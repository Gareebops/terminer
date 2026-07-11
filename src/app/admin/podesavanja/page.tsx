import Link from "next/link";
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
      {onboarding.guide_hidden && !tenant.is_published && <ShowGuideLink />}
      {/* Korak "Doteraj izgled" vodi ovamo; izmene se čuvaju tiho (bez
          toasta), pa je ovo jedini put nazad u vodič sa ove stranice */}
      {!onboarding.guide_hidden && !tenant.is_published && (
        <div className="mt-8 text-center">
          <Link
            href="/admin"
            className="text-xs text-ink/70 underline-offset-2 hover:underline"
          >
            Nastavi vodič na Početnoj →
          </Link>
        </div>
      )}
    </div>
  );
}
