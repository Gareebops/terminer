import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import {
  AtSign,
  CalendarClock,
  ChevronDown,
  Clock,
  MapPin,
  Phone,
} from "lucide-react";
import { FadeUp, HeroItem, HeroStagger } from "@/components/animate";
import { Button } from "@/components/ui/button";
import { DAY_NAMES_SR, formatPriceRange, fromMinutes } from "@/lib/booking/slots";
import { GalleryGrid } from "./gallery-grid";
import { MobileBookCta } from "./mobile-book-cta";
import {
  addDaysISO,
  dayOfWeek,
  mondayOf,
  resolveWindow,
} from "@/lib/booking/schedule";
import { nowInZone } from "@/lib/booking/timezone";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTenantSite, type TenantSite } from "@/lib/tenant";
import type { ScheduleException, WorkingHours } from "@/lib/types";

// Radno vreme salona za tekuću nedelju: unija radnih okana svih aktivnih
// zaposlenih (pravilo + izuzeci). working_hours javno nije čitljiv (RLS),
// pa server komponenta čita service-role klijentom - u browser ide samo
// izračunata lista.
async function getWeeklyHours(site: TenantSite): Promise<{
  rows: { name: string; label: string; isToday: boolean }[];
  openNow: boolean;
} | null> {
  if (site.staff.length === 0) return null;
  const db = createAdminClient();
  const now = nowInZone(site.tenant.timezone);
  const today = now.date;
  const nowHM = fromMinutes(now.minutes);
  const monday = mondayOf(today);
  const dates = Array.from({ length: 7 }, (_, i) => addDaysISO(monday, i));
  const [hoursRes, excRes] = await Promise.all([
    db.from("working_hours").select("*").eq("tenant_id", site.tenant.id),
    db
      .from("shift_assignments")
      .select("*")
      .eq("tenant_id", site.tenant.id)
      .gte("date", dates[0])
      .lte("date", dates[6]),
  ]);
  const hours = (hoursRes.data ?? []) as WorkingHours[];
  const exceptions = (excRes.data ?? []) as ScheduleException[];

  let openNow = false;
  const rows = dates.map((date) => {
    let start: string | null = null;
    let end: string | null = null;
    for (const member of site.staff) {
      const w = resolveWindow(
        date,
        member,
        hours,
        exceptions.find((e) => e.staff_id === member.id && e.date === date) ?? null
      );
      if (!w) continue;
      if (!start || w.start < start) start = w.start;
      if (!end || w.end > end) end = w.end;
    }
    if (date === today && start && end && nowHM >= start && nowHM < end) {
      openNow = true;
    }
    return {
      name: DAY_NAMES_SR[dayOfWeek(date)],
      label: start && end ? `${start} – ${end}` : "Ne radi",
      isToday: date === today,
    };
  });
  // Salon bez ijednog radnog dana: sekcija se ne prikazuje
  return rows.some((r) => r.label !== "Ne radi") ? { rows, openNow } : null;
}

