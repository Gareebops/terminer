import { expect, test } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { dodjiDoDanaSaSlotovima, SLOT_RE, sledeciRadniDan } from "./fixtures";

// Anti-spam granica gost zakazivanja: sa jednim brojem telefona najviše 3
// aktivne rezervacije - četvrta se odbija jasnom porukom (booking akcija
// broji pending/confirmed od danas pa nadalje).

const TELEFON = "+381609998877"; // već kanonski oblik (normalizePhone no-op)
const DEMO = "00000000-0000-0000-0000-000000000001";
const DJORDJE = "00000000-0000-0000-0000-000000000201";
const SISANJE = "00000000-0000-0000-0000-000000000101";

function service(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

test.beforeAll(async () => {
  // Tri aktivne rezervacije van radnog vremena (06-07:30) - limit ih broji
  // isto, a ne diraju slotove drugih testova (grid kreće od 09:00)
  const dan = sledeciRadniDan();
  const db = service();
  for (const [od, doVreme] of [
    ["06:00", "06:30"],
    ["06:30", "07:00"],
    ["07:00", "07:30"],
  ] as const) {
    const { error } = await db.from("bookings").insert({
      tenant_id: DEMO,
      staff_id: DJORDJE,
      service_id: SISANJE,
      customer_name: "Spam Test",
      customer_phone: TELEFON,
      date: dan,
      start_time: od,
      end_time: doVreme,
      starts_at: `${dan}T${od}:00Z`,
      ends_at: `${dan}T${doVreme}:00Z`,
      status: "confirmed",
    });
    expect(error).toBeNull();
  }
});

test.afterAll(async () => {
  await service().from("bookings").delete().eq("customer_phone", TELEFON);
});

test("četvrta rezervacija istim telefonom je odbijena", async ({ page }) => {
  await page.goto("/demo/zakazi");
  await page.getByRole("button", { name: /Muško šišanje/ }).click();
  await page.getByRole("button", { name: /Đorđe/ }).click();
  await dodjiDoDanaSaSlotovima(page);
  await page.getByRole("button", { name: SLOT_RE }).first().click();

  await page.fill("#name", "Spam Test");
  await page.fill("#phone", TELEFON);
  await page.getByRole("button", { name: "Potvrdi termin" }).click();

  await expect(
    page.getByText(/već postoje 3 aktivne rezervacije/)
  ).toBeVisible({ timeout: 15_000 });
  // Nije nastao ekran potvrde
  await expect(page.getByText("Termin je zakazan!")).toBeHidden();
});
