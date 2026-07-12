"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { bustTenantSiteCache } from "@/lib/tenant";
import { logAdminAction } from "@/lib/audit";
import { addMonths, invoicePeriod, PLANS, revertedPaidUntil, type PlanId } from "@/lib/invoice";

// Superadmin = vlasnik platforme (SUPER_ADMIN_EMAIL u env).
export async function assertSuperAdmin(): Promise<{ email: string } | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const allowed = (process.env.SUPER_ADMIN_EMAIL ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (!user?.email || !allowed.includes(user.email.toLowerCase())) return null;
  return { email: user.email };
}

type ActionResult = { ok: boolean; error?: string };

// Plaćena faktura je izvor istine: produžava pretplatu tačno do kraja
// perioda sa fakture (ili zadržava kasniji postojeći datum).
export async function markInvoicePaid(invoiceId: string): Promise<ActionResult> {
  const me = await assertSuperAdmin();
  if (!me) return { ok: false, error: "Nemaš pristup." };
  const db = createAdminClient();

  const { data: invoice } = await db
    .from("invoices")
    .select("id, tenant_id, period_from, period_to, status")
    .eq("id", invoiceId)
    .maybeSingle();
  if (!invoice) return { ok: false, error: "Faktura nije pronađena." };
  if (invoice.status !== "issued") {
    return { ok: false, error: "Faktura nije na čekanju." };
  }

  const { error } = await db
    .from("invoices")
    .update({ status: "paid", paid_at: new Date().toISOString() })
    .eq("id", invoiceId);
  if (error) return { ok: false, error: "Izmena nije uspela." };

  // Sestrinske neplaćene fakture istog perioda (vlasnik je u modalu menjao
  // plan pa su izdate i mesečna i godišnja) - plaćanjem jedne ostale
  // postaju bespredmetne, storniraju se same
  const { data: siblings } = await db
    .from("invoices")
    .update({ status: "cancelled" })
    .eq("tenant_id", invoice.tenant_id)
    .eq("period_from", invoice.period_from)
    .eq("status", "issued")
    .neq("id", invoiceId)
    .select("id");

  const { data: tenant } = await db
    .from("tenants")
    .select("paid_until, slug")
    .eq("id", invoice.tenant_id)
    .single();
  const newPaidUntil =
    tenant?.paid_until && tenant.paid_until > invoice.period_to
      ? tenant.paid_until
      : invoice.period_to;
  await db
    .from("tenants")
    .update({ paid_until: newPaidUntil })
    .eq("id", invoice.tenant_id);
  // paid_until živi na keširanom tenant redu (pauza online zakazivanja) -
  // posle uplate zakazivanje mora odmah da proradi
  if (tenant?.slug) bustTenantSiteCache(tenant.slug);

  await logAdminAction({
    adminEmail: me.email,
    action: "faktura označena plaćenom",
    tenantId: invoice.tenant_id,
    details: {
      invoice_id: invoiceId,
      paid_until: newPaidUntil,
      auto_cancelled: (siblings ?? []).map((s) => s.id),
    },
  });
  revalidatePath("/superadmin");
  return { ok: true };
}

const issueInvoiceSchema = z.object({
  tenantId: z.string().min(1),
  plan: z.enum(["monthly", "yearly"]),
  // Prilagođen iznos za telefonske/founder dogovore; prazan = cenovnik.
  // Zaokruživanje na 2 decimale PRE upisa - numeric(10,2) konvencija.
  amount: z
    .number()
    .positive()
    .max(9_999_999)
    .transform((n) => Math.round(n * 100) / 100)
    .optional(),
});

