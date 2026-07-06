"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { getAdminContext } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendCustomerCancelledNotice } from "@/lib/email";
import { normalizePhone } from "@/lib/phone";
import { fromMinutes, toMinutes } from "@/lib/booking/slots";
import { nowInZone, zonedToUtc } from "@/lib/booking/timezone";
import {
  addDaysISO,
  mondayOf,
  resolveWindow,
  type WorkWindow,
} from "@/lib/booking/schedule";
import QRCode from "qrcode";
import { buildIpsQr, PLANS, type PlanId } from "@/lib/invoice";
import type {
  BookingStatus,
  OnboardingState,
  ScheduleActionResult,
  ScheduleConflict,
  Staff,
  WorkingHours,
} from "@/lib/types";

// Sve admin akcije koriste session klijent - RLS propušta samo redove
// salona čiji je korisnik član, pa tenant_id sa klijenta ne primamo nigde.

type ActionResult = { ok: boolean; error?: string };

export async function updateBookingStatus(
  bookingId: string,
  status: BookingStatus
): Promise<ActionResult> {
  const { tenant } = await getAdminContext();
  const supabase = await createClient();

  // Stanje pre izmene: za obaveštenje klijentu kad salon otkazuje
  const { data: before } = await supabase
    .from("bookings")
    .select("status, date, start_time, customer_email, services(name), staff(name)")
    .eq("id", bookingId)
    .maybeSingle();

  const { error } = await supabase
    .from("bookings")
    .update({ status })
    .eq("id", bookingId);
  if (error) return { ok: false, error: "Izmena nije uspela." };

  // Salon otkazuje termin: klijent koji je ostavio email saznaje odmah,
  // sa linkom za novo zakazivanje. Mejl nikad ne obara izmenu statusa.
  if (
    status === "cancelled" &&
    before?.customer_email &&
    ["pending", "confirmed"].includes(before.status)
  ) {
    const { data: settings } = await supabase
      .from("site_settings")
      .select("phone")
      .eq("tenant_id", tenant.id)
      .maybeSingle();
    const hdrs = await headers();
    const proto = hdrs.get("x-forwarded-proto") ?? "http";
    const host = hdrs.get("host") ?? "localhost:3000";
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? `${proto}://${host}`;
    await sendCustomerCancelledNotice({
      to: before.customer_email,
      salonName: tenant.name,
      serviceName:
        (before.services as unknown as { name: string } | null)?.name ?? "Usluga",
      staffName: (before.staff as unknown as { name: string } | null)?.name ?? "",
      date: before.date,
      startTime: before.start_time.slice(0, 5),
      salonPhone: settings?.phone ?? null,
      bookingUrl: `${baseUrl}/${tenant.slug}/zakazi`,
    });
  }

  // Status se vidi i u kalendaru i u statistici na Početnoj
  revalidatePath("/admin/rezervacije");
  revalidatePath("/admin/kalendar");
  revalidatePath("/admin");
  return { ok: true };
}

const serviceSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1, "Unesi naziv usluge.").max(100),
  description: z.string().trim().max(300).optional(),
  durationMinutes: z.coerce.number().int().min(5).max(480),
  price: z.coerce.number().min(0),
  isActive: z.boolean(),
});

export async function upsertService(
  input: z.infer<typeof serviceSchema>
): Promise<ActionResult> {
  const parsed = serviceSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Neispravni podaci." };
  }
  const { tenant } = await getAdminContext();
  const supabase = await createClient();

  const row = {
    tenant_id: tenant.id,
    name: parsed.data.name,
    description: parsed.data.description || null,
    duration_minutes: parsed.data.durationMinutes,
    price: parsed.data.price,
    is_active: parsed.data.isActive,
  };

  const { data: service, error } = parsed.data.id
    ? await supabase.from("services").update(row).eq("id", parsed.data.id).select("id").single()
    : await supabase.from("services").insert(row).select("id").single();

  if (error) return { ok: false, error: "Čuvanje nije uspelo." };

  // Nova usluga se podrazumevano dodeljuje svim zaposlenima
  if (!parsed.data.id) {
    const { data: staff } = await supabase
      .from("staff")
      .select("id")
      .eq("tenant_id", tenant.id);
    if (staff && staff.length > 0) {
      await supabase.from("staff_services").insert(
        staff.map((s) => ({
          tenant_id: tenant.id,
          staff_id: s.id,
          service_id: service.id,
        }))
      );
    }
  }

  revalidatePath("/admin/usluge");
  return { ok: true };
}

export async function deleteService(id: string): Promise<ActionResult> {
  await getAdminContext();
  const supabase = await createClient();
  const { error } = await supabase.from("services").delete().eq("id", id);
  if (error) {
    // 23503 = FK sa bookings - usluga ima istoriju, samo je deaktiviraj
    if (error.code === "23503") {
      await supabase.from("services").update({ is_active: false }).eq("id", id);
      revalidatePath("/admin/usluge");
      return { ok: true };
    }
    return { ok: false, error: "Brisanje nije uspelo." };
  }
  revalidatePath("/admin/usluge");
  return { ok: true };
}

const staffSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1, "Unesi ime.").max(100),
  bio: z.string().trim().max(300).optional(),
  isActive: z.boolean(),
});

