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

// Datumi u zoni salona (Europe/Belgrade) - CI radi u UTC, pa bi posle
// 22h leti "sutra" po runneru bilo "danas" po salonu
export function belgradeToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Belgrade" }).format(new Date());
}

function addDaysISO(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// Sutrašnji dan, preskačući nedelju (seed: nedelja neradna) - da testovi
// koji gledaju slotove u wizardu ne padnu jednom nedeljno
export function sledeciRadniDan(): string {
  let iso = addDaysISO(belgradeToday(), 1);
  if (new Date(`${iso}T12:00:00Z`).getUTCDay() === 0) iso = addDaysISO(iso, 1);
  return iso;
}
