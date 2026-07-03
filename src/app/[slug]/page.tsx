import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ArrowRight, AtSign, Clock, MapPin, Phone } from "lucide-react";
import { FadeUp, HeroItem, HeroStagger, ZoomOnHover } from "@/components/animate";
import { Button } from "@/components/ui/button";
import { formatPrice } from "@/lib/booking/slots";
import { nowInZone } from "@/lib/booking/timezone";
import { getTenantSite } from "@/lib/tenant";

// Redosled prikaza: ponedeljak..nedelja (day_of_week: 0=nedelja)
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const DAY_LABELS: Record<number, string> = {
  0: "Nedelja",
  1: "Ponedeljak",
  2: "Utorak",
  3: "Sreda",
  4: "Četvrtak",
  5: "Petak",
  6: "Subota",
};

export default async function SalonPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const site = await getTenantSite(slug);
  if (!site) notFound();

  const { tenant, settings, services, staff, gallery, openHours } = site;
  const mapsQuery =
    settings?.address || settings?.city
      ? encodeURIComponent([settings.address, settings.city].filter(Boolean).join(", "))
      : null;

  const hasHours = openHours.some(Boolean);
  const today = new Date(`${nowInZone(tenant.timezone).date}T12:00:00`).getDay();
  const todayHours = openHours[today];

  return (
    <main className="flex-1">
      {/* Neobjavljen sajt vide samo članovi salona (RLS) — podseti ih */}
      {!tenant.is_published && (
        <div className="bg-amber-500 px-4 py-2 text-center text-sm font-medium text-amber-950">
          Sajt još nije objavljen — vidiš ga samo ti. Objavi ga u{" "}
          <Link href="/admin/podesavanja" className="underline">
            Podešavanjima
          </Link>
          .
        </div>
      )}
      {/* Sticky zaglavlje */}
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <Link href={`/${tenant.slug}`} className="flex items-center gap-2.5">
            {settings?.logo_url ? (
              <Image
                src={settings.logo_url}
                alt=""
                width={36}
                height={36}
                className="size-9 rounded-lg object-cover"
              />
            ) : (
              <span className="flex size-9 items-center justify-center rounded-lg bg-primary font-bold text-primary-foreground">
                {tenant.name.charAt(0)}
              </span>
            )}
            <span className="font-semibold tracking-tight">{tenant.name}</span>
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

      {/* Hero — tekst levo, velika fotografija desno (MINERVA raspored) */}
      <section className="mx-auto max-w-5xl px-4 pb-16 pt-12 sm:pt-16">
        <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,460px)]">
          <HeroStagger>
            {settings?.city && (
              <HeroItem>
                <p className="text-sm font-semibold uppercase tracking-[0.25em] text-primary">
                  {settings.city}
                </p>
              </HeroItem>
            )}
            <HeroItem>
              <h1 className="mt-4 font-heading text-4xl font-bold leading-[1.08] tracking-tight sm:text-6xl">
                {settings?.hero_title || tenant.name}
              </h1>
            </HeroItem>
            {settings?.hero_subtitle && (
              <HeroItem>
                <p className="mt-5 max-w-lg text-lg text-muted-foreground">
                  {settings.hero_subtitle}
                </p>
              </HeroItem>
            )}
            <HeroItem>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button size="lg" asChild>
                  <Link href={`/${tenant.slug}/zakazi`}>
                    Zakaži termin <ArrowRight className="size-4" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <a href="#cenovnik">Pogledaj cenovnik</a>
                </Button>
              </div>
            </HeroItem>
            <HeroItem>
              <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
                {hasHours && (
                  <span className="flex items-center gap-1.5">
                    <Clock className="size-4 text-primary" />
                    {todayHours
                      ? `Danas ${todayHours.start}–${todayHours.end}`
                      : "Danas zatvoreno"}
                  </span>
                )}
                {settings?.address && (
                  <span className="flex items-center gap-1.5">
                    <MapPin className="size-4 text-primary" />
                    {[settings.address, settings.city].filter(Boolean).join(", ")}
                  </span>
                )}
                {settings?.phone && (
                  <a
                    href={`tel:${settings.phone}`}
                    className="flex items-center gap-1.5 hover:text-foreground"
                  >
                    <Phone className="size-4 text-primary" /> {settings.phone}
                  </a>
                )}
              </div>
            </HeroItem>
          </HeroStagger>

          <FadeUp>
            {settings?.hero_image_url ? (
              <div className="relative overflow-hidden rounded-3xl shadow-xl">
                <Image
                  src={settings.hero_image_url}
                  alt={tenant.name}
                  width={920}
                  height={1100}
                  priority
                  className="aspect-[4/5] w-full object-cover"
                />
              </div>
            ) : (
              <div className="flex aspect-[4/5] w-full items-center justify-center rounded-3xl bg-primary/10">
                <span className="font-heading text-8xl font-bold text-primary/40">
                  {tenant.name.charAt(0)}
                </span>
              </div>
            )}
          </FadeUp>
        </div>
      </section>

      {/* Usluge / cenovnik — kartice */}
      <section id="cenovnik" className="border-t bg-muted/40">
        <div className="mx-auto max-w-5xl scroll-mt-20 px-4 py-20">
          <FadeUp>
            <p className="text-sm font-semibold uppercase tracking-widest text-primary">
              Cenovnik
            </p>
            <h2 className="mt-2 font-heading text-3xl font-bold tracking-tight">
              Usluge
            </h2>
          </FadeUp>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {services.map((s, i) => (
              <FadeUp key={s.id} delay={Math.min(i * 0.05, 0.3)}>
                <Link
                  href={`/${tenant.slug}/zakazi`}
                  className="group flex h-full flex-col justify-between rounded-2xl border bg-background p-5 transition-all hover:-translate-y-0.5 hover:shadow-lg"
                >
                  <div>
                    <p className="font-heading text-lg font-semibold">{s.name}</p>
                    {s.description && (
                      <p className="mt-1 text-sm text-muted-foreground">
                        {s.description}
                      </p>
                    )}
                  </div>
                  <div className="mt-4 flex items-center justify-between">
                    <span className="flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                      <Clock className="size-3.5" />
                      {s.duration_minutes} min
                    </span>
                    <span className="flex items-center gap-2">
                      {settings?.show_prices !== false && (
                        <span className="font-heading text-lg font-bold text-primary">
                          {formatPrice(s.price, s.currency)}
                        </span>
                      )}
                      <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                    </span>
                  </div>
                </Link>
              </FadeUp>
            ))}
            {services.length === 0 && (
              <p className="py-4 text-muted-foreground">Usluge još nisu unete.</p>
            )}
          </div>
        </div>
      </section>

      {/* Tim — portret kartice */}
      {settings?.show_team !== false && staff.length > 0 && (
        <section className="mx-auto max-w-5xl px-4 py-20">
          <FadeUp>
            <p className="text-sm font-semibold uppercase tracking-widest text-primary">
              Tim
            </p>
            <h2 className="mt-2 font-heading text-3xl font-bold tracking-tight">
              Ko te šiša
            </h2>
          </FadeUp>
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {staff.map((m, i) => (
              <FadeUp key={m.id} delay={i * 0.08}>
                <ZoomOnHover className="overflow-hidden rounded-2xl">
                  {m.photo_url ? (
                    <Image
                      src={m.photo_url}
                      alt={m.name}
                      width={480}
                      height={600}
                      className="aspect-[4/5] w-full object-cover"
                    />
                  ) : (
                    <div className="flex aspect-[4/5] w-full items-center justify-center bg-primary/10">
                      <span className="font-heading text-6xl font-bold text-primary/40">
                        {m.name.charAt(0)}
                      </span>
                    </div>
                  )}
                </ZoomOnHover>
                <p className="mt-3 font-heading text-lg font-semibold">{m.name}</p>
                {m.bio && (
                  <p className="mt-0.5 text-sm text-muted-foreground">{m.bio}</p>
                )}
              </FadeUp>
            ))}
          </div>
        </section>
      )}

      {/* Galerija */}
      {settings?.show_gallery !== false && gallery.length > 0 && (
        <section className="border-t bg-muted/40">
          <div className="mx-auto max-w-5xl px-4 py-20">
            <FadeUp>
              <p className="text-sm font-semibold uppercase tracking-widest text-primary">
                Galerija
              </p>
              <h2 className="mt-2 font-heading text-3xl font-bold tracking-tight">
                Naši radovi
              </h2>
            </FadeUp>
            <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {gallery.map((g, i) => (
                <FadeUp key={g.id} delay={Math.min(i * 0.05, 0.3)}>
                  <ZoomOnHover className="overflow-hidden rounded-2xl">
                    <Image
                      src={g.image_url}
                      alt=""
                      width={400}
                      height={400}
                      className="aspect-square w-full object-cover"
                    />
                  </ZoomOnHover>
                </FadeUp>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Kontakt + radno vreme */}
      <section className="mx-auto max-w-5xl px-4 py-20">
        <div className="grid gap-12 sm:grid-cols-2">
          <FadeUp>
            <p className="text-sm font-semibold uppercase tracking-widest text-primary">
              Kontakt
            </p>
            <h2 className="mt-2 font-heading text-3xl font-bold tracking-tight">
              Gde smo
            </h2>
            <div className="mt-6 space-y-3 text-sm">
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
              {settings?.instagram && (
                <p className="flex items-center gap-2.5">
                  <AtSign className="size-4 text-primary" />
                  <a
                    href={`https://instagram.com/${settings.instagram.replace(/^@/, "")}`}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:underline"
                  >
                    {settings.instagram}
                  </a>
                </p>
              )}
            </div>
            {mapsQuery && (
              <Button variant="outline" className="mt-6" asChild>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${mapsQuery}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <MapPin className="size-4" /> Otvori u mapama
                </a>
              </Button>
            )}
          </FadeUp>

          {hasHours && (
            <FadeUp delay={0.1}>
              <p className="text-sm font-semibold uppercase tracking-widest text-primary">
                Radno vreme
              </p>
              <h2 className="mt-2 font-heading text-3xl font-bold tracking-tight">
                Kad radimo
              </h2>
              <dl className="mt-6 space-y-2 text-sm">
                {DAY_ORDER.map((d) => {
                  const h = openHours[d];
                  const isToday = d === today;
                  return (
                    <div
                      key={d}
                      className={`flex items-center justify-between rounded-lg px-3 py-2 ${
                        isToday ? "bg-primary/10 font-semibold" : ""
                      }`}
                    >
                      <dt>{DAY_LABELS[d]}</dt>
                      <dd className={h ? "" : "text-muted-foreground"}>
                        {h ? `${h.start} – ${h.end}` : "Zatvoreno"}
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </FadeUp>
          )}
        </div>
      </section>

      {/* CTA traka pre footera */}
      <section className="bg-primary text-primary-foreground">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-5 px-4 py-16 text-center">
          <FadeUp>
            <h2 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl">
              Spremni za novi izgled?
            </h2>
            <p className="mt-2 opacity-80">
              Izaberi uslugu, termin i gotovo — potvrda stiže odmah.
            </p>
            <Button
              size="lg"
              className="mt-6 border-0 bg-background text-foreground hover:bg-background/90"
              asChild
            >
              <Link href={`/${tenant.slug}/zakazi`}>
                Zakaži termin <ArrowRight className="size-4" />
              </Link>
            </Button>
          </FadeUp>
        </div>
      </section>

      <footer className="bg-zinc-950 text-zinc-400">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-8 text-sm">
          <span>
            © {new Date().getFullYear()} {tenant.name}
            {settings?.city ? ` · ${settings.city}` : ""}
          </span>
          <Link href="/" className="hover:text-white">
            Pokreće Terminer
          </Link>
        </div>
      </footer>
    </main>
  );
}