// Vraća id kod kreiranja da klijent odvede vlasnika pravo na stranicu
// zaposlenog (usluge, radno vreme, fotografija)
export async function upsertStaff(
  input: z.infer<typeof staffSchema>
): Promise<ActionResult & { id?: string }> {
  const parsed = staffSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Neispravni podaci." };
  }
  const { tenant } = await getAdminContext();
  const supabase = await createClient();

  const row = {
    tenant_id: tenant.id,
    name: parsed.data.name,
    bio: parsed.data.bio || null,
    is_active: parsed.data.isActive,
  };

  if (parsed.data.id) {
    const { error } = await supabase.from("staff").update(row).eq("id", parsed.data.id);
    if (error) return { ok: false, error: "Čuvanje nije uspelo." };
  } else {
    const { data: member, error } = await supabase
      .from("staff")
      .insert(row)
      .select("id")
      .single();
    if (error) return { ok: false, error: "Čuvanje nije uspelo." };

    // Podrazumevano: radi sve usluge, pon–sub 09–20 (menja se u Zaposleni)
    const { data: services } = await supabase
      .from("services")
      .select("id")
      .eq("tenant_id", tenant.id);
    await Promise.all([
      services && services.length > 0
        ? supabase.from("staff_services").insert(
            services.map((s) => ({
              tenant_id: tenant.id,
              staff_id: member.id,
              service_id: s.id,
            }))
          )
        : Promise.resolve(),
      supabase.from("working_hours").insert(
        Array.from({ length: 7 }, (_, dow) => ({
          tenant_id: tenant.id,
          staff_id: member.id,
          day_of_week: dow,
          start_time: "09:00",
          end_time: "20:00",
          is_working: dow !== 0,
        }))
      ),
    ]);

    revalidatePath("/admin/zaposleni");
    return { ok: true, id: member.id };
  }

  revalidatePath("/admin/zaposleni");
  return { ok: true };
}

export async function deleteStaff(id: string): Promise<ActionResult> {
  await getAdminContext();
  const supabase = await createClient();
  const { error } = await supabase.from("staff").delete().eq("id", id);
  if (error) {
    if (error.code === "23503") {
      await supabase.from("staff").update({ is_active: false }).eq("id", id);
      revalidatePath("/admin/zaposleni");
      return { ok: true };
    }
    return { ok: false, error: "Brisanje nije uspelo." };
  }
  revalidatePath("/admin/zaposleni");
  return { ok: true };
}

export async function updateStaffServices(
  staffId: string,
  serviceIds: string[]
): Promise<ActionResult> {
  const { tenant } = await getAdminContext();
  const supabase = await createClient();

  // Prihvati samo usluge koje stvarno pripadaju ovom salonu
  const { data: valid } = await supabase
    .from("services")
    .select("id")
    .eq("tenant_id", tenant.id)
    .in("id", serviceIds.length > 0 ? serviceIds : ["00000000-0000-0000-0000-000000000000"]);
  const validIds = (valid ?? []).map((s) => s.id);

  const { error: delError } = await supabase
    .from("staff_services")
    .delete()
    .eq("staff_id", staffId);
  if (delError) return { ok: false, error: "Čuvanje nije uspelo." };

  if (validIds.length > 0) {
    const { error } = await supabase.from("staff_services").insert(
      validIds.map((serviceId) => ({
        tenant_id: tenant.id,
        staff_id: staffId,
        service_id: serviceId,
      }))
    );
    if (error) return { ok: false, error: "Čuvanje nije uspelo." };
  }

  revalidatePath(`/admin/zaposleni/${staffId}`);
  revalidatePath(`/${tenant.slug}`);
  return { ok: true };
}

// ---------- Vodič za pokretanje ----------

const onboardingSchema = z.object({
  welcomeSeen: z.boolean().optional(),
  guideHidden: z.boolean().optional(),
  scheduleConfirmed: z.boolean().optional(),
  rasporedSeen: z.boolean().optional(),
});

// Spoji flagove u site_settings.onboarding; preskače upis kad se ništa
// ne menja (poziva se i uzgred, npr. iz čuvanja radnog vremena)
async function mergeOnboarding(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tenantId: string,
  patch: Partial<OnboardingState>
): Promise<boolean> {
  const { data: row } = await supabase
    .from("site_settings")
    .select("onboarding")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  const current = (row?.onboarding ?? {}) as OnboardingState;
  const entries = Object.entries(patch) as [keyof OnboardingState, boolean][];
  if (entries.every(([k, v]) => current[k] === v)) return true;

  const { error } = await supabase
    .from("site_settings")
    .update({ onboarding: { ...current, ...patch } })
    .eq("tenant_id", tenantId);
  return !error;
}

export async function updateOnboarding(
  input: z.infer<typeof onboardingSchema>
): Promise<ActionResult> {
  const parsed = onboardingSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Neispravni podaci." };
  const { tenant } = await getAdminContext();
  const supabase = await createClient();

  const patch: Partial<OnboardingState> = {};
  if (parsed.data.welcomeSeen !== undefined) patch.welcome_seen = parsed.data.welcomeSeen;
  if (parsed.data.guideHidden !== undefined) patch.guide_hidden = parsed.data.guideHidden;
  if (parsed.data.scheduleConfirmed !== undefined)
    patch.schedule_confirmed = parsed.data.scheduleConfirmed;
  if (parsed.data.rasporedSeen !== undefined) patch.raspored_seen = parsed.data.rasporedSeen;

  const ok = await mergeOnboarding(supabase, tenant.id, patch);
  if (!ok) return { ok: false, error: "Čuvanje nije uspelo." };

  revalidatePath("/admin");
  revalidatePath("/admin/raspored");
  return { ok: true };
}

// Tipičan cenovnik za start - vlasnik menja cene/trajanja umesto da kreće
// od praznog ekrana. Ubacuje se SAMO u prazan cenovnik.
const SAMPLE_SERVICES = [
  { name: "Muško šišanje", duration_minutes: 30, price: 700 },
  { name: "Žensko šišanje", duration_minutes: 45, price: 1200 },
  { name: "Dečije šišanje", duration_minutes: 20, price: 500 },
  { name: "Feniranje", duration_minutes: 30, price: 800 },
  { name: "Farbanje", duration_minutes: 90, price: 3500 },
  { name: "Pramenovi", duration_minutes: 120, price: 4500 },
  { name: "Oblikovanje brade", duration_minutes: 20, price: 400 },
  { name: "Šišanje + brada", duration_minutes: 45, price: 1000 },
];

