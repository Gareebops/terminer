import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getAdminContext } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import type { Service, ShiftTemplate, Staff, WorkingHours } from "@/lib/types";
import { StaffDetail } from "./staff-detail";

export default async function StaffDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { tenant } = await getAdminContext();
  const supabase = await createClient();

  const [staffRes, servicesRes, linksRes, hoursRes, templatesRes] = await Promise.all([
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
      .from("shift_templates")
      .select("*")
      .eq("staff_id", id)
      .order("sort_order")
      .order("start_time"),
  ]);

  if (!staffRes.data) notFound();

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
          staffId={id}
          tenantId={tenant.id}
          photoUrl={(staffRes.data as Staff).photo_url}
          services={(servicesRes.data ?? []) as Service[]}
          assignedServiceIds={(linksRes.data ?? []).map((l) => l.service_id)}
          workingHours={(hoursRes.data ?? []) as WorkingHours[]}
          shiftTemplates={(templatesRes.data ?? []) as ShiftTemplate[]}
        />
      </div>
    </div>
  );
}
