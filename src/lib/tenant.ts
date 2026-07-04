import { cache } from "react";
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
  "id, slug, name, timezone, is_published, suspended_at, created_at";

export interface TenantSite {
  tenant: PublicTenant;
  settings: SiteSettings | null;
  services: Service[];
  staff: Staff[];
  staffServices: { staff_id: string; service_id: string }[];
  gallery: Gallery[];
}

// Jedina tačka u aplikaciji koja rezoluje tenant-a iz slug-a.
// Kod prelaska na subdomene menja se samo middleware - ovo ostaje isto.
export const getTenantSite = cache(
  async (slug: string): Promise<TenantSite | null> => {
    const supabase = await createClient();

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
);
