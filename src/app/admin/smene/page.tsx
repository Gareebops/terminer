import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getAdminContext } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { formatDateISO } from "@/lib/booking/slots";
import type { ShiftAssignment, ShiftTemplate, Staff } from "@/lib/types";
import { ShiftsGrid } from "./shifts-grid";

function mondayOf(dateStr?: string): Date {
  const d = dateStr ? new Date(`${dateStr}T12:00:00`) : new Date();
  const day = d.getDay(); // 0 = nedelja
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export default async function ShiftsPage({
  searchParams,
}: {
  searchParams: Promise<{ od?: string }>;
}) {
  const { od } = await searchParams;
  const { tenant } = await getAdminContext();
  const supabase = await createClient();

  const monday = mondayOf(od);
  const weekDates = Array.from({ length: 7 }, (_, i) =>
    formatDateISO(addDays(monday, i))
  );
  const prevWeek = formatDateISO(addDays(monday, -7));
  const nextWeek = formatDateISO(addDays(monday, 7));

  const [staffRes, templatesRes, assignmentsRes] = await Promise.all([
    supabase
      .from("staff")
      .select("*")
      .eq("tenant_id", tenant.id)
      .eq("is_active", true)
      .order("sort_order"),
    supabase
      .from("shift_templates")
      .select("*")
      .eq("tenant_id", tenant.id)
      .order("start_time"),
    supabase
      .from("shift_assignments")
      .select("*")
      .eq("tenant_id", tenant.id)
      .gte("date", weekDates[0])
      .lte("date", weekDates[6]),
  ]);

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Smene</h1>
          <p className="mt-1 text-sm font-medium text-ink/50">
            Raspored po datumu. &quot;Podrazumevano&quot; = važi radno vreme
            zaposlenog; smena za konkretan dan ima prednost.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" asChild>
            <Link href={`/admin/smene?od=${prevWeek}`}>
              <ChevronLeft className="size-4" />
            </Link>
          </Button>
          <span className="min-w-40 text-center text-sm font-medium">
            {new Date(`${weekDates[0]}T12:00:00`).toLocaleDateString("sr-RS")} –{" "}
            {new Date(`${weekDates[6]}T12:00:00`).toLocaleDateString("sr-RS")}
          </span>
          <Button variant="outline" size="icon" asChild>
            <Link href={`/admin/smene?od=${nextWeek}`}>
              <ChevronRight className="size-4" />
            </Link>
          </Button>
        </div>
      </div>

      <div className="mt-6 rounded-[2rem] bg-white p-6 shadow-[0_4px_24px_rgba(20,25,20,0.06)]">
        <ShiftsGrid
          weekDates={weekDates}
          staff={(staffRes.data ?? []) as Staff[]}
          templates={(templatesRes.data ?? []) as ShiftTemplate[]}
          assignments={(assignmentsRes.data ?? []) as ShiftAssignment[]}
        />
      </div>
    </div>
  );
}
