import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { MemberRole, Tenant } from "@/lib/types";

export interface AdminContext {
  userId: string;
  role: MemberRole;
  tenant: Tenant;
}

// Kontekst ulogovanog člana salona. Svi upiti u admin zoni idu preko
// session klijenta, pa RLS garantuje izolaciju po salonu.
export const getAdminContext = cache(async (): Promise<AdminContext> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/prijava");

  // Članstvo kroz session klijent (RLS) - to je autorizaciona provera
  const { data: membership } = await supabase
    .from("tenant_members")
    .select("role, tenant_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!membership) redirect("/onboarding");

  // Tenant red ide service-role klijentom: billing/suspension kolone nisu
  // u javnim SELECT privilegijama, a članu salona ovde legitimno trebaju
  const db = createAdminClient();
  const { data: tenant } = await db
    .from("tenants")
    .select("*")
    .eq("id", membership.tenant_id)
    .maybeSingle();

  if (!tenant) redirect("/onboarding");

  return {
    userId: user.id,
    role: membership.role as MemberRole,
    tenant: tenant as Tenant,
  };
});