export default async function SalonPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const site = await getTenantSite(slug);
  if (!site) notFound();

  const { tenant, settings, services, staff, gallery } = site;
  const weekly = await getWeeklyHours(site);
  const mapsQuery =
    settings?.address || settings?.city
      ? encodeURIComponent([settings.address, settings.city].filter(Boolean).join(", "))
      : null;
  // Podnosi i pun URL i @handle (stariji podaci pre normalizacije u akciji)
  const igHandle = settings?.instagram
    ? settings.instagram
        .trim()
        .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
        .replace(/^@/, "")
        .split(/[/?#]/)[0]
    : null;

  return (
    <main className="flex-1">
      {/* Neobjavljen sajt vide samo članovi salona (RLS) - podseti ih */}
      {!tenant.is_published && (
        <div className="bg-amber-500 px-4 py-2 text-center text-sm font-medium text-amber-950">
          Sajt još nije objavljen - vidiš ga samo ti. Klikni „Objavi sajt“ u{" "}
          <Link href="/admin" className="underline">
            admin panelu
          </Link>
          .
        </div>
      )}
      {/* Sticky zaglavlje */}
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <Link href={`/${tenant.slug}`} className="flex min-w-0 items-center gap-2.5">
            {settings?.logo_url ? (
              <Image
                src={settings.logo_url}
                alt=""
                width={36}
                height={36}
                className="size-9 shrink-0 rounded-[var(--surface-radius)] object-cover"
              />
            ) : (
              <span className="flex size-9 shrink-0 items-center justify-center rounded-[var(--surface-radius)] bg-primary font-bold text-primary-foreground">
                {tenant.name.charAt(0)}
              </span>
            )}
            <span className="truncate font-semibold tracking-tight">{tenant.name}</span>
          </Link>
          <div className="flex items-center gap-2">
            {settings?.phone && (
              <Button variant="ghost" size="sm" className="hidden sm:inline-flex" asChild>
                <a href={`tel:${settings.phone}`}>
                  <Phone className="size-4" /> {settings.phone}
                </a>
              </Button>
            )}
            <Button size="sm" asChild>
              <Link href={`/${tenant.slug}/zakazi`}>Zakaži termin</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative isolate overflow-hidden bg-zinc-950 text-white">
        {settings?.hero_image_url && (
          <Image
            src={settings.hero_image_url}
            alt=""
            fill
            priority
            className="object-cover opacity-50"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/40 to-zinc-950/20" />
        <div className="relative mx-auto max-w-4xl px-4 pb-28 pt-24 text-center sm:pb-36 sm:pt-32">
          <HeroStagger>
            {settings?.city && (
              <HeroItem>
                <p className="text-sm font-medium uppercase tracking-[0.25em] text-zinc-300">
                  {settings.city}
                </p>
              </HeroItem>
            )}
            <HeroItem>
              <h1 className="mt-4 font-heading text-4xl font-bold tracking-tight sm:text-6xl">
                {settings?.hero_title || tenant.name}
              </h1>
            </HeroItem>
            {settings?.hero_subtitle && (
              <HeroItem>
                <p className="mx-auto mt-5 max-w-xl text-lg text-zinc-300">
                  {settings.hero_subtitle}
                </p>
              </HeroItem>
            )}
            <HeroItem>
              <div className="mt-9 flex flex-wrap justify-center gap-3">
                <Button size="lg" asChild>
                  <Link href={`/${tenant.slug}/zakazi`}>Zakaži termin</Link>
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="border-white/25 bg-white/5 text-white hover:bg-white/15 hover:text-white"
                  asChild
                >
                  <a href="#cenovnik">Pogledaj cenovnik</a>
                </Button>
              </div>
            </HeroItem>
            {(settings?.address || settings?.phone) && (
              <HeroItem>
                <div className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-zinc-300">
                  {settings?.address && (
                    <span className="flex items-center gap-1.5">
                      <MapPin className="size-4" />
                      {[settings.address, settings.city].filter(Boolean).join(", ")}
                    </span>
                  )}
                  {settings?.phone && (
                    <a href={`tel:${settings.phone}`} className="flex items-center gap-1.5 hover:text-white">
                      <Phone className="size-4" /> {settings.phone}
                    </a>
                  )}
                </div>
              </HeroItem>
            )}
          </HeroStagger>
        </div>
        {/* Scroll cue: tamni hero ume da deluje kao kraj stranice,
            pogotovo na telefonu - pulsirajuća strelica vodi ka ponudi */}
        <a
          href="#cenovnik"
          aria-label="Pogledaj ponudu"
          className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full p-2 text-white/50 transition-colors hover:text-white motion-safe:animate-bounce"
        >
          <ChevronDown className="size-5" />
        </a>
      </section>

      {/* Usluge / cenovnik */}
      <section id="cenovnik" className="mx-auto max-w-4xl scroll-mt-20 px-4 py-20">
        <FadeUp>
        <p className="text-sm font-semibold uppercase tracking-widest text-primary">
          Ponuda
        </p>
        <h2 className="mt-2 font-heading text-3xl font-bold tracking-tight">Usluge i cenovnik</h2>
        <div className="mt-8 divide-y">
          {services.map((s) => (
            <div
              key={s.id}
              className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-4"
            >
              <div className="min-w-0">
                <p className="break-words font-medium">{s.name}</p>
                {s.description && (
                  <p className="mt-0.5 break-words text-sm text-muted-foreground">
                    {s.description}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-4">
                <span className="flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                  <Clock className="size-3.5" />
                  {s.duration_minutes} min
                </span>
                {settings?.show_prices !== false && (
                  <span className="min-w-20 text-right font-semibold text-primary">
                    {formatPriceRange(s.price, s.price_max, s.currency)}
                  </span>
                )}
              </div>
            </div>
          ))}
          {services.length === 0 && (
            <p className="py-4 text-muted-foreground">Usluge još nisu unete.</p>
          )}
        </div>
        <Button className="mt-6" size="lg" asChild>
          <Link href={`/${tenant.slug}/zakazi`}>Zakaži termin</Link>
        </Button>
        </FadeUp>
      </section>

      {/* Tim */}
      {settings?.show_team !== false && staff.length > 0 && (
        <section className="border-t bg-muted/40">
          <div className="mx-auto max-w-4xl px-4 py-20">
            <FadeUp>
              <p className="text-sm font-semibold uppercase tracking-widest text-primary">
                Tim
              </p>
              <h2 className="mt-2 font-heading text-3xl font-bold tracking-tight">Upoznaj naš tim</h2>
            </FadeUp>
            <div className="mt-8 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {staff.map((m, i) => (
                <FadeUp key={m.id} delay={i * 0.08} className="text-center">
                  {m.photo_url ? (
                    <Image
                      src={m.photo_url}
                      alt={m.name}
                      width={112}
                      height={112}
                      className="mx-auto size-28 rounded-full object-cover shadow-md"
                    />
                  ) : (
                    <div className="mx-auto flex size-28 items-center justify-center rounded-full bg-primary/10 text-3xl font-bold text-primary">
                      {m.name.charAt(0)}
                    </div>
                  )}
                  <p className="mt-4 font-semibold">{m.name}</p>
                  {m.bio && (
                    <p className="mt-1 text-sm text-muted-foreground">{m.bio}</p>
                  )}
                </FadeUp>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Galerija */}
      {settings?.show_gallery !== false && gallery.length > 0 && (
        <section className="mx-auto max-w-4xl px-4 py-20">
          <FadeUp>
            <p className="text-sm font-semibold uppercase tracking-widest text-primary">
              Galerija
            </p>
            <h2 className="mt-2 font-heading text-3xl font-bold tracking-tight">Izdvojeni radovi</h2>
          </FadeUp>
          <GalleryGrid images={gallery} />
        </section>
      )}

      {/* Kontakt */}
      <section className="border-t">
        <div className="mx-auto max-w-4xl px-4 py-20">
          <FadeUp>
          <p className="text-sm font-semibold uppercase tracking-widest text-primary">
            Kontakt
          </p>
          <h2 className="mt-2 font-heading text-3xl font-bold tracking-tight">Poseti nas</h2>
          <div className="mt-8 flex flex-wrap items-start justify-between gap-6">
            <div className="space-y-3 text-sm">
              {settings?.phone && (
                <p className="flex items-center gap-2.5">
                  <Phone className="size-4 text-primary" />
                  <a href={`tel:${settings.phone}`} className="hover:underline">
                    {settings.phone}
                  </a>
                </p>
              )}
              {(settings?.address || settings?.city) && (
                <p className="flex items-center gap-2.5">
                  <MapPin className="size-4 text-primary" />
                  {[settings.address, settings.city].filter(Boolean).join(", ")}
                </p>
              )}
              {igHandle && (
                <p className="flex items-center gap-2.5">
                  <AtSign className="size-4 text-primary" />
                  <a
                    href={`https://instagram.com/${igHandle}`}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:underline"
                  >
                    @{igHandle}
                  </a>
                </p>
              )}
            </div>
            {weekly && (
              <div className="min-w-56">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <CalendarClock className="size-4 text-primary" /> Radno vreme
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      weekly.openNow
                        ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    <span
                      className={`size-1.5 rounded-full ${
                        weekly.openNow ? "bg-emerald-500" : "bg-muted-foreground/50"
                      }`}
                    />
                    {weekly.openNow ? "Otvoreno" : "Zatvoreno"}
                  </span>
                </p>
                <dl className="mt-3 space-y-1.5 text-sm">
                  {weekly.rows.map((d) => (
                    <div
                      key={d.name}
                      className={`flex items-center justify-between gap-6 ${
                        d.isToday ? "font-semibold" : ""
                      }`}
                    >
                      <dt className={d.isToday ? "" : "text-muted-foreground"}>
                        {d.name}
                      </dt>
                      <dd
                        className={
                          d.label === "Ne radi" ? "text-muted-foreground" : ""
                        }
                      >
                        {d.label}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
            {mapsQuery && (
              <Button variant="outline" asChild>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${mapsQuery}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <MapPin className="size-4" /> Otvori u mapama
                </a>
              </Button>
            )}
          </div>
          </FadeUp>
        </div>
      </section>

      <footer className="bg-zinc-950 text-zinc-400">
        {/* pb na telefonu: plutajuće CTA dugme ne sme da prekrije sadržaj */}
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-8 pb-24 text-sm sm:pb-8">
          <span>
            © {new Date().getFullYear()} {tenant.name}
          </span>
          <Link href="/" className="hover:text-white">
            Pokreće Terminer
          </Link>
        </div>
      </footer>

      <MobileBookCta slug={tenant.slug} />
    </main>
  );
}
