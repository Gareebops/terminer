import Link from "next/link";
import { notFound } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { datumSr, datumVremeSr } from "@/lib/datum";
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
import { AccountControls } from "./account-controls";
import { InvoiceActions } from "./invoice-actions";
import { TenantActions } from "./tenant-actions";

const statusLabels: Record<string, { label: string; cls: string }> = {
  trial: { label: "Proba", cls: "bg-lavender text-ink" },
  active: { label: "Aktivan", cls: "bg-mint text-ink" },
  grace: { label: "Grace", cls: "bg-amber-300 text-amber-950" },
  expired: { label: "Istekao", cls: "bg-red-600 text-white" },
};

const invoiceStatusCls: Record<string, string> = {
  issued: "bg-amber-200 text-amber-950",
  paid: "bg-mint text-ink",
  cancelled: "bg-ink/10 text-ink/70",
};

export default async function SuperAdminPage() {
  const me = await assertSuperAdmin();
  if (!me) notFound();

  const db = createAdminClient();
  const [
    { data: tenants },
    { data: allInvoices },
    { data: owners },
    { data: auditLog },
    { data: chats },
  ] = await Promise.all([
    db.from("tenants").select("*").order("created_at"),
    db.from("invoices").select("*, tenants(name, slug)").order("created_at", { ascending: false }),
    db.from("tenant_members").select("tenant_id, user_id").eq("role", "owner"),
    db
      .from("superadmin_audit_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(30),
    // Pre migracije chata upit vrati grešku (data null) - badge je tada 0
    db.from("support_conversations").select("last_message_at, support_read_at"),
  ]);

  // Aktivnost posle read markera = razgovor čeka odgovor (poruka vlasnika
  // pomera last_message_at; odgovor podrške pomera i support_read_at)
  const unreadChats = (chats ?? []).filter(
    (c) => new Date(c.last_message_at).getTime() > new Date(c.support_read_at).getTime()
  ).length;

  // Vlasnik po salonu (kontakt + status potvrde naloga)
  const ownerInfo = new Map<string, { email: string; confirmed: boolean }>();
  for (const o of owners ?? []) {
    const { data } = await db.auth.admin.getUserById(o.user_id);
    if (data.user?.email) {
      ownerInfo.set(o.tenant_id, {
        email: data.user.email,
        confirmed: !!data.user.email_confirmed_at,
      });
    }
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
      cls: "bg-white shadow-card",
    },
  ];

  const fmt = (d: string) => datumSr(d);

  return (
    <main className="min-h-screen flex-1 bg-canvas p-6 font-display text-ink">
      <div className="mx-auto max-w-5xl">
        <h1 className="text-3xl font-extrabold tracking-tight">Superadmin</h1>
        <p className="mt-1 text-sm font-medium text-ink/70">
          Saloni, pretplate i naplata. Prijavljen: {me.email}
        </p>

        <Link
          href="/superadmin/poruke"
          className="mt-4 inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white hover:opacity-85"
        >
          <MessageCircle className="size-4" /> Poruke podrške
          {unreadChats > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-mint px-1.5 text-xs font-bold text-ink">
              {unreadChats}
            </span>
          )}
        </Link>

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
                className="rounded-2xl bg-white p-4 shadow-card"
              >
                <div className="flex flex-wrap items-center gap-3">
                  <div className="min-w-44">
                    <p className="font-bold">{tenant.name}</p>
                    <p className="text-xs text-ink/70">
                      <Link href={`/${tenant.slug}`} target="_blank" className="hover:underline">
                        /{tenant.slug}
                      </Link>
                      {ownerInfo.get(tenant.id) && (
                        <>
                          {" · "}
                          <a
                            href={`mailto:${ownerInfo.get(tenant.id)!.email}`}
                            className="hover:underline"
                          >
                            {ownerInfo.get(tenant.id)!.email}
                          </a>
                          {!ownerInfo.get(tenant.id)!.confirmed && " · nalog nepotvrđen"}
                        </>
                      )}
                    </p>
                  </div>
                  {tenant.suspended_at && (
                    <span className="rounded-full bg-red-600 px-3 py-1 text-xs font-bold text-white">
                      SUSPENDOVAN
                    </span>
                  )}
                  <span className={`rounded-full px-3 py-1 text-xs font-bold ${s.cls}`}>
                    {s.label}
                    {sub.status !== "expired" && ` · ${sub.daysLeft}d`}
                  </span>
                  <span className="text-xs font-medium text-ink/70">
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
                <div className="mt-2 border-t border-ink/5 pt-2">
                  <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-ink/70">
                    Nalog
                  </p>
                  <AccountControls
                    tenantId={tenant.id}
                    slug={tenant.slug}
                    suspended={!!tenant.suspended_at}
                    ownerConfirmed={ownerInfo.get(tenant.id)?.confirmed ?? true}
                  />
                </div>
              </div>
            );
          })}
          {rows.length === 0 && (
            <p className="rounded-2xl border border-dashed border-ink/20 p-8 text-center text-ink/70">
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
              className="flex flex-wrap items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-card"
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
              <span className="text-sm text-ink/70">
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
            <p className="rounded-2xl border border-dashed border-ink/20 p-8 text-center text-ink/70">
              Još nema izdatih faktura.
            </p>
          )}
        </div>

        {/* Dnevnik superadmin akcija */}
        <h2 className="mt-10 text-xl font-extrabold tracking-tight">
          Dnevnik akcija
        </h2>
        <div className="mt-4 overflow-hidden rounded-2xl bg-white shadow-card">
          {(auditLog ?? []).map((entry) => (
            <div
              key={entry.id}
              className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-ink/5 px-4 py-2.5 text-sm last:border-0"
            >
              <span className="text-xs tabular-nums text-ink/70">
                {datumVremeSr(entry.created_at)}
              </span>
              <span className="font-bold">{entry.action}</span>
              {entry.tenant_label && (
                <span className="text-ink/70">{entry.tenant_label}</span>
              )}
              {entry.details && (
                <span className="truncate text-xs text-ink/70">
                  {JSON.stringify(entry.details)}
                </span>
              )}
            </div>
          ))}
          {(auditLog ?? []).length === 0 && (
            <p className="p-8 text-center text-ink/70">
              Još nema zabeleženih akcija.
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
