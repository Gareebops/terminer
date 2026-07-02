import { getAdminContext } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { formatDateISO } from "@/lib/booking/slots";
import type { Booking } from "@/lib/types";
import { BookingsTable } from "./bookings-table";

export default async function BookingsPage() {
  const { tenant } = await getAdminContext();
  const supabase = await createClient();
  const today = formatDateISO(new Date());

  const { data: bookings } = await supabase
    .from("bookings")
    .select("*, services(name), staff(name)")
    .eq("tenant_id", tenant.id)
    .gte("date", today)
    .order("date")
    .order("start_time");

  return (
    <div>
      <h1 className="text-2xl font-bold">Rezervacije</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Predstojeći termini, od danas pa nadalje.
      </p>
      <div className="mt-6">
        <BookingsTable
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
