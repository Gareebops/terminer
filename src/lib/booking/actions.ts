"use server";

import { unstable_cache } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { tenantSiteTag } from "@/lib/tenant";
import { sendBookingConfirmation, sendOwnerBookingNotice } from "@/lib/email";
import {
  generateAvailableSlots,
  toMinutes,
  fromMinutes,
  type TimeRange,
} from "@/lib/booking/slots";
import { linkCancelExpired } from "@/lib/booking/cancel";
import { nowInZone, zonedToUtc } from "@/lib/booking/timezone";
import {
  addDaysISO,
  bookingHorizonDays,
  dayOfWeek,
  resolveWindow,
} from "@/lib/booking/schedule";
import { isBookingPaused } from "@/lib/billing";
import { normalizePhone } from "@/lib/phone";
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
// "any" = klijentu je svejedno kod koga - server bira među svima koji
// rade uslugu
const staffIdSchema = uuidSchema.or(z.literal("any"));

type Db = ReturnType<typeof createAdminClient>;

interface BookingContext {
  db: Db;
  tenant: Tenant;
  service: Service;
  // Jedan izabrani član tima, ili svi koji rade uslugu (staffId "any")
  staffList: Staff[];
}

// Namerno NE filtriramo po is_published: vlasnik testira zakazivanje i pre
// objave sajta. Anonimni posetilac ne može da dođe do UUID-jeva usluga i
// frizera neobjavljenog salona (RLS krije stranicu), pa je ovo bezbedno.
//
// Podaci konteksta (tenant/usluga/tim) se menjaju retko pa se keširaju:
// tag obara svaka admin izmena (bustTenantSiteCache), TTL je zaštitna
// mreža. Provere zavisne od vremena (suspenzija, pauza pretplate) NISU u
// kešu - računaju se iz keširanih polja pri svakom pozivu, u
// loadBookingContext. Rezervacije i blokade se ne keširaju nikad.
type BookingContextData =
  | { tenant: Tenant | null; error: string }
  | { tenant: Tenant; error?: undefined; service: Service; staffList: Staff[] };

async function fetchBookingContextData(
  slug: string,
  staffId: string,
  serviceId: string
): Promise<BookingContextData> {
  const db = createAdminClient();
  const { data: tenant } = await db
    .from("tenants")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (!tenant) return { tenant: null, error: "Salon nije pronađen." };

  if (staffId === "any") {
    const [serviceRes, linksRes] = await Promise.all([
      db.from("services").select("*").eq("id", serviceId).eq("tenant_id", tenant.id).eq("is_active", true).maybeSingle(),
      db.from("staff_services").select("staff_id").eq("tenant_id", tenant.id).eq("service_id", serviceId),
    ]);
    if (!serviceRes.data) {
      return { tenant: tenant as Tenant, error: "Usluga nije pronađena ili je neaktivna." };
    }
    const ids = (linksRes.data ?? []).map((l) => l.staff_id);
    const { data: staff } = ids.length
      ? await db
          .from("staff")
          .select("*")
          .eq("tenant_id", tenant.id)
          .eq("is_active", true)
          .in("id", ids)
          .order("sort_order")
      : { data: [] };
    if (!staff || staff.length === 0) {
      return {
        tenant: tenant as Tenant,
        error: "Trenutno niko ne radi ovu uslugu. Probaj drugu ili pozovi salon.",
      };
    }
    return {
      tenant: tenant as Tenant,
      service: serviceRes.data as Service,
      staffList: staff as Staff[],
    };
  }

  const [staffRes, serviceRes, linkRes] = await Promise.all([
    db.from("staff").select("*").eq("id", staffId).eq("tenant_id", tenant.id).eq("is_active", true).maybeSingle(),
    db.from("services").select("*").eq("id", serviceId).eq("tenant_id", tenant.id).eq("is_active", true).maybeSingle(),
    db.from("staff_services").select("staff_id").eq("staff_id", staffId).eq("service_id", serviceId).maybeSingle(),
  ]);
  // Neutralno "član tima" - platforma služi i salonima gde nema frizera
  if (!staffRes.data) {
    return { tenant: tenant as Tenant, error: "Član tima nije pronađen ili je neaktivan." };
  }
  if (!serviceRes.data) {
    return { tenant: tenant as Tenant, error: "Usluga nije pronađena ili je neaktivna." };
  }
  if (!linkRes.data) {
    return { tenant: tenant as Tenant, error: "Izabrani član tima ne radi ovu uslugu." };
  }

  return {
    tenant: tenant as Tenant,
    service: serviceRes.data as Service,
    staffList: [staffRes.data as Staff],
  };
}

