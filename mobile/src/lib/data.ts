// Čitanja podataka — identični upiti kao web admin (pod RLS-om člana).
import { supabase } from "./supabase";
import type { AdminTenant, BookingStatus, TodayBooking } from "./types";

let cachedTenant: AdminTenant | null = null;

export function clearTenantCache() {
  cachedTenant = null;
}

// PostgREST embed vraća objekat za many-to-one, ali tipovi bez codegen-a to
// ne znaju — defanzivno pokrivamo i niz.
function embedOne<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

export async function fetchTenant(): Promise<AdminTenant | null> {
  if (cachedTenant) return cachedTenant;
  const { data, error } = await supabase
    .from("tenant_members")
    .select("tenant_id, tenants(id, name, slug, timezone)")
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const tenant = embedOne(data?.tenants ?? null) as AdminTenant | null;
  cachedTenant = tenant;
  return tenant;
}

export function todayInZone(timezone: string): string {
  // en-CA daje YYYY-MM-DD format.
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(
    new Date()
  );
}

export function hourInZone(timezone: string): number {
  return Number(
    new Intl.DateTimeFormat("en-GB", {
      hour: "numeric",
      hour12: false,
      timeZone: timezone,
    }).format(new Date())
  );
}

const ACTIVE_STATUSES: BookingStatus[] = ["pending", "confirmed", "completed"];

export async function fetchTodayBookings(
  tenant: AdminTenant
): Promise<TodayBooking[]> {
  const { data, error } = await supabase
    .from("bookings")
    .select("id, start_time, end_time, customer_name, status, services(name), staff(name)")
    .eq("tenant_id", tenant.id)
    .eq("date", todayInZone(tenant.timezone))
    .in("status", ACTIVE_STATUSES)
    .order("start_time");
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => {
    const service = embedOne(row.services);
    const staff = embedOne(row.staff);
    return {
      id: row.id as string,
      startTime: String(row.start_time).slice(0, 5),
      endTime: String(row.end_time).slice(0, 5),
      customerName: (row.customer_name as string) ?? "",
      status: row.status as BookingStatus,
      serviceName: service?.name ?? "",
      staffName: staff?.name ?? "",
    };
  });
}
