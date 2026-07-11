import { expect, test } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { DEMO_TENANT_ID, loginAsAdmin, loginAsSuperAdmin } from "./fixtures";

// Live chat podrške: vlasnik piše iz plutajućeg widgeta u adminu,
// superadmin vidi razgovor u /superadmin/poruke, odgovara i zatvara,
// pa vlasnik vidi odgovor i obaveštenje o zatvaranju. Testovi idu redom
// (workers: 1) i dele isti razgovor.

const PITANJE = `E2E pitanje za podršku ${Date.now()}`;
const ODGOVOR = "E2E odgovor podrške - rešeno!";

function service(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

test.afterAll(async () => {
  // Kaskada composite FK-a nosi i poruke
  await service()
    .from("support_conversations")
    .delete()
    .eq("tenant_id", DEMO_TENANT_ID);
});

test("vlasnik otvara chat i šalje prvu poruku", async ({ page }) => {
  await loginAsAdmin(page);

  await page.getByRole("button", { name: /^Podrška/ }).click();
  await page.getByLabel("Poruka za podršku").fill(PITANJE);
  await page.getByRole("button", { name: "Pošalji poruku" }).click();

  // Poruka se pojavljuje u threadu posle refetch-a
  await expect(page.getByText(PITANJE)).toBeVisible();
});

test("superadmin vidi razgovor, odgovara i zatvara ga", async ({ page }) => {
  await loginAsSuperAdmin(page);

  // Sa glavnog panela do inboxa (link nosi i badge nepročitanih)
  await page.getByRole("link", { name: /Poruke podrške/ }).click();
  await page.waitForURL("**/superadmin/poruke");

  await page.getByRole("button", { name: /Salon Demo/ }).click();
  await expect(page.getByText(PITANJE)).toBeVisible();

  await page.getByLabel("Odgovor vlasniku salona").fill(ODGOVOR);
  await page.getByRole("button", { name: "Pošalji odgovor" }).click();
  await expect(page.getByText(ODGOVOR)).toBeVisible();

  await page.getByRole("button", { name: "Zatvori" }).click();
  await expect(page.getByText("Razgovor je zatvoren.")).toBeVisible(); // toast
  await expect(page.getByText("Zatvoren", { exact: true })).toBeVisible(); // bedž
});

test("vlasnik vidi odgovor podrške i zatvoren razgovor", async ({ page }) => {
  await loginAsAdmin(page);

  // Bedž nepročitanih na plutajućem dugmetu (odgovor podrške je stigao)
  const fab = page.getByRole("button", { name: /^Podrška - \d+ nepročitan/ });
  await expect(fab).toBeVisible();
  await fab.click();

  await expect(page.getByText(ODGOVOR)).toBeVisible();
  await expect(
    page.getByText("Razgovor je zatvoren - nova poruka otvara nov razgovor.")
  ).toBeVisible();
});
