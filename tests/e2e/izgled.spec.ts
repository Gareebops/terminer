import { expect, test } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SITE_THEMES } from "../../src/lib/themes";
import { DEMO_TENANT_ID, loginAsAdmin } from "./fixtures";

// Kustomizacija izgleda: novi tokeni se ODMAH vide na javnom sajtu
// (keš bust kroz updateAppearance), a "Predloži izgled" primenjuje celu
// temu uz mogućnost vraćanja. Snapshot/restore preko service klijenta:
// i PAD testa na pola ostavlja demo salon u podrazumevanom izgledu -
// ostatak suite-a ne sme da zavisi od ishoda ovog fajla.

function service(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

let snimljeno: { primary_color: string; theme: unknown } | null = null;

test.beforeAll(async () => {
  const { data } = await service()
    .from("site_settings")
    .select("primary_color, theme")
    .eq("tenant_id", DEMO_TENANT_ID)
    .single();
  snimljeno = data;
});

test.afterAll(async () => {
  if (!snimljeno) return;
  await service()
    .from("site_settings")
    .update({ primary_color: snimljeno.primary_color, theme: snimljeno.theme })
    .eq("tenant_id", DEMO_TENANT_ID);
});

test("velika slova naslova se odmah vide na javnom sajtu", async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto("/admin/podesavanja");

  await page.getByRole("button", { name: "Velika slova" }).click();
  await expect(page.getByText("Stil naslova je sačuvan.")).toBeVisible({ timeout: 15_000 });
  await page.goto("/demo");
  await expect(page.locator('[data-heading="caps"]')).toHaveCount(1);

  // Vrati na podrazumevano
  await page.goto("/admin/podesavanja");
  await page.getByRole("button", { name: "Normalno", exact: true }).click();
  await expect(page.getByText("Stil naslova je sačuvan.")).toBeVisible({ timeout: 15_000 });
  await page.goto("/demo");
  await expect(page.locator('[data-heading="normal"]')).toHaveCount(1);
});

test("novi fontovi su u ponudi", async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto("/admin/podesavanja");
  for (const label of ["Luksuzno", "Geometrijsko", "Odvažno", "Književno", "Nežno"]) {
    await expect(page.getByText(label, { exact: true })).toBeVisible();
  }
});

test("predlog izgleda primenjuje temu i vraća prethodno stanje", async ({ page, context }) => {
  await loginAsAdmin(page);
  await page.goto("/admin/podesavanja");

  await page.getByRole("button", { name: "Predloži izgled" }).click();
  // reducedMotion u configu preskače teatar, pa je primena brza
  await expect(page.getByText(/Primenjena tema/)).toBeVisible({ timeout: 20_000 });

  // Pročitaj KOJA tema je primenjena pa asertuj baš njene tokene na sajtu -
  // [data-radius] uvek postoji, pa bi gola provera prisustva bila tautologija
  const temaLabel = (
    await page
      .locator("span", { hasText: "Tema:" })
      .locator("span")
      .first()
      .textContent()
  )?.trim();
  const tema = SITE_THEMES.find((t) => t.label === temaLabel);
  expect(tema, `nepoznata tema u UI: ${temaLabel}`).toBeTruthy();

  // Javni sajt proveri u DRUGOM tabu - undo snapshot živi u state-u forme,
  // navigacija bi ga obrisala
  const javno = await context.newPage();
  await javno.goto("/demo");
  await expect(javno.locator(`[data-radius="${tema!.radiusScale}"]`)).toHaveCount(1);
  await expect(javno.locator(`[data-heading="${tema!.headingStyle}"]`)).toHaveCount(1);
  await expect(javno.locator(`[data-button-style="${tema!.buttonStyle}"]`)).toHaveCount(1);

  // Vrati staro: demo se vraća na podrazumevani izgled
  await page.getByRole("button", { name: "Vrati prethodni izgled" }).click();
  await expect(page.getByText("Vraćen prethodni izgled.")).toBeVisible({ timeout: 15_000 });
  await javno.goto("/demo");
  await expect(javno.locator('[data-radius="soft"]')).toHaveCount(1);
  await expect(javno.locator('[data-heading="normal"]')).toHaveCount(1);
  await javno.close();
});
