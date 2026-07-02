import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getAdminContext } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { formatDateISO, DAY_NAMES_SR } from "@/lib/booking/slots";
import type { BlockedSlot, Booking, Service, Staff } from "@/lib/types";
import { CalendarView } from "./calendar-view";

function addDays(dateStr: string, n: number): string {
  const d = new Date(`${dateStr}T12:00:00`);
  d.setDate(d.getDate() + n);
  return formatDateISO(d);
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ dan?: string }>;
}) {
  const { dan } = await searchParams;
  const { tenant } = await getAdminContext();
  const supabase = await createClient();

  const day = /^\d{4}-\d{2}-\d{2}$/.test(dan ?? "") ? dan! : formatDateISO(new Date());
  const dayDate = new Date(`${day}T12:00:00`);

  const [staffRes, servicesRes, bookingsRes, blockedRes] = await Promise.all([
    supabase
      .from("staff")
      .select("*")
      .eq("tenant_id", tenant.id)
      .eq("is_active", true)
      .order("sort_order"),
    supabase
      .from("services")
      .select("*")
      .eq("tenant_id", tenant.id)
      .eq("is_active", true)
      .order("sort_order"),
    supabase
      .from("bookings")
      .select("*, services(name)")
      .eq("tenant_id", tenant.id)
      .eq("date", day)
      .in("status", ["pending", "confirmed"])
      .order("start_time"),
    supabase
      .from("blocked_slots")
      .select("*")
      .eq("tenant_id", tenant.id)
      .eq("date", day),
  ]);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-extrabold tracking-tight">Kalendar</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" asChild>
            <Link href={`/admin/kalendar?dan=${addDays(day, -1)}`}>
              <ChevronLeft className="size-4" />
            </Link>
          </Button>
          <span className="min-w-44 text-center text-sm font-medium">
            {DAY_NAMES_SR[dayDate.getDay()]},{" "}
            {dayDate.toLocaleDateString("sr-RS")}
          </span>
          <Button variant="outline" size="icon" asChild>
            <Link href={`/admin/kalendar?dan=${addDays(day, 1)}`}>
              <ChevronRight className="size-4" />
            </Link>
          </Button>
          <Button variant="ghost" asChild>
            <Link href="/admin/kalendar">Danas</Link>
          </Button>
        </div>
      </div>

      <div className="mt-6">
        <CalendarView
          day={day}
          staff={(staffRes.data ?? []) as Staff[]}
          services={(servicesRes.data ?? []) as Service[]}
          bookings={
            (bookingsRes.data ?? []) as (Booking & { services: { name: string } | null })[]
          }
          blockedSlots={(blockedRes.data ?? []) as BlockedSlot[]}
        />
      </div>
    </div>
  );
}
