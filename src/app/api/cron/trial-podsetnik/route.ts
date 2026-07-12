import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { trialReminderDue } from "@/lib/billing";
import {
  sendTrialExpiryNotice,
  sendTrialExpiryOwnerNotice,
  type TrialExpirySalon,
} from "@/lib/email";
import { CRON_MARKER_ACTION, logAdminAction } from "@/lib/audit";
import type { Tenant } from "@/lib/types";

// Dnevni Vercel cron (vercel.json): superadminu šalje digest salona kojima
// proba ističe za REMINDER_DAYS dana (sa aktivnošću po salonu), a VLASNIKU
// svakog takvog salona podsetnik sa CTA na /admin/pretplata. Selekcija
// "tačno N dana" (trialReminderDue) garantuje jedno slanje po salonu bez
// čuvanja stanja. Svaki uspešan run upisuje sumarni red u audit log
// (CRON_MARKER_ACTION) - panel iz njega prikazuje zdravlje crona.

const REMINDER_DAYS = 3;

export async function GET(request: Request) {
  // Vercel Cron šalje "Authorization: Bearer ${CRON_SECRET}" kad je env
  // podešen; bez secreta je ruta zaključana (fail-closed, ne no-op).
  // Poređenje preko sha-obeleženih bafera: timingSafeEqual traži jednake
  // dužine, a običan !== curi dužinu/prefiks kroz vreme odgovora
  const secret = process.env.CRON_SECRET;
  const provided = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const providedBuf = Buffer.from(provided);
  const expectedBuf = Buffer.from(expected);
  if (
    !secret ||
    providedBuf.length !== expectedBuf.length ||
    !timingSafeEqual(providedBuf, expectedBuf)
  ) {
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
    // Marker i kad nema kome da se šalje - "cron je živ" se vidi u panelu
    await logAdminAction({
      adminEmail: "sistem (cron)",
      action: CRON_MARKER_ACTION,
      details: { checked: tenants?.length ?? 0, sent: 0 },
    });
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

  // Podsetnik i VLASNIKU svakog salona (CTA na produženje) - pad slanja
  // jednom vlasniku ne sme da preskoči ostale
  const ownersNotified: string[] = [];
  for (const t of due) {
    const to = ownerEmail.get(t.id);
    if (!to) continue;
    const ownerRes = await sendTrialExpiryOwnerNotice({
      to,
      salonName: t.name,
      trialEndsAt: t.trial_ends_at,
      days: REMINDER_DAYS,
      pretplataUrl: `${baseUrl}/admin/pretplata`,
    });
    if (ownerRes.sent) ownersNotified.push(t.slug);
  }

  if (res.sent || ownersNotified.length > 0) {
    await Promise.all(
      due.map((t) =>
        logAdminAction({
          adminEmail: "sistem (cron)",
          action: "podsetnik: proba ističe",
          tenantId: t.id,
          tenantLabel: `${t.name} (/${t.slug})`,
          details: {
            za_dana: REMINDER_DAYS,
            vlasnik_obavešten: ownersNotified.includes(t.slug),
          },
        })
      )
    );
  }

  await logAdminAction({
    adminEmail: "sistem (cron)",
    action: CRON_MARKER_ACTION,
    details: {
      checked: (tenants ?? []).length,
      sent: res.sent ? due.length : 0,
      owners_notified: ownersNotified.length,
      // Panel iz ovoga razlikuje "cron radi" od "cron radi ali mejlovi ne
      // odlaze" (npr. istekao RESEND_API_KEY) - due > 0 a ništa poslato
      email_ok: res.sent || ownersNotified.length > 0,
    },
  });

  return NextResponse.json({
    checked: (tenants ?? []).length,
    sent: res.sent ? due.length : 0,
    ownersNotified,
    salons: due.map((t) => t.slug),
  });
}
