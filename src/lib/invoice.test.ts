import { describe, expect, it } from "vitest";
import {
  addMonths,
  buildIpsQr,
  formatAmount,
  invoiceLabel,
  invoicePeriod,
  ISSUER,
  PLANS,
  revertedPaidUntil,
} from "./invoice";

// Fakture su novac: pogrešan poziv na broj znači uplatu koja ne može da se
// upari sa fakturom, pogrešan iznos u QR-u znači pogrešnu uplatu.

describe("buildIpsQr", () => {
  it("gradi tačan NBS IPS payload", () => {
    expect(buildIpsQr({ amount: 1990, invoiceNumber: 7, invoiceYear: 2026 })).toBe(
      "K:PR|V:01|C:1" +
        `|R:${ISSUER.accountIps}` +
        "|N:Čvorište, Svetosavska 3, Niš" +
        "|I:RSD1990,00" +
        "|SF:289" +
        "|S:Terminer članarina" +
        "|RO:002026007"
    );
  });

  it("iznos ide sa zarezom i uvek dve decimale", () => {
    expect(buildIpsQr({ amount: 1234.5, invoiceNumber: 1, invoiceYear: 2026 })).toContain(
      "|I:RSD1234,50|"
    );
  });

  it("poziv na broj: model 00 + godina + redni broj na tri cifre", () => {
    expect(
      buildIpsQr({ amount: 1, invoiceNumber: 42, invoiceYear: 2027 })
    ).toContain("|RO:002027042");
    // preko 999 faktura godišnje: broj se ne seče
    expect(
      buildIpsQr({ amount: 1, invoiceNumber: 1234, invoiceYear: 2026 })
    ).toContain("|RO:0020261234");
  });

  it("račun je u 18-cifrenom IPS obliku (bez crtica)", () => {
    expect(ISSUER.accountIps).toMatch(/^\d{18}$/);
    // izveden iz čitljivog oblika: banka(3) + sredina dopunjena nulama + kontrolni(2)
    const [banka, sredina, kontrola] = ISSUER.account.split("-");
    expect(ISSUER.accountIps).toBe(`${banka}${sredina.padStart(13, "0")}${kontrola}`);
  });
});

describe("formatAmount", () => {
  it("srpski format: tačka za hiljade, zarez za decimale", () => {
    expect(formatAmount(1990)).toBe("1.990,00");
    expect(formatAmount(19900)).toBe("19.900,00");
    expect(formatAmount(0.5)).toBe("0,50");
  });
});

describe("invoiceLabel i planovi", () => {
  it("labela je broj/godina", () => {
    expect(invoiceLabel({ number: 7, year: 2026 })).toBe("7/2026");
  });

  it("godišnji plan je jeftiniji od 12 mesečnih (poslovna postavka)", () => {
    expect(PLANS.yearly.amount).toBeLessThan(PLANS.monthly.amount * 12);
    expect(PLANS.yearly.months).toBe(12);
    expect(PLANS.monthly.months).toBe(1);
  });
});

// Period fakture i vraćanje pogrešno naplaćene: greška ovde pomera plaćene
// periode ili gazi ručne korekcije superadmina.

describe("addMonths / invoicePeriod", () => {
  it("dodaje mesece uz klamp na kraj meseca", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2026-01-15", 1)).toBe("2026-02-15");
    expect(addMonths("2026-07-12", 12)).toBe("2027-07-12");
    expect(addMonths("2024-01-31", 1)).toBe("2024-02-29"); // prestupna
  });

  it("period kreće danas kad pretplata nije plaćena ili je istekla", () => {
    expect(invoicePeriod(null, 1, "2026-07-12")).toEqual({
      from: "2026-07-12",
      to: "2026-08-12",
    });
    expect(invoicePeriod("2026-07-01", 1, "2026-07-12").from).toBe("2026-07-12");
  });

  it("period se lančano nastavlja dan posle postojećeg isteka", () => {
    expect(invoicePeriod("2026-07-20", 1, "2026-07-12")).toEqual({
      from: "2026-07-21",
      to: "2026-08-21",
    });
    // paid_until baš danas: još plaćen, nastavak od sutra
    expect(invoicePeriod("2026-07-12", 12, "2026-07-12").from).toBe("2026-07-13");
  });
});

describe("revertedPaidUntil", () => {
  it("skida paid_until kad ga je postavila upravo ta faktura", () => {
    expect(revertedPaidUntil("2026-08-12", "2026-08-12", [])).toEqual({
      change: true,
      value: null,
    });
  });

  it("pada na najkasniju preostalu plaćenu fakturu", () => {
    expect(
      revertedPaidUntil("2026-08-12", "2026-08-12", ["2026-06-01", "2026-07-15"])
    ).toEqual({ change: true, value: "2026-07-15" });
  });

  it("ne dira ručne korekcije i tuđe periode", () => {
    // paid_until je kasniji od perioda fakture (ručni produžetak/gratis)
    expect(revertedPaidUntil("2027-01-01", "2026-08-12", [])).toEqual({
      change: false,
      value: "2027-01-01",
    });
    expect(revertedPaidUntil(null, "2026-08-12", [])).toEqual({
      change: false,
      value: null,
    });
  });
});
