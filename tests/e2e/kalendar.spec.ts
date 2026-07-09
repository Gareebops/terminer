import { expect, test, type Page } from "@playwright/test";
import { loginAsAdmin, sledeciRadniDan } from "./fixtures";

// Admin alati koje salon koristi svaki dan: ručni upis termina (telefonski
// klijenti), blokada vremena i promena statusa rezervacije. Testovi u ovom
// fajlu idu redom i dele podatke (upisani termin se kasnije otkazuje).

const DATUM = sledeciRadniDan();

async function popuniRucnoZakazivanje(page: Page, vreme: string): Promise<void> {
  const dijalog = page.getByRole("dialog");
  await expect(dijalog.getByText("Ručno zakazivanje")).toBeVisible();
  // Radix Select-ovi unutar dijaloga: prvi je usluga, drugi zaposleni
  await dijalog.getByRole("combobox").first().click();
  await page.getByRole("option", { name: /Muško šišanje/ }).click();
  await dijalog.getByRole("combobox").nth(1).click();
  await page.getByRole("option", { name: "Đorđe" }).click();
  await page.fill("#nb-date", DATUM);
  await page.fill("#nb-time", vreme);
  await page.fill("#nb-name", "Telefonski Klijent");
  await page.fill("#nb-phone", "+381 60 555 44 33");
  await page.getByRole("button", { name: "Upiši rezervaciju" }).click();
}

test("admin ručno upisuje termin, duplikat istog termina je odbijen", async ({ page }) => {
  await loginAsAdmin(page);

  await page.goto("/admin/kalendar?novo=1");
  await popuniRucnoZakazivanje(page, "18:30");
  // Sačekaj potvrdu upisa PRE navigacije - inače trka između server akcije
  // i odlaska na Rezervacije (viđeno kao flake na CI-ju)
  await expect(page.getByText("Rezervacija je upisana.")).toBeVisible({ timeout: 15_000 });

  // Termin je u Rezervacijama sa tačnim vremenom i statusom
  await page.goto("/admin/rezervacije");
  const red = page.getByRole("row").filter({ hasText: "Telefonski Klijent" });
  await expect(red).toBeVisible();
  await expect(red.getByText("18:30–19:00")).toBeVisible();
  await expect(red.getByText("Potvrđeno")).toBeVisible();

  // Isti termin ponovo: baza (exclusion constraint) ga odbija, admin
  // dobija jasnu poruku umesto duple rezervacije
  await page.goto("/admin/kalendar?novo=1");
  await popuniRucnoZakazivanje(page, "18:30");
  await expect(
    page.getByText("Termin se preklapa sa postojećom rezervacijom.")
  ).toBeVisible({ timeout: 15_000 });
});

test("blokada vremena sklanja slotove iz javnog wizarda", async ({ page }) => {
  await loginAsAdmin(page);

  // Blokada celog salona sutra 12:00-13:00 (dijalog se otvara sa ?blokada=1,
  // datum stiže kroz ?dan=)
  await page.goto(`/admin/kalendar?blokada=1&dan=${DATUM}`);
  await expect(page.getByText("Blokiranje termina")).toBeVisible();
  await page.fill("#bl-date", DATUM);
  await page.fill("#bl-start", "12:00");
  await page.fill("#bl-end", "13:00");
  await page.fill("#bl-reason", "pauza (e2e)");
  await page.getByRole("button", { name: "Blokiraj", exact: true }).click();
  await expect(page.getByText("Termin je blokiran.")).toBeVisible({ timeout: 15_000 });

  // Javni wizard na ISTI dan: 12:00 i 12:30 ne postoje, 13:00 postoji
  await page.goto("/demo/zakazi");
  await page.getByRole("button", { name: /Muško šišanje/ }).click();
  await page.getByRole("button", { name: /Đorđe/ }).click();
  await page.locator(`[data-date="${DATUM}"]`).click();
  await expect(
    page.getByRole("button", { name: "13:00", exact: true })
  ).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("button", { name: "12:00", exact: true })).toBeHidden();
  await expect(page.getByRole("button", { name: "12:30", exact: true })).toBeHidden();
});

test("salon otkazuje termin kroz tabelu rezervacija", async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto("/admin/rezervacije");

  const red = page.getByRole("row").filter({ hasText: "Telefonski Klijent" });
  await expect(red).toBeVisible();
  await red.getByRole("button", { name: "Izmeni" }).click();
  await page.getByRole("menuitem", { name: "Otkazano" }).click();

  await expect(red.getByText("Otkazano")).toBeVisible({ timeout: 15_000 });
});
