import { getAdminContext } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import type { Gallery } from "@/lib/types";
import { GalleryManager } from "./gallery-manager";

export default async function GalleryPage() {
  const { tenant } = await getAdminContext();
  const supabase = await createClient();

  const { data: images } = await supabase
    .from("gallery")
    .select("*")
    .eq("tenant_id", tenant.id)
    .order("sort_order")
    .order("created_at");

  return (
    <div>
      <h1 className="text-3xl font-extrabold tracking-tight">Galerija radova</h1>
      <p className="mt-1 text-sm font-medium text-ink/70">
        Fotografije se prikazuju na tvom sajtu u sekciji „Izdvojeni radovi“.
      </p>
      <div className="mt-6">
        <GalleryManager
          tenantId={tenant.id}
          images={(images ?? []) as Gallery[]}
        />
      </div>
    </div>
  );
}
