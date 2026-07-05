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
//
// Performanse (ovo se izvršava pri SVAKOM kliku u adminu): getClaims()
// verifikuje JWT lokalno umesto round-tripa do Auth API-ja (sesiju je
// proxy već osvežio kroz getUser), a članstvo + tenant idu kao JEDAN
// upit. Service role je bezbedan jer user_id dolazi iz verifikovanog
// tokena, a billing/suspension kolone tenants-a ionako nisu u javnim
// SELECT privilegijama pa ih session klijent ne može čitati.
export const getAdminContext = cache(async (): Promise<AdminContext> => {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims.sub;
  if (!userId) redirect("/prijava");

  const db = createAdminClient();
  const { data: membership } = await db
    .from("tenant_members")
    .select("role, tenants(*)")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (!membership?.tenants) redirect("/onboarding");

  return {
    userId,
    role: membership.role as MemberRole,
    tenant: membership.tenants as unknown as Tenant,
  };
});
