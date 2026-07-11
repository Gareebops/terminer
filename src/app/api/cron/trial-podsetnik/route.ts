import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { trialReminderDue } from "@/lib/billing";
import { sendTrialExpiryNotice, type TrialExpirySalon } from "@/lib/email";
import { logAdminAction } from "@/lib/audit";
import type { Tenant } from "@/lib/types";

// Dnevni Vercel cron (vercel.json): superadminu šalje digest salona kojima
// proba ističe za REMINDER_DAYS dana, sa aktivnošću po salonu. Selekcija
// "tačno N dana" (trialReminderDue) garantuje jedno slanje po salonu bez
// čuvanja stanja; trag ostaje u superadmin_audit_log.

const REMINDER_DAYS = 3;

export async function GET(request: Request) {
  // Vercel Cron šalje "Authorization: Bearer ${CRON_SECRET}" kad je env
  // podešen; bez secreta je ruta zaključana (fail-closed, ne no-op)
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = createAdminClient();
  const { data: tenants, error } = await db
    .from("tenants")
    .select("*")
    .is("suspended_at", null);
  if (error) {
    console.error("trial-podsetnik: čitanje salona nije uspelo:", error);
    return NextResponse.json({ error: "db" }, { status: 500 });
  }

  const due = ((tenants ?? []) as Tenant[]).filter((t) =>
    trialReminderDue(t, REMINDER_DAYS)
  );
  if (due.length === 0) {
    return NextResponse.json({ checked: tenants?.length ?? 0, sent: 0 });
  }

  // Aktivnost i vlasnik za svaki salon iz digesta (ista definicija kao na
  // superadmin strani: rezervacije po created_at, samo aktivni usluge/tim)
  const ids = due.map((t) => t.id);
  const since30 = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const [bookingsRes, servicesRes, staffRes, ownersRes] = await Promise.all([
    db
      .from("bookings")
      .select("tenant_id")
      .in("tenant_id", ids)
      .gte("created_at", since30),
    db.from("services").select("tenant_id").in("tenant_id", ids).eq("is_active", true),
    db.from("staff").select("tenant_id").in("tenant_id", ids).eq("is_active", true),
    db
      .from("tenant_members")
      .select("tenant_id, user_id")
      .in("tenant_id", ids)
      .eq("role", "owner"),
  ]);
  const countByTenant = (list: { tenant_id: string }[] | null) => {
    const m = new Map<string, number>();
    for (const r of list ?? []) m.set(r.tenant_id, (m.get(r.tenant_id) ?? 0) + 1);
    return m;
  };
  const bookings30 = countByTenant(bookingsRes.data);
  const servicesCount = countByTenant(servicesRes.data);
  const staffCount = countByTenant(staffRes.data);

  const ownerEmail = new Map<string, string>();
  for (const o of ownersRes.data ?? []) {
    const { data } = await db.auth.admin.getUserById(o.user_id);
    if (data.user?.email) ownerEmail.set(o.tenant_id, data.user.email);
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://terminer.rs";
  const salons: TrialExpirySalon[] = due.map((t) => ({
    salonName: t.name,
    slug: t.slug,
    ownerEmail: ownerEmail.get(t.id) ?? null,
    trialEndsAt: t.trial_ends_at,
    bookings30: bookings30.get(t.id) ?? 0,
    servicesCount: servicesCount.get(t.id) ?? 0,
    staffCount: staffCount.get(t.id) ?? 0,
    published: t.is_published,
    siteUrl: `${baseUrl}/${t.slug}`,
  }));

  const res = await sendTrialExpiryNotice({
    salons,
    days: REMINDER_DAYS,
    panelUrl: `${baseUrl}/superadmin`,
  });

  if (res.sent) {
    await Promise.all(
      due.map((t) =>
        logAdminAction({
          adminEmail: "sistem (cron)",
          action: "podsetnik: proba ističe",
          tenantId: t.id,
          tenantLabel: `${t.name} (/${t.slug})`,
          details: { za_dana: REMINDER_DAYS },
        })
      )
    );
  }

  return NextResponse.json({
    checked: (tenants ?? []).length,
    sent: res.sent ? due.length : 0,
    salons: due.map((t) => t.slug),
  });
}
