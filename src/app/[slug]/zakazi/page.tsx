import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { nowInZone } from "@/lib/booking/timezone";
import { salonCanonicalBase } from "@/lib/seo";
import { getTenantSite } from "@/lib/tenant";
import { BookingWizard } from "./booking-wizard";

// Kroz template iz [slug]/layout postaje "Zakaži termin | {salon}";
// canonical prati kanonsku bazu salona (custom domen kad je povezan)
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const site = await getTenantSite(slug);
  if (!site) return { title: "Zakaži termin" };
  return {
    title: "Zakaži termin",
    alternates: { canonical: `${salonCanonicalBase(site.tenant)}/zakazi` },
  };
}

export default async function BookingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const site = await getTenantSite(slug);
  if (!site) notFound();

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10">
      <Link
        href={`/${site.tenant.slug}`}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:underline"
      >
        <ArrowLeft className="size-4" /> {site.tenant.name}
      </Link>
      <h1 className="mt-4 font-heading text-3xl font-bold tracking-tight">
        Zakaži termin
      </h1>
      <div className="mt-8">
        <BookingWizard
          slug={site.tenant.slug}
          salonName={site.tenant.name}
          address={
            site.settings
              ? [site.settings.address, site.settings.city].filter(Boolean).join(", ")
              : null
          }
          salonPhone={site.settings?.phone ?? null}
          // "Danas" u zoni salona - browser posetioca iz druge zone bi
          // traku dana pomerio za ceo dan
          todayISO={nowInZone(site.tenant.timezone).date}
          services={site.services}
          staff={site.staff}
          staffServices={site.staffServices}
        />
      </div>
    </main>
  );
}
