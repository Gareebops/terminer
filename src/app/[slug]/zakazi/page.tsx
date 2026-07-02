import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getTenantSite } from "@/lib/tenant";
import { BookingWizard } from "./booking-wizard";

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
      <h1 className="mt-4 text-3xl font-bold tracking-tight">Zakaži termin</h1>
      <div className="mt-8">
        <BookingWizard
          slug={site.tenant.slug}
          services={site.services}
          staff={site.staff}
          staffServices={site.staffServices}
        />
      </div>
    </main>
  );
}
