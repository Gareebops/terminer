import { describe, expect, it } from "vitest";
import {
  CANCEL_CUTOFF_HOURS,
  CANCEL_WINDOW_MINUTES,
  linkCancelExpired,
} from "./cancel";

const T0 = Date.parse("2026-07-11T10:00:00Z");
const min = (n: number) => n * 60_000;
const h = (n: number) => n * 3_600_000;
const iso = (ms: number) => new Date(ms).toISOString();

describe("linkCancelExpired", () => {
  it("unutar sata od zakazivanja link uvek važi, i za termin za 2h", () => {
    const created = iso(T0);
    const starts = iso(T0 + h(2));
    expect(linkCancelExpired(created, starts, T0)).toBe(false);
    expect(linkCancelExpired(created, starts, T0 + min(59))).toBe(false);
    expect(linkCancelExpired(created, starts, T0 + min(CANCEL_WINDOW_MINUTES))).toBe(false);
  });

  it("posle sata: važi samo ako je do termina ostalo bar 48h", () => {
    const created = iso(T0);
    // Termin za 5 dana - link radi i posle isteka prvog sata
    expect(linkCancelExpired(created, iso(T0 + h(120)), T0 + h(3))).toBe(false);
    // Termin za 47h u trenutku provere - zaključano
    expect(linkCancelExpired(created, iso(T0 + h(50)), T0 + h(3))).toBe(true);
  });

  it("granica od 48h: tačno 48h pre početka još važi, minut kasnije ne", () => {
    const created = iso(T0);
    const starts = iso(T0 + h(100));
    const naGranici = T0 + h(100) - h(CANCEL_CUTOFF_HOURS);
    expect(linkCancelExpired(created, starts, naGranici)).toBe(false);
    expect(linkCancelExpired(created, starts, naGranici + min(1))).toBe(true);
  });

  it("granica prvog sata: minut posle sata za blizak termin zaključava", () => {
    const created = iso(T0);
    const starts = iso(T0 + h(24));
    expect(linkCancelExpired(created, starts, T0 + min(CANCEL_WINDOW_MINUTES) + 1)).toBe(true);
  });

  it("radi sa postgres timestamptz formatom (offset umesto Z)", () => {
    // Supabase vraća npr. 2026-07-11T12:00:00+02:00 (= 10:00Z)
    expect(
      linkCancelExpired("2026-07-11T12:00:00+02:00", iso(T0 + h(24)), T0 + min(61))
    ).toBe(true);
    expect(
      linkCancelExpired("2026-07-11T12:00:00+02:00", iso(T0 + h(24)), T0 + min(30))
    ).toBe(false);
  });

  it("neispravni datumi ne zaključavaju otkazivanje", () => {
    expect(linkCancelExpired("nije-datum", iso(T0 + h(2)), T0 + h(5))).toBe(false);
    // Neispravan starts_at: odlučuje samo prvi sat
    expect(linkCancelExpired(iso(T0), "nije-datum", T0 + min(30))).toBe(false);
    expect(linkCancelExpired(iso(T0), "nije-datum", T0 + min(90))).toBe(true);
  });
});
