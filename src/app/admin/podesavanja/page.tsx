import { getAdminContext } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import type { SiteSettings } from "@/lib/types";
import { SettingsShell } from "./settings-shell";

export default async function SettingsPage() {
  const { tenant } = await getAdminContext();
  const supabase = await createClient();

  const { data: settings } = await supabase
    .from("site_settings")
    .select("*")
    .eq("tenant_id", tenant.id)
    .maybeSingle();

  return (
    <div>
      <h1 className="text-3xl font-extrabold tracking-tight">Podešavanja</h1>
      <p className="mt-1 text-sm font-medium text-ink/50">
        Sadržaj tvog sajta na adresi /{tenant.slug}
      </p>
      <div className="mt-6">
        <SettingsShell
          tenantId={tenant.id}
          slug={tenant.slug}
          isPublished={tenant.is_published}
          settings={settings as SiteSettings | null}
        />
      </div>
    </div>
  );
}
