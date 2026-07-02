import { getAdminContext } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import type { SiteSettings } from "@/lib/types";
import { SettingsForm } from "./settings-form";

export default async function SettingsPage() {
  const { tenant } = await getAdminContext();
  const supabase = await createClient();

  const { data: settings } = await supabase
    .from("site_settings")
    .select("*")
    .eq("tenant_id", tenant.id)
    .maybeSingle();

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-bold">Podešavanja</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Sadržaj tvog sajta na adresi /{tenant.slug}
      </p>
      <div className="mt-6">
        <SettingsForm
          settings={settings as SiteSettings | null}
          isPublished={tenant.is_published}
          slug={tenant.slug}
        />
      </div>
    </div>
  );
}
