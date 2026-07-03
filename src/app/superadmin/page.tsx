import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { subscriptionInfo } from "@/lib/billing";
import { formatAmount, invoiceLabel, type Invoice } from "@/lib/invoice";
import type { Tenant } from "@/lib/types";
import { assertSuperAdmin } from "./actions";
import { ExtendButtons } from "./extend-buttons";

const statusLabels: Record<string, { label: string; cls: string }> = {
  trial: { label: "Proba", cls: "bg-lavender text-ink" },
  active: { label: "Aktivan", cls: "bg-mint text-ink" },
  grace: { label: "Grace", cls: "bg-amber-300 text-amber-950" },
  expired: { label: "Istekao", cls: "bg-red-500 text-white" },
};

export default async function SuperAdminPage() {
  const me = await assertSuperAdmin();
  if (!me) notFound();

  const db = createAdminClient();
  const [{ data: tenants }, { data: allInvoices }] = await Promise.all([
    db.from("tenants").select("*").order("created_at"),
    db.from("invoices").select("*").order("created_at", { ascending: false }),
  ]);

  const invoicesByTenant = new Map<string, Invoice[]>();
  for (const inv of (allInvoices ?? []) as Invoice[]) {
    const list = invoicesByTenant.get(inv.tenant_id) ?? [];
    list.push(inv);
    invoicesByTenant.set(inv.tenant_id, list);
  }

  const rows = ((tenants ?? []) as Tenant[]).map((t) => ({
    tenant: t,
    sub: subscriptionInfo(t),
    invoices: invoicesByTenant.get(t.id) ?? [],
  }));

  return (
    <main className="min-h-screen flex-1 bg-canvas p-6 font-display text-ink">
      <div className="mx-auto max-w-4xl">
        <h1 className="text-3xl font-extrabold tracking-tight">Superadmin</h1>
        <p className="mt-1 text-sm font-medium text-ink/50">
          Saloni na platformi i stanje pretplata. Prijavljen: {me.email}
        </p>

        <div className="mt-6 space-y-3">
          {rows.map(({ tenant, sub, invoices }) => {
            const s = statusLabels[sub.status];
            return (
              <div
                key={tenant.id}
                className="rounded-2xl bg-white p-4 shadow-[0_4px_24px_rgba(20,25,20,0.06)]"
              >
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-40">
                  <p className="font-bold">{tenant.name}</p>
                  <Link
                    href={`/${tenant.slug}`}
                    target="_blank"
                    className="text-xs text-ink/50 hover:underline"
                  >
                    /{tenant.slug}
                  </Link>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-bold ${s.cls}`}
                >
                  {s.label}
                  {sub.status !== "expired" && ` · ${sub.daysLeft}d`}
                </span>
                <span className="text-xs font-medium text-ink/50">
                  {tenant.paid_until
                    ? `Plaćeno do ${new Date(tenant.paid_until).toLocaleDateString("sr-RS")}`
                    : `Proba do ${new Date(tenant.trial_ends_at).toLocaleDateString("sr-RS")}`}
                  {" · "}
                  {tenant.is_published ? "objavljen" : "neobjavljen"}
                </span>
                <div className="ml-auto">
                  <ExtendButtons tenantId={tenant.id} />
                </div>
              </div>
              {invoices.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-ink/5 pt-2 text-xs font-medium text-ink/60">
                  {invoices.slice(0, 6).map((inv) => (
                    <Link
                      key={inv.id}
                      href={`/faktura/${inv.id}`}
                      target="_blank"
                      className="hover:underline"
                    >
                      Faktura {invoiceLabel(inv)} ·{" "}
                      {formatAmount(Number(inv.amount))} RSD ·{" "}
                      {new Date(inv.created_at).toLocaleDateString("sr-RS")}
                    </Link>
                  ))}
                </div>
              )}
              </div>
            );
          })}
          {rows.length === 0 && (
            <p className="rounded-2xl border border-dashed border-ink/20 p-8 text-center text-ink/50">
              Još nema salona.
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