const getBookingContextData = (slug: string, staffId: string, serviceId: string) =>
  unstable_cache(
    () => fetchBookingContextData(slug, staffId, serviceId),
    ["booking-context", slug, staffId, serviceId],
    { tags: [tenantSiteTag(slug)], revalidate: 60 }
  )();

async function loadBookingContext(
  slug: string,
  staffId: string,
  serviceId: string
): Promise<BookingContext | { error: string }> {
  const data = await getBookingContextData(slug, staffId, serviceId);

  // Isti redosled provera kao pre keširanja: suspenzija/pauza imaju
  // prednost nad greškama o usluzi/članu tima
  if (data.tenant) {
    // Suspendovan salon: nema zakazivanja ni za koga
    if (data.tenant.suspended_at) {
      return { error: "Salon trenutno nije dostupan." };
    }
    // Istekla pretplata pauzira samo online zakazivanje - sajt ostaje živ
    if (isBookingPaused(data.tenant)) {
      return { error: "Online zakazivanje je trenutno pauzirano. Pozovi salon telefonom." };
    }
  }
  if (data.error !== undefined) return { error: data.error };

  return {
    db: createAdminClient(),
    tenant: data.tenant,
    service: data.service,
    staffList: data.staffList,
  };
}

// Podaci dana za SVE članove iz konteksta odjednom - 4 upita bez obzira
// na broj kandidata (ranije 4 po članu, pa je "any" u salonu sa 5 ljudi
// koštao 20). resolveWindow sam bira red po članu/danu/parnosti.
type DayData = {
  exceptions: ScheduleException[];
  hours: WorkingHours[];
  // rezervacije + blokade zajedno; staff_id null = blokada celog salona
  busy: { staff_id: string | null; start_time: string; end_time: string }[];
};

async function fetchDayData(
  db: Db,
  tenantId: string,
  staffIds: string[],
  date: string
): Promise<DayData> {
  // tenant_id filter i ovde iako FK garantuje integritet - service-role
  // klijent zaobilazi RLS, pa nijedan upit ne sme bez tenant granice
  const [excRes, whRes, bookingsRes, blockedRes] = await Promise.all([
    db
      .from("shift_assignments")
      .select("*")
      .eq("tenant_id", tenantId)
      .in("staff_id", staffIds)
      .eq("date", date),
    db
      .from("working_hours")
      .select("*")
      .eq("tenant_id", tenantId)
      .in("staff_id", staffIds)
      .eq("day_of_week", dayOfWeek(date)),
    db
      .from("bookings")
      .select("staff_id, start_time, end_time")
      .eq("tenant_id", tenantId)
      .in("staff_id", staffIds)
      .eq("date", date)
      .in("status", ["pending", "confirmed"]),
    db
      .from("blocked_slots")
      .select("staff_id, start_time, end_time")
      .eq("tenant_id", tenantId)
      .eq("date", date)
      .or(`staff_id.in.(${staffIds.join(",")}),staff_id.is.null`),
  ]);

  return {
    exceptions: (excRes.data ?? []) as ScheduleException[],
    hours: (whRes.data ?? []) as WorkingHours[],
    busy: [...(bookingsRes.data ?? []), ...(blockedRes.data ?? [])],
  };
}

// Termin ne sme da počne "za minut" - salonu treba vremena da vidi
// rezervaciju. Današnji slotovi počinju tek posle ovog razmaka.
const MIN_LEAD_MINUTES = 30;

