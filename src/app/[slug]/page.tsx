import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { AtSign, Clock, MapPin, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatPrice } from "@/lib/booking/slots";
import { getTenantSite } from "@/lib/tenant";

export default async function SalonPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const site = await getTenantSite(slug);
  if (!site) notFound();

  const { tenant, settings, services, staff, gallery } = site;

  return (
    <main className="flex-1">
      {/* Hero */}
      <section className="relative border-b bg-zinc-950 text-white">
        {settings?.hero_image_url && (
          <Image
            src={settings.hero_image_url}
            alt=""
            fill
            className="object-cover opacity-40"
          />
        )}
        <div className="relative mx-auto max-w-4xl px-4 py-28 text-center">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            {settings?.hero_title || tenant.name}
          </h1>
          {settings?.hero_subtitle && (
            <p className="mx-auto mt-4 max-w-xl text-lg text-zinc-300">
              {settings.hero_subtitle}
            </p>
          )}
          <Button size="lg" className="mt-8" asChild>
            <Link href={`/${tenant.slug}/zakazi`}>Zakaži termin</Link>
          </Button>
        </div>
      </section>

      {/* Usluge / cenovnik */}
      <section className="mx-auto max-w-4xl px-4 py-16">
        <h2 className="text-2xl font-bold">Usluge</h2>
        <div className="mt-6 space-y-1">
          {services.map((s) => (
            <div key={s.id}>
              <div className="flex items-center justify-between gap-4 py-3">
                <div>
                  <p className="font-medium">{s.name}</p>
                  {s.description && (
                    <p className="text-sm text-muted-foreground">{s.description}</p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-4 text-sm">
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Clock className="size-4" />
                    {s.duration_minutes} min
                  </span>
                  {settings?.show_prices !== false && (
                    <span className="font-semibold">
                      {formatPrice(s.price, s.currency)}
                    </span>
                  )}
                </div>
              </div>
              <Separator />
            </div>
          ))}
          {services.length === 0 && (
            <p className="text-muted-foreground">Usluge još nisu unete.</p>
          )}
        </div>
      </section>

      {/* Tim */}
      {settings?.show_team !== false && staff.length > 0 && (
        <section className="border-t bg-muted/40">
          <div className="mx-auto max-w-4xl px-4 py-16">
            <h2 className="text-2xl font-bold">Naš tim</h2>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {staff.map((m) => (
                <Card key={m.id}>
                  <CardContent className="pt-6 text-center">
                    {m.photo_url ? (
                      <Image
                        src={m.photo_url}
                        alt={m.name}
                        width={96}
                        height={96}
                        className="mx-auto size-24 rounded-full object-cover"
                      />
                    ) : (
                      <div className="mx-auto flex size-24 items-center justify-center rounded-full bg-muted text-2xl font-bold">
                        {m.name.charAt(0)}
                      </div>
                    )}
                    <p className="mt-3 font-semibold">{m.name}</p>
                    {m.bio && (
                      <p className="mt-1 text-sm text-muted-foreground">{m.bio}</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Galerija */}
      {settings?.show_gallery !== false && gallery.length > 0 && (
        <section className="mx-auto max-w-4xl px-4 py-16">
          <h2 className="text-2xl font-bold">Galerija</h2>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {gallery.map((g) => (
              <Image
                key={g.id}
                src={g.image_url}
                alt=""
                width={400}
                height={400}
                className="aspect-square rounded-lg object-cover"
              />
            ))}
          </div>
        </section>
      )}

      {/* Kontakt */}
      <section className="border-t">
        <div className="mx-auto max-w-4xl px-4 py-16">
          <h2 className="text-2xl font-bold">Kontakt</h2>
          <div className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
            {settings?.phone && (
              <p className="flex items-center gap-2">
                <Phone className="size-4 text-muted-foreground" />
                <a href={`tel:${settings.phone}`} className="hover:underline">
                  {settings.phone}
                </a>
              </p>
            )}
            {(settings?.address || settings?.city) && (
              <p className="flex items-center gap-2">
                <MapPin className="size-4 text-muted-foreground" />
                {[settings.address, settings.city].filter(Boolean).join(", ")}
              </p>
            )}
            {settings?.instagram && (
              <p className="flex items-center gap-2">
                <AtSign className="size-4 text-muted-foreground" />
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
        </div>
      </section>

      <footer className="border-t bg-muted/40">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-6 text-sm text-muted-foreground">
          <span>© {new Date().getFullYear()} {tenant.name}</span>
          <Link href="/" className="hover:underline">
            Pokreće Terminer
          </Link>
        </div>
      </footer>
    </main>
  );
}
