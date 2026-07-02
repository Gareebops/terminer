import { getAdminContext } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import type { Staff } from "@/lib/types";
import { StaffManager } from "./staff-manager";

export default async function StaffPage() {
  const { tenant } = await getAdminContext();
  const supabase = await createClient();

  const { data: staff } = await supabase
    .from("staff")
    .select("*")
    .eq("tenant_id", tenant.id)
    .order("sort_order")
    .order("created_at");

  return (
    <div>
      <h1 className="text-3xl font-extrabold tracking-tight">Zaposleni</h1>
      <p className="mt-1 text-sm font-medium text-ink/50">
        Klik na zaposlenog otvara usluge, radno vreme, smene i fotografiju.
      </p>
      <div className="mt-6">
        <StaffManager staff={(staff ?? []) as Staff[]} />
      </div>
    </div>
  );
}