// Čisto računanje nad već učitanim podacima dana - bez upita
function computeSlotsForStaff(
  ctx: BookingContext,
  staff: Staff,
  date: string,
  now: ReturnType<typeof nowInZone>,
  day: DayData
): string[] {
  if (date < now.date) return [];
  // Horizont po zaposlenom (wizard traka nudi isti broj dana). Horizont N =
  // N ponuđenih dana računajući danas, pa je poslednji dozvoljen danas+N-1.
  const lastBookable = addDaysISO(now.date, bookingHorizonDays(staff) - 1);
  if (date > lastBookable) return [];

  // Izuzetak za datum ima prednost, inače pravilo (nedeljno radno vreme,
  // uz A/B parnost kod rotacije - resolveWindow bira red)
  const exception =
    day.exceptions.find((e) => e.staff_id === staff.id) ?? null;
  const window = exception
    ? resolveWindow(date, staff, [], exception)
    : resolveWindow(date, staff, day.hours, null);
  if (!window) return [];

  const busy: TimeRange[] = day.busy
    .filter((r) => r.staff_id === staff.id || r.staff_id === null)
    .map((r) => ({ start: r.start_time.slice(0, 5), end: r.end_time.slice(0, 5) }));

  return generateAvailableSlots({
    workStart: window.start,
    workEnd: window.end,
    durationMinutes: ctx.service.duration_minutes,
    busy,
    isToday: date === now.date,
    nowMinutes: now.minutes + MIN_LEAD_MINUTES,
  });
}

// Slotovi po svakom članu iz konteksta; za jednog je to obična lista,
// za "any" se uniraju u getAvailableSlots / biraju u createBooking
async function computeSlotsPerStaff(
  ctx: BookingContext,
  date: string
): Promise<string[][]> {
  const now = nowInZone(ctx.tenant.timezone);

  // Prošli datum ili datum iza svih horizonata: bez ijednog upita
  if (date < now.date) return ctx.staffList.map(() => []);
  const maxLast = addDaysISO(
    now.date,
    Math.max(...ctx.staffList.map(bookingHorizonDays)) - 1
  );
  if (date > maxLast) return ctx.staffList.map(() => []);

  const day = await fetchDayData(
    ctx.db,
    ctx.tenant.id,
    ctx.staffList.map((s) => s.id),
    date
  );
  return ctx.staffList.map((s) => computeSlotsForStaff(ctx, s, date, now, day));
}

// Dostupnost po danu za traku u wizardu: radi li IKO iz konteksta tog dana
// (pravilo + izuzeci; rezervacije se ne gledaju - ovo kaže "radno/neradno",
// slotove i dalje računa izbor konkretnog dana). Dužina = najduži horizont.
export type DayAvailability = { date: string; open: boolean }[];

async function computeOpenDays(ctx: BookingContext): Promise<DayAvailability> {
  const now = nowInZone(ctx.tenant.timezone);
  const horizon = Math.max(...ctx.staffList.map(bookingHorizonDays));
  const last = addDaysISO(now.date, horizon - 1);
  const ids = ctx.staffList.map((s) => s.id);

  const [hoursRes, excRes] = await Promise.all([
    ctx.db
      .from("working_hours")
      .select("*")
      .eq("tenant_id", ctx.tenant.id)
      .in("staff_id", ids),
    ctx.db
      .from("shift_assignments")
      .select("*")
      .eq("tenant_id", ctx.tenant.id)
      .in("staff_id", ids)
      .gte("date", now.date)
      .lte("date", last),
  ]);
  const hours = (hoursRes.data ?? []) as WorkingHours[];
  const exceptions = (excRes.data ?? []) as ScheduleException[];

  const days: DayAvailability = [];
  for (let i = 0; i < horizon; i++) {
    const date = addDaysISO(now.date, i);
    const open = ctx.staffList.some(
      (s) =>
        i < bookingHorizonDays(s) &&
        resolveWindow(
          date,
          s,
          hours,
          exceptions.find((e) => e.staff_id === s.id && e.date === date) ?? null
        ) !== null
    );
    days.push({ date, open });
  }
  return days;
}

// Rate limit provere slotova - jedina javna akcija bez prirodne granice
// (createBooking već ima limite po telefonu i IP-u u bazi). Po instanci,
// kao domainCache u proxy-ju: dovoljno da niko jeftino ne dobuje bazu, a
// čovek u wizardu (klik po datumu) limitu ni ne prilazi.
const SLOTS_MAX_PER_WINDOW = 30;
const SLOTS_WINDOW_MS = 60_000;
const slotsHits = new Map<string, { count: number; windowStart: number }>();

