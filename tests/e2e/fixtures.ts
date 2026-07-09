import type { Page } from "@playwright/test";

// Seed podaci (supabase/seed.sql) na koje se testovi oslanjaju
export const DEMO_TENANT_ID = "00000000-0000-0000-0000-000000000001";
export const DEMO_SLUG = "demo";

// Nalog koji global-setup kreira u LOKALNOJ bazi (nikad ne postoji u
// produkciji - guard u setup-u ionako odbija sve što nije localhost)
export const E2E_ADMIN = {
  email: "e2e-admin@terminer.test",
  password: "e2e-Lozinka-123!",
};

export async function loginAsAdmin(page: Page): Promise<void> {
  await page.goto("/prijava");
  await page.fill("#email", E2E_ADMIN.email);
  await page.fill("#password", E2E_ADMIN.password);
  await page.getByRole("button", { name: "Prijavi se" }).click();
  await page.waitForURL("**/admin");
}
