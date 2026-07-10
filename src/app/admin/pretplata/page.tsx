import { getAdminContext } from "@/lib/admin";
import { subscriptionInfo } from "@/lib/billing";
import { createClient } from "@/lib/supabase/server";
import type { Invoice } from "@/lib/invoice";
import { PretplataClient } from "./pretplata-client";

// Pretplata i naplata - namerno odvojena od podešavanja izgleda:
// novac i evidencija su druga briga od estetike sajta.
export default async function SubscriptionPage() {
  const { tenant } = await getAdminContext();
  const supabase = await createClient();

  const { data: invoices } = await supabase
    .from("invoices")
    .select("*")
    .eq("tenant_id", tenant.id)
    .order("created_at", { ascending: false });

  // Gledanje cena u modalu ume da izda i mesečnu i godišnju fakturu za
  // isti period - vlasniku se za period prikazuje samo najskorija izdata
  // (plaćene i stornirane se ne diraju; superadmin i dalje vidi sve)
  const rows = (invoices ?? []) as Invoice[];
  const visibleInvoices = rows.filter((inv) => {
    if (inv.status !== "issued") return true;
    const newestForPeriod = rows.find(
      (o) => o.status === "issued" && o.period_from === inv.period_from
    );
    return newestForPeriod?.id === inv.id;
  });

  return (
    <div>
      <h1 className="text-3xl font-extrabold tracking-tight">Pretplata</h1>
      <p className="mt-1 text-sm font-medium text-ink/70">
        Status članarine, plaćanje i istorija uplata
      </p>
      <div className="mt-6 max-w-2xl">
        <PretplataClient
          sub={subscriptionInfo(tenant)}
          paidUntil={tenant.paid_until}
          trialEndsAt={tenant.trial_ends_at}
          billingInfo={tenant.billing_note ?? ""}
          invoices={visibleInvoices}
        />
      </div>
    </div>
  );
}
