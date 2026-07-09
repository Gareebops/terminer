import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { anonKlijent, imaLokalniStack, serviceKlijent } from "./okruzenje";

// TA multi-tenant garancija: ulogovani vlasnik salona A ne sme da vidi
// ni pipne podatke salona B. RLS testovi za anon pokrivaju javnost; ovo
// pokriva authenticated putanju (admin zona ide session klijentom).

const LOZINKA = "izolacija-Test-123!";

type Ctx = {
  tenantId: string;
  staffId: string;
  serviceId: string;
};

async function napraviSalon(
  service: ReturnType<typeof serviceKlijent>,
  slug: string,
  email: string,
  published: boolean
): Promise<Ctx & { userId: string }> {
  const { data: tenant, error: tErr } = await service
    .from("tenants")
    .insert({ slug, name: `Salon ${slug}`, is_published: published })
    .select("id")
    .single();
  expect(tErr).toBeNull();

  const { data: user, error: uErr } = await service.auth.admin.createUser({
    email,
    password: LOZINKA,
    email_confirm: true,
  });
  expect(uErr).toBeNull();

  const { error: mErr } = await service
    .from("tenant_members")
    .insert({ tenant_id: tenant!.id, user_id: user!.user!.id, role: "owner" });
  expect(mErr).toBeNull();

  const { data: staff } = await service
    .from("staff")
    .insert({ tenant_id: tenant!.id, name: `Radnik ${slug}` })
    .select("id")
    .single();
  const { data: svc } = await service
    .from("services")
    .insert({ tenant_id: tenant!.id, name: `Usluga ${slug}`, duration_minutes: 30, price: 500 })
    .select("id")
    .single();

  await service.from("customers").insert({
    tenant_id: tenant!.id,
    name: `Klijent ${slug}`,
    phone: `+38160${String(Math.abs(hash(slug))).slice(0, 7)}`,
  });
  await service.from("bookings").insert({
    tenant_id: tenant!.id,
    staff_id: staff!.id,
    service_id: svc!.id,
    customer_name: `Klijent ${slug}`,
    customer_phone: "+381601000000",
    date: "2030-06-01",
    start_time: "10:00",
    end_time: "10:30",
    starts_at: "2030-06-01T08:00:00Z",
    ends_at: "2030-06-01T08:30:00Z",
  });
  await service.from("working_hours").insert({
    tenant_id: tenant!.id,
    staff_id: staff!.id,
    day_of_week: 1,
    start_time: "09:00",
    end_time: "17:00",
  });

  return { tenantId: tenant!.id, staffId: staff!.id, serviceId: svc!.id, userId: user!.user!.id };
}

function hash(s: string): number {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0;
  return h;
}

describe.skipIf(!imaLokalniStack)("Izolacija između salona (authenticated)", () => {
  const service = serviceKlijent();
  let a: Ctx & { userId: string };
  let b: Ctx & { userId: string };
  let klijentA: SupabaseClient;

  beforeAll(async () => {
    a = await napraviSalon(service, "izolacija-a", "izolacija-a@terminer.test", true);
    // B namerno NEOBJAVLJEN: ni tenant red ne sme da se vidi spolja
    b = await napraviSalon(service, "izolacija-b", "izolacija-b@terminer.test", false);

    klijentA = anonKlijent();
    const { error } = await klijentA.auth.signInWithPassword({
      email: "izolacija-a@terminer.test",
      password: LOZINKA,
    });
    expect(error).toBeNull();
  });

  afterAll(async () => {
    await klijentA?.auth.signOut();
    for (const slug of ["izolacija-a", "izolacija-b"]) {
      await service.from("tenants").delete().eq("slug", slug);
    }
    for (const u of [a?.userId, b?.userId]) {
      if (u) await service.auth.admin.deleteUser(u);
    }
  });

  it("A vidi SVOJE klijente, a B-ove ne", async () => {
    const svoji = await klijentA.from("customers").select("tenant_id");
    expect(svoji.error).toBeNull();
    expect(svoji.data!.length).toBeGreaterThan(0);
    expect(svoji.data!.every((r) => r.tenant_id === a.tenantId)).toBe(true);

    const tudji = await klijentA
      .from("customers")
      .select("id")
      .eq("tenant_id", b.tenantId);
    expect(tudji.data ?? []).toHaveLength(0);
  });

  it("A ne vidi B-ove rezervacije", async () => {
    const { data } = await klijentA
      .from("bookings")
      .select("id")
      .eq("tenant_id", b.tenantId);
    expect(data ?? []).toHaveLength(0);
  });

  it("A ne vidi B-ovo radno vreme (raspored otkriva kad je radnik sam)", async () => {
    const { data } = await klijentA
      .from("working_hours")
      .select("id")
      .eq("tenant_id", b.tenantId);
    expect(data ?? []).toHaveLength(0);
  });

  it("neobjavljen tuđi salon ne postoji ni za ulogovanog člana drugog salona", async () => {
    const { data } = await klijentA
      .from("tenants")
      .select("id")
      .eq("id", b.tenantId);
    expect(data ?? []).toHaveLength(0);
  });

  it("A ne može da IZMENI B-ovu uslugu (update ne zahvata redove)", async () => {
    const { data } = await klijentA
      .from("services")
      .update({ price: 1 })
      .eq("id", b.serviceId)
      .select("id");
    expect(data ?? []).toHaveLength(0);

    const { data: provera } = await service
      .from("services")
      .select("price")
      .eq("id", b.serviceId)
      .single();
    expect(Number(provera!.price)).toBe(500);
  });

  it("A ne može da UPIŠE red u B-ov salon", async () => {
    const { error } = await klijentA.from("services").insert({
      tenant_id: b.tenantId,
      name: "Uljez usluga",
      duration_minutes: 30,
      price: 100,
    });
    expect(error).not.toBeNull();
  });
});