export async function insertSampleServices(): Promise<ActionResult> {
  const { tenant } = await getAdminContext();
  const supabase = await createClient();

  const { count } = await supabase
    .from("services")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenant.id);
  if ((count ?? 0) > 0) {
    return { ok: false, error: "Cenovnik nije prazan - primeri se ne ubacuju preko postojećih usluga." };
  }

  const { data: inserted, error } = await supabase
    .from("services")
    .insert(SAMPLE_SERVICES.map((s, i) => ({ tenant_id: tenant.id, sort_order: i, ...s })))
    .select("id");
  if (error || !inserted) return { ok: false, error: "Ubacivanje nije uspelo." };

  // Kao i kod ručnog dodavanja: nova usluga se dodeljuje svim zaposlenima
  const { data: staff } = await supabase
    .from("staff")
    .select("id")
    .eq("tenant_id", tenant.id);
  if (staff && staff.length > 0) {
    await supabase.from("staff_services").insert(
      staff.flatMap((m) =>
        inserted.map((s) => ({
          tenant_id: tenant.id,
          staff_id: m.id,
          service_id: s.id,
        }))
      )
    );
  }

  revalidatePath("/admin/usluge");
  revalidatePath("/admin");
  return { ok: true };
}

// ---------- Raspored: pravilo (nedeljno / smene A/B) + izuzeci po datumu ----------

type ConflictBooking = {
  staff_id: string;
  date: string;
  start_time: string;
  end_time: string;
  customer_name: string;
  services: { name: string } | null;
};

async function activeBookings(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tenantId: string,
  staffIds: string[],
  from: string,
  to?: string,
  // Termini koji su se danas već završili nisu konflikt za novo radno
  // vreme - bez ovoga bi izmena rasporeda u 18h prijavila jutrošnji termin
  endedCutoff?: { date: string; time: string }
): Promise<ConflictBooking[]> {
  let q = supabase
    .from("bookings")
    .select("staff_id, date, start_time, end_time, customer_name, services(name)")
    .eq("tenant_id", tenantId)
    .in("staff_id", staffIds)
    .in("status", ["pending", "confirmed"])
    .gte("date", from)
    .order("date")
    .order("start_time");
  if (to) q = q.lte("date", to);
  const { data } = await q;
  const rows = (data ?? []) as unknown as ConflictBooking[];
  if (!endedCutoff) return rows;
  return rows.filter(
    (b) =>
      !(b.date === endedCutoff.date && b.end_time.slice(0, 5) <= endedCutoff.time)
  );
}

function isOutsideWindow(b: ConflictBooking, window: WorkWindow): boolean {
  if (!window) return true;
  return b.start_time.slice(0, 5) < window.start || b.end_time.slice(0, 5) > window.end;
}

function toConflict(b: ConflictBooking, staffName: string): ScheduleConflict {
  return {
    staff_name: staffName,
    date: b.date,
    start_time: b.start_time.slice(0, 5),
    end_time: b.end_time.slice(0, 5),
    customer_name: b.customer_name,
    service_name: b.services?.name ?? null,
  };
}

const dayRowSchema = z
  .object({
    dayOfWeek: z.number().int().min(0).max(6),
    isWorking: z.boolean(),
    startTime: z.string().regex(/^\d{2}:\d{2}$/),
    endTime: z.string().regex(/^\d{2}:\d{2}$/),
  })
  .refine((d) => !d.isWorking || d.startTime < d.endTime, {
    message: "Početak mora biti pre kraja radnog vremena.",
  });

const staffScheduleSchema = z
  .object({
    staffId: z.string().min(1),
    mode: z.enum(["weekly", "rotating"]),
    // Kod rotacije: da li je TEKUĆA nedelja A (0) ili B (1) - iz toga se
    // računa rotation_anchor, pa rotacija dalje teče sama
    thisWeekParity: z.union([z.literal(0), z.literal(1)]).optional(),
    weekA: z.array(dayRowSchema).length(7),
    weekB: z.array(dayRowSchema).length(7).optional(),
    force: z.boolean().optional(),
  })
  .refine((d) => d.mode !== "rotating" || (d.weekB && d.thisWeekParity !== undefined), {
    message: "Za smene A/B unesi obe nedelje.",
  });

