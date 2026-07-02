import Link from "next/link";
import { CalendarDays, TrendingUp, Users, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAdminContext } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { formatPrice } from "@/lib/booking/slots";
import { nowInZone } from "@/lib/booking/timezone";

function addDaysISO(dateStr: string, n: number): string {
  const d = new Date(`${dateStr}T12:00:00`);
  d.setDate(d.getDate() + n);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default async function AdminDashboardPage() {
  const { tenant } = await getAdminContext();
  const supabase = await createClient();

  const today = nowInZone(tenant.timezone).date;
  const todayDate = new Date(`${today}T12:00:00`);
  const dow = todayDate.getDay();
  const monday = addDaysISO(today, dow === 0 ? -6 : 1 - dow);
  const sunday = addDaysISO(monday, 6);
  const monthStart = `${today.slice(0, 7)}-01`;
  const monthEnd = addDaysISO(`${today.slice(0, 7)}-28`, 7).slice(0, 7) + "-01";

  const activeStatuses = ["pending", "confirmed", "completed"];

  const [todayRes, weekRes, monthRes, customersRes] = await Promise.all([
    supabase
      .from("bookings")
      .select("id, start_time, customer_name, services(name), staff(name), status")
      .eq("tenant_id", tenant.id)
      .eq("date", today)
      .in("status", activeStatuses)
      .order("start_time"),
    supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenant.id)
      .gte("date", monday)
      .lte("date", sunday)
      .in("status", activeStatuses),
    supabase
      .from("bookings")
      .select("service_id, services(name, price, currency)")
      .eq("tenant_id", tenant.id)
      .gte("date", monthStart)
      .lt("date", monthEnd)
      .in("status", activeStatuses),
    supabase
      .from("customers")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenant.id),
  ]);

  const todayBookings = todayRes.data ?? [];
  const monthRows = (monthRes.data ?? []) as unknown as {
    service_id: string;
    services: { name: string; price: number; currency: string } | null;
  }[];

  const monthRevenue = monthRows.reduce((sum, r) => sum + Number(r.services?.price ?? 0), 0);
  const currency = monthRows[0]?.services?.currency ?? "RSD";

  const byService = new Map<string, { name: string; count: number }>();
  for (const r of monthRows) {
    const key = r.service_id;
    const entry = byService.get(key) ?? { name: r.services?.name ?? "—", count: 0 };
    entry.count += 1;
    byService.set(key, entry);
  }
  const topServices = [...byService.values()].sort((a, b) => b.count - a.count).slice(0, 5);
  const maxCount = topServices[0]?.count ?? 1;

  const stats = [
    { icon: CalendarDays, label: "Danas", value: String(todayBookings.length) },
    { icon: TrendingUp, label: "Ove nedelje", value: String(weekRes.count ?? 0) },
    {
      icon: Wallet,
      label: "Promet ovog meseca",
      value: formatPrice(monthRevenue, currency),
      sub: `${monthRows.length} termina`,
    },
    { icon: Users, label: "Klijenata u evidenciji", value: String(customersRes.count ?? 0) },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold">Početna</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Pregled za {todayDate.toLocaleDateString("sr-RS")}
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <s.icon className="size-4" /> {s.label}
              </div>
              <p className="mt-2 text-2xl font-bold">{s.value}</p>
              {"sub" in s && s.sub && (
                <p className="text-xs text-muted-foreground">{s.sub}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Današnji raspored</CardTitle>
          </CardHeader>
          <CardContent>
            {todayBookings.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Nema termina za danas.{" "}
                <Link href="/admin/kalendar" className="underline">
                  Otvori kalendar
                </Link>
              </p>
            )}
            <ul className="space-y-2">
              {todayBookings.map((b) => {
                const row = b as unknown as {
                  id: string;
                  start_time: string;
                  customer_name: string;
                  services: { name: string } | null;
                  staff: { name: string } | null;
                };
                return (
                  <li key={row.id} className="flex items-center gap-3 text-sm">
                    <span className="w-12 font-mono font-medium">
                      {row.start_time.slice(0, 5)}
                    </span>
                    <span className="font-medium">{row.customer_name}</span>
                    <span className="text-muted-foreground">
                      {row.services?.name} · {row.staff?.name}
                    </span>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top usluge ovog meseca</CardTitle>
          </CardHeader>
          <CardContent>
            {topServices.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Još nema rezervacija ovog meseca.
              </p>
            )}
            <ul className="space-y-3">
              {topServices.map((s) => (
                <li key={s.name} className="text-sm">
                  <div className="flex justify-between">
                    <span>{s.name}</span>
                    <span className="font-medium">{s.count}</span>
                  </div>
                  <div className="mt-1 h-2 rounded bg-muted">
                    <div
                      className="h-2 rounded bg-primary"
                      style={{ width: `${(s.count / maxCount) * 100}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
