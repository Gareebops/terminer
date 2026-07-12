import { createAdminClient } from "@/lib/supabase/admin";

// Sumarni red koji cron podsetnika upisuje na SVAKOM uspešnom runu (i kad
// nema salona za slanje) - superadmin panel iz poslednjeg ovakvog reda
// prikazuje zdravlje crona. Route fajl ne sme da izvozi konstante, pa živi tu.
export const CRON_MARKER_ACTION = "cron: dnevna provera podsetnika";

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