export async function updateStaffSchedule(
  input: z.infer<typeof staffScheduleSchema>
): Promise<ScheduleActionResult> {
  const parsed = staffScheduleSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Neispravni podaci." };
  }
  const { tenant } = await getAdminContext();
  const supabase = await createClient();
  const { staffId, mode, thisWeekParity, weekA, weekB, force } = parsed.data;

  const { data: staffRow } = await supabase
    .from("staff")
    .select("*")
    .eq("id", staffId)
    .eq("tenant_id", tenant.id)
    .maybeSingle();
  if (!staffRow) return { ok: false, error: "Zaposleni nije pronađen." };

  const now = nowInZone(tenant.timezone);
  const today = now.date;
  const anchor =
    mode === "rotating"
      ? thisWeekParity === 1
        ? addDaysISO(mondayOf(today), -7)
        : mondayOf(today)
      : null;

  const toRows = (days: z.infer<typeof dayRowSchema>[], parity: 0 | 1) =>
    days.map((h) => ({
      tenant_id: tenant.id,
      staff_id: staffId,
      day_of_week: h.dayOfWeek,
      week_parity: parity,
      start_time: h.startTime,
      end_time: h.endTime,
      is_working: h.isWorking,
    }));
  const rows = [...toRows(weekA, 0), ...(mode === "rotating" ? toRows(weekB!, 1) : [])];

  if (!force) {
    // Buduće rezervacije koje bi novo pravilo ostavilo van radnog vremena;
    // datumi sa izuzetkom se preskaču - njih pravilo ne dira
    const bookings = await activeBookings(supabase, tenant.id, [staffId], today, undefined, {
      date: today,
      time: fromMinutes(now.minutes),
    });
    if (bookings.length > 0) {
      const { data: exceptions } = await supabase
        .from("shift_assignments")
        .select("date")
        .eq("staff_id", staffId)
        .gte("date", today);
      const exceptionDates = new Set((exceptions ?? []).map((e) => e.date));
      const nextStaff: Staff = {
        ...(staffRow as Staff),
        schedule_mode: mode,
        rotation_anchor: anchor,
      };
      const nextHours: WorkingHours[] = rows.map((r) => ({ ...r, id: "" }));
      const conflicts = bookings
        .filter(
          (b) =>
            !exceptionDates.has(b.date) &&
            isOutsideWindow(b, resolveWindow(b.date, nextStaff, nextHours, null))
        )
        .map((b) => toConflict(b, (staffRow as Staff).name));
      if (conflicts.length > 0) return { ok: false, conflicts };
    }
  }

  const { error } = await supabase
    .from("working_hours")
    .upsert(rows, { onConflict: "staff_id,day_of_week,week_parity" });
  if (error) return { ok: false, error: "Čuvanje nije uspelo." };

  const { error: staffError } = await supabase
    .from("staff")
    .update({ schedule_mode: mode, rotation_anchor: anchor })
    .eq("id", staffId);
  if (staffError) return { ok: false, error: "Čuvanje nije uspelo." };

  // Vlasnik je svesno sačuvao radno vreme - to štiklira korak vodiča
  await mergeOnboarding(supabase, tenant.id, { schedule_confirmed: true });

  revalidatePath(`/admin/zaposleni/${staffId}`);
  revalidatePath("/admin/raspored");
  revalidatePath("/admin");
  return { ok: true };
}

const exceptionSchema = z
  .object({
    staffId: z.string().min(1),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    // "custom" = radi drugačije taj dan, "off" = ne radi, "clear" = vrati pravilo
    kind: z.enum(["custom", "off", "clear"]),
    startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    force: z.boolean().optional(),
  })
  .refine(
    (d) => d.kind !== "custom" || (d.startTime && d.endTime && d.startTime < d.endTime),
    { message: "Početak mora biti pre kraja." }
  );

export async function setScheduleException(
  input: z.infer<typeof exceptionSchema>
): Promise<ScheduleActionResult> {
  const parsed = exceptionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Neispravni podaci." };
  }
  const { tenant } = await getAdminContext();
  const supabase = await createClient();
  const { staffId, date, kind, startTime, endTime, force } = parsed.data;

  const { data: staffRow } = await supabase
    .from("staff")
    .select("*")
    .eq("id", staffId)
    .eq("tenant_id", tenant.id)
    .maybeSingle();
  if (!staffRow) return { ok: false, error: "Zaposleni nije pronađen." };

  let window: WorkWindow = null;
  if (kind === "custom") {
    window = { start: startTime!, end: endTime! };
  } else if (kind === "clear") {
    // Povratak na pravilo: okno koje bi važilo bez izuzetka
    const { data: hours } = await supabase
      .from("working_hours")
      .select("*")
      .eq("staff_id", staffId);
    window = resolveWindow(date, staffRow as Staff, (hours ?? []) as WorkingHours[], null);
  }

  if (!force) {
    const now = nowInZone(tenant.timezone);
    const bookings = await activeBookings(supabase, tenant.id, [staffId], date, date, {
      date: now.date,
      time: fromMinutes(now.minutes),
    });
    const conflicts = bookings
      .filter((b) => isOutsideWindow(b, window))
      .map((b) => toConflict(b, (staffRow as Staff).name));
    if (conflicts.length > 0) return { ok: false, conflicts };
  }

  if (kind === "clear") {
    const { error } = await supabase
      .from("shift_assignments")
      .delete()
      .eq("staff_id", staffId)
      .eq("date", date);
    if (error) return { ok: false, error: "Izmena nije uspela." };
  } else {
    const { error } = await supabase.from("shift_assignments").upsert(
      {
        tenant_id: tenant.id,
        staff_id: staffId,
        date,
        is_off: kind === "off",
        start_time: kind === "custom" ? startTime : null,
        end_time: kind === "custom" ? endTime : null,
      },
      { onConflict: "staff_id,date" }
    );
    if (error) return { ok: false, error: "Izmena nije uspela." };
  }

  revalidatePath("/admin/raspored");
  return { ok: true };
}

const absenceSchema = z
  .object({
    staffIds: z.array(z.string().min(1)).min(1, "Izaberi bar jednog zaposlenog."),
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    force: z.boolean().optional(),
  })
  .refine((d) => d.from <= d.to, { message: "Datum 'od' mora biti pre 'do'." });

export async function createAbsence(
  input: z.infer<typeof absenceSchema>
): Promise<ScheduleActionResult> {
  const parsed = absenceSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Neispravni podaci." };
  }
  const { tenant } = await getAdminContext();
  const supabase = await createClient();
  const { staffIds, from, to, force } = parsed.data;

  const dates: string[] = [];
  for (let d = from; d <= to; d = addDaysISO(d, 1)) {
    dates.push(d);
    if (dates.length > 92) return { ok: false, error: "Opseg je predugačak (najviše 3 meseca)." };
  }

  const { data: staffRows } = await supabase
    .from("staff")
    .select("id, name")
    .eq("tenant_id", tenant.id)
    .in("id", staffIds);
  if (!staffRows || staffRows.length !== staffIds.length) {
    return { ok: false, error: "Zaposleni nije pronađen." };
  }
  const nameById = new Map(staffRows.map((s) => [s.id, s.name]));

  if (!force) {
    const now = nowInZone(tenant.timezone);
    const bookings = await activeBookings(supabase, tenant.id, staffIds, from, to, {
      date: now.date,
      time: fromMinutes(now.minutes),
    });
    const conflicts = bookings.map((b) => toConflict(b, nameById.get(b.staff_id) ?? ""));
    if (conflicts.length > 0) return { ok: false, conflicts };
  }

  const rows = staffIds.flatMap((staffId) =>
    dates.map((date) => ({
      tenant_id: tenant.id,
      staff_id: staffId,
      date,
      is_off: true,
      start_time: null,
      end_time: null,
    }))
  );
  const { error } = await supabase
    .from("shift_assignments")
    .upsert(rows, { onConflict: "staff_id,date" });
  if (error) return { ok: false, error: "Upis nije uspeo." };

  revalidatePath("/admin/raspored");
  return { ok: true };
}

