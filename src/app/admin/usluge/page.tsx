import { getAdminContext } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { guideNextInfo, isAppearanceTouched } from "@/lib/guide";
import type { OnboardingState, Service, SiteSettings } from "@/lib/types";
import { ServicesManager } from "./services-manager";

export default async function ServicesPage() {
  const { tenant } = await getAdminContext();
  const supabase = await createClient();

  const [{ data: services }, settingsRes, staffRes] = await Promise.all([
    supabase
      .from("services")
      .select("*")
      .eq("tenant_id", tenant.id)
      .order("sort_order")
      .order("created_at"),
    supabase
      .from("site_settings")
      .select("*")
      .eq("tenant_id", tenant.id)
      .maybeSingle(),
    supabase.from("staff").select("id").eq("tenant_id", tenant.id).eq("is_active", true),
  ]);

  // Dok korak vodiča "usluge" još nije završen (prazan cenovnik), uspešno
  // čuvanje otvara dijalog "Korak završen" sa CTA pravo na sledeći korak
  const settings = (settingsRes.data ?? null) as SiteSettings | null;
  const onboarding = (settings?.onboarding ?? {}) as OnboardingState;
  const guideActive = !tenant.is_published && !onboarding.guide_hidden;
  const staffIds = ((staffRes.data ?? []) as { id: string }[]).map((s) => s.id);
  const next =
    guideActive && (services?.length ?? 0) === 0
      ? guideNextInfo(
          {
            servicesCount: 0,
            staffCount: staffIds.length,
            scheduleConfirmed: !!onboarding.schedule_confirmed,
            appearanceTouched: isAppearanceTouched(settings),
            appearanceConfirmed: !!onboarding.appearance_confirmed,
            singleStaffId: staffIds.length === 1 ? staffIds[0] : null,
          },
          "services"
        )
      : null;

  return (
    <div>
      <h1 className="text-3xl font-extrabold tracking-tight">Usluge</h1>
      <p className="mt-1 text-sm font-medium text-ink/70">
        Usluge koje klijenti mogu da zakažu online.
      </p>
      <div className="mt-6">
        <ServicesManager
          services={(services ?? []) as Service[]}
          guideNext={next}
        />
      </div>
    </div>
  );
}