// Superadmin izdaje fakturu umesto vlasnika (telefonski dogovor, founder
// cena). Ista numeracija i idempotentnost kao samoposlužni createInvoice -
// ali ne traži billing_note (kupac pada na ime salona) i prima iznos.
export async function issueInvoice(input: {
  tenantId: string;
  plan: PlanId;
  amount?: number;
}): Promise<{ ok: true; invoiceId: string; reused: boolean } | { ok: false; error: string }> {
  const parsed = issueInvoiceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Neispravni podaci." };
  // Članarina ispod 100 RSD je praktično sigurno greška u unosu
  // ("1.990" parsiran kao 1,99) - bolje odbiti nego izdati pogrešnu fakturu
  if (parsed.data.amount !== undefined && parsed.data.amount < 100) {
    return {
      ok: false,
      error: "Iznos je manji od 100 RSD - proveri unos (separator hiljada?).",
    };
  }
  const me = await assertSuperAdmin();
  if (!me) return { ok: false, error: "Nemaš pristup." };

  const db = createAdminClient();
  const { data: tenant } = await db
    .from("tenants")
    .select("id, name, slug, paid_until, billing_note")
    .eq("id", parsed.data.tenantId)
    .maybeSingle();
  if (!tenant) return { ok: false, error: "Salon nije pronađen." };

  const plan = parsed.data.plan;
  const amount = parsed.data.amount ?? PLANS[plan].amount;
  const today = new Date().toISOString().slice(0, 10);
  const { from: periodFrom, to: periodTo } = invoicePeriod(
    tenant.paid_until,
    PLANS[plan].months,
    today
  );

  // Aktivna faktura za isti plan i period već postoji - ne dupliraj
  const { data: existing } = await db
    .from("invoices")
    .select("id")
    .eq("tenant_id", tenant.id)
    .eq("plan", plan)
    .eq("period_from", periodFrom)
    .neq("status", "cancelled")
    .limit(1)
    .maybeSingle();
  if (existing) return { ok: true, invoiceId: existing.id, reused: true };

  const year = new Date().getFullYear();
  const { data: maxRow } = await db
    .from("invoices")
    .select("number")
    .eq("year", year)
    .order("number", { ascending: false })
    .limit(1)
    .maybeSingle();
  let nextNumber = (maxRow?.number ?? 0) + 1;

  for (let attempt = 0; attempt < 3; attempt++) {
    const { data: created, error } = await db
      .from("invoices")
      .insert({
        tenant_id: tenant.id,
        tenant_label: `${tenant.name} (/${tenant.slug})`,
        number: nextNumber,
        year,
        plan,
        amount,
        period_from: periodFrom,
        period_to: periodTo,
        buyer_info: tenant.billing_note || tenant.name,
      })
      .select("id")
      .single();
    if (!error) {
      await logAdminAction({
        adminEmail: me.email,
        action: "faktura izdata (superadmin)",
        tenantId: tenant.id,
        tenantLabel: `${tenant.name} (/${tenant.slug})`,
        details: {
          invoice_id: created.id,
          plan,
          amount,
          period_from: periodFrom,
          period_to: periodTo,
        },
      });
      revalidatePath("/superadmin");
      return { ok: true, invoiceId: created.id, reused: false };
    }
    if (error.code === "23505") {
      nextNumber += 1;
      continue;
    }
    console.error("issueInvoice failed:", error);
    return { ok: false, error: "Izdavanje fakture nije uspelo." };
  }
  return { ok: false, error: "Izdavanje fakture nije uspelo. Pokušaj ponovo." };
}

// Poništavanje pogrešnog klika na "Označi plaćeno": faktura se vraća u
// "na čekanju", a paid_until se koriguje SAMO ako ga je postavila baš ona
// (logika u revertedPaidUntil - ručni produžeci se ne gaze). Sestrinske
// fakture stornirane pri plaćanju OSTAJU stornirane (mogu se izdati iznova).
export async function revertInvoicePaid(invoiceId: string): Promise<ActionResult> {
  const me = await assertSuperAdmin();
  if (!me) return { ok: false, error: "Nemaš pristup." };
  const db = createAdminClient();

  const { data: invoice } = await db
    .from("invoices")
    .select("id, tenant_id, period_to, status")
    .eq("id", invoiceId)
    .maybeSingle();
  if (!invoice) return { ok: false, error: "Faktura nije pronađena." };
  if (invoice.status !== "paid") {
    return { ok: false, error: "Samo plaćena faktura može da se vrati u čekanje." };
  }

  const { error } = await db
    .from("invoices")
    .update({ status: "issued", paid_at: null })
    .eq("id", invoiceId);
  if (error) return { ok: false, error: "Vraćanje nije uspelo." };

  // Korekcija paid_until iz preostalih plaćenih faktura (za obrisan salon
  // tenant_id je null - nema šta da se koriguje)
  let paidUntilAfter: string | null | undefined;
  if (invoice.tenant_id) {
    const [{ data: tenant }, { data: others }] = await Promise.all([
      db.from("tenants").select("paid_until, slug").eq("id", invoice.tenant_id).maybeSingle(),
      db
        .from("invoices")
        .select("period_to")
        .eq("tenant_id", invoice.tenant_id)
        .eq("status", "paid")
        .neq("id", invoiceId),
    ]);
    if (tenant) {
      const next = revertedPaidUntil(
        tenant.paid_until,
        invoice.period_to,
        (others ?? []).map((o) => o.period_to)
      );
      if (next.change) {
        await db
          .from("tenants")
          .update({ paid_until: next.value })
          .eq("id", invoice.tenant_id);
        bustTenantSiteCache(tenant.slug);
        paidUntilAfter = next.value;
      }
    }
  }

  await logAdminAction({
    adminEmail: me.email,
    action: "faktura vraćena u čekanje",
    tenantId: invoice.tenant_id,
    details: {
      invoice_id: invoiceId,
      ...(paidUntilAfter !== undefined ? { paid_until: paidUntilAfter } : {}),
    },
  });
  revalidatePath("/superadmin");
  return { ok: true };
}