const adminBookingSchema = z.object({
  serviceId: z.string().min(1),
  staffId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  customerName: z.string().trim().min(2, "Unesi ime klijenta.").max(100),
  customerPhone: z
    .string()
    .trim()
    .regex(/^\+?[0-9 /-]{6,20}$/, "Unesi ispravan broj telefona."),
  note: z.string().trim().max(500).optional(),
});

// Ručno zakazivanje za klijente koji zovu telefonom. Namerno ne proverava
// radno vreme/smene - salon zna šta radi; jedino preklapanje termina brani baza.
export async function adminCreateBooking(
  input: z.infer<typeof adminBookingSchema>
): Promise<ActionResult> {
  const parsed = adminBookingSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Neispravni podaci." };
  }
  const { tenant } = await getAdminContext();
  const supabase = await createClient();
  const d = parsed.data;

  const [serviceRes, staffRes] = await Promise.all([
    supabase
      .from("services")
      .select("id, duration_minutes")
      .eq("id", d.serviceId)
      .eq("tenant_id", tenant.id)
      .maybeSingle(),
    supabase
      .from("staff")
      .select("id")
      .eq("id", d.staffId)
      .eq("tenant_id", tenant.id)
      .maybeSingle(),
  ]);
  if (!serviceRes.data || !staffRes.data) {
    return { ok: false, error: "Usluga ili zaposleni nisu pronađeni." };
  }

  // Termin mora da se završi istog dana - "25:00" nije vreme, a upis bi pukao
  const endMinutes = toMinutes(d.time) + serviceRes.data.duration_minutes;
  if (endMinutes > 24 * 60) {
    return {
      ok: false,
      error: "Termin bi trajao preko ponoći - pomeri početak ranije.",
    };
  }
  const endTime = fromMinutes(endMinutes);

  // Isti kanonski oblik telefona kao kod online zakazivanja - da telefonski
  // klijent ne postane duplikat u evidenciji
  const phone = normalizePhone(d.customerPhone);

  const { data: customer } = await supabase
    .from("customers")
    .upsert(
      { tenant_id: tenant.id, name: d.customerName, phone },
      { onConflict: "tenant_id,phone" }
    )
    .select("id")
    .maybeSingle();

  const { error } = await supabase.from("bookings").insert({
    tenant_id: tenant.id,
    staff_id: d.staffId,
    service_id: d.serviceId,
    customer_id: customer?.id ?? null,
    customer_name: d.customerName,
    customer_phone: phone,
    date: d.date,
    start_time: d.time,
    end_time: endTime,
    starts_at: zonedToUtc(d.date, d.time, tenant.timezone).toISOString(),
    ends_at: zonedToUtc(d.date, endTime, tenant.timezone).toISOString(),
    note: d.note || null,
    status: "confirmed",
  });

  if (error) {
    if (error.code === "23P01") {
      return { ok: false, error: "Termin se preklapa sa postojećom rezervacijom." };
    }
    return { ok: false, error: "Zakazivanje nije uspelo." };
  }

  revalidatePath("/admin/kalendar");
  revalidatePath("/admin/rezervacije");
  return { ok: true };
}

const blockedSlotSchema = z
  .object({
    staffId: z.string().optional(), // undefined/"" = ceo salon
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    startTime: z.string().regex(/^\d{2}:\d{2}$/),
    endTime: z.string().regex(/^\d{2}:\d{2}$/),
    reason: z.string().trim().max(200).optional(),
    force: z.boolean().optional(),
  })
  .refine((d) => d.startTime < d.endTime, {
    message: "Početak mora biti pre kraja.",
  });

export async function createBlockedSlot(
  input: z.infer<typeof blockedSlotSchema>
): Promise<ScheduleActionResult> {
  const parsed = blockedSlotSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Neispravni podaci." };
  }
  const { tenant } = await getAdminContext();
  const supabase = await createClient();
  const d = parsed.data;

  // Blokada preko postojeće rezervacije: vlasnik mora svesno da odluči
  // (isti obrazac kao izmene rasporeda - lista konflikata + force)
  if (!d.force) {
    let q = supabase
      .from("bookings")
      .select("staff_id, date, start_time, end_time, customer_name, services(name), staff(name)")
      .eq("tenant_id", tenant.id)
      .eq("date", d.date)
      .in("status", ["pending", "confirmed"])
      .lt("start_time", d.endTime)
      .gt("end_time", d.startTime)
      .order("start_time");
    if (d.staffId) q = q.eq("staff_id", d.staffId);
    const { data: overlapping } = await q;
    const conflicts: ScheduleConflict[] = (
      (overlapping ?? []) as unknown as (ConflictBooking & {
        staff: { name: string } | null;
      })[]
    ).map((b) => toConflict(b, b.staff?.name ?? ""));
    if (conflicts.length > 0) return { ok: false, conflicts };
  }

  const { error } = await supabase.from("blocked_slots").insert({
    tenant_id: tenant.id,
    staff_id: d.staffId || null,
    date: d.date,
    start_time: d.startTime,
    end_time: d.endTime,
    reason: d.reason || null,
  });
  if (error) return { ok: false, error: "Blokiranje nije uspelo." };

  revalidatePath("/admin/kalendar");
  return { ok: true };
}

