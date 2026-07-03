import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type {
  Gallery,
  Service,
  SiteSettings,
  Staff,
  Tenant,
} from "@/lib/types";

export interface TenantSite {
  tenant: Tenant;
  settings: SiteSettings | null;
  services: Service[];
  staff: Staff[];
  staffServices: { staff_id: string; service_id: string }[];
  gallery: Gallery[];
  /** Radno vreme salona po danu (0=nedelja..6=subota): unija radnih vremena
   *  aktivnih zaposlenih, null = neradan dan. */
  openHours: ({ start: string; end: string } | null)[];
}

// Jedina tačka u aplikaciji koja rezoluje tenant-a iz slug-a.
// Kod prelaska na subdomene menja se samo middleware — ovo ostaje isto.
export const getTenantSite = cache(
  async (slug: string): Promise<TenantSite | null> => {
    const supabase = await createClient();

    const { data: tenant } = await supabase
      .from("tenants")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();

    if (!tenant) return null;

    const [settings, services, staff, staffServices, gallery, workingHours] =
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
        supabase
          .from("working_hours")
          .select("day_of_week, start_time, end_time, is_working")
          .eq("tenant_id", tenant.id),
      ]);

    // Radno vreme salona = unija radnih vremena zaposlenih po danu
    const openHours: ({ start: string; end: string } | null)[] = Array.from(
      { length: 7 },
      () => null
    );
    for (const wh of workingHours.data ?? []) {
      if (!wh.is_working) continue;
      const start = wh.start_time.slice(0, 5);
      const end = wh.end_time.slice(0, 5);
      const cur = openHours[wh.day_of_week];
      openHours[wh.day_of_week] = {
        start: cur && cur.start < start ? cur.start : start,
        end: cur && cur.end > end ? cur.end : end,
      };
    }

    return {
      tenant: tenant as Tenant,
      settings: (settings.data as SiteSettings) ?? null,
      services: (services.data as Service[]) ?? [],
      staff: (staff.data as Staff[]) ?? [],
      staffServices: staffServices.data ?? [],
      gallery: (gallery.data as Gallery[]) ?? [],
      openHours,
    };
  }
);
