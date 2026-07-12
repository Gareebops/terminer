import { cache } from "react";
import { unstable_cache, updateTag } from "next/cache";
import { cookies } from "next/headers";
import {
  createClient as createSupabaseClient,
  type SupabaseClient,
} from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type {
  Gallery,
  PublicTenant,
  Service,
  SiteSettings,
  Staff,
} from "@/lib/types";

// Kolonske SELECT privilegije puštaju javnim klijentima samo ove kolone -
// select("*") bi pao sa permission denied
const TENANT_PUBLIC_COLUMNS =
  "id, slug, name, timezone, is_published, suspended_at, created_at, custom_domain";

export interface TenantSite {
  tenant: PublicTenant;
  settings: SiteSettings | null;
  services: Service[];
  staff: Staff[];
  staffServices: { staff_id: string; service_id: string }[];
  gallery: Gallery[];
}

// Tag keša javnog sajta salona (deli ga i booking kontekst u
// lib/booking/actions.ts): admin/superadmin akcije ga obaraju kroz
// bustTenantSiteCache čim se promeni nešto što javnost vidi.
export function tenantSiteTag(slug: string): string {
  return `tenant-site:${slug}`;
}

// SME da se zove samo iz server akcija (updateTag ograničenje). Trenutna
// invalidacija, ne stale-while-revalidate - vlasnik posle "Sačuvaj" odmah
// vidi izmenu na svom sajtu.
export function bustTenantSiteCache(slug: string): void {
  updateTag(tenantSiteTag(slug));
}

// Tenant po slugu BEZ obzira na objavljenost/suspenziju (service role) -
// SAMO za tokove gde pravo pristupa dokazuje nešto drugo (cancel_token iz
// mejla) i za razlikovanje "skriven" od "ne postoji" u [slug]/layout.
// NIKAD ne koristiti za prikaz javnog sadržaja sajta.
export interface HiddenTenant {
  id: string;
  slug: string;
  name: string;
  timezone: string;
  is_published: boolean;
  suspended_at: string | null;
}

export const getHiddenTenant = cache(
  async (slug: string): Promise<HiddenTenant | null> => {
    const { data } = await createAdminClient()
      .from("tenants")
      .select("id, slug, name, timezone, is_published, suspended_at")
      .eq("slug", slug)
      .maybeSingle();
    return (data as HiddenTenant) ?? null;
  }
);

// Anon klijent bez kolačića: vidi tačno ono što i neulogovan posetilac
// (RLS javno čitanje objavljenih salona), pa keš ne zavisi od sesije.
function createAnonClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

async function loadTenantSite(
  supabase: SupabaseClient,
  slug: string
): Promise<TenantSite | null> {
  const { data: tenant } = await supabase
    .from("tenants")
    .select(TENANT_PUBLIC_COLUMNS)
    .eq("slug", slug)
    .maybeSingle();

  if (!tenant) return null;
  // Suspendovan salon ne postoji za javnost (admin i dalje radi, uz baner)
  if (tenant.suspended_at) return null;

  const [settings, services, staff, staffServices, gallery] =
    await Promise.all([
      supabase.from("site_settings").select("*").eq("tenant_id", tenant.id).maybeSingle(),
      supabase
        .from("services")
        .select("*")
        .eq("tenant_id", tenant.id)
        .eq("is_active", true)
        .order("sort_order"),
      supabase
        .from("staff")
        .select("*")
        .eq("tenant_id", tenant.id)
        .eq("is_active", true)
        .order("sort_order"),
      supabase
        .from("staff_services")
        .select("staff_id, service_id")
        .eq("tenant_id", tenant.id),
      supabase
        .from("gallery")
        .select("*")
        .eq("tenant_id", tenant.id)
        .order("sort_order"),
    ]);

  return {
    tenant: tenant as PublicTenant,
    settings: (settings.data as SiteSettings) ?? null,
    services: (services.data as Service[]) ?? [],
    staff: (staff.data as Staff[]) ?? [],
    staffServices: staffServices.data ?? [],
    gallery: (gallery.data as Gallery[]) ?? [],
  };
}

// Keširana javna varijanta: topla poseta sajtu salona ne dira bazu.
// TTL je zaštitna mreža (npr. izmena direktno u bazi); redovne izmene
// odmah obaraju tag kroz bustTenantSiteCache u admin akcijama.
const getPublicTenantSite = (slug: string) =>
  unstable_cache(
    async () => loadTenantSite(createAnonClient(), slug),
    ["tenant-site", slug],
    { tags: [tenantSiteTag(slug)], revalidate: 300 }
  )();

// Jedina tačka u aplikaciji koja rezoluje tenant-a iz slug-a.
// Kod prelaska na subdomene menja se samo middleware - ovo ostaje isto.
export const getTenantSite = cache(
  async (slug: string): Promise<TenantSite | null> => {
    // cookies() se čita bezuslovno i PRE keša: drži rutu dinamičkom (svež
    // HTML po zahtevu, keširaju se samo podaci) i ne sme u cache scope
    const cookieStore = await cookies();
    const hasSession = cookieStore
      .getAll()
      .some((c) => c.name.startsWith("sb-"));

    const site = await getPublicTenantSite(slug);
    // Bez auth kolačića je sesijski klijent ionako anoniman - keširani
    // rezultat je za takvog posetioca konačan odgovor
    if (site || !hasSession) return site;

    // Neobjavljen salon: RLS ga krije od anon klijenta, ali član sme da
    // pregleda svoj sajt pre objave - sesijski klijent, bez keširanja
    return loadTenantSite(await createClient(), slug);
  }
);