export async function cancelInvoice(invoiceId: string): Promise<ActionResult> {
  const me = await assertSuperAdmin();
  if (!me) return { ok: false, error: "Nemaš pristup." };
  const db = createAdminClient();

  // Samo neplaćene fakture se storniraju; za plaćenu prvo korekcija datuma
  const { data, error } = await db
    .from("invoices")
    .update({ status: "cancelled" })
    .eq("id", invoiceId)
    .eq("status", "issued")
    .select("id, tenant_id, tenant_label")
    .maybeSingle();
  if (error || !data) {
    return { ok: false, error: "Storniranje nije uspelo (možda je već plaćena?)." };
  }
  await logAdminAction({
    adminEmail: me.email,
    action: "faktura stornirana",
    // Tenant kontekst da pretraga dnevnika po salonu nalazi i storna
    tenantId: data.tenant_id,
    tenantLabel: data.tenant_label,
    details: { invoice_id: invoiceId },
  });
  revalidatePath("/superadmin");
  return { ok: true };
}

export async function extendTrial(
  tenantId: string,
  days: number
): Promise<ActionResult> {
  const parsed = z.number().int().min(1).max(90).safeParse(days);
  if (!parsed.success) return { ok: false, error: "Neispravan broj dana." };
  const me = await assertSuperAdmin();
  if (!me) return { ok: false, error: "Nemaš pristup." };

  const db = createAdminClient();
  const { data: tenant } = await db
    .from("tenants")
    .select("trial_ends_at, slug")
    .eq("id", tenantId)
    .maybeSingle();
  if (!tenant) return { ok: false, error: "Salon nije pronađen." };

  // Od postojećeg isteka ili od sada - šta god je kasnije
  const base = Math.max(new Date(tenant.trial_ends_at).getTime(), Date.now());
  const next = new Date(base + parsed.data * 86400000).toISOString();
  const { error } = await db
    .from("tenants")
    .update({ trial_ends_at: next })
    .eq("id", tenantId);
  if (error) return { ok: false, error: "Izmena nije uspela." };
  bustTenantSiteCache(tenant.slug);
  await logAdminAction({
    adminEmail: me.email,
    action: "produžena proba",
    tenantId,
    details: { days: parsed.data, until: next },
  });
  revalidatePath("/superadmin");
  return { ok: true };
}

// Ručna korekcija (ispravke grešaka, specijalni dogovori)
export async function setPaidUntil(
  tenantId: string,
  date: string | null
): Promise<ActionResult> {
  if (date !== null && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { ok: false, error: "Neispravan datum." };
  }
  const me = await assertSuperAdmin();
  if (!me) return { ok: false, error: "Nemaš pristup." };

  const db = createAdminClient();
  const { data: updated, error } = await db
    .from("tenants")
    .update({ paid_until: date })
    .eq("id", tenantId)
    .select("slug")
    .maybeSingle();
  if (error) return { ok: false, error: "Izmena nije uspela." };
  if (updated?.slug) bustTenantSiteCache(updated.slug);
  await logAdminAction({
    adminEmail: me.email,
    action: "ručna korekcija plaćeno-do",
    tenantId,
    details: { paid_until: date },
  });
  revalidatePath("/superadmin");
  return { ok: true };
}

const extendSchema = z.object({
  tenantId: z.string().min(1),
  months: z.number().int().min(1).max(24),
});

export async function extendSubscription(input: {
  tenantId: string;
  months: number;
}): Promise<{ ok: boolean; error?: string }> {
  const parsed = extendSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Neispravni podaci." };
  const me = await assertSuperAdmin();
  if (!me) return { ok: false, error: "Nemaš pristup." };

  const db = createAdminClient();
  const { data: tenant } = await db
    .from("tenants")
    .select("paid_until, slug")
    .eq("id", parsed.data.tenantId)
    .maybeSingle();
  if (!tenant) return { ok: false, error: "Salon nije pronađen." };

  // Produžetak ide od danas ili od postojećeg isteka - šta god je kasnije.
  // addMonths (lib/invoice) klampuje na kraj meseca (31.8 + 1 mes = 30.9),
  // isto kao periodi faktura - Date.setMonth bi prelio u 1.10.
  const today = new Date().toISOString().slice(0, 10);
  const base =
    tenant.paid_until && tenant.paid_until > today ? tenant.paid_until : today;
  const paidUntil = addMonths(base, parsed.data.months);

  const { error } = await db
    .from("tenants")
    .update({ paid_until: paidUntil })
    .eq("id", parsed.data.tenantId);
  if (error) return { ok: false, error: "Izmena nije uspela." };
  bustTenantSiteCache(tenant.slug);

  await logAdminAction({
    adminEmail: me.email,
    action: "produžena pretplata",
    tenantId: parsed.data.tenantId,
    details: { months: parsed.data.months, paid_until: paidUntil },
  });
  revalidatePath("/superadmin");
  return { ok: true };
}