function slotsRateLimited(ip: string | null): boolean {
  if (!ip) return false;
  const now = Date.now();
  const hit = slotsHits.get(ip);
  if (!hit || now - hit.windowStart >= SLOTS_WINDOW_MS) {
    // Usputno čišćenje isteklih prozora da mapa ne raste unedogled
    if (slotsHits.size >= 5000) {
      for (const [key, v] of slotsHits) {
        if (now - v.windowStart >= SLOTS_WINDOW_MS) slotsHits.delete(key);
      }
    }
    slotsHits.set(ip, { count: 1, windowStart: now });
    return false;
  }
  hit.count += 1;
  return hit.count > SLOTS_MAX_PER_WINDOW;
}

export async function getAvailableSlots(input: {
  slug: string;
  staffId: string;
  serviceId: string;
  date: string;
  // Uz slotove vrati i radne/neradne dane horizonta - wizard ih traži
  // jednom po izboru osobe (jedna akcija umesto dve: klijentski dispatcher
  // server akcije ionako serijalizuje)
  includeDays?: boolean;
}): Promise<{ slots: string[]; days?: DayAvailability } | { error: string }> {
  const parsedDate = dateSchema.safeParse(input.date);
  if (!parsedDate.success) return { error: "Neispravan datum." };
  if (!staffIdSchema.safeParse(input.staffId).success) return { error: "Neispravan ID." };

  const hdrs = await headers();
  const ip = (hdrs.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || null;
  if (slotsRateLimited(ip)) {
    return { error: "Previše zahteva odjednom. Sačekaj malo pa pokušaj ponovo." };
  }

  const ctx = await loadBookingContext(input.slug, input.staffId, input.serviceId);
  if ("error" in ctx) return { error: ctx.error };

  const [perStaff, days] = await Promise.all([
    computeSlotsPerStaff(ctx, input.date),
    input.includeDays ? computeOpenDays(ctx) : Promise.resolve(undefined),
  ]);
  const slots = [...new Set(perStaff.flat())].sort();

  return days ? { slots, days } : { slots };
}

const createBookingSchema = z.object({
  slug: z.string().min(2),
  staffId: staffIdSchema,
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
  | {
      ok: true;
      bookingId: string;
      cancelToken: string;
      emailSent: boolean;
      // Kome je termin dodeljen - kod "any" klijent tek ovde saznaje ime
      staffName: string;
    }
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

  // Kanonski oblik telefona: isti klijent = jedan red u customers, a limit
  // po telefonu se ne zaobilazi razmacima/crticama
  const phone = normalizePhone(input.customerPhone);

  // Anti-spam limiti idu paralelno - nezavisni su
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const [phoneRes, ipRes] = await Promise.all([
    // Limit po telefonu: max aktivnih predstojećih rezervacija u ovom salonu
    ctx.db
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", ctx.tenant.id)
      .eq("customer_phone", phone)
      .in("status", ["pending", "confirmed"])
      .gte("date", now.date),
    // Limit po IP-u: max novih rezervacija na sat u ovom salonu. Ako kolona
    // created_ip još ne postoji (migracija nije primenjena), preskoči limit
    // umesto da oborimo zakazivanje.
    ip
      ? ctx.db
          .from("bookings")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", ctx.tenant.id)
          .eq("created_ip", ip)
          .gte("created_at", since)
      : Promise.resolve(null),
  ]);
  if ((phoneRes.count ?? 0) >= MAX_ACTIVE_PER_PHONE) {
    return {
      ok: false,
      error: `Sa ovim brojem telefona već postoje ${MAX_ACTIVE_PER_PHONE} aktivne rezervacije. Za dodatni termin pozovi salon.`,
    };
  }
  const trackIp = !!ip && !!ipRes && !ipRes.error;
  if (trackIp && (ipRes!.count ?? 0) >= MAX_PER_IP_PER_HOUR) {
    return {
      ok: false,
      error: "Previše pokušaja zakazivanja odjednom. Sačekaj malo ili pozovi salon telefonom.",
    };
  }

  // Termin mora biti među trenutno dostupnim slotovima. Kod "any" su
  // kandidati svi koji u to vreme stvarno mogu - jedan se bira nasumično
  // (statistički ravnomerno raspoređuje klijente), a na sudar se proba sledeći.
  const perStaff = await computeSlotsPerStaff(ctx, input.date);
  const candidates = ctx.staffList.filter((_, i) => perStaff[i].includes(input.time));
  if (candidates.length === 0) {
    return { ok: false, error: "Termin više nije dostupan. Izaberi drugi." };
  }
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }

  const endTime = fromMinutes(toMinutes(input.time) + ctx.service.duration_minutes);
  const startsAt = zonedToUtc(input.date, input.time, ctx.tenant.timezone);
  const endsAt = zonedToUtc(input.date, endTime, ctx.tenant.timezone);

  // Upis/ažuriranje klijenta u evidenciji salona. Email se šalje samo kad
  // postoji - upsert ažurira sve poslate kolone, pa bi email:null pregazio
  // adresu koju je klijent ostavio pri ranijem zakazivanju.
  const { data: customer } = await ctx.db
    .from("customers")
    .upsert(
      {
        tenant_id: ctx.tenant.id,
        name: input.customerName,
        phone,
        ...(input.customerEmail ? { email: input.customerEmail } : {}),
      },
      { onConflict: "tenant_id,phone" }
    )
    .select("id")
    .maybeSingle();

  let booking: { id: string; cancel_token: string } | null = null;
  let assigned: Staff | null = null;
  for (const member of candidates) {
    const { data, error } = await ctx.db
      .from("bookings")
      .insert({
        tenant_id: ctx.tenant.id,
        staff_id: member.id,
        service_id: ctx.service.id,
        customer_id: customer?.id ?? null,
        customer_name: input.customerName,
        customer_phone: phone,
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

    if (!error) {
      booking = data;
      assigned = member;
      break;
    }
    // 23P01 = exclusion_violation → neko je u međuvremenu zauzeo termin
    // kod ovog člana; kod "any" probaj sledećeg kandidata
    if (error.code !== "23P01") {
      console.error("createBooking failed:", error);
      return { ok: false, error: "Greška pri zakazivanju. Pokušaj ponovo." };
    }
  }
  if (!booking || !assigned) {
    return { ok: false, error: "Termin je upravo zauzet. Izaberi drugi." };
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
        staffName: assigned.name,
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
        staffName: assigned.name,
        date: input.date,
        startTime: input.time,
        endTime,
        customerName: input.customerName,
        customerPhone: phone,
        note: input.note || null,
      })
    : Promise.resolve({ sent: false });
  const [confirmation] = await Promise.all([confirmationP, ownerNoticeP]);

  return {
    ok: true,
    bookingId: booking.id,
    cancelToken: booking.cancel_token,
    emailSent: confirmation.sent,
    staffName: assigned.name,
  };
}

export async function cancelBooking(input: {
  bookingId: string;
  cancelToken: string;
}): Promise<{ ok: boolean; error?: string; code?: "window_expired" }> {
  const ids = z
    .object({ bookingId: uuidSchema, cancelToken: uuidSchema })
    .safeParse(input);
  if (!ids.success) return { ok: false, error: "Neispravan link za otkazivanje." };

  const db = createAdminClient();

  // Prošao termin se ne može otkazati ni direktnim pozivom akcije -
  // UI to već brani, ali server mora imati sopstvenu proveru
  const { data: existing, error: guardError } = await db
    .from("bookings")
    .select("date, start_time, created_at, tenants(timezone)")
    .eq("id", ids.data.bookingId)
    .eq("cancel_token", ids.data.cancelToken)
    .maybeSingle();
  // Pad čitanja ne sme da preskoči provere ispod (fail-closed)
  if (guardError) {
    return { ok: false, error: "Nešto nije uspelo. Pokušaj ponovo." };
  }
  if (existing) {
    const tz =
      (existing.tenants as unknown as { timezone: string } | null)?.timezone ??
      "Europe/Belgrade";
    const now = nowInZone(tz);
    const started =
      existing.date < now.date ||
      (existing.date === now.date &&
        toMinutes(existing.start_time.slice(0, 5)) <= now.minutes);
    if (started) {
      return { ok: false, error: "Termin je već prošao, pa otkazivanje više nije moguće." };
    }
    // Link za otkazivanje važi sat vremena od zakazivanja (lib/booking/cancel);
    // code omogućava kartici da pređe u "istekao prozor" prikaz bez refresha
    if (linkCancelExpired(existing.created_at, Date.now())) {
      return {
        ok: false,
        code: "window_expired",
        error:
          "Prošlo je više od sat vremena od zakazivanja, pa otkazivanje preko linka više nije moguće. Za izmenu se javi salonu.",
      };
    }
  }

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
