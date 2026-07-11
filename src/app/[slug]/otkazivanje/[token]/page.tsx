import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTenantSite } from "@/lib/tenant";
import { linkCancelExpiredNow } from "@/lib/booking/cancel";
import { nowInZone } from "@/lib/booking/timezone";
import { toMinutes } from "@/lib/booking/slots";
import { CancelCard } from "./cancel-card";

// Stranica iz mejla potvrde: gost preko cancel_token linka vidi svoju
// rezervaciju i može da je otkaže. Token je UUID iz mejla - RLS ne pušta
// anonimno čitanje bookinga, pa se red čita service-role klijentom, ali
// isključivo po (tenant, token) paru.

const TOKEN_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function CancelPage({
  params,
}: {
  params: Promise<{ slug: string; token: string }>;
}) {
  const { slug, token } = await params;
  const site = await getTenantSite(slug);
  if (!site || !TOKEN_RE.test(token)) notFound();

  const db = createAdminClient();
  const { data: booking } = await db
    .from("bookings")
    .select(
      "id, cancel_token, date, start_time, end_time, status, customer_name, created_at, starts_at, services(name), staff(name)"
    )
    .eq("tenant_id", site.tenant.id)
    .eq("cancel_token", token)
    .maybeSingle();

  const now = nowInZone(site.tenant.timezone);
  const isPast =
    !!booking &&
    (booking.date < now.date ||
      (booking.date === now.date &&
        toMinutes(booking.start_time.slice(0, 5)) <= now.minutes));
  // Linkom se otkazuje do 48h pre termina (bliži termin: sat od
  // zakazivanja) - posle toga se nudi telefon salona
  const windowExpired =
    !!booking &&
    !isPast &&
    linkCancelExpiredNow(booking.created_at, booking.starts_at);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10">
      <Link
        href={`/${site.tenant.slug}`}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:underline"
      >
        <ArrowLeft className="size-4" /> {site.tenant.name}
      </Link>
      <h1 className="mt-4 font-heading text-3xl font-bold tracking-tight">
        Otkazivanje termina
      </h1>
      <div className="mt-8">
        <CancelCard
          slug={site.tenant.slug}
          booking={
            booking
              ? {
                  id: booking.id,
                  cancelToken: booking.cancel_token,
                  date: booking.date,
                  startTime: booking.start_time.slice(0, 5),
                  endTime: booking.end_time.slice(0, 5),
                  status: booking.status,
                  customerName: booking.customer_name,
                  serviceName:
                    (booking.services as unknown as { name: string } | null)?.name ?? "Usluga",
                  staffName:
                    (booking.staff as unknown as { name: string } | null)?.name ?? "",
                }
              : null
          }
          isPast={isPast}
          windowExpired={windowExpired}
          salonPhone={site.settings?.phone ?? null}
        />
      </div>
    </main>
  );
}
