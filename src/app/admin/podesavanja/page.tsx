import { getAdminContext } from "@/lib/admin";
import { subscriptionInfo } from "@/lib/billing";
import { createClient } from "@/lib/supabase/server";
import type { Invoice } from "@/lib/invoice";
import type { SiteSettings } from "@/lib/types";
import { BillingCard } from "./billing-card";
import { SettingsShell } from "./settings-shell";

export default async function SettingsPage() {
  const { tenant } = await getAdminContext();
  const supabase = await createClient();

  const [{ data: settings }, { data: invoices }] = await Promise.all([
    supabase
      .from("site_settings")
      .select("*")
      .eq("tenant_id", tenant.id)
      .maybeSingle(),
    supabase
      .from("invoices")
      .select("*")
      .eq("tenant_id", tenant.id)
      .order("created_at", { ascending: false })
      .limit(12),
  ]);

  return (
    <div>
      <h1 className="text-3xl font-extrabold tracking-tight">Podešavanja</h1>
      <p className="mt-1 text-sm font-medium text-ink/50">
        Sadržaj tvog sajta na adresi /{tenant.slug}
      </p>
      <div className="mt-6 max-w-xl">
        <BillingCard
          sub={subscriptionInfo(tenant)}
          paidUntil={tenant.paid_until}
          billingInfo={tenant.billing_note ?? ""}
          invoices={(invoices ?? []) as Invoice[]}
        />
      </div>
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
