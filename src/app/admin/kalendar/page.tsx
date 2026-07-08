import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getAdminContext } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { DAY_NAMES_SR, formatDateISO } from "@/lib/booking/slots";
import { nowInZone } from "@/lib/booking/timezone";
import { resolveWindow, type WorkWindow } from "@/lib/booking/schedule";
import type {
  BlockedSlot,
  Booking,
  ScheduleException,
  Service,
  Staff,
  WorkingHours,
} from "@/lib/types";
import { CalendarView } from "./calendar-view";
import { DateJump } from "./date-jump";

function addDays(dateStr: string, n: number): string {
  const d = new Date(`${dateStr}T12:00:00`);
  d.setDate(d.getDate() + n);
  return formatDateISO(d);
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ dan?: string; novo?: string; blokada?: string }>;
}) {
  const { dan, novo, blokada } = await searchParams;
  const { tenant } = await getAdminContext();
  const supabase = await createClient();

  // "Danas" u zoni salona - server na Vercelu radi u UTC, pa bi posle
  // ponoći po Beogradu prikazivao jučerašnji dan
  const now = nowInZone(tenant.timezone);
  const day = /^\d{4}-\d{2}-\d{2}$/.test(dan ?? "") ? dan! : now.date;
  const dayDate = new Date(`${day}T12:00:00`);

  const [staffRes, servicesRes, bookingsRes, blockedRes, hoursRes, exceptionsRes] =
    await Promise.all([
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
      // Završeni i "nije došao" ostaju vidljivi (prigušeno) - inače prošli
      // dani izgledaju prazno čim se status ažurira
      .in("status", ["pending", "confirmed", "completed", "no_show"])
      .order("start_time"),
    supabase
      .from("blocked_slots")
      .select("*")
      .eq("tenant_id", tenant.id)
      .eq("date", day),
    supabase.from("working_hours").select("*").eq("tenant_id", tenant.id),
    supabase
      .from("shift_assignments")
      .select("*")
      .eq("tenant_id", tenant.id)
      .eq("date", day),
  ]);

  // Radno okno po zaposlenom za taj dan (izuzetak gazi pravilo) -
  // vreme van okna se u gridu šrafira, "Ne radi" = cela kolona
  const staff = (staffRes.data ?? []) as Staff[];
  const hours = (hoursRes.data ?? []) as WorkingHours[];
  const exceptions = (exceptionsRes.data ?? []) as ScheduleException[];
  const windows: Record<string, WorkWindow> = Object.fromEntries(
    staff.map((m) => [
      m.id,
      resolveWindow(day, m, hours, exceptions.find((e) => e.staff_id === m.id) ?? null),
    ])
  );

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
          <DateJump day={day} />
          <Button variant="ghost" asChild>
            <Link href="/admin/kalendar">Danas</Link>
          </Button>
        </div>
      </div>

      <div className="mt-6">
        <CalendarView
          day={day}
          staff={staff}
          services={(servicesRes.data ?? []) as Service[]}
          bookings={
            (bookingsRes.data ?? []) as (Booking & { services: { name: string } | null })[]
          }
          blockedSlots={(blockedRes.data ?? []) as BlockedSlot[]}
          windows={windows}
          nowMinutes={day === now.date ? now.minutes : null}
          openNew={novo === "1"}
          openBlock={blokada === "1"}
        />
      </div>
    </div>
  );
}
