"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendBookingConfirmation, sendOwnerBookingNotice } from "@/lib/email";
import {
  generateAvailableSlots,
  toMinutes,
  fromMinutes,
  type TimeRange,
} from "@/lib/booking/slots";
import { nowInZone, zonedToUtc } from "@/lib/booking/timezone";
import {
  dayOfWeek,
  parityForStaff,
  resolveWindow,
  type WorkWindow,
} from "@/lib/booking/schedule";
import { isBookingPaused } from "@/lib/billing";
import type {
  ScheduleException,
  Service,
  Staff,
  Tenant,
  WorkingHours,
} from "@/lib/types";

// Sve javne booking operacije idu kroz ove server akcije sa service-role
// klijentom: RLS ne dozvoljava anonimno čitanje/pisanje rezervacija, pa
// lični podaci klijenata nikad ne stižu do browsera drugog klijenta.

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
// Zod-ov .uuid() traži RFC 4122 verziju pa odbija npr. seed ID-jeve;
// nama treba samo Postgres-ov uuid format.
const uuidSchema = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, "Neispravan ID.");

// Namerno NE filtriramo po is_published: vlasnik testira zakazivanje i pre
// objave sajta. Anonimni posetilac ne može da dođe do UUID-jeva usluga i
// frizera neobjavljenog salona (RLS krije stranicu), pa je ovo bezbedno.
async function loadBookingContext(
  slug: string,
  staffId: string,
  serviceId: string
): Promise<
  | { db: ReturnType<typeof createAdminClient>; tenant: Tenant; staff: Staff; service: Service }
  | { error: string }
> {
  const db = createAdminClient();
  const { data: tenant } = await db
    .from("tenants")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (!tenant) return { error: "Salon nije pronađen." };

  // Suspendovan salon: nema zakazivanja ni za koga
  if (tenant.suspended_at) {
    return { error: "Salon trenutno nije dostupan." };
  }

  // Istekla pretplata pauzira samo online zakazivanje - sajt ostaje živ
  if (isBookingPaused(tenant as Tenant)) {
    return { error: "Online zakazivanje je trenutno pauzirano. Pozovi salon telefonom." };
  }

  const [staffRes, serviceRes, linkRes] = await Promise.all([
    db.from("staff").select("*").eq("id", staffId).eq("tenant_id", tenant.id).eq("is_active", true).maybeSingle(),
    db.from("services").select("*").eq("id", serviceId).eq("tenant_id", tenant.id).eq("is_active", true).maybeSingle(),
    db.from("staff_services").select("staff_id").eq("staff_id", staffId).eq("service_id", serviceId).maybeSingle(),
  ]);
  if (!staffRes.data) return { error: "Frizer nije pronađen ili je neaktivan." };
  if (!serviceRes.data) return { error: "Usluga nije pronađena ili je neaktivna." };
  if (!linkRes.data) return { error: "Izabrani frizer ne radi ovu uslugu." };

  return {
    db,
    tenant: tenant as Tenant,
    staff: staffRes.data as Staff,
    service: serviceRes.data as Service,
  };
}

// Radno okno za frizera na dati datum: izuzetak za datum ima prednost,
// inače pravilo (nedeljno radno vreme, uz A/B parnost kod rotacije).
async function getWorkWindow(
  db: ReturnType<typeof createAdminClient>,
  tenantId: string,
  staff: Staff,
  date: string
): Promise<WorkWindow> {
  // tenant_id filter i ovde iako FK garantuje integritet - service-role
  // klijent zaobilazi RLS, pa nijedan upit ne sme bez tenant granice
  const { data: exception } = await db
    .from("shift_assignments")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("staff_id", staff.id)
    .eq("date", date)
    .maybeSingle();

  if (exception) return resolveWindow(date, staff, [], exception as ScheduleException);

  const { data: wh } = await db
    .from("working_hours")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("staff_id", staff.id)
    .eq("day_of_week", dayOfWeek(date))
    .eq("week_parity", parityForStaff(date, staff))
    .maybeSingle();

  return resolveWindow(date, staff, wh ? [(wh as WorkingHours)] : [], null);
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
      .eq("tenant_id", tenantId)
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

type BookingContext = Exclude<
  Awaited<ReturnType<typeof loadBookingContext>>,
  { error: string }
>;

// Koliko unapred gost sme da zakaže. Wizard nudi 14 dana, ali akcije
// primaju proizvoljan datum - server mora imati sopstvenu granicu da
// niko ne bukira termine za godinu dana unapred.
const MAX_DAYS_AHEAD = 60;

async function computeSlots(ctx: BookingContext, date: string): Promise<string[]> {
  const now = nowInZone(ctx.tenant.timezone);
  if (date < now.date) return [];
  const max = new Date(`${now.date}T12:00:00Z`);
  max.setUTCDate(max.getUTCDate() + MAX_DAYS_AHEAD);
  if (date > max.toISOString().slice(0, 10)) return [];

  const window = await getWorkWindow(ctx.db, ctx.tenant.id, ctx.staff, date);
  if (!window) return [];

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
  if ("error" in ctx) return { error: ctx.error };

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
  // Honeypot: skriveno polje koje pravi korisnik nikad ne popunjava
  website: z.string().max(200).optional(),
});

// Anti-spam granice za gost-booking (admin zakazuje kroz svoju akciju)
const MAX_ACTIVE_PER_PHONE = 3;
const MAX_PER_IP_PER_HOUR = 5;

