import Link from "next/link";
import { getAdminContext } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { nowInZone } from "@/lib/booking/timezone";
import { normalizePhone } from "@/lib/phone";
import type { Booking } from "@/lib/types";
import { BookingsTable } from "./bookings-table";

// Istorija se ne lista unedogled - pretraga ide kroz bazu (dole), pa
// nalazi i termine starije od ovog limita
const HISTORY_LIMIT = 200;

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ prikaz?: string; q?: string }>;
}) {
  const { prikaz, q } = await searchParams;
  const showHistory = prikaz === "istorija";
  const term = (q ?? "").trim();
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

  // Pretraga u BAZI (ime ili telefon) - klijentsko filtriranje bi videlo
  // samo učitani limit istorije. Vrednosti idu u PostgREST or() pa se
  // svode na bezbedan skup znakova; telefon se poredi normalizovan.
  if (term.length >= 2) {
    const nameTerm = term.replace(/[^\p{L}\p{N} ]/gu, "").trim();
    const phoneDigits = normalizePhone(term).replace(/\D/g, "");
    const filters: string[] = [];
    if (nameTerm.length >= 2) filters.push(`customer_name.ilike.*${nameTerm}*`);
    if (phoneDigits.length >= 3) filters.push(`customer_phone.ilike.*${phoneDigits}*`);
    if (filters.length > 0) query = query.or(filters.join(","));
  }

  const { data: bookings } = await query;

  const tabClass = (active: boolean) =>
    `rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
      active ? "bg-ink text-white" : "text-ink/70 hover:bg-ink/5"
    }`;

  const tabHref = (istorija: boolean) => {
    const params = new URLSearchParams();
    if (istorija) params.set("prikaz", "istorija");
    if (term) params.set("q", term);
    const qs = params.toString();
    return `/admin/rezervacije${qs ? `?${qs}` : ""}`;
  };

  return (
    <div>
      <h1 className="text-3xl font-extrabold tracking-tight">Rezervacije</h1>
      <p className="mt-1 text-sm font-medium text-ink/70">
        {showHistory
          ? "Prošli termini, najnoviji prvo."
          : "Predstojeći termini, od danas pa nadalje."}
      </p>
      <div className="mt-4 flex w-fit gap-1 rounded-full bg-white p-1 shadow-card">
        <Link href={tabHref(false)} className={tabClass(!showHistory)}>
          Predstojeće
        </Link>
        <Link href={tabHref(true)} className={tabClass(showHistory)}>
          Istorija
        </Link>
      </div>
      <div className="mt-4 rounded-[2rem] bg-white p-6 shadow-card">
        <BookingsTable
          history={showHistory}
          query={term}
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