export async function deleteBlockedSlot(id: string): Promise<ActionResult> {
  await getAdminContext();
  const supabase = await createClient();
  const { error } = await supabase.from("blocked_slots").delete().eq("id", id);
  if (error) return { ok: false, error: "Brisanje nije uspelo." };
  revalidatePath("/admin/kalendar");
  return { ok: true };
}

// Zamenjen/uklonjen fajl se počisti iz storage-a (best effort - red u bazi
// je već ažuriran, zaostao fajl nije kritičan)
async function removeStorageFile(
  supabase: Awaited<ReturnType<typeof createClient>>,
  url: string | null | undefined,
  keepUrl: string | null
) {
  if (!url || url === keepUrl) return;
  const path = url.split("/tenant-media/")[1];
  if (path) await supabase.storage.from("tenant-media").remove([path]);
}

export async function updateStaffPhoto(
  staffId: string,
  photoUrl: string | null
): Promise<ActionResult> {
  const { tenant } = await getAdminContext();
  const supabase = await createClient();

  // Prihvati samo URL iz našeg storage-a, u folderu ovog salona
  if (photoUrl !== null) {
    const expectedPrefix = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/tenant-media/${tenant.id}/`;
    if (!photoUrl.startsWith(expectedPrefix)) {
      return { ok: false, error: "Neispravna adresa slike." };
    }
  }

  const { data: current } = await supabase
    .from("staff")
    .select("photo_url")
    .eq("id", staffId)
    .maybeSingle();

  const { error } = await supabase
    .from("staff")
    .update({ photo_url: photoUrl })
    .eq("id", staffId);
  if (error) return { ok: false, error: "Čuvanje nije uspelo." };

  await removeStorageFile(supabase, current?.photo_url, photoUrl);

  revalidatePath(`/admin/zaposleni/${staffId}`);
  revalidatePath("/admin/zaposleni");
  revalidatePath(`/${tenant.slug}`);
  return { ok: true };
}

const appearanceSchema = z.object({
  primaryColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Neispravna boja.")
    .optional(),
  fontPair: z.enum(["geist", "elegant", "modern", "warm", "classic"]).optional(),
  mode: z.enum(["light", "dark"]).optional(),
  buttonStyle: z.enum(["rounded", "pill", "square"]).optional(),
});

export async function updateAppearance(
  input: z.infer<typeof appearanceSchema>
): Promise<ActionResult> {
  const parsed = appearanceSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Neispravni podaci." };
  }
  const { tenant } = await getAdminContext();
  const supabase = await createClient();

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (parsed.data.primaryColor) patch.primary_color = parsed.data.primaryColor;

  if (parsed.data.fontPair || parsed.data.mode || parsed.data.buttonStyle) {
    const { data: current } = await supabase
      .from("site_settings")
      .select("theme")
      .eq("tenant_id", tenant.id)
      .maybeSingle();
    patch.theme = {
      ...((current?.theme as object) ?? {}),
      ...(parsed.data.fontPair ? { font_pair: parsed.data.fontPair } : {}),
      ...(parsed.data.mode ? { mode: parsed.data.mode } : {}),
      ...(parsed.data.buttonStyle ? { button_style: parsed.data.buttonStyle } : {}),
    };
  }

  const { error } = await supabase
    .from("site_settings")
    .update(patch)
    .eq("tenant_id", tenant.id);
  if (error) return { ok: false, error: "Čuvanje nije uspelo." };
  revalidatePath("/admin/podesavanja");
  revalidatePath(`/${tenant.slug}`);
  return { ok: true };
}

export async function updateSiteImage(
  kind: "logo" | "hero",
  url: string | null
): Promise<ActionResult> {
  const { tenant } = await getAdminContext();
  const supabase = await createClient();

  if (url !== null) {
    const expectedPrefix = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/tenant-media/${tenant.id}/`;
    if (!url.startsWith(expectedPrefix)) {
      return { ok: false, error: "Neispravna adresa slike." };
    }
  }

  const column = kind === "logo" ? "logo_url" : "hero_image_url";
  const { data: current } = await supabase
    .from("site_settings")
    .select(column)
    .eq("tenant_id", tenant.id)
    .maybeSingle();

  const { error } = await supabase
    .from("site_settings")
    .update({ [column]: url, updated_at: new Date().toISOString() })
    .eq("tenant_id", tenant.id);
  if (error) return { ok: false, error: "Čuvanje nije uspelo." };

  await removeStorageFile(
    supabase,
    (current as Record<string, string | null> | null)?.[column],
    url
  );

  revalidatePath("/admin/podesavanja");
  revalidatePath(`/${tenant.slug}`);
  return { ok: true };
}

