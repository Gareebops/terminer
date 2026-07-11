import { expect, test } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { sledeciRadniDan } from "./fixtures";

// Prozor za otkazivanje linkom: sat vremena od zakazivanja. Rezervaciji se
// created_at unazadi service klijentom (kao antispam obrazac) pa stranica
// otkazivanja mora da ponudi telefon salona umesto dugmeta - postojeći E2E
// otkazuje odmah po zakazivanju pa ovu granu nikad ne gađa.

const TELEFON = "+381609990011";
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

let token: string | null = null;

test.beforeAll(async () => {
  // Termin van grida (06:00) da ne dira slotove drugih testova; created_at
  // se odmah unazadi 2 sata - prozor od sat vremena je sigurno istekao
  const dan = sledeciRadniDan();
  const db = service();
  const { data, error } = await db
    .from("bookings")
    .insert({
      tenant_id: DEMO,
      staff_id: DJORDJE,
      service_id: SISANJE,
      customer_name: "Prozor Testić",
      customer_phone: TELEFON,
      date: dan,
      start_time: "06:00",
      end_time: "06:30",
      starts_at: `${dan}T06:00:00Z`,
      ends_at: `${dan}T06:30:00Z`,
      status: "confirmed",
    })
    .select("cancel_token")
    .single();
  expect(error).toBeNull();
  token = data!.cancel_token;

  const { error: ageErr } = await db
    .from("bookings")
    .update({ created_at: new Date(Date.now() - 2 * 3600_000).toISOString() })
    .eq("tenant_id", DEMO)
    .eq("customer_phone", TELEFON);
  expect(ageErr).toBeNull();
});

test.afterAll(async () => {
  await service().from("bookings").delete().eq("customer_phone", TELEFON);
});

test("posle sat vremena link ne otkazuje, nudi se telefon salona", async ({ page }) => {
  await page.goto(`/demo/otkazivanje/${token}`);

  await expect(
    page.getByText(/više od sat vremena od zakazivanja/)
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Otkaži termin" })).toHaveCount(0);

  // Rezervacija je i dalje aktivna u bazi - ništa nije otkazano
  const { data } = await service()
    .from("bookings")
    .select("status")
    .eq("tenant_id", DEMO)
    .eq("customer_phone", TELEFON)
    .single();
  expect(data!.status).toBe("confirmed");
});
