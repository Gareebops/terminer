import { describe, expect, it } from "vitest";
import { buildIpsQr, formatAmount, invoiceLabel, ISSUER, PLANS } from "./invoice";

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