export async function addGalleryImage(url: string): Promise<ActionResult> {
  const { tenant } = await getAdminContext();
  const supabase = await createClient();

  const expectedPrefix = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/tenant-media/${tenant.id}/`;
  if (!url.startsWith(expectedPrefix)) {
    return { ok: false, error: "Neispravna adresa slike." };
  }

  const { error } = await supabase
    .from("gallery")
    .insert({ tenant_id: tenant.id, image_url: url });
  if (error) return { ok: false, error: "Čuvanje nije uspelo." };

  revalidatePath("/admin/galerija");
  revalidatePath(`/${tenant.slug}`);
  return { ok: true };
}

export async function deleteGalleryImage(id: string): Promise<ActionResult> {
  const { tenant } = await getAdminContext();
  const supabase = await createClient();

  const { data: row } = await supabase
    .from("gallery")
    .select("image_url")
    .eq("id", id)
    .maybeSingle();

  const { error } = await supabase.from("gallery").delete().eq("id", id);
  if (error) return { ok: false, error: "Brisanje nije uspelo." };

  // Počisti i fajl iz storage-a (ako ne uspe, red je već obrisan - nije kritično)
  const path = row?.image_url?.split("/tenant-media/")[1];
  if (path) await supabase.storage.from("tenant-media").remove([path]);

  revalidatePath("/admin/galerija");
  revalidatePath(`/${tenant.slug}`);
  return { ok: true };
}

// ---------- Redosled usluga i galerije (strelice gore/dole) ----------

// Permisivni uuid (kao u booking akcijama) - Zodov .uuid() odbija seed
// ID-jeve koji nisu RFC 4122
const moveSchema = z.object({
  id: z
    .string()
    .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i),
  direction: z.enum(["up", "down"]),
});

// Zameni mesto sa susedom pa preupiši sort_order 0..n-1 za sve redove -
// početno su svi na default 0, pa sam swap ne bi bio dovoljan
async function moveRow(
  table: "services" | "gallery",
  input: z.infer<typeof moveSchema>,
  adminPath: string
): Promise<ActionResult> {
  const parsed = moveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Neispravni podaci." };
  const { tenant } = await getAdminContext();
  const supabase = await createClient();

  // Isti redosled kao na stranicama (sort_order, pa created_at)
  const { data: rows } = await supabase
    .from(table)
    .select("id")
    .eq("tenant_id", tenant.id)
    .order("sort_order")
    .order("created_at");
  const ids = (rows ?? []).map((r) => r.id as string);
  const idx = ids.indexOf(parsed.data.id);
  if (idx === -1) return { ok: false, error: "Stavka nije pronađena." };
  const swapWith = parsed.data.direction === "up" ? idx - 1 : idx + 1;
  if (swapWith < 0 || swapWith >= ids.length) return { ok: true }; // već na kraju

  [ids[idx], ids[swapWith]] = [ids[swapWith], ids[idx]];
  const results = await Promise.all(
    ids.map((rowId, i) =>
      supabase.from(table).update({ sort_order: i }).eq("id", rowId)
    )
  );
  if (results.some((r) => r.error)) {
    return { ok: false, error: "Čuvanje nije uspelo." };
  }

  revalidatePath(adminPath);
  revalidatePath(`/${tenant.slug}`);
  return { ok: true };
}

export async function moveService(
  id: string,
  direction: "up" | "down"
): Promise<ActionResult> {
  return moveRow("services", { id, direction }, "/admin/usluge");
}

export async function moveGalleryImage(
  id: string,
  direction: "up" | "down"
): Promise<ActionResult> {
  return moveRow("gallery", { id, direction }, "/admin/galerija");
}

export async function updateBillingInfo(info: string): Promise<ActionResult> {
  const parsed = z.string().trim().max(500).safeParse(info);
  if (!parsed.success) return { ok: false, error: "Neispravni podaci." };

  const { tenant } = await getAdminContext();
  const supabase = await createClient();
  const { error } = await supabase
    .from("tenants")
    .update({ billing_note: parsed.data || null })
    .eq("id", tenant.id);
  if (error) return { ok: false, error: "Čuvanje nije uspelo." };
  revalidatePath("/admin/podesavanja");
  return { ok: true };
}

function addMonths(dateStr: string, months: number): string {
  const d = new Date(`${dateStr}T12:00:00`);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  // Klamp na poslednji dan ciljanog meseca: 31.1. + 1 mesec = 28.2, ne 3.3.
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, lastDay));
  return d.toISOString().slice(0, 10);
}

// Samoposlužna faktura: kreira (ili ponovo koristi) fakturu za naredni
// period. Numeracija je globalna po godini pa ide preko service-role klijenta;
// članstvo je već potvrđeno kroz getAdminContext.
export async function createInvoice(
  plan: PlanId
): Promise<{ ok: true; invoiceId: string } | { ok: false; error: string }> {
  if (!(plan in PLANS)) return { ok: false, error: "Nepoznat plan." };
  const { tenant } = await getAdminContext();

  // Faktura mora imati kupca - bez podataka nema izdavanja
  if (!tenant.billing_note?.trim()) {
    return {
      ok: false,
      error: "Prvo upiši podatke za fakturu (naziv i adresa), pa izdaj fakturu.",
    };
  }

  const db = createAdminClient();

  // Period počinje danas, ili dan posle postojećeg isteka ako je još plaćen
  const today = new Date().toISOString().slice(0, 10);
  const periodFrom =
    tenant.paid_until && tenant.paid_until >= today
      ? new Date(new Date(`${tenant.paid_until}T12:00:00`).getTime() + 86400000)
          .toISOString()
          .slice(0, 10)
      : today;
  const periodTo = addMonths(periodFrom, PLANS[plan].months);

  // Ako već postoji aktivna faktura za isti plan i period, ne izdaji novu
  // (stornirane se ignorišu - za njih sme nova)
  const { data: existing } = await db
    .from("invoices")
    .select("id")
    .eq("tenant_id", tenant.id)
    .eq("plan", plan)
    .eq("period_from", periodFrom)
    .neq("status", "cancelled")
    .limit(1)
    .maybeSingle();
  if (existing) return { ok: true, invoiceId: existing.id };

  const year = new Date().getFullYear();
  const { data: maxRow } = await db
    .from("invoices")
    .select("number")
    .eq("year", year)
    .order("number", { ascending: false })
    .limit(1)
    .maybeSingle();
  let nextNumber = (maxRow?.number ?? 0) + 1;

  // Retry na sudar numeracije (paralelno izdavanje)
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data: created, error } = await db
      .from("invoices")
      .insert({
        tenant_id: tenant.id,
        number: nextNumber,
        year,
        plan,
        amount: PLANS[plan].amount,
        period_from: periodFrom,
        period_to: periodTo,
        buyer_info: tenant.billing_note || tenant.name,
      })
      .select("id")
      .single();
    if (!error) {
      revalidatePath("/admin/podesavanja");
      return { ok: true, invoiceId: created.id };
    }
    if (error.code === "23505") {
      nextNumber += 1;
      continue;
    }
    console.error("createInvoice failed:", error);
    return { ok: false, error: "Izdavanje fakture nije uspelo." };
  }
  return { ok: false, error: "Izdavanje fakture nije uspelo. Pokušaj ponovo." };
}

// Instagram polje trpi sve što vlasnici lepe: pun URL, @handle ili čist
// handle - čuva se uvek samo handle da link na sajtu ne bude pokvaren
function normalizeInstagram(value: string): string {
  return value
    .trim()
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
    .replace(/^@/, "")
    .split(/[/?#]/)[0];
}

const settingsSchema = z.object({
  heroTitle: z.string().trim().max(100).optional(),
  heroSubtitle: z.string().trim().max(300).optional(),
  phone: z.string().trim().max(30).optional(),
  // Na ovu adresu stižu obaveštenja o rezervacijama - nevažeća bi značila
  // da mejlovi tiho ne stižu
  email: z
    .string()
    .trim()
    .email("Unesi ispravan email za obaveštenja.")
    .max(200)
    .optional()
    .or(z.literal("")),
  address: z.string().trim().max(200).optional(),
  city: z.string().trim().max(100).optional(),
  instagram: z.string().trim().max(100).transform(normalizeInstagram).optional(),
  showTeam: z.boolean(),
  showGallery: z.boolean(),
  showPrices: z.boolean(),
});

export async function updateSettings(
  input: z.input<typeof settingsSchema>
): Promise<ActionResult> {
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Neispravni podaci." };
  }

  const { tenant } = await getAdminContext();
  const supabase = await createClient();
  const { error } = await supabase
    .from("site_settings")
    .update({
      hero_title: parsed.data.heroTitle || null,
      hero_subtitle: parsed.data.heroSubtitle || null,
      phone: parsed.data.phone || null,
      email: parsed.data.email || null,
      address: parsed.data.address || null,
      city: parsed.data.city || null,
      instagram: parsed.data.instagram || null,
      show_team: parsed.data.showTeam,
      show_gallery: parsed.data.showGallery,
      show_prices: parsed.data.showPrices,
      updated_at: new Date().toISOString(),
    })
    .eq("tenant_id", tenant.id);

  if (error) return { ok: false, error: "Čuvanje nije uspelo." };
  revalidatePath("/admin/podesavanja");
  revalidatePath(`/${tenant.slug}`);
  return { ok: true };
}

// emptySite: objava bi iznela prazan sajt (bez usluga ili bez ikoga ko prima
// rezervacije) - dijalozi prikazuju upozorenje, "Objavi svejedno" šalje force
export type PublishResult =
  | { ok: true }
  | { ok: false; error?: string; emptySite?: { services: number; staff: number } };

export async function setPublished(
  published: boolean,
  force = false
): Promise<PublishResult> {
  const { tenant } = await getAdminContext();
  // Suspendovan salon ne može nazad na javni internet dok traje suspenzija
  if (published && tenant.suspended_at) {
    return { ok: false, error: "Salon je suspendovan - objava nije moguća. Kontaktiraj podršku." };
  }
  const supabase = await createClient();

  if (published && !force) {
    const [servicesRes, staffRes] = await Promise.all([
      supabase
        .from("services")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenant.id)
        .eq("is_active", true),
      supabase
        .from("staff")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenant.id)
        .eq("is_active", true),
    ]);
    const services = servicesRes.count ?? 0;
    const staff = staffRes.count ?? 0;
    if (services === 0 || staff === 0) {
      return { ok: false, emptySite: { services, staff } };
    }
  }
  const { error } = await supabase
    .from("tenants")
    .update({ is_published: published })
    .eq("id", tenant.id);
  if (error) return { ok: false, error: "Izmena nije uspela." };
  revalidatePath("/admin/podesavanja");
  revalidatePath(`/${tenant.slug}`);
  return { ok: true };
}

// Priprema plaćanja za modal: izda (ili ponovo iskoristi - createInvoice je
// idempotentan) fakturu za izabrani plan i vrati IPS QR spreman za prikaz.
export type PreparePaymentResult =
  | {
      ok: true;
      qrDataUrl: string;
      amount: number;
      plan: PlanId;
      periodFrom: string;
      periodTo: string;
      invoiceId: string;
      invoiceLabel: string;
      refNumber: string;
    }
  | { ok: false; needBillingInfo?: boolean; error?: string };

export async function preparePayment(plan: PlanId): Promise<PreparePaymentResult> {
  if (!(plan in PLANS)) return { ok: false, error: "Nepoznat plan." };
  const { tenant } = await getAdminContext();

  // Faktura mora imati kupca - modal u tom slučaju prvo traži podatke
  if (!tenant.billing_note?.trim()) {
    return { ok: false, needBillingInfo: true };
  }

  const created = await createInvoice(plan);
  if (!created.ok) return { ok: false, error: created.error };

  const db = createAdminClient();
  const { data: invoice } = await db
    .from("invoices")
    .select("id, number, year, amount, plan, period_from, period_to")
    .eq("id", created.invoiceId)
    .single();
  if (!invoice) return { ok: false, error: "Faktura nije pronađena." };

  const ipsString = buildIpsQr({
    amount: Number(invoice.amount),
    invoiceNumber: invoice.number,
    invoiceYear: invoice.year,
  });
  // Nivo H (30% korekcije) - dozvoljava Terminer logo preko sredine koda
  const qrDataUrl = await QRCode.toDataURL(ipsString, {
    margin: 1,
    width: 320,
    errorCorrectionLevel: "H",
  });

  return {
    ok: true,
    qrDataUrl,
    amount: Number(invoice.amount),
    plan: invoice.plan as PlanId,
    periodFrom: invoice.period_from,
    periodTo: invoice.period_to,
    invoiceId: invoice.id,
    invoiceLabel: `${invoice.number}/${invoice.year}`,
    refNumber: `00${invoice.year}${String(invoice.number).padStart(3, "0")}`,
  };
}
