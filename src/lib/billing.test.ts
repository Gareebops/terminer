import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GRACE_DAYS, isBookingPaused, subscriptionInfo, trialReminderDue } from "./billing";

// Logika koja odlučuje kad se salonu pauzira online zakazivanje - greška
// od jednog dana ovde znači ugašeno zakazivanje salonu koji je platio.
// Vreme je zamrznuto na fiksni trenutak (jul - bez DST prelaza), a
// paid_until se namerno testira kao goli datum jer ga tako čuva baza
// (važi do kraja tog dana, 23:59:59 lokalno).

const NOW = new Date("2026-07-09T12:00:00");

function daysFromNow(days: number): string {
  return new Date(NOW.getTime() + days * 86_400_000).toISOString();
}

function dateOnly(daysOffset: number): string {
  const d = new Date(NOW.getTime() + daysOffset * 86_400_000);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("subscriptionInfo - proba", () => {
  it("proba u toku", () => {
    const info = subscriptionInfo({ trial_ends_at: daysFromNow(3), paid_until: null });
    expect(info).toEqual({ status: "trial", daysLeft: 3 });
  });

  it("proba ističe danas za par sati - još važi, daysLeft 1", () => {
    const info = subscriptionInfo({
      trial_ends_at: new Date(NOW.getTime() + 6 * 3_600_000).toISOString(),
      paid_until: null,
    });
    expect(info).toEqual({ status: "trial", daysLeft: 1 });
  });

  it("proba istekla pre sekund - prelazi u grace", () => {
    const info = subscriptionInfo({
      trial_ends_at: new Date(NOW.getTime() - 1000).toISOString(),
      paid_until: null,
    });
    expect(info.status).toBe("grace");
    expect(info.daysLeft).toBe(GRACE_DAYS);
  });
});

describe("subscriptionInfo - grace period", () => {
  it("proba istekla juče - grace sa preostalih 6 dana", () => {
    const info = subscriptionInfo({ trial_ends_at: daysFromNow(-1), paid_until: null });
    expect(info).toEqual({ status: "grace", daysLeft: GRACE_DAYS - 1 });
  });

  it("tačno na kraju grace perioda - još grace (>= poređenje)", () => {
    const info = subscriptionInfo({
      trial_ends_at: daysFromNow(-GRACE_DAYS),
      paid_until: null,
    });
    expect(info).toEqual({ status: "grace", daysLeft: 0 });
  });

  it("sekund posle kraja grace perioda - expired", () => {
    const info = subscriptionInfo({
      trial_ends_at: new Date(NOW.getTime() - (GRACE_DAYS * 86_400_000 + 1000)).toISOString(),
      paid_until: null,
    });
    expect(info).toEqual({ status: "expired", daysLeft: 0 });
  });
});

describe("subscriptionInfo - plaćena pretplata", () => {
  it("paid_until DANAS znači aktivno do kraja dana", () => {
    const info = subscriptionInfo({ trial_ends_at: daysFromNow(-30), paid_until: dateOnly(0) });
    expect(info.status).toBe("active");
    expect(info.daysLeft).toBe(1);
  });

  it("paid_until juče - grace kreće od kraja plaćenog dana", () => {
    const info = subscriptionInfo({ trial_ends_at: daysFromNow(-30), paid_until: dateOnly(-1) });
    // paidEnd = juče 23:59:59 (pre ~12h) → do kraja grace-a je 6.5 dana → ceil 7
    expect(info).toEqual({ status: "grace", daysLeft: GRACE_DAYS });
  });

  it("uplata u budućnosti nadjačava isteklu probu", () => {
    const info = subscriptionInfo({ trial_ends_at: daysFromNow(-30), paid_until: dateOnly(30) });
    expect(info.status).toBe("active");
    expect(info.daysLeft).toBeGreaterThanOrEqual(30);
  });

  it("proba koja još traje se poštuje i kad je ranija uplata istekla", () => {
    const info = subscriptionInfo({ trial_ends_at: daysFromNow(5), paid_until: dateOnly(-10) });
    expect(info).toEqual({ status: "trial", daysLeft: 5 });
  });

  it("davno istekla i proba i uplata - expired", () => {
    const info = subscriptionInfo({ trial_ends_at: daysFromNow(-60), paid_until: dateOnly(-30) });
    expect(info).toEqual({ status: "expired", daysLeft: 0 });
  });
});

describe("isBookingPaused", () => {
  it("zakazivanje radi u trial/active/grace, staje tek na expired", () => {
    expect(isBookingPaused({ trial_ends_at: daysFromNow(3), paid_until: null })).toBe(false);
    expect(isBookingPaused({ trial_ends_at: daysFromNow(-30), paid_until: dateOnly(10) })).toBe(false);
    expect(isBookingPaused({ trial_ends_at: daysFromNow(-2), paid_until: null })).toBe(false);
    expect(isBookingPaused({ trial_ends_at: daysFromNow(-30), paid_until: null })).toBe(true);
  });
});

describe("trialReminderDue", () => {
  it("okida na tačno 3 dana do isteka probe", () => {
    expect(trialReminderDue({ trial_ends_at: daysFromNow(3), paid_until: null }, 3)).toBe(true);
  });

  it("ne okida dan ranije ni dan kasnije (ceil granice)", () => {
    // 3.5 dana -> daysLeft 4; 2 dana -> daysLeft 2
    expect(trialReminderDue({ trial_ends_at: daysFromNow(3.5), paid_until: null }, 3)).toBe(false);
    expect(trialReminderDue({ trial_ends_at: daysFromNow(2), paid_until: null }, 3)).toBe(false);
  });

  it("plaćen salon nema podsetnik ni kad mu proba formalno traje", () => {
    expect(trialReminderDue({ trial_ends_at: daysFromNow(3), paid_until: dateOnly(20) }, 3)).toBe(false);
  });

  it("istekla proba ne okida", () => {
    expect(trialReminderDue({ trial_ends_at: daysFromNow(-3), paid_until: null }, 3)).toBe(false);
  });
});
