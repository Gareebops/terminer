import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { subscriptionInfo } from "@/lib/billing";
import {
  formatAmount,
  invoiceLabel,
  INVOICE_STATUS_LABELS,
  PLANS,
  type Invoice,
} from "@/lib/invoice";
import type { Tenant } from "@/lib/types";
import { assertSuperAdmin } from "./actions";
import { InvoiceActions } from "./invoice-actions";
import { TenantActions } from "./tenant-actions";

const statusLabels: Record<string, { label: string; cls: string }> = {
  trial: { label: "Proba", cls: "bg-lavender text-ink" },
  active: { label: "Aktivan", cls: "bg-mint text-ink" },
  grace: { label: "Grace", cls: "bg-amber-300 text-amber-950" },
  expired: { label: "Istekao", cls: "bg-red-500 text-white" },
};

const invoiceStatusCls: Record<string, string> = {
  issued: "bg-amber-200 text-amber-950",
  paid: "bg-mint text-ink",
  cancelled: "bg-ink/10 text-ink/50",
};

export default async function SuperAdminPage() {
  const me = await assertSuperAdmin();
  if (!me) notFound();

  const db = createAdminClient();
  const [{ data: tenants }, { data: allInvoices }, { data: owners }] =
    await Promise.all([
      db.from("tenants").select("*").order("created_at"),
      db.from("invoices").select("*, tenants(name, slug)").order("created_at", { ascending: false }),
      db.from("tenant_members").select("tenant_id, user_id").eq("role", "owner"),
    ]);

  // Email vlasnika po salonu (za kontakt)
  const ownerEmails = new Map<string, string>();
  for (const o of owners ?? []) {
    const { data } = await db.auth.admin.getUserById(o.user_id);
    if (data.user?.email) ownerEmails.set(o.tenant_id, data.user.email);
  }

  const invoices = (allInvoices ?? []) as (Invoice & {
    tenants: { name: string; slug: string } | null;
  })[];

  const rows = ((tenants ?? []) as Tenant[]).map((t) => ({
    tenant: t,
    sub: subscriptionInfo(t),
  }));

  const year = new Date().getFullYear();
  const stats = [
    {
      label: "Aktivni saloni",
      value: rows.filter((r) => r.sub.status === "active").length,
      cls: "bg-mint",
    },
    {
      label: "U probi",
      value: rows.filter((r) => r.sub.status === "trial").length,
      cls: "bg-lavender",
    },
    {
      label: `Naplaćeno ${year}.`,
      value: `${formatAmount(
        invoices
          .filter((i) => i.status === "paid" && i.year === year)
          .reduce((s, i) => s + Number(i.amount), 0)
      )} RSD`,
      cls: "bg-ink text-white",
    },
    {
      label: "Fakture na čekanju",
      value: invoices.filter((i) => i.status === "issued").length,
      cls: "bg-white shadow-[0_4px_24px_rgba(20,25,20,0.06)]",
    },
  ];

  const fmt = (d: string) => new Date(d).toLocaleDateString("sr-RS");

  return (
    <main className="min-h-screen flex-1 bg-canvas p-6 font-display text-ink">
      <div className="mx-auto max-w-5xl">
        <h1 className="text-3xl font-extrabold tracking-tight">Superadmin</h1>
        <p className="mt-1 text-sm font-medium text-ink/50">
          Saloni, pretplate i naplata. Prijavljen: {me.email}
        </p>

        {/* Statistika */}
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className={`rounded-[2rem] p-5 ${s.cls}`}>
              <p className="text-sm font-semibold opacity-60">{s.label}</p>
              <p className="mt-1 text-3xl font-extrabold tracking-tight">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Saloni */}
        <h2 className="mt-10 text-xl font-extrabold tracking-tight">Saloni</h2>
        <div className="mt-4 space-y-3">
          {rows.map(({ tenant, sub }) => {
            const s = statusLabels[sub.status];
            return (
              <div
                key={tenant.id}
                className="rounded-2xl bg-white p-4 shadow-[0_4px_24px_rgba(20,25,20,0.06)]"
              >
                <div className="flex flex-wrap items-center gap-3">
                  <div className="min-w-44">
                    <p className="font-bold">{tenant.name}</p>
                    <p className="text-xs text-ink/50">
                      <Link href={`/${tenant.slug}`} target="_blank" className="hover:underline">
                        /{tenant.slug}
                      </Link>
                      {ownerEmails.get(tenant.id) && (
                        <>
                          {" · "}
                          <a
                            href={`mailto:${ownerEmails.get(tenant.id)}`}
                            className="hover:underline"
                          >
                            {ownerEmails.get(tenant.id)}
                          </a>
                        </>
                      )}
                    </p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-bold ${s.cls}`}>
                    {s.label}
                    {sub.status !== "expired" && ` · ${sub.daysLeft}d`}
                  </span>
                  <span className="text-xs font-medium text-ink/50">
                    {tenant.paid_until
                      ? `Plaćeno do ${fmt(tenant.paid_until)}`
                      : `Proba do ${fmt(tenant.trial_ends_at)}`}
                    {" · "}
                    {tenant.is_published ? "objavljen" : "neobjavljen"}
                  </span>
                </div>
                <div className="mt-3 border-t border-ink/5 pt-3">
                  <TenantActions
                    tenantId={tenant.id}
                    status={sub.status}
                    paidUntil={tenant.paid_until}
                  />
                </div>
              </div>
            );
          })}
          {rows.length === 0 && (
            <p className="rounded-2xl border border-dashed border-ink/20 p-8 text-center text-ink/50">
              Još nema salona.
            </p>
          )}
        </div>

        {/* Fakture */}
        <h2 className="mt-10 text-xl font-extrabold tracking-tight">Fakture</h2>
        <div className="mt-4 space-y-2">
          {invoices.map((inv) => (
            <div
              key={inv.id}
              className="flex flex-wrap items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-[0_4px_24px_rgba(20,25,20,0.06)]"
            >
              <Link
                href={`/faktura/${inv.id}`}
                target="_blank"
                className="min-w-16 font-bold underline-offset-2 hover:underline"
              >
                {invoiceLabel(inv)}
              </Link>
              <span className="min-w-32 text-sm font-semibold">
                {inv.tenants?.name ?? "-"}
              </span>
              <span className="text-sm text-ink/60">
                {PLANS[inv.plan].label} · {formatAmount(Number(inv.amount))} RSD ·{" "}
                {fmt(inv.created_at)}
              </span>
              <span
                className={`rounded-full px-3 py-1 text-xs font-bold ${invoiceStatusCls[inv.status]}`}
              >
                {INVOICE_STATUS_LABELS[inv.status]}
                {inv.paid_at && ` ${fmt(inv.paid_at)}`}
              </span>
              <div className="ml-auto">
                {inv.status === "issued" && <InvoiceActions invoiceId={inv.id} />}
              </div>
            </div>
          ))}
          {invoices.length === 0 && (
            <p className="rounded-2xl border border-dashed border-ink/20 p-8 text-center text-ink/50">
              Još nema izdatih faktura.
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
