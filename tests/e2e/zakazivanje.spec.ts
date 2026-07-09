import { expect, test, type Page } from "@playwright/test";
import { dodjiDoDanaSaSlotovima, SLOT_RE } from "./fixtures";

// Kritičan put od koga platforma živi: gost kroz wizard zakaže termin,
// pa ga otkaže linkom sa ekrana potvrde (isti link ide u mejl).

async function zakaziPrviSlobodan(
  page: Page,
  clan: RegExp,
  ime: string,
  telefon: string
): Promise<string> {
  await page.goto("/demo/zakazi");
  await page.getByRole("button", { name: /Muško šišanje/ }).click();
  await page.getByRole("button", { name: clan }).click();
  await dodjiDoDanaSaSlotovima(page);
  await page.getByRole("button", { name: SLOT_RE }).first().click();

  // Izabrano vreme sa čipa rezimea ("… u HH:MM")
  const chip = await page.getByText(/ u \d{2}:\d{2}$/).first().textContent();
  const vreme = chip?.match(/(\d{2}:\d{2})$/)?.[1];
  expect(vreme).toBeTruthy();

  await page.fill("#name", ime);
  await page.fill("#phone", telefon);
  await page.getByRole("button", { name: "Potvrdi termin" }).click();
  await expect(page.getByText("Termin je zakazan!")).toBeVisible({ timeout: 20_000 });
  return vreme!;
}

test("gost zakazuje termin kroz wizard pa ga otkazuje linkom", async ({ page }) => {
  await zakaziPrviSlobodan(page, /Đorđe/, "Petar E2E Petrović", "+381 60 111 22 33");

  // Link za otkazivanje stoji na ekranu potvrde i bez emaila
  const cancelUrl = (
    await page.locator("p", { hasText: "/otkazivanje/" }).first().textContent()
  )?.trim();
  expect(cancelUrl).toBeTruthy();

  await page.goto(cancelUrl!);
  // Stranica otkazivanja oslovljava klijenta samo imenom ("Petar, ako ti
  // termin ne odgovara…"), a dugme postoji samo za aktivnu rezervaciju
  await expect(page.getByText(/Petar,/)).toBeVisible();
  await page.getByRole("button", { name: "Otkaži termin" }).click();
  await page.getByRole("button", { name: "Da, otkaži" }).click();
  await expect(page.getByText("Termin je otkazan")).toBeVisible({ timeout: 15_000 });
});

test("zauzet termin nestaje iz ponude za drugog gosta", async ({ page }) => {
  // Prvi gost uzima prvi slobodan slot kod Marka
  const vreme = await zakaziPrviSlobodan(
    page,
    /Marko/,
    "Prvi Gost Testić",
    "+381 60 444 55 66"
  );

  // Drugi gost istom navigacijom stiže na isti dan (jedna rezervacija ne
  // zatvara dan od ~20 slotova) - zauzeto vreme ne sme biti u ponudi
  await page.goto("/demo/zakazi");
  await page.getByRole("button", { name: /Muško šišanje/ }).click();
  await page.getByRole("button", { name: /Marko/ }).click();
  await dodjiDoDanaSaSlotovima(page);

  await expect(page.getByRole("button", { name: SLOT_RE }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: vreme, exact: true })).toBeHidden();
});
