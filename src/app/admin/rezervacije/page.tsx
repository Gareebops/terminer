import Link from "next/link";
import { getAdminContext } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { nowInZone } from "@/lib/booking/timezone";
import type { Booking } from "@/lib/types";
import { BookingsTable } from "./bookings-table";

// Istorija se ne lista unedogled - za starije uvek postoji pretraga
const HISTORY_LIMIT = 200;

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ prikaz?: string }>;
}) {
  const { prikaz } = await searchParams;
  const showHistory = prikaz === "istorija";
  const { tenant } = await getAdminContext();
  const supabase = await createClient();
  // "Danas" u zoni salona, ne servera (Vercel radi u UTC)
  const today = nowInZone(tenant.timezone).date;

  let query = supabase
    .from("bookings")
    .select("*, services(name), staff(name)")
    .eq("tenant_id", tenant.id);
  query = showHistory
    ? query.lt("date", today).order("date", { ascending: false }).order("start_time", { ascending: false }).limit(HISTORY_LIMIT)
    : query.gte("date", today).order("date").order("start_time");
  const { data: bookings } = await query;

  const tabClass = (active: boolean) =>
    `rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
      active ? "bg-ink text-white" : "text-ink/60 hover:bg-ink/5"
    }`;

  return (
    <div>
      <h1 className="text-3xl font-extrabold tracking-tight">Rezervacije</h1>
      <p className="mt-1 text-sm font-medium text-ink/50">
        {showHistory
          ? `Prošli termini, najnoviji prvo (poslednjih ${HISTORY_LIMIT}).`
          : "Predstojeći termini, od danas pa nadalje."}
      </p>
      <div className="mt-4 flex w-fit gap-1 rounded-full bg-white p-1 shadow-[0_4px_24px_rgba(20,25,20,0.06)]">
        <Link href="/admin/rezervacije" className={tabClass(!showHistory)}>
          Predstojeće
        </Link>
        <Link
          href="/admin/rezervacije?prikaz=istorija"
          className={tabClass(showHistory)}
        >
          Istorija
        </Link>
      </div>
      <div className="mt-4 rounded-[2rem] bg-white p-6 shadow-[0_4px_24px_rgba(20,25,20,0.06)]">
        <BookingsTable
          history={showHistory}
          bookings={
            (bookings ?? []) as (Booking & {
              services: { name: string } | null;
              staff: { name: string } | null;
            })[]
          }
        />
      </div>
    </div>
  );
}
