import { describe, expect, it } from "vitest";
import { CANCEL_WINDOW_MINUTES, linkCancelExpired } from "./cancel";

const T0 = Date.parse("2026-07-11T10:00:00Z");
const min = (n: number) => n * 60_000;

describe("linkCancelExpired", () => {
  it("unutar sata od zakazivanja link važi", () => {
    expect(linkCancelExpired("2026-07-11T10:00:00Z", T0)).toBe(false);
    expect(linkCancelExpired("2026-07-11T10:00:00Z", T0 + min(59))).toBe(false);
  });

  it("tačno na sat vremena još uvek važi, minut kasnije ne", () => {
    expect(linkCancelExpired("2026-07-11T10:00:00Z", T0 + min(CANCEL_WINDOW_MINUTES))).toBe(false);
    expect(linkCancelExpired("2026-07-11T10:00:00Z", T0 + min(CANCEL_WINDOW_MINUTES) + 1)).toBe(true);
  });

  it("radi sa postgres timestamptz formatom (offset umesto Z)", () => {
    // Supabase vraća npr. 2026-07-11T10:00:00+00:00
    expect(linkCancelExpired("2026-07-11T12:00:00+02:00", T0 + min(61))).toBe(true);
    expect(linkCancelExpired("2026-07-11T12:00:00+02:00", T0 + min(30))).toBe(false);
  });

  it("neispravan datum ne zaključava otkazivanje", () => {
    expect(linkCancelExpired("nije-datum", T0)).toBe(false);
  });
});
