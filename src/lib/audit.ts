import { createAdminClient } from "@/lib/supabase/admin";

// Dnevnik superadmin akcija - svaka akcija nad tuđim nalogom/salonom mora
// ostaviti trag (ko, šta, kad, nad kim). Upis ide service-role klijentom;
// RLS bez policy-ja garantuje da log niko drugi ne čita.
export async function logAdminAction(input: {
  adminEmail: string;
  action: string;
  tenantId?: string | null;
  tenantLabel?: string | null;
  details?: Record<string, unknown>;
}): Promise<void> {
  const db = createAdminClient();
  const { error } = await db.from("superadmin_audit_log").insert({
    admin_email: input.adminEmail,
    action: input.action,
    tenant_id: input.tenantId ?? null,
    tenant_label: input.tenantLabel ?? null,
    details: input.details ?? null,
  });
  // Log nikad ne obara akciju, ali grešku ne gutamo tiho
  if (error) console.error("audit log upis nije uspeo:", error);
}
