import { expect, test } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { sledeciRadniDan } from "./fixtures";

// Prozor za otkazivanje linkom: najkasnije 48h pre termina, a termin
// zakazan unutar poslednjih 48h samo u prvom satu od zakazivanja.
// created_at se unazadi service klijentom (kao antispam obrazac) -
// postojeći E2E otkazuje odmah po zakazivanju pa ove grane nikad ne gađa.

const TELEFON_BLIZAK = "+381609990011";
const TELEFON_DALEK = "+381609990012";
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

function dodajDane(dan: string, n: number): string {
  const d = new Date(`${dan}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

let tokenBlizak: string | null = null;
let tokenDalek: string | null = null;

async function ubaci(telefon: string, dan: string): Promise<string> {
  // Termin van grida (06:00) da ne dira slotove drugih testova; created_at
  // se odmah unazadi 2 sata - prvi sat od zakazivanja je sigurno istekao
  const db = service();
  const { data, error } = await db
    .from("bookings")
    .insert({
      tenant_id: DEMO,
      staff_id: DJORDJE,
      service_id: SISANJE,
      customer_name: "Prozor Testić",
      customer_phone: telefon,
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
  const { error: ageErr } = await db
    .from("bookings")
    .update({ created_at: new Date(Date.now() - 2 * 3600_000).toISOString() })
    .eq("tenant_id", DEMO)
    .eq("customer_phone", telefon);
  expect(ageErr).toBeNull();
  return data!.cancel_token;
}

test.beforeAll(async () => {
  const sutra = sledeciRadniDan();
  tokenBlizak = await ubaci(TELEFON_BLIZAK, sutra); // < 48h do termina
  tokenDalek = await ubaci(TELEFON_DALEK, dodajDane(sutra, 6)); // > 48h
});

test.afterAll(async () => {
  const db = service();
  await db.from("bookings").delete().eq("customer_phone", TELEFON_BLIZAK);
  await db.from("bookings").delete().eq("customer_phone", TELEFON_DALEK);
});

test("blizak termin posle prvog sata: link ne otkazuje, nudi se telefon", async ({ page }) => {
  await page.goto(`/demo/otkazivanje/${tokenBlizak}`);

  await expect(page.getByText(/manje od 48 sati/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Otkaži termin" })).toHaveCount(0);

  // Rezervacija je i dalje aktivna u bazi - ništa nije otkazano
  const { data } = await service()
    .from("bookings")
    .select("status")
    .eq("tenant_id", DEMO)
    .eq("customer_phone", TELEFON_BLIZAK)
    .single();
  expect(data!.status).toBe("confirmed");
});

test("dalek termin (>48h) se otkazuje linkom i posle prvog sata", async ({ page }) => {
  await page.goto(`/demo/otkazivanje/${tokenDalek}`);

  await page.getByRole("button", { name: "Otkaži termin" }).click();
  await page.getByRole("button", { name: "Da, otkaži" }).click();
  await expect(page.getByText("Termin je otkazan")).toBeVisible({ timeout: 15_000 });

  const { data } = await service()
    .from("bookings")
    .select("status")
    .eq("tenant_id", DEMO)
    .eq("customer_phone", TELEFON_DALEK)
    .single();
  expect(data!.status).toBe("cancelled");
});
