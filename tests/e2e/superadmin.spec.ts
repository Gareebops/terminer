import { expect, test } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { belgradeToday, loginAsAdmin, loginAsSuperAdmin } from "./fixtures";

// Superadmin panel: kontrola pristupa, suspenzija (skida sajt ODMAH),
// produženja pretplate i tok fakture. Suspenzija se testira na NAMENSKOM
// salonu - demo mora ostati objavljen za ostale specove u suite-u.

const SA_SLUG = "sa-proba";
const DEMO_ID = "00000000-0000-0000-0000-000000000001";
const GODINA = Number(belgradeToday().slice(0, 4));

function service(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

test.beforeAll(async () => {
  const db = service();
  const { data: tenant, error } = await db
    .from("tenants")
    .insert({ slug: SA_SLUG, name: "Salon Za Suspenziju", is_published: true })
    .select("id")
    .single();
  expect(error).toBeNull();
  await db.from("site_settings").insert({ tenant_id: tenant!.id, hero_title: "Salon Za Suspenziju" });
});

test.afterAll(async () => {
  const db = service();
  await db.from("tenants").delete().eq("slug", SA_SLUG);
  await db.from("invoices").delete().in("number", [990, 991]).eq("year", GODINA);
});

test("vlasnik salona (ne-superadmin) dobija 404 na panelu", async ({ page }) => {
  await loginAsAdmin(page);
  const odgovor = await page.goto("/superadmin");
  expect(odgovor!.status()).toBe(404);
});

test("suspenzija ODMAH skida javni sajt; ukidanje vraća kontrolu vlasniku", async ({ page }) => {
  // Pre suspenzije: javni sajt živ (i keširan - suspenzija mora da ga obori)
  const pre = await page.goto(`/${SA_SLUG}`);
  expect(pre!.status()).toBe(200);

  await loginAsSuperAdmin(page);
  await expect(page.getByRole("heading", { name: "Superadmin" })).toBeVisible();

  const red = page
    .locator("div.rounded-2xl")
    .filter({ has: page.getByRole("link", { name: `/${SA_SLUG}`, exact: true }) });
  await red.getByRole("button", { name: "Suspenduj" }).click();

  const dijalog = page.getByRole("dialog");
  await expect(dijalog.getByText("Suspenzija salona")).toBeVisible();
  await page.fill("#sa-reason", "E2E proba suspenzije");
  await dijalog.getByRole("button", { name: "Suspenduj" }).click();
  await expect(page.getByText("Salon je suspendovan.")).toBeVisible({ timeout: 15_000 });
  await expect(red.getByText("SUSPENDOVAN")).toBeVisible({ timeout: 15_000 });

  // Keširan javni sajt mora pasti na 404 BEZ čekanja TTL-a (bustTenantSiteCache)
  const posle = await page.goto(`/${SA_SLUG}`);
  expect(posle!.status()).toBe(404);

  // Ukidanje: badge nestaje, ali sajt ostaje neobjavljen (vlasnik odlučuje)
  await page.goto("/superadmin");
  await red.getByRole("button", { name: "Ukini suspenziju" }).click();
  await expect(page.getByText("Suspenzija je ukinuta.")).toBeVisible({ timeout: 15_000 });
  await expect(red.getByText("SUSPENDOVAN")).toBeHidden();
  await expect(red.getByText("neobjavljen")).toBeVisible();
});

test("produženje probe pa pretplate menja status salona", async ({ page }) => {
  await loginAsSuperAdmin(page);
  const red = page
    .locator("div.rounded-2xl")
    .filter({ has: page.getByRole("link", { name: "/demo", exact: true }) });

  // Demo je iz seeda u probi → dugme postoji; posle +1 mes nestaje (active)
  await red.getByRole("button", { name: "Proba +14d" }).click();
  await expect(page.getByText("Proba produžena 14 dana.")).toBeVisible({ timeout: 15_000 });

  await red.getByRole("button", { name: "+1 mes" }).click();
  await expect(page.getByText("Produženo 1 mes.")).toBeVisible({ timeout: 15_000 });
  await expect(red.getByText(/Plaćeno do/)).toBeVisible({ timeout: 15_000 });
  await expect(red.getByText(/Aktivan · /)).toBeVisible();
  await expect(red.getByRole("button", { name: "Proba +14d" })).toBeHidden();
});

test("faktura: označavanje plaćenom i storniranje", async ({ page }) => {
  // Seed nema fakture - ubaci dve "issued" u RAZLIČITIM periodima
  // (plaćanje automatski stornira sestrinske fakture ISTOG perioda)
  const db = service();
  for (const [broj, from, to] of [
    [990, `${GODINA}-11-01`, `${GODINA}-12-01`],
    [991, `${GODINA + 1}-01-01`, `${GODINA + 1}-02-01`],
  ] as const) {
    const { error } = await db.from("invoices").insert({
      tenant_id: DEMO_ID,
      number: broj,
      year: GODINA,
      plan: "monthly",
      amount: 1990,
      period_from: from,
      period_to: to,
    });
    expect(error).toBeNull();
  }

  await loginAsSuperAdmin(page);

  const placena = page.locator("div.rounded-2xl").filter({ hasText: `990/${GODINA}` });
  await placena.getByRole("button", { name: "Označi plaćeno" }).click();
  await expect(page.getByText("Plaćeno - pretplata produžena.")).toBeVisible({ timeout: 15_000 });
  await expect(placena.getByText("Plaćena")).toBeVisible({ timeout: 15_000 });

  // Storno ide kroz NATIVNI confirm - Playwright ga podrazumevano odbija
  page.on("dialog", (d) => d.accept());
  const stornirana = page.locator("div.rounded-2xl").filter({ hasText: `991/${GODINA}` });
  await stornirana.getByRole("button", { name: "Storno" }).click();
  await expect(page.getByText("Faktura stornirana.")).toBeVisible({ timeout: 15_000 });
  await expect(stornirana.getByText("Stornirana")).toBeVisible({ timeout: 15_000 });
});
