import { getAdminContext } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import type { Service } from "@/lib/types";
import { ServicesManager } from "./services-manager";

export default async function ServicesPage() {
  const { tenant } = await getAdminContext();
  const supabase = await createClient();

  const { data: services } = await supabase
    .from("services")
    .select("*")
    .eq("tenant_id", tenant.id)
    .order("sort_order")
    .order("created_at");

  return (
    <div>
      <h1 className="text-3xl font-extrabold tracking-tight">Usluge</h1>
      <p className="mt-1 text-sm font-medium text-ink/70">
        Usluge koje klijenti mogu da zakažu online.
      </p>
      <div className="mt-6">
        <ServicesManager services={(services ?? []) as Service[]} />
      </div>
    </div>
  );
}
