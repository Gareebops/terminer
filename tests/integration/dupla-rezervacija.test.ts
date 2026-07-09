import { afterAll, describe, expect, it } from "vitest";
import {
  DEMO_TENANT_ID,
  imaLokalniStack,
  SERVICE_SISANJE,
  serviceKlijent,
  STAFF_MARKO,
  sutraISO,
} from "./okruzenje";

// Najvrednija garancija platforme: dva klijenta NE MOGU da zakažu isti
// termin, ma koliko istovremeno kliknuli. Brani je exclusion constraint
// bookings_no_overlap u bazi (23P01) - aplikativni kod je samo retry.

describe.skipIf(!imaLokalniStack)("Zaštita od duple rezervacije", () => {
  const db = serviceKlijent();
  const sutra = sutraISO();

  // 06:00 - namerno van radnog vremena: constraint ne zavisi od rasporeda,
  // a E2E wizard testovi (09-20h) ne mogu da se sudare sa ovim redovima
  const red = (telefon: string) => ({
    tenant_id: DEMO_TENANT_ID,
    staff_id: STAFF_MARKO,
    service_id: SERVICE_SISANJE,
    customer_name: "Race Test",
    customer_phone: telefon,
    date: sutra,
    start_time: "06:00",
    end_time: "06:30",
    starts_at: `${sutra}T06:00:00Z`,
    ends_at: `${sutra}T06:30:00Z`,
    status: "confirmed",
  });

  afterAll(async () => {
    await db
      .from("bookings")
      .delete()
      .eq("tenant_id", DEMO_TENANT_ID)
      .eq("customer_name", "Race Test");
  });

  it("od dva istovremena upisa istog termina prolazi tačno jedan", async () => {
    const [prvi, drugi] = await Promise.all([
      db.from("bookings").insert(red("+381609990001")).select("id").maybeSingle(),
      db.from("bookings").insert(red("+381609990002")).select("id").maybeSingle(),
    ]);

    const uspesni = [prvi, drugi].filter((r) => !r.error && r.data);
    const odbijeni = [prvi, drugi].filter((r) => r.error);
    expect(uspesni).toHaveLength(1);
    expect(odbijeni).toHaveLength(1);
    // 23P01 = exclusion_violation (bookings_no_overlap)
    expect(odbijeni[0].error!.code).toBe("23P01");
  });

  it("otkazan termin oslobađa slot za novu rezervaciju", async () => {
    const { data: postojeci } = await db
      .from("bookings")
      .select("id")
      .eq("tenant_id", DEMO_TENANT_ID)
      .eq("customer_name", "Race Test")
      .in("status", ["pending", "confirmed"])
      .limit(1)
      .single();

    await db.from("bookings").update({ status: "cancelled" }).eq("id", postojeci!.id);

    // Constraint važi samo za aktivne statuse - isti termin sada prolazi
    const { data, error } = await db
      .from("bookings")
      .insert(red("+381609990003"))
      .select("id")
      .maybeSingle();
    expect(error).toBeNull();
    expect(data).not.toBeNull();
  });
});
