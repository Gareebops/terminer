import { afterEach, describe, expect, it, vi } from "vitest";
import { nowInZone, zonedToUtc } from "./timezone";

// Konverzija zona je ispod SVAKOG termina (starts_at/ends_at u bazi,
// "danas" u adminu). DST prelazi su klasično mesto tihe greške od sat
// vremena - Evropa/Beograd 2026: 29.3. (02:00→03:00) i 25.10. (03:00→02:00).

const TZ = "Europe/Belgrade";

afterEach(() => {
  vi.useRealTimers();
});

describe("zonedToUtc", () => {
  it("letnje računanje vremena (CEST, +2)", () => {
    expect(zonedToUtc("2026-07-09", "12:00", TZ).toISOString()).toBe(
      "2026-07-09T10:00:00.000Z"
    );
  });

  it("zimsko računanje vremena (CET, +1)", () => {
    expect(zonedToUtc("2026-01-15", "12:00", TZ).toISOString()).toBe(
      "2026-01-15T11:00:00.000Z"
    );
  });

  it("termin posle ponoći pada na prethodni UTC dan", () => {
    expect(zonedToUtc("2026-07-09", "00:15", TZ).toISOString()).toBe(
      "2026-07-08T22:15:00.000Z"
    );
  });

  it("dan prelaska na letnje: pre skoka +1, posle skoka +2", () => {
    expect(zonedToUtc("2026-03-29", "01:30", TZ).toISOString()).toBe(
      "2026-03-29T00:30:00.000Z"
    );
    expect(zonedToUtc("2026-03-29", "12:00", TZ).toISOString()).toBe(
      "2026-03-29T10:00:00.000Z"
    );
  });

  it("nepostojeće vreme (02:30 na dan skoka) se gura napred na 03:30", () => {
    // 02:00-03:00 tog dana ne postoji - standardno ponašanje je pomeranje
    // preko rupe (01:30Z = 03:30 CEST); bitno je da je stabilno i bez izuzetka
    expect(zonedToUtc("2026-03-29", "02:30", TZ).toISOString()).toBe(
      "2026-03-29T01:30:00.000Z"
    );
  });

  it("dan vraćanja na zimsko: 01:30 je još CEST (+2)", () => {
    expect(zonedToUtc("2026-10-25", "01:30", TZ).toISOString()).toBe(
      "2026-10-24T23:30:00.000Z"
    );
  });

  it("dvosmisleno vreme (02:30 na dan vraćanja) bira drugu pojavu (CET)", () => {
    expect(zonedToUtc("2026-10-25", "02:30", TZ).toISOString()).toBe(
      "2026-10-25T01:30:00.000Z"
    );
  });
});

describe("nowInZone", () => {
  it("posle ponoći po Beogradu vraća NOVI datum iako je UTC još juče", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-09T22:30:00Z")); // Beograd: 00:30, 10.7.
    expect(nowInZone(TZ)).toEqual({ date: "2026-07-10", minutes: 30 });
  });

  it("zimi je pomak +1", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-15T10:05:00Z")); // Beograd: 11:05
    expect(nowInZone(TZ)).toEqual({ date: "2026-01-15", minutes: 11 * 60 + 5 });
  });

  it("minut pre ponoći ostaje na starom datumu", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-09T21:59:00Z")); // Beograd: 23:59
    expect(nowInZone(TZ)).toEqual({ date: "2026-07-09", minutes: 23 * 60 + 59 });
  });
});
