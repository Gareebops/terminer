"use server";

import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  generateAvailableSlots,
  toMinutes,
  fromMinutes,
  type TimeRange,
} from "@/lib/booking/slots";
import { nowInZone, zonedToUtc } from "@/lib/booking/timezone";
import type { Service, Staff, Tenant } from "@/lib/types";

// Sve javne booking operacije idu kroz ove server akcije sa service-role
// klijentom: RLS ne dozvoljava anonimno čitanje/pisanje rezervacija, pa
// lični podaci klijenata nikad ne stižu do browsera drugog klijenta.

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
// Zod-ov .uuid() traži RFC 4122 verziju pa odbija npr. seed ID-jeve;
// nama treba samo Postgres-ov uuid format.
const uuidSchema = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, "Neispravan ID.");

async function loadBookingContext(slug: string, staffId: string, serviceId: string) {
  const db = createAdminClient();
  const { data: tenant } = await db
    .from("tenants")
    .select("*")
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();
  if (!tenant) return null;

  const [staffRes, serviceRes, linkRes] = await Promise.all([
    db.from("staff").select("*").eq("id", staffId).eq("tenant_id", tenant.id).eq("is_active", true).maybeSingle(),
    db.from("services").select("*").eq("id", serviceId).eq("tenant_id", tenant.id).eq("is_active", true).maybeSingle(),
    db.from("staff_services").select("staff_id").eq("staff_id", staffId).eq("service_id", serviceId).maybeSingle(),
  ]);
  if (!staffRes.data || !serviceRes.data || !linkRes.data) return null;

  return {
    db,
    tenant: tenant as Tenant,
    staff: staffRes.data as Staff,
    service: serviceRes.data as Service,
  };
}

// Radno okno za frizera na dati datum: dodeljena smena ima prednost,
// inače podrazumevano nedeljno radno vreme.
async function getWorkWindow(
  db: ReturnType<typeof createAdminClient>,
  staffId: string,
  date: string
): Promise<{ start: string; end: string } | null> {
  const { data: assignment } = await db
    .from("shift_assignments")
    .select("is_off, shift_template_id, shift_templates(start_time, end_time)")
    .eq("staff_id", staffId)
    .eq("date", date)
    .maybeSingle();

  if (assignment) {
    if (assignment.is_off || !assignment.shift_template_id) return null;
    const tpl = assignment.shift_templates as unknown as {
      start_time: string;
      end_time: string;
    } | null;
    if (tpl) return { start: tpl.start_time.slice(0, 5), end: tpl.end_time.slice(0, 5) };
    return null;
  }

  const dayOfWeek = new Date(`${date}T12:00:00Z`).getUTCDay();
  const { data: wh } = await db
    .from("working_hours")
    .select("start_time, end_time, is_working")
    .eq("staff_id", staffId)
    .eq("day_of_week", dayOfWeek)
    .maybeSingle();

  if (!wh || !wh.is_working) return null;
  return { start: wh.start_time.slice(0, 5), end: wh.end_time.slice(0, 5) };
}

async function getBusyRanges(
  db: ReturnType<typeof createAdminClient>,
  tenantId: string,
  staffId: string,
  date: string
): Promise<TimeRange[]> {
  const [bookings, blocked] = await Promise.all([
    db
      .from("bookings")
      .select("start_time, end_time")
      .eq("staff_id", staffId)
      .eq("date", date)
      .in("status", ["pending", "confirmed"]),
    db
      .from("blocked_slots")
      .select("start_time, end_time, staff_id")
      .eq("tenant_id", tenantId)
      .eq("date", date)
      .or(`staff_id.eq.${staffId},staff_id.is.null`),
  ]);

  return [...(bookings.data ?? []), ...(blocked.data ?? [])].map((r) => ({
    start: r.start_time.slice(0, 5),
    end: r.end_time.slice(0, 5),
  }));
}

async function computeSlots(
  ctx: NonNullable<Awaited<ReturnType<typeof loadBookingContext>>>,
  date: string
): Promise<string[]> {
  const window = await getWorkWindow(ctx.db, ctx.staff.id, date);
  if (!window) return [];

  const now = nowInZone(ctx.tenant.timezone);
  if (date < now.date) return [];

  const busy = await getBusyRanges(ctx.db, ctx.tenant.id, ctx.staff.id, date);

  return generateAvailableSlots({
    workStart: window.start,
    workEnd: window.end,
    durationMinutes: ctx.service.duration_minutes,
    busy,
    isToday: date === now.date,
    nowMinutes: now.minutes,
  });
}

