import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "@/components/icons";
import { getAdminContext } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import type { OnboardingState, Service, Staff, WorkingHours } from "@/lib/types";
import { StaffDetail } from "./staff-detail";

export default async function StaffDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { tenant } = await getAdminContext();
  const supabase = await createClient();

  const [staffRes, servicesRes, linksRes, hoursRes, settingsRes] = await Promise.all([
    supabase.from("staff").select("*").eq("id", id).eq("tenant_id", tenant.id).maybeSingle(),
    supabase
      .from("services")
      .select("*")
      .eq("tenant_id", tenant.id)
      .order("sort_order")
      .order("created_at"),
    supabase.from("staff_services").select("service_id").eq("staff_id", id),
    supabase.from("working_hours").select("*").eq("staff_id", id).order("day_of_week"),
    supabase
      .from("site_settings")
      .select("onboarding")
      .eq("tenant_id", tenant.id)
      .maybeSingle(),
  ]);

  if (!staffRes.data) notFound();

  // Dok je vodič za pokretanje aktivan, čuvanje radnog vremena nudi
  // povratak na sledeći korak vodiča
  const onboarding = (settingsRes.data?.onboarding ?? {}) as OnboardingState;
  const guideActive = !tenant.is_published && !onboarding.guide_hidden;

  return (
    <div className="max-w-2xl">
      <Link
        href="/admin/zaposleni"
        className="flex items-center gap-1 text-sm text-muted-foreground hover:underline"
      >
        <ArrowLeft className="size-4" /> Zaposleni
      </Link>
      <h1 className="mt-2 text-3xl font-extrabold tracking-tight">
        {(staffRes.data as Staff).name}
      </h1>
      <div className="mt-6">
        <StaffDetail
          staff={staffRes.data as Staff}
          services={(servicesRes.data ?? []) as Service[]}
          assignedServiceIds={(linksRes.data ?? []).map((l) => l.service_id)}
          workingHours={(hoursRes.data ?? []) as WorkingHours[]}
          guideActive={guideActive}
        />
      </div>
    </div>
  );
}
