import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { nadjiPotvrdniLink } from "./fixtures";

// Funnel kojim dolaze novi saloni: registracija → potvrda mejla (lokalni
// mail hvatač) → onboarding → salon kreiran → dashboard. Pokriva i PKCE
// razmenu koda kroz /auth/callback - istu koju koristi i Google prijava.

test("registracija sa potvrdom mejla do kreiranog salona", async ({ page }) => {
  // Jedinstveno po pokušaju: retry ne sme da udari u "nalog već postoji"
  const ts = Date.now();
  const email = `e2e-vlasnik-${ts}@terminer.test`;
  const slug = `e2e-salon-${ts}`;

  await page.goto("/registracija");
  await page.fill("#full-name", "E2E Vlasnik Salona");
  await page.fill("#phone", "+381 60 111 99 88");
  await page.fill("#email", email);
  await page.fill("#password", "e2e-Lozinka-123!");
  await page.getByRole("button", { name: "Napravi nalog" }).click();

  await expect(page.getByText("Proveri sanduče")).toBeVisible({ timeout: 15_000 });

  // Potvrdni link iz mail hvatača, otvoren u ISTOM browser kontekstu
  // (PKCE verifier je kolačić postavljen pri registraciji)
  const link = await nadjiPotvrdniLink(email);
  await page.goto(link);

  // /auth/callback → /admin → bez članstva → /onboarding
  await page.waitForURL("**/onboarding", { timeout: 20_000 });
  await page.fill("#name", "E2E Onboarding Salon");
  await page.fill("#slug", slug);
  await page.getByRole("button", { name: "Napravi salon" }).click();

  await page.waitForURL("**/admin", { timeout: 20_000 });

  // Novog vlasnika dočekuje welcome ekran sa imenom salona (modal - Radix
  // stavlja aria-hidden na ostatak strane, pa se dashboard proverava POSLE
  // zatvaranja)
  await expect(page.getByText("Dobro došli u Terminer")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("E2E Onboarding Salon").first()).toBeVisible();
  await page.getByRole("button", { name: "Krenimo" }).click();
  await expect(page.getByRole("heading", { name: "Početna" })).toBeVisible();

  // Počisti za sledeći (retry) run na istom stacku
  const service = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
  await service.from("tenants").delete().eq("slug", slug);
  const { data } = await service.auth.admin.listUsers();
  const user = data?.users.find((u) => u.email === email);
  if (user) await service.auth.admin.deleteUser(user.id);
});