export type CreateBookingResult =
  | { ok: true; bookingId: string; cancelToken: string; emailSent: boolean }
  | { ok: false; error: string };

export async function createBooking(
  raw: z.infer<typeof createBookingSchema>
): Promise<CreateBookingResult> {
  const parsed = createBookingSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Neispravni podaci." };
  }
  const input = parsed.data;

  // Bot koji je popunio honeypot polje ne prolazi (generička poruka, namerno)
  if (input.website) {
    return { ok: false, error: "Greška pri zakazivanju. Pokušaj ponovo." };
  }

  const ctx = await loadBookingContext(input.slug, input.staffId, input.serviceId);
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const now = nowInZone(ctx.tenant.timezone);
  const hdrs = await headers();
  const ip = (hdrs.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || null;

  // Limit po telefonu: max aktivnih predstojećih rezervacija u ovom salonu
  const { count: phoneCount } = await ctx.db
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", ctx.tenant.id)
    .eq("customer_phone", input.customerPhone)
    .in("status", ["pending", "confirmed"])
    .gte("date", now.date);
  if ((phoneCount ?? 0) >= MAX_ACTIVE_PER_PHONE) {
    return {
      ok: false,
      error: `Sa ovim brojem telefona već postoje ${MAX_ACTIVE_PER_PHONE} aktivne rezervacije. Za dodatni termin pozovi salon.`,
    };
  }

  // Limit po IP-u: max novih rezervacija na sat u ovom salonu. Ako kolona
  // created_ip još ne postoji (migracija nije primenjena), preskoči limit
  // umesto da oborimo zakazivanje.
  let trackIp = false;
  if (ip) {
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const ipRes = await ctx.db
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", ctx.tenant.id)
      .eq("created_ip", ip)
      .gte("created_at", since);
    if (!ipRes.error) {
      trackIp = true;
      if ((ipRes.count ?? 0) >= MAX_PER_IP_PER_HOUR) {
        return {
          ok: false,
          error: "Previše pokušaja zakazivanja odjednom. Sačekaj malo ili pozovi salon telefonom.",
        };
      }
    }
  }

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
      ...(trackIp ? { created_ip: ip } : {}),
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

  // Mejlovi (nikad ne obaraju booking): potvrda klijentu ako je ostavio
  // email + obaveštenje salonu ako ima kontakt adresu u podešavanjima
  const { data: settings } = await ctx.db
    .from("site_settings")
    .select("address, city, phone, email")
    .eq("tenant_id", ctx.tenant.id)
    .maybeSingle();
  const proto = hdrs.get("x-forwarded-proto") ?? "http";
  const host = hdrs.get("host") ?? "localhost:3000";
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? `${proto}://${host}`;

  const confirmationP = input.customerEmail
    ? sendBookingConfirmation({
        to: input.customerEmail,
        salonName: ctx.tenant.name,
        serviceName: ctx.service.name,
        staffName: ctx.staff.name,
        date: input.date,
        startTime: input.time,
        endTime,
        address: settings
          ? [settings.address, settings.city].filter(Boolean).join(", ") || null
          : null,
        salonPhone: settings?.phone ?? null,
        cancelUrl: `${baseUrl}/${ctx.tenant.slug}/otkazivanje/${booking.cancel_token}`,
      })
    : Promise.resolve({ sent: false });
  const ownerNoticeP = settings?.email
    ? sendOwnerBookingNotice({
        to: settings.email,
        kind: "new",
        salonName: ctx.tenant.name,
        serviceName: ctx.service.name,
        staffName: ctx.staff.name,
        date: input.date,
        startTime: input.time,
        endTime,
        customerName: input.customerName,
        customerPhone: input.customerPhone,
        note: input.note || null,
      })
    : Promise.resolve({ sent: false });
  const [confirmation] = await Promise.all([confirmationP, ownerNoticeP]);

  return {
    ok: true,
    bookingId: booking.id,
    cancelToken: booking.cancel_token,
    emailSent: confirmation.sent,
  };
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
    .select("id, tenant_id")
    .maybeSingle();

  if (error || !data) {
    return { ok: false, error: "Rezervacija nije pronađena ili je već otkazana." };
  }

  // Obavesti salon da se termin oslobodio - nikad ne obara otkazivanje
  const [{ data: booking }, { data: settings }] = await Promise.all([
    db
      .from("bookings")
      .select(
        "date, start_time, end_time, customer_name, customer_phone, note, tenants(name), services(name), staff(name)"
      )
      .eq("id", data.id)
      .maybeSingle(),
    db.from("site_settings").select("email").eq("tenant_id", data.tenant_id).maybeSingle(),
  ]);
  if (booking && settings?.email) {
    await sendOwnerBookingNotice({
      to: settings.email,
      kind: "cancelled",
      salonName:
        (booking.tenants as unknown as { name: string } | null)?.name ?? "",
      serviceName:
        (booking.services as unknown as { name: string } | null)?.name ?? "Usluga",
      staffName:
        (booking.staff as unknown as { name: string } | null)?.name ?? "",
      date: booking.date,
      startTime: booking.start_time.slice(0, 5),
      endTime: booking.end_time.slice(0, 5),
      customerName: booking.customer_name,
      customerPhone: booking.customer_phone,
      note: booking.note,
    });
  }

  return { ok: true };
}
