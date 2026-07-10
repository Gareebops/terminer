import { afterAll, describe, expect, it } from "vitest";
import {
  anonKlijent,
  DEMO_TENANT_ID,
  imaLokalniStack,
  serviceKlijent,
} from "./okruzenje";

// RLS + eksplicitni GRANT-ovi (migracija 20260709000001) su brana između
// salona i između javnosti i ličnih podataka. Ovi testovi pretvaraju
// "verujem da su privilegije dobre" u proveru pri svakom pushu - pogrešna
// migracija politika ILI grantova ovde pada odmah. Od 9.7: lične tabele za
// anon nemaju ni SELECT grant, pa upit pada sa 42501 (permission denied)
// umesto da vrati prazan rezultat.

describe.skipIf(!imaLokalniStack)("RLS: šta anonimni posetilac sme da vidi", () => {
  const anon = anonKlijent();
  const service = serviceKlijent();
  const RLS_SLUG = "rls-proba-neobjavljen";

  afterAll(async () => {
    await service.from("tenants").delete().eq("slug", RLS_SLUG);
  });

  it("rezervacije su nedostupne i na nivou granta (lični podaci klijenata)", async () => {
    const { data, error } = await anon.from("bookings").select("*").limit(10);
    expect(error?.code).toBe("42501");
    expect(data).toBeNull();
  });

  it("evidencija klijenata je nedostupna i na nivou granta", async () => {
    const { data, error } = await anon.from("customers").select("*").limit(10);
    expect(error?.code).toBe("42501");
    expect(data).toBeNull();
  });

  it("blokade i raspored radnika nisu javno upitljivi", async () => {
    for (const tabela of ["blocked_slots", "working_hours", "shift_assignments"]) {
      const { error } = await anon.from(tabela).select("*").limit(1);
      expect(error?.code, tabela).toBe("42501");
    }
  });

  it("anonimac ne može da upiše rezervaciju direktno u bazu", async () => {
    const { error } = await anon.from("bookings").insert({
      tenant_id: DEMO_TENANT_ID,
      staff_id: "00000000-0000-0000-0000-000000000201",
      service_id: "00000000-0000-0000-0000-000000000101",
      customer_name: "Uljez",
      customer_phone: "+381600000999",
      date: "2030-01-01",
      start_time: "10:00",
      end_time: "10:30",
      starts_at: "2030-01-01T10:00:00Z",
      ends_at: "2030-01-01T10:30:00Z",
    });
    expect(error).not.toBeNull();
  });

  it("neobjavljen salon za javnost ne postoji", async () => {
    const { error: createError } = await service
      .from("tenants")
      .insert({ slug: RLS_SLUG, name: "RLS Proba", is_published: false });
    expect(createError).toBeNull();

    const { data } = await anon.from("tenants").select("slug").eq("slug", RLS_SLUG);
    expect(data ?? []).toHaveLength(0);
  });

  it("billing kolone tenants-a nisu u javnim SELECT privilegijama", async () => {
    const { error } = await anon
      .from("tenants")
      .select("slug, paid_until")
      .eq("slug", "demo");
    expect(error).not.toBeNull();
  });

  it("objavljen salon jeste javno vidljiv (kontrolna provera)", async () => {
    const { data, error } = await anon
      .from("tenants")
      .select("slug, name")
      .eq("slug", "demo")
      .maybeSingle();
    expect(error).toBeNull();
    expect(data?.slug).toBe("demo");
  });

  it("javne tabele sajta ostaju čitljive anonimcu (kontrolna provera)", async () => {
    // Tačno ono što loadTenantSite (lib/tenant.ts) čita anon klijentom -
    // ako grant migracija previše skrati, javni sajt salona pada ovde.
    // Seed ne puni gallery, pa se tamo proverava samo da upit prolazi.
    for (const tabela of ["site_settings", "services", "staff", "staff_services", "gallery"]) {
      const { data, error } = await anon
        .from(tabela)
        .select("*")
        .eq("tenant_id", DEMO_TENANT_ID)
        .limit(1);
      expect(error, tabela).toBeNull();
      if (tabela !== "gallery") {
        expect((data ?? []).length, tabela).toBeGreaterThan(0);
      }
    }
  });
});
