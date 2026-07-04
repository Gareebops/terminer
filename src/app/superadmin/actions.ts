"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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
  if (!(await assertSuperAdmin())) return { ok: false, error: "Nemaš pristup." };
  const db = createAdminClient();

  const { data: invoice } = await db
    .from("invoices")
    .select("id, tenant_id, period_to, status")
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

  const { data: tenant } = await db
    .from("tenants")
    .select("paid_until")
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

  revalidatePath("/superadmin");
  return { ok: true };
}

export async function cancelInvoice(invoiceId: string): Promise<ActionResult> {
  if (!(await assertSuperAdmin())) return { ok: false, error: "Nemaš pristup." };
  const db = createAdminClient();

  // Samo neplaćene fakture se storniraju; za plaćenu prvo korekcija datuma
  const { data, error } = await db
    .from("invoices")
    .update({ status: "cancelled" })
    .eq("id", invoiceId)
    .eq("status", "issued")
    .select("id")
    .maybeSingle();
  if (error || !data) {
    return { ok: false, error: "Storniranje nije uspelo (možda je već plaćena?)." };
  }
  revalidatePath("/superadmin");
  return { ok: true };
}

export async function extendTrial(
  tenantId: string,
  days: number
): Promise<ActionResult> {
  const parsed = z.number().int().min(1).max(90).safeParse(days);
  if (!parsed.success) return { ok: false, error: "Neispravan broj dana." };
  if (!(await assertSuperAdmin())) return { ok: false, error: "Nemaš pristup." };

  const db = createAdminClient();
  const { data: tenant } = await db
    .from("tenants")
    .select("trial_ends_at")
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
  if (!(await assertSuperAdmin())) return { ok: false, error: "Nemaš pristup." };

  const db = createAdminClient();
  const { error } = await db
    .from("tenants")
    .update({ paid_until: date })
    .eq("id", tenantId);
  if (error) return { ok: false, error: "Izmena nije uspela." };
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
  if (!(await assertSuperAdmin())) return { ok: false, error: "Nemaš pristup." };

  const db = createAdminClient();
  const { data: tenant } = await db
    .from("tenants")
    .select("paid_until")
    .eq("id", parsed.data.tenantId)
    .maybeSingle();
  if (!tenant) return { ok: false, error: "Salon nije pronađen." };

  // Produžetak ide od danas ili od postojećeg isteka - šta god je kasnije
  const today = new Date();
  const base =
    tenant.paid_until && new Date(tenant.paid_until) > today
      ? new Date(tenant.paid_until)
      : today;
  base.setMonth(base.getMonth() + parsed.data.months);
  const paidUntil = base.toISOString().slice(0, 10);

  const { error } = await db
    .from("tenants")
    .update({ paid_until: paidUntil })
    .eq("id", parsed.data.tenantId);
  if (error) return { ok: false, error: "Izmena nije uspela." };

  revalidatePath("/superadmin");
  return { ok: true };
}
