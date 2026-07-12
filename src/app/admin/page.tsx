import Link from "next/link";
import { ArrowUpRight, Ban, CalendarDays, Plus } from "lucide-react";
import { getAdminContext } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { fromMinutes, toMinutes } from "@/lib/booking/slots";
import { nowInZone } from "@/lib/booking/timezone";
import { datumSr } from "@/lib/datum";
import { plural } from "@/lib/plural";
import { isAppearanceTouched } from "@/lib/guide";
import { Button } from "@/components/ui/button";
import { CountUp } from "@/components/count-up";
import type { OnboardingState, SiteSettings } from "@/lib/types";
import { OnboardingGuide } from "./onboarding-guide";
import { ShareSiteButton } from "./share-site-button";

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

  const now = nowInZone(tenant.timezone);
  const today = now.date;
  const todayDate = new Date(`${today}T12:00:00`);
  const hour = Math.floor(now.minutes / 60);
  const greeting = hour < 10 ? "Dobro jutro" : hour < 18 ? "Dobar dan" : "Dobro veče";
  const dow = todayDate.getDay();
  const monday = addDaysISO(today, dow === 0 ? -6 : 1 - dow);
  const sunday = addDaysISO(monday, 6);
  const monthStart = `${today.slice(0, 7)}-01`;
  const monthEnd = addDaysISO(`${today.slice(0, 7)}-28`, 7).slice(0, 7) + "-01";

  const activeStatuses = ["pending", "confirmed", "completed"];

  const [todayRes, weekRes, monthRes, customersRes, servicesRes, staffRes, settingsRes, nextRes] =
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
    // Prvi predstojeći termin - istaknut u tamnoj kartici
    supabase
      .from("bookings")
      .select("date, start_time, customer_name, services(name)")
      .eq("tenant_id", tenant.id)
      .in("status", ["pending", "confirmed"])
      .or(`date.gt.${today},and(date.eq.${today},start_time.gte.${fromMinutes(now.minutes)})`)
      .order("date")
      .order("start_time")
      .limit(1)
      .maybeSingle(),
  ]);

  // "za 45 min" / "danas u 14:30" / "sutra u 10:00" / "sre 8.7. u 10:00"
  const next = nextRes.data as unknown as {
    date: string;
    start_time: string;
    customer_name: string;
    services: { name: string } | null;
  } | null;
  let nextLabel: string | null = null;
  if (next) {
    const time = next.start_time.slice(0, 5);
    if (next.date === today) {
      const diff = toMinutes(time) - now.minutes;
      nextLabel =
        diff <= 90
          ? `za ${diff} min`
          : `danas u ${time}`;
    } else if (next.date === addDaysISO(today, 1)) {
      nextLabel = `sutra u ${time}`;
    } else {
      nextLabel = `${datumSr(next.date, {
        weekday: "short",
        day: "numeric",
        month: "numeric",
      })} u ${time}`;
    }
  }

  // Vodič za pokretanje: vidljiv dok sajt nije objavljen (ili dok ga vlasnik
  // ne sakrije); koraci se izvode iz stvarnih podataka
  const settings = (settingsRes.data ?? null) as SiteSettings | null;
  const onboarding = (settings?.onboarding ?? {}) as OnboardingState;
  const staffIds = ((staffRes.data ?? []) as { id: string }[]).map((s) => s.id);
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

  // Kod raspona cene (price_max) namerno računa donju granicu - "očekivani"
  // promet ne sme da obećava više nego što je sigurno
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
      {/* Mobil: naslov i CTA jedno ispod drugog (dugme pune širine);
          od sm naviše originalni red sa dugmetom uz desnu ivicu */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Početna</h1>
          <p className="mt-1 text-sm font-medium text-ink/70">
            {greeting} ·{" "}
            {datumSr(todayDate, {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </p>
        </div>
        <Button asChild variant="brand" size="pill">
          <Link href="/admin/kalendar">
            <CalendarDays className="size-4" /> Otvori kalendar
          </Link>
        </Button>
      </div>

      {/* Vodič stoji PRE brzih akcija: za svež salon je on primarni sadržaj
          (brze akcije su preuranjene bez usluga i objave), a pozicija je
          fiksna bez obzira na published da komponenta ne bi remountovala
          usred proslave objave */}
      {showGuide && (
        <OnboardingGuide
          slug={tenant.slug}
          salonName={tenant.name}
          published={tenant.is_published}
          showWelcome={!onboarding.welcome_seen && !tenant.is_published}
          data={{
            servicesCount: servicesRes.count ?? 0,
            staffCount: staffIds.length,
            scheduleConfirmed: !!onboarding.schedule_confirmed,
            singleStaffId: staffIds.length === 1 ? staffIds[0] : null,
            appearanceTouched: isAppearanceTouched(settings),
            appearanceConfirmed: !!onboarding.appearance_confirmed,
          }}
        />
      )}

      {/* Brze akcije - najčešći poslovi na jedan klik. Mobil: uredna mreža
          2+1 (Podeli sajt puna širina), od sm naviše originalni red */}
      <div className="mt-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        <Link
          href="/admin/kalendar?novo=1"
          className="flex items-center justify-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold shadow-card transition-colors hover:bg-ink/5 sm:justify-start"
        >
          <Plus className="size-4" /> Upiši termin
        </Link>
        <Link
          href="/admin/kalendar?blokada=1"
          className="flex items-center justify-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold shadow-card transition-colors hover:bg-ink/5 sm:justify-start"
        >
          <Ban className="size-4" /> Blokiraj vreme
        </Link>
        <ShareSiteButton slug={tenant.slug} published={tenant.is_published} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        {/* Tamna hero kartica - današnji dan */}
        <div className="rounded-[2rem] bg-ink p-5 text-white sm:p-7">
          <div className="flex items-start justify-between">
            <div>
              <p className="flex items-center gap-2 text-sm font-semibold text-white/55">
                Termina danas
                <span className="flex size-6 items-center justify-center rounded-full bg-mint text-xs text-ink">
                  <ArrowUpRight className="size-3.5" />
                </span>
              </p>
              <p className="mt-1 text-5xl font-extrabold tracking-tight">
                <CountUp value={todayBookings.length} />
              </p>
            </div>
            <Link
              href="/admin/rezervacije"
              className="rounded-full border border-white/15 px-4 py-2 text-xs font-semibold text-white/80 transition-colors hover:bg-white/10"
            >
              Sve rezervacije
            </Link>
          </div>
          {next && nextLabel && (
            // Mobil: dva čista reda (bez tačke na početku drugog) u rounded-2xl
            // kartici - pill sa prelomljenim tekstom izgleda razlomljeno;
            // od sm naviše originalni jednolinijski pill
            <div className="mt-5 flex flex-col gap-0.5 rounded-2xl bg-mint px-4 py-3 text-sm text-ink sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-2 sm:gap-y-1 sm:rounded-full sm:py-2.5">
              <span className="font-bold">Sledeći termin {nextLabel}</span>
              <span className="text-ink/70">
                <span className="hidden sm:inline">· </span>
                {next.customer_name}
                {next.services?.name && ` · ${next.services.name}`}
              </span>
            </div>
          )}
          <div className="mt-6 space-y-2">
            {todayBookings.slice(0, 6).map((b) => (
              // Mobil: mreža sa vremenom levo i dva poravnata reda desno
              // (ime, pa usluga · zaposleni) - ništa se ne lomi ni ne seče;
              // od sm naviše originalni jednolinijski pill
              <div
                key={b.id}
                className="grid grid-cols-[auto_1fr] items-center gap-x-3 rounded-2xl bg-white/[0.06] px-4 py-2.5 text-sm sm:flex sm:rounded-full"
              >
                <span className="font-bold tabular-nums">{b.start_time.slice(0, 5)}</span>
                <span className="min-w-0 truncate font-semibold">{b.customer_name}</span>
                <span className="col-start-2 min-w-0 truncate text-xs text-white/50 sm:ml-auto sm:text-sm">
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
                + još {todayBookings.length - 6}{" "}
                {plural(todayBookings.length - 6, ["termin", "termina", "termina"])}
              </p>
            )}
          </div>
        </div>

        {/* Stat kolona */}
        <div className="grid gap-4">
          <div className="rounded-[2rem] bg-mint p-6">
            {/* Sabira i zakazane buduće termine - zato "očekivani" */}
            <p className="text-sm font-semibold text-ink/80">Očekivani promet ovog meseca</p>
            <p className="mt-1 text-4xl font-extrabold tracking-tight">
              <CountUp value={monthRevenue} suffix={` ${currency}`} />
            </p>
            <p className="mt-1 text-sm font-semibold text-ink/80">
              {monthRows.length} {plural(monthRows.length, ["termin", "termina", "termina"])}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {/* Stat kartice su linkovi - broj vodi na spisak iza njega */}
            <Link
              href="/admin/rezervacije"
              className="group rounded-[2rem] bg-lavender p-6 transition-shadow hover:shadow-[0_8px_32px_rgba(20,25,20,0.14)]"
            >
              <p className="flex items-center justify-between text-sm font-semibold text-ink/80">
                Ove nedelje
                <ArrowUpRight className="size-4 opacity-0 transition-opacity group-hover:opacity-100" />
              </p>
              <p className="mt-1 text-4xl font-extrabold tracking-tight">
                <CountUp value={weekRes.count ?? 0} />
              </p>
              <p className="mt-1 text-sm font-semibold text-ink/80">
                {plural(weekRes.count ?? 0, ["termin", "termina", "termina"])}
              </p>
            </Link>
            <Link
              href="/admin/rezervacije?prikaz=istorija"
              className="group rounded-[2rem] bg-white p-6 shadow-card transition-shadow hover:shadow-[0_8px_32px_rgba(20,25,20,0.14)]"
            >
              <p className="flex items-center justify-between text-sm font-semibold text-ink/70">
                Klijenata
                <ArrowUpRight className="size-4 opacity-0 transition-opacity group-hover:opacity-100" />
              </p>
              <p className="mt-1 text-4xl font-extrabold tracking-tight">
                <CountUp value={customersRes.count ?? 0} />
              </p>
              <p className="mt-1 text-sm font-semibold text-ink/70">u evidenciji</p>
            </Link>
          </div>
          <div className="rounded-[2rem] bg-white p-6 shadow-card">
            <Link
              href="/admin/usluge"
              className="group flex items-center justify-between text-base font-bold tracking-tight hover:underline"
            >
              Top usluge ovog meseca
              <ArrowUpRight className="size-4 opacity-0 transition-opacity group-hover:opacity-100" />
            </Link>
            {topServices.length === 0 && (
              <p className="mt-3 text-sm text-ink/70">Još nema rezervacija.</p>
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
