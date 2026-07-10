import { expect, test } from "@playwright/test";
import { loginAsAdmin } from "./fixtures";

// Admin smoke + regresija za keširanje javnog sajta: izmena kroz admin
// akciju mora ODMAH da se vidi na javnoj strani (bustTenantSiteCache).
// Bez invalidacije bi keširana kopija stajala do isteka TTL-a (5 min) i
// ovaj test bi pao - upravo greška koju čuvamo da se ne vrati.

test("vlasnik se prijavljuje i vidi dashboard", async ({ page }) => {
  await loginAsAdmin(page);
  await expect(page.getByRole("heading", { name: "Početna" })).toBeVisible();
  await expect(page.getByText("Termina danas")).toBeVisible();
});

test("izmena cene u adminu se odmah vidi na javnom sajtu", async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto("/admin/usluge");

  // Red usluge "Fade" (seed: 900 RSD) → olovka otvara formu za izmenu
  const red = page.locator("div.rounded-2xl").filter({ hasText: "Fade" }).first();
  await red.getByRole("button", { name: "Izmeni" }).click();
  await page.fill("#s-price", "999");
  await page.getByRole("button", { name: "Sačuvaj" }).click();

  // Lista u adminu se osveži kroz revalidatePath
  await expect(red.getByText("999 RSD")).toBeVisible({ timeout: 15_000 });

  // Javni sajt: bez tag invalidacije ovde bi stajala keširana stara cena
  await page.goto("/demo");
  await expect(page.getByText("999 RSD").first()).toBeVisible();
});

test("raspon cene: validacija, čuvanje i prikaz na sajtu i u wizardu", async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto("/admin/usluge");

  const red = page.locator("div.rounded-2xl").filter({ hasText: "Šišanje + brada" }).first();
  await red.getByRole("button", { name: "Izmeni" }).click();

  // Gornja granica manja od početne → jasna greška, dijalog ostaje otvoren
  await page.fill("#s-price", "1000");
  await page.fill("#s-price-max", "900");
  await page.getByRole("button", { name: "Sačuvaj" }).click();
  await expect(
    page.getByText("Najviša cena mora biti veća od početne.")
  ).toBeVisible({ timeout: 15_000 });

  // Ispravan raspon prolazi i vidi se u admin listi
  await page.fill("#s-price-max", "1500");
  await page.getByRole("button", { name: "Sačuvaj" }).click();
  await expect(red.getByText("1.000–1.500 RSD")).toBeVisible({ timeout: 15_000 });

  // Javni cenovnik (keš oboren) i booking wizard prikazuju raspon
  await page.goto("/demo");
  await expect(page.getByText("1.000–1.500 RSD").first()).toBeVisible();
  await page.goto("/demo/zakazi");
  await expect(
    page.getByRole("button", { name: /Šišanje \+ brada/ }).getByText("1.000–1.500 RSD")
  ).toBeVisible();

  // Vrati na fiksnu cenu - kasniji specovi (zakazivanje) koriste isti wizard
  await page.goto("/admin/usluge");
  await red.getByRole("button", { name: "Izmeni" }).click();
  await page.fill("#s-price-max", "");
  await page.getByRole("button", { name: "Sačuvaj" }).click();
  await expect(red.getByText("1.000 RSD")).toBeVisible({ timeout: 15_000 });
});
