import Link from "next/link";
import { notFound } from "next/navigation";
import { MessageCircle, TriangleAlert } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { datumSr, datumVremeSr } from "@/lib/datum";
import { subscriptionInfo } from "@/lib/billing";
import { CRON_MARKER_ACTION } from "@/lib/audit";
import { listAllUsers } from "@/lib/auth-users";
import { formatAmount, invoiceLabel, PLANS, type Invoice } from "@/lib/invoice";
import { isOnline, presenceLabel } from "@/lib/presence";
import type { Tenant } from "@/lib/types";
import { assertSuperAdmin } from "./actions";
import { AuditLogList, type AuditRow } from "./audit-log-list";
import { InvoiceList, type InvoiceRow } from "./invoice-list";
import { OrphanAccounts, type OrphanAccount } from "./orphan-accounts";
import { SalonList, type SalonRow } from "./salon-list";

export default async function SuperAdminPage() {
  const me = await assertSuperAdmin();
  if (!me) notFound();

  const db = createAdminClient();
  // Aktivnost se meri po created_at rezervacije (kada je UPISANA, ne kada
  // je termin) - to hvata i admin upis i online zakazivanje kao korišćenje.
  // new Date() umesto Date.now() - react-hooks/purity brani Date.now() u
  // renderu (isti obrazac kao ostatak fajla)
  const now = new Date();
  const since30 = new Date(now.getTime() - 30 * 86_400_000).toISOString();
  const [
    { data: tenants },
    { data: allInvoices },
    { data: owners },
    { data: allMembers },
    { data: auditLog },
    { data: chats },
    { data: recentBookings },
    { data: activeServices },
    { data: activeStaff },
    // Pre migracije 20260712000001 kolona last_seen_at ne postoji - upit
    // vrati grešku (data null) i prisustvo se jednostavno ne prikazuje
    { data: presenceRows },
    { data: cronMarker },
  ] = await Promise.all([
    db.from("tenants").select("*").order("created_at"),
    db.from("invoices").select("*, tenants(name, slug)").order("created_at", { ascending: false }),
    db.from("tenant_members").select("tenant_id, user_id").eq("role", "owner"),
    db.from("tenant_members").select("user_id"),
    db
      .from("superadmin_audit_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200),
    // Pre migracije chata upit vrati grešku (data null) - badge je tada 0
    db.from("support_conversations").select("last_message_at, support_read_at"),
    db.from("bookings").select("tenant_id, created_at").gte("created_at", since30),
    db.from("services").select("tenant_id").eq("is_active", true),
    db.from("staff").select("tenant_id").eq("is_active", true),
    db.from("tenant_members").select("tenant_id, last_seen_at"),
    db
      .from("superadmin_audit_log")
      .select("created_at")
      .eq("action", CRON_MARKER_ACTION)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  // Svi auth korisnici JEDNIM prolazom (umesto getUserById po vlasniku) -
  // daje i mejlove vlasnika i naloge koji nikad nisu napravili salon.
  // Pad auth API-ja ne obara panel, samo se ti podaci ne prikažu.
  const users = await listAllUsers(db).catch(() => []);
  const userById = new Map(users.map((u) => [u.id, u]));

  // Zdravlje salona: rezervacije u 30/7 dana + obim podešenog sadržaja
  const since7 = now.getTime() - 7 * 86_400_000;
  const bookingActivity = new Map<string, { b30: number; b7: number }>();
  for (const b of (recentBookings ?? []) as { tenant_id: string; created_at: string }[]) {
    const a = bookingActivity.get(b.tenant_id) ?? { b30: 0, b7: 0 };
    a.b30 += 1;
    if (new Date(b.created_at).getTime() > since7) a.b7 += 1;
    bookingActivity.set(b.tenant_id, a);
  }
  const countByTenant = (list: { tenant_id: string }[] | null) => {
    const m = new Map<string, number>();
    for (const r of list ?? []) m.set(r.tenant_id, (m.get(r.tenant_id) ?? 0) + 1);
    return m;
  };
  const servicesCount = countByTenant(activeServices);
  const staffCount = countByTenant(activeStaff);

  // Prisustvo: najskoriji heartbeat bilo kog člana salona
  const lastSeenByTenant = new Map<string, string>();
  for (const p of (presenceRows ?? []) as {
    tenant_id: string;
    last_seen_at: string | null;
  }[]) {
    if (!p.last_seen_at) continue;
    const prev = lastSeenByTenant.get(p.tenant_id);
    if (!prev || p.last_seen_at > prev) lastSeenByTenant.set(p.tenant_id, p.last_seen_at);
  }

  // Aktivnost posle read markera = razgovor čeka odgovor (poruka vlasnika
  // pomera last_message_at; odgovor podrške pomera i support_read_at)
  const unreadChats = (chats ?? []).filter(
    (c) => new Date(c.last_message_at).getTime() > new Date(c.support_read_at).getTime()
  ).length;

  // Vlasnik po salonu (kontakt + status potvrde + poslednja prijava)
  const ownerInfo = new Map<
    string,
    { email: string; confirmed: boolean; lastSignIn: string | null }
  >();
  for (const o of owners ?? []) {
    const u = userById.get(o.user_id);
    if (u?.email) {
      ownerInfo.set(o.tenant_id, {
        email: u.email,
        confirmed: !!u.email_confirmed_at,
        lastSignIn: u.last_sign_in_at ?? null,
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

  // Hitnost na vrh: grace (plaćanje kasni) pa proba, unutar grupe manje
  // preostalih dana prvo; expired pa active na dno. Stabilan sort čuva
  // redosled registracije unutar istog ranga.
  const statusRank: Record<string, number> = { grace: 0, trial: 1, expired: 2, active: 3 };
  rows.sort(
    (a, b) =>
      statusRank[a.sub.status] - statusRank[b.sub.status] ||
      a.sub.daysLeft - b.sub.daysLeft
  );

  const fmt = (d: string) => datumSr(d);

  const salonRows: SalonRow[] = rows.map(({ tenant, sub }) => {
    const act = bookingActivity.get(tenant.id) ?? { b30: 0, b7: 0 };
    const owner = ownerInfo.get(tenant.id) ?? null;
    const lastSeen = lastSeenByTenant.get(tenant.id) ?? null;
    return {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      ownerEmail: owner?.email ?? null,
      ownerConfirmed: owner?.confirmed ?? true,
      suspended: !!tenant.suspended_at,
      suspendedReason: tenant.suspended_reason,
      status: sub.status,
      daysLeft: sub.daysLeft,
      paidUntil: tenant.paid_until,
      deadlineLabel: tenant.paid_until
        ? `Plaćeno do ${fmt(tenant.paid_until)}`
        : `Proba do ${fmt(tenant.trial_ends_at)}`,
      isPublished: tenant.is_published,
      b30: act.b30,
      b7: act.b7,
      services: servicesCount.get(tenant.id) ?? 0,
      staff: staffCount.get(tenant.id) ?? 0,
      lastSignInLabel: owner?.lastSignIn ? fmt(owner.lastSignIn) : null,
      online: isOnline(lastSeen, now),
      presenceLabel: presenceLabel(lastSeen, now),
      customDomain: tenant.custom_domain ?? null,
      note: tenant.superadmin_note ?? null,
    };
  });

  // Nalozi koji nikad nisu napravili salon - nevidljivi u listi salona
  const memberIds = new Set((allMembers ?? []).map((m) => m.user_id));
  const orphans: OrphanAccount[] = users
    .filter((u) => !memberIds.has(u.id))
    .sort((a, b) => (b.created_at > a.created_at ? 1 : -1))
    .map((u) => ({
      id: u.id,
      email: u.email ?? null,
      createdLabel: fmt(u.created_at),
      lastSignInLabel: u.last_sign_in_at ? fmt(u.last_sign_in_at) : null,
      confirmed: !!u.email_confirmed_at,
    }));

  const novih30 = rows.filter(
    (r) => new Date(r.tenant.created_at).getTime() > now.getTime() - 30 * 86_400_000
  ).length;
  const onlineCount = salonRows.filter((r) => r.online).length;

  const year = now.getFullYear();
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
      label: "Grace (uplata kasni)",
      value: rows.filter((r) => r.sub.status === "grace").length,
      cls: "bg-amber-200",
    },
    {
      label: "Istekli",
      value: rows.filter((r) => r.sub.status === "expired").length,
      cls: "bg-white shadow-card",
    },
    {
      label: "Suspendovani",
      value: rows.filter((r) => r.tenant.suspended_at).length,
      cls: "bg-white shadow-card",
    },
    {
      label: "Novi saloni (30d)",
      value: novih30,
      cls: "bg-white shadow-card",
    },
    {
      label: "Online sada",
      value: onlineCount,
      cls: "bg-emerald-100",
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

  const invoiceRows: InvoiceRow[] = invoices.map((inv) => ({
    id: inv.id,
    label: invoiceLabel(inv),
    tenantName: inv.tenants?.name ?? inv.tenant_label ?? "-",
    tenantDeleted: !inv.tenants,
    planLabel: PLANS[inv.plan].label,
    amountLabel: formatAmount(Number(inv.amount)),
    createdLabel: fmt(inv.created_at),
    status: inv.status,
    paidAtLabel: inv.paid_at ? fmt(inv.paid_at) : null,
  }));

  const auditRows: AuditRow[] = ((auditLog ?? []) as {
    id: string;
    created_at: string;
    action: string;
    tenant_label: string | null;
    details: Record<string, unknown> | null;
  }[]).map((entry) => ({
    id: entry.id,
    atLabel: datumVremeSr(entry.created_at),
    action: entry.action,
    tenantLabel: entry.tenant_label,
    details: entry.details ? JSON.stringify(entry.details) : null,
  }));

  // Zdravlje crona: bez CRON_SECRET ruta vraća 401; marker stariji od 48h
  // znači da Vercel cron ne radi (upisuje se na SVAKOM uspešnom runu)
  const cronSecretSet = !!process.env.CRON_SECRET;
  const cronLastRun = cronMarker?.created_at ?? null;
  const cronStale =
    !cronLastRun || now.getTime() - new Date(cronLastRun).getTime() > 48 * 3_600_000;

  return (
    <main className="min-h-screen flex-1 bg-canvas p-6 font-display text-ink">
      <div className="mx-auto max-w-5xl">
        <h1 className="text-3xl font-extrabold tracking-tight">Superadmin</h1>
        <p className="mt-1 text-sm font-medium text-ink/70">
          Saloni, pretplate i naplata. Prijavljen: {me.email}
        </p>
        {!cronSecretSet ? (
          <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-amber-200 px-3 py-1 text-xs font-bold text-amber-950">
            <TriangleAlert className="size-3.5" /> CRON_SECRET nije podešen -
            dnevni podsetnici o isteku probe ne rade
          </p>
        ) : (
          <p
            className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${
              cronStale ? "bg-amber-200 text-amber-950" : "bg-ink/5 text-ink/70"
            }`}
          >
            {cronStale && <TriangleAlert className="size-3.5" />}
            Cron podsetnik:{" "}
            {cronLastRun
              ? `poslednja provera ${datumVremeSr(cronLastRun)}${cronStale ? " (kasni!)" : ""}`
              : "još nema zabeleženog runa"}
          </p>
        )}

        <div className="mt-4">
          <Link
            href="/superadmin/poruke"
            className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white hover:opacity-85"
          >
            <MessageCircle className="size-4" /> Poruke podrške
            {unreadChats > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-mint px-1.5 text-xs font-bold text-ink">
                {unreadChats}
              </span>
            )}
          </Link>
        </div>

        {/* Statistika - 9 kartica: statusi salona, rast/prisustvo, novac */}
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {stats.map((s) => (
            <div key={s.label} className={`rounded-[2rem] p-5 ${s.cls}`}>
              <p className="text-sm font-semibold opacity-60">{s.label}</p>
              <p className="mt-1 text-3xl font-extrabold tracking-tight">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Saloni */}
        <h2 className="mt-10 text-xl font-extrabold tracking-tight">Saloni</h2>
        <SalonList rows={salonRows} />

        {/* Nalozi bez salona (registracija bez onboardinga) */}
        <OrphanAccounts accounts={orphans} />

        {/* Fakture */}
        <h2 className="mt-10 text-xl font-extrabold tracking-tight">Fakture</h2>
        <InvoiceList rows={invoiceRows} />

        {/* Dnevnik superadmin akcija */}
        <h2 className="mt-10 text-xl font-extrabold tracking-tight">
          Dnevnik akcija
        </h2>
        <AuditLogList rows={auditRows} />
      </div>
    </main>
  );
}
