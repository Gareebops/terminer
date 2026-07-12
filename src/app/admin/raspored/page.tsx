import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getAdminContext } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { nowInZone } from "@/lib/booking/timezone";
import { datumSr } from "@/lib/datum";
import { addDaysISO, mondayOf } from "@/lib/booking/schedule";
import type { OnboardingState, ScheduleException, Staff, WorkingHours } from "@/lib/types";
import { ScheduleGrid } from "./schedule-grid";
import { AbsenceDialog } from "./absence-dialog";
import { RasporedIntro } from "./intro-card";

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ od?: string }>;
}) {
  const { od } = await searchParams;
  const { tenant } = await getAdminContext();
  const supabase = await createClient();

  const today = nowInZone(tenant.timezone).date;
  const monday = mondayOf(od && /^\d{4}-\d{2}-\d{2}$/.test(od) ? od : today);
  const weekDates = Array.from({ length: 7 }, (_, i) => addDaysISO(monday, i));
  const prevWeek = addDaysISO(monday, -7);
  const nextWeek = addDaysISO(monday, 7);

  const [staffRes, hoursRes, exceptionsRes, settingsRes] = await Promise.all([
    supabase
      .from("staff")
      .select("*")
      .eq("tenant_id", tenant.id)
      .eq("is_active", true)
      .order("sort_order"),
    supabase.from("working_hours").select("*").eq("tenant_id", tenant.id),
    supabase
      .from("shift_assignments")
      .select("*")
      .eq("tenant_id", tenant.id)
      .gte("date", weekDates[0])
      .lte("date", weekDates[6]),
    supabase
      .from("site_settings")
      .select("onboarding")
      .eq("tenant_id", tenant.id)
      .maybeSingle(),
  ]);

  const staff = (staffRes.data ?? []) as Staff[];
  const onboarding = (settingsRes.data?.onboarding ?? {}) as OnboardingState;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Raspored</h1>
          <p className="mt-1 text-sm font-medium text-ink/70">
            Ko kad radi. Klik na dan menja samo taj datum; stalno radno vreme
            se menja kod zaposlenog.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <AbsenceDialog staff={staff} today={today} />
          <Button variant="outline" size="icon" asChild>
            <Link href={`/admin/raspored?od=${prevWeek}`}>
              <ChevronLeft className="size-4" />
            </Link>
          </Button>
          <span className="min-w-40 text-center text-sm font-medium">
            {datumSr(weekDates[0])} – {datumSr(weekDates[6])}
          </span>
          <Button variant="outline" size="icon" asChild>
            <Link href={`/admin/raspored?od=${nextWeek}`}>
              <ChevronRight className="size-4" />
            </Link>
          </Button>
        </div>
      </div>

      {!onboarding.raspored_seen && <RasporedIntro />}

      <div className="mt-6 rounded-[2rem] bg-white p-6 shadow-card">
        <ScheduleGrid
          weekDates={weekDates}
          today={today}
          staff={staff}
          hours={(hoursRes.data ?? []) as WorkingHours[]}
          exceptions={(exceptionsRes.data ?? []) as ScheduleException[]}
        />
      </div>
    </div>
  );
}