export async function getAvailableSlots(input: {
  slug: string;
  staffId: string;
  serviceId: string;
  date: string;
}): Promise<{ slots: string[] } | { error: string }> {
  const parsedDate = dateSchema.safeParse(input.date);
  if (!parsedDate.success) return { error: "Neispravan datum." };

  const ctx = await loadBookingContext(input.slug, input.staffId, input.serviceId);
  if (!ctx) return { error: "Salon, usluga ili frizer nisu pronađeni." };

  return { slots: await computeSlots(ctx, input.date) };
}

const createBookingSchema = z.object({
  slug: z.string().min(2),
  staffId: uuidSchema,
  serviceId: uuidSchema,
  date: dateSchema,
  time: z.string().regex(/^\d{2}:\d{2}$/),
  customerName: z.string().trim().min(2, "Unesi ime i prezime.").max(100),
  customerPhone: z
    .string()
    .trim()
    .regex(/^\+?[0-9 /-]{6,20}$/, "Unesi ispravan broj telefona."),
  customerEmail: z.string().trim().email("Neispravan email.").max(200).optional().or(z.literal("")),
  note: z.string().trim().max(500).optional(),
});

export type CreateBookingResult =
  | { ok: true; bookingId: string; cancelToken: string }
  | { ok: false; error: string };

export async function createBooking(
  raw: z.infer<typeof createBookingSchema>
): Promise<CreateBookingResult> {
  const parsed = createBookingSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Neispravni podaci." };
  }
  const input = parsed.data;

  const ctx = await loadBookingContext(input.slug, input.staffId, input.serviceId);
  if (!ctx) return { ok: false, error: "Salon, usluga ili frizer nisu pronađeni." };

  // Termin mora biti među trenutno dostupnim slotovima
  const slots = await computeSlots(ctx, input.date);
  if (!slots.includes(input.time)) {
    return { ok: false, error: "Termin više nije dostupan. Izaberi drugi." };
  }

  const endTime = fromMinutes(toMinutes(input.time) + ctx.service.duration_minutes);
  const startsAt = zonedToUtc(input.date, input.time, ctx.tenant.timezone);
  const endsAt = zonedToUtc(input.date, endTime, ctx.tenant.timezone);

  // Upis/ažuriranje klijenta u evidenciji salona
  const { data: customer } = await ctx.db
    .from("customers")
    .upsert(
      {
        tenant_id: ctx.tenant.id,
        name: input.customerName,
        phone: input.customerPhone,
        email: input.customerEmail || null,
      },
      { onConflict: "tenant_id,phone" }
    )
    .select("id")
    .maybeSingle();

  const { data: booking, error } = await ctx.db
    .from("bookings")
    .insert({
      tenant_id: ctx.tenant.id,
      staff_id: ctx.staff.id,
      service_id: ctx.service.id,
      customer_id: customer?.id ?? null,
      customer_name: input.customerName,
      customer_phone: input.customerPhone,
      customer_email: input.customerEmail || null,
      date: input.date,
      start_time: input.time,
      end_time: endTime,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      note: input.note || null,
      status: "confirmed",
    })
    .select("id, cancel_token")
    .single();

  if (error) {
    // 23P01 = exclusion_violation → neko je u međuvremenu zauzeo termin
    if (error.code === "23P01") {
      return { ok: false, error: "Termin je upravo zauzet. Izaberi drugi." };
    }
    console.error("createBooking failed:", error);
    return { ok: false, error: "Greška pri zakazivanju. Pokušaj ponovo." };
  }

  return { ok: true, bookingId: booking.id, cancelToken: booking.cancel_token };
}

export async function cancelBooking(input: {
  bookingId: string;
  cancelToken: string;
}): Promise<{ ok: boolean; error?: string }> {
  const ids = z
    .object({ bookingId: uuidSchema, cancelToken: uuidSchema })
    .safeParse(input);
  if (!ids.success) return { ok: false, error: "Neispravan link za otkazivanje." };

  const db = createAdminClient();
  const { data, error } = await db
    .from("bookings")
    .update({ status: "cancelled" })
    .eq("id", ids.data.bookingId)
    .eq("cancel_token", ids.data.cancelToken)
    .in("status", ["pending", "confirmed"])
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return { ok: false, error: "Rezervacija nije pronađena ili je već otkazana." };
  }
  return { ok: true };
}
