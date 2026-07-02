import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
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

  const { data: membership } = await supabase
    .from("tenant_members")
    .select("role, tenants(*)")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!membership?.tenants) redirect("/onboarding");

  return {
    userId: user.id,
    role: membership.role as MemberRole,
    tenant: membership.tenants as unknown as Tenant,
  };
});
