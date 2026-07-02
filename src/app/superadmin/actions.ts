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

  // Produžetak ide od danas ili od postojećeg isteka — šta god je kasnije
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
