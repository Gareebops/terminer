import { getAdminContext } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import type { OnboardingState, SiteSettings } from "@/lib/types";
import { SettingsShell } from "./settings-shell";
import { ShowGuideLink } from "./show-guide-link";

// Podešavanja = izgled i sadržaj sajta. Naplata je namerno odvojena
// na /admin/pretplata - druga briga, druga stranica.
export default async function SettingsPage() {
  const { tenant } = await getAdminContext();
  const supabase = await createClient();

  const { data: settings } = await supabase
    .from("site_settings")
    .select("*")
    .eq("tenant_id", tenant.id)
    .maybeSingle();

  const onboarding = ((settings as SiteSettings | null)?.onboarding ??
    {}) as OnboardingState;

  return (
    <div>
      <h1 className="text-3xl font-extrabold tracking-tight">Podešavanja</h1>
      <p className="mt-1 text-sm font-medium text-ink/70">
        Sadržaj tvog sajta na adresi /{tenant.slug}
      </p>
      <div className="mt-6">
        <SettingsShell
          tenantId={tenant.id}
          slug={tenant.slug}
          customDomain={tenant.custom_domain ?? null}
          settings={settings as SiteSettings | null}
        />
      </div>
      {/* Put nazad u vodič drži traka vodiča u layoutu; ovaj link vraća
          SAKRIVEN vodič */}
      {onboarding.guide_hidden && !tenant.is_published && <ShowGuideLink />}
    </div>
  );
}
