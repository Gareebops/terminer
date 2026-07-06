import Link from "next/link";
import { ArrowUpRight, CalendarDays } from "lucide-react";
import { getAdminContext } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { formatPrice } from "@/lib/booking/slots";
import { nowInZone } from "@/lib/booking/timezone";
import type { OnboardingState, SiteSettings } from "@/lib/types";
import { OnboardingGuide } from "./onboarding-guide";

function addDaysISO(dateStr: string, n: number): string {
  const d = new Date(`${dateStr}T12:00:00`);
  d.setDate(d.getDate() + n);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default async function AdminDashboardPage() {
  const { tenant } = await getAdminContext();
  const supabase = await createClient();

  const today = nowInZone(tenant.timezone).date;
  const todayDate = new Date(`${today}T12:00:00`);
  const dow = todayDate.getDay();
  const monday = addDaysISO(today, dow === 0 ? -6 : 1 - dow);
  const sunday = addDaysISO(monday, 6);
  const monthStart = `${today.slice(0, 7)}-01`;
  const monthEnd = addDaysISO(`${today.slice(0, 7)}-28`, 7).slice(0, 7) + "-01";

  const activeStatuses = ["pending", "confirmed", "completed"];

  const [todayRes, weekRes, monthRes, customersRes, servicesRes, staffRes, settingsRes] =
    await Promise.all([
    supabase
      .from("bookings")
      .select("id, start_time, customer_name, services(name), staff(name), status")
      .eq("tenant_id", tenant.id)
      .eq("date", today)
      .in("status", activeStatuses)
      .order("start_time"),
    supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenant.id)
      .gte("date", monday)
      .lte("date", sunday)
      .in("status", activeStatuses),
    supabase
      .from("bookings")
      .select("service_id, services(name, price, currency)")
      .eq("tenant_id", tenant.id)
      .gte("date", monthStart)
      .lt("date", monthEnd)
      .in("status", activeStatuses),
    supabase
      .from("customers")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenant.id),
    supabase
      .from("services")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenant.id),
    // Id-jevi (ne samo count): vodič vodi pravo na jedinog zaposlenog
    supabase
      .from("staff")
      .select("id")
      .eq("tenant_id", tenant.id)
      .eq("is_active", true),
    supabase.from("site_settings").select("*").eq("tenant_id", tenant.id).maybeSingle(),
  ]);

  // Vodič za pokretanje: vidljiv dok sajt nije objavljen (ili dok ga vlasnik
  // ne sakrije); koraci se izvode iz stvarnih podataka
  const settings = (settingsRes.data ?? null) as SiteSettings | null;
  const onboarding = (settings?.onboarding ?? {}) as OnboardingState;
  const staffIds = ((staffRes.data ?? []) as { id: string }[]).map((s) => s.id);
  const appearanceTouched = !!(
    settings &&
    (settings.logo_url ||
      settings.hero_image_url ||
      // theme ima default '{}' - dirnut je tek kad forma upiše font/mod
      (settings.theme && Object.keys(settings.theme).length > 0) ||
      settings.phone ||
      settings.address ||
      settings.primary_color !== "#18181b")
  );
  // Guide ostaje montiran i kad je sajt objavljen (kartica se sama sakrije) -
  // tako proslava objave preživi refresh koji server akcija povuče
  const showGuide = !tenant.suspended_at && !onboarding.guide_hidden;

  const todayBookings = (todayRes.data ?? []) as unknown as {
    id: string;
    start_time: string;
    customer_name: string;
    services: { name: string } | null;
    staff: { name: string } | null;
  }[];
  const monthRows = (monthRes.data ?? []) as unknown as {
    service_id: string;
    services: { name: string; price: number; currency: string } | null;
  }[];

  const monthRevenue = monthRows.reduce((sum, r) => sum + Number(r.services?.price ?? 0), 0);
  const currency = monthRows[0]?.services?.currency ?? "RSD";

  const byService = new Map<string, { id: string; name: string; count: number }>();
  for (const r of monthRows) {
    const entry = byService.get(r.service_id) ?? {
      id: r.service_id,
      name: r.services?.name ?? "-",
      count: 0,
    };
    entry.count += 1;
    byService.set(r.service_id, entry);
  }
  const topServices = [...byService.values()].sort((a, b) => b.count - a.count).slice(0, 5);
  const maxCount = topServices[0]?.count ?? 1;

  return (
    <div>
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Početna</h1>
          <p className="mt-1 text-sm font-medium text-ink/50">
            {todayDate.toLocaleDateString("sr-RS", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </p>
        </div>
        <Link
          href="/admin/kalendar"
          className="flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-85"
        >
          <CalendarDays className="size-4" /> Otvori kalendar
        </Link>
      </div>

      {showGuide && (
        <OnboardingGuide
          slug={tenant.slug}
          salonName={tenant.name}
          published={tenant.is_published}
          showWelcome={!onboarding.welcome_seen && !tenant.is_published}
          servicesCount={servicesRes.count ?? 0}
          staffCount={staffIds.length}
          scheduleConfirmed={!!onboarding.schedule_confirmed}
          singleStaffId={staffIds.length === 1 ? staffIds[0] : null}
          appearanceTouched={appearanceTouched}
        />
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        {/* Tamna hero kartica - današnji dan */}
        <div className="rounded-[2rem] bg-ink p-7 text-white">
          <div className="flex items-start justify-between">
            <div>
              <p className="flex items-center gap-2 text-sm font-semibold text-white/55">
                Termina danas
                <span className="flex size-6 items-center justify-center rounded-full bg-mint text-xs text-ink">
                  <ArrowUpRight className="size-3.5" />
                </span>
              </p>
              <p className="mt-1 text-5xl font-extrabold tracking-tight">
                {todayBookings.length}
              </p>
            </div>
            <Link
              href="/admin/rezervacije"
              className="rounded-full border border-white/15 px-4 py-2 text-xs font-semibold text-white/80 transition-colors hover:bg-white/10"
            >
              Sve rezervacije
            </Link>
          </div>
          <div className="mt-6 space-y-2">
            {todayBookings.slice(0, 6).map((b) => (
              <div
                key={b.id}
                className="flex items-center gap-3 rounded-full bg-white/[0.06] px-4 py-2.5 text-sm"
              >
                <span className="font-bold tabular-nums">{b.start_time.slice(0, 5)}</span>
                <span className="font-semibold">{b.customer_name}</span>
                <span className="ml-auto truncate text-white/50">
                  {b.services?.name} · {b.staff?.name}
                </span>
              </div>
            ))}
            {todayBookings.length === 0 && (
              <p className="rounded-2xl border border-dashed border-white/15 p-6 text-center text-sm text-white/50">
                Nema termina za danas.
              </p>
            )}
            {todayBookings.length > 6 && (
              <p className="pt-1 text-center text-xs text-white/50">
                + još {todayBookings.length - 6} termina
              </p>
            )}
          </div>
        </div>

        {/* Stat kolona */}
        <div className="grid gap-4">
          <div className="rounded-[2rem] bg-mint p-6">
            {/* Sabira i zakazane buduće termine - zato "očekivani" */}
            <p className="text-sm font-semibold text-ink/60">Očekivani promet ovog meseca</p>
            <p className="mt-1 text-4xl font-extrabold tracking-tight">
              {formatPrice(monthRevenue, currency)}
            </p>
            <p className="mt-1 text-sm font-semibold text-ink/60">
              {monthRows.length} termina
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-[2rem] bg-lavender p-6">
              <p className="text-sm font-semibold text-ink/60">Ove nedelje</p>
              <p className="mt-1 text-4xl font-extrabold tracking-tight">
                {weekRes.count ?? 0}
              </p>
              <p className="mt-1 text-sm font-semibold text-ink/60">termina</p>
            </div>
            <div className="rounded-[2rem] bg-white p-6 shadow-[0_4px_24px_rgba(20,25,20,0.06)]">
              <p className="text-sm font-semibold text-ink/50">Klijenata</p>
              <p className="mt-1 text-4xl font-extrabold tracking-tight">
                {customersRes.count ?? 0}
              </p>
              <p className="mt-1 text-sm font-semibold text-ink/50">u evidenciji</p>
            </div>
          </div>
          <div className="rounded-[2rem] bg-white p-6 shadow-[0_4px_24px_rgba(20,25,20,0.06)]">
            <p className="text-base font-bold tracking-tight">Top usluge ovog meseca</p>
            {topServices.length === 0 && (
              <p className="mt-3 text-sm text-ink/50">Još nema rezervacija.</p>
            )}
            <ul className="mt-4 space-y-3">
              {topServices.map((s, i) => (
                <li key={s.id} className="text-sm font-semibold">
                  <div className="flex justify-between">
                    <span>{s.name}</span>
                    <span>{s.count}</span>
                  </div>
                  <div className="mt-1.5 h-2.5 rounded-full bg-ink/5">
                    <div
                      className={`h-2.5 rounded-full ${i % 2 === 0 ? "bg-mint-strong" : "bg-lavender-strong"}`}
                      style={{ width: `${(s.count / maxCount) * 100}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
