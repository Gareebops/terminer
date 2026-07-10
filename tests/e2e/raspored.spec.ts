import { expect, test, type Page } from "@playwright/test";
import { belgradeToday, loginAsAdmin } from "./fixtures";

// Raspored kroz UI: izuzetak po datumu ("Ne radi" / skraćeno vreme) mora
// ODMAH da se odrazi na javni wizard. Datumi +8/+9 dana: dovoljno daleko
// da nema sudara sa rezervacijama drugih specova (oni diraju danas/sutra),
// a dovoljno blizu da su unutar podrazumevanog horizonta (60 dana).

function radniDanPlus(n: number): string {
  const d = new Date(`${belgradeToday()}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  if (d.getUTCDay() === 0) d.setUTCDate(d.getUTCDate() + 1); // nedelja → pon
  return d.toISOString().slice(0, 10);
}

// Kolona u tabeli rasporeda: td(0) je ime člana, pa pon..ned
function kolonaZaDatum(iso: string): number {
  const dow = new Date(`${iso}T12:00:00Z`).getUTCDay();
  return ((dow + 6) % 7) + 1;
}

async function otvoriCeliju(page: Page, clan: string, datum: string): Promise<void> {
  await page.goto(`/admin/raspored?od=${datum}`);
  const red = page.getByRole("row").filter({ hasText: clan });
  await red.locator("td").nth(kolonaZaDatum(datum)).getByRole("button").click();
  await expect(page.getByRole("dialog")).toContainText(clan);
}

test("izuzetak 'Ne radi' gasi dan u javnom wizardu", async ({ page }) => {
  const datum = radniDanPlus(8);
  await loginAsAdmin(page);
  await otvoriCeliju(page, "Đorđe", datum);

  const dijalog = page.getByRole("dialog");
  await dijalog.getByRole("button", { name: "Ne radi" }).click();
  await dijalog.getByRole("button", { name: "Sačuvaj" }).click();
  await expect(page.getByText("Raspored je izmenjen.")).toBeVisible({ timeout: 15_000 });

  // Wizard za Đorđa: taj dan postaje neklikabilan ("Ne radi")
  await page.goto("/demo/zakazi");
  await page.getByRole("button", { name: /Muško šišanje/ }).click();
  await page.getByRole("button", { name: /Đorđe/ }).click();
  await expect(page.locator(`[data-date="${datum}"]`)).toBeDisabled({ timeout: 15_000 });
});

test("skraćeno radno vreme seče slotove posle podneva", async ({ page }) => {
  const datum = radniDanPlus(9) === radniDanPlus(8) ? radniDanPlus(10) : radniDanPlus(9);
  await loginAsAdmin(page);
  await otvoriCeliju(page, "Marko", datum);

  // Podrazumevano je "Radi" (pravilo pon-sub) - samo skrati okno na 09-12
  const dijalog = page.getByRole("dialog");
  const vremena = dijalog.locator('input[type="time"]');
  await vremena.first().fill("09:00");
  await vremena.nth(1).fill("12:00");
  await dijalog.getByRole("button", { name: "Sačuvaj" }).click();
  await expect(page.getByText("Raspored je izmenjen.")).toBeVisible({ timeout: 15_000 });

  // Wizard za Marka na taj dan: poslednji slot 11:30, ništa od 12:00 nadalje
  await page.goto("/demo/zakazi");
  await page.getByRole("button", { name: /Muško šišanje/ }).click();
  await page.getByRole("button", { name: /Marko/ }).click();
  await page.locator(`[data-date="${datum}"]`).click();
  await expect(
    page.getByRole("button", { name: "11:30", exact: true })
  ).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("button", { name: "12:00", exact: true })).toBeHidden();
  await expect(page.getByRole("button", { name: "13:00", exact: true })).toBeHidden();
});
