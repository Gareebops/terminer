import { describe, expect, it } from "vitest";
import type { ScheduleException, Staff, WorkingHours } from "@/lib/types";
import {
  addDaysISO,
  bookingHorizonDays,
  dayOfWeek,
  DEFAULT_HORIZON_DAYS,
  MAX_HORIZON_DAYS,
  mondayOf,
  parityForStaff,
  resolveWindow,
  weekParityFor,
} from "./schedule";

// 2026-07-06 je ponedeljak (sidro A-nedelje u većini testova)
const ANCHOR = "2026-07-06";

function makeStaff(over: Partial<Staff> = {}): Staff {
  return {
    id: "staff-1",
    tenant_id: "t-1",
    user_id: null,
    name: "Test Zaposleni",
    photo_url: null,
    bio: null,
    is_active: true,
    sort_order: 0,
    schedule_mode: "weekly",
    rotation_anchor: null,
    booking_horizon_days: null,
    ...over,
  };
}

function makeHours(over: Partial<WorkingHours> = {}): WorkingHours {
  return {
    id: "wh-1",
    tenant_id: "t-1",
    staff_id: "staff-1",
    day_of_week: 1, // ponedeljak
    start_time: "09:00:00",
    end_time: "17:00:00",
    is_working: true,
    week_parity: 0,
    ...over,
  };
}

function makeException(over: Partial<ScheduleException> = {}): ScheduleException {
  return {
    id: "ex-1",
    tenant_id: "t-1",
    staff_id: "staff-1",
    date: ANCHOR,
    is_off: false,
    start_time: "12:00:00",
    end_time: "20:00:00",
    ...over,
  };
}

describe("dayOfWeek / mondayOf / addDaysISO", () => {
  it("računa dan u nedelji (0 = nedelja)", () => {
    expect(dayOfWeek("2026-07-06")).toBe(1); // ponedeljak
    expect(dayOfWeek("2026-07-05")).toBe(0); // nedelja
    expect(dayOfWeek("2026-07-11")).toBe(6); // subota
  });

  it("nalazi ponedeljak tekuće nedelje (nedelja pripada PRETHODNOJ)", () => {
    expect(mondayOf("2026-07-08")).toBe("2026-07-06"); // sreda
    expect(mondayOf("2026-07-06")).toBe("2026-07-06"); // sam ponedeljak
    expect(mondayOf("2026-07-12")).toBe("2026-07-06"); // nedelja
  });

  it("dodaje dane preko granice meseca i godine", () => {
    expect(addDaysISO("2026-07-31", 1)).toBe("2026-08-01");
    expect(addDaysISO("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDaysISO("2026-07-06", -7)).toBe("2026-06-29");
  });

  it("prelaz na letnje računanje vremena ne pomera datum (UTC podne)", () => {
    // U Evropi se sat pomera poslednje nedelje marta
    expect(addDaysISO("2026-03-28", 2)).toBe("2026-03-30");
  });
});

describe("weekParityFor", () => {
  it("nedelja sidra je A (0), sledeća B (1), pa opet A", () => {
    expect(weekParityFor(ANCHOR, ANCHOR)).toBe(0);
    expect(weekParityFor("2026-07-12", ANCHOR)).toBe(0); // nedelja iste nedelje
    expect(weekParityFor("2026-07-13", ANCHOR)).toBe(1); // sledeći ponedeljak
    expect(weekParityFor("2026-07-19", ANCHOR)).toBe(1);
    expect(weekParityFor("2026-07-20", ANCHOR)).toBe(0);
  });

  it("radi i za datume PRE sidra", () => {
    expect(weekParityFor("2026-06-29", ANCHOR)).toBe(1); // nedelja pre = B
    expect(weekParityFor("2026-06-22", ANCHOR)).toBe(0); // dve pre = A
  });

  it("sidro koje nije ponedeljak se svodi na svoj ponedeljak", () => {
    // sidro sreda 2026-07-08 → ista nedelja kao ponedeljak 2026-07-06
    expect(weekParityFor("2026-07-06", "2026-07-08")).toBe(0);
    expect(weekParityFor("2026-07-13", "2026-07-08")).toBe(1);
  });
});

describe("parityForStaff", () => {
  it("weekly režim je uvek parnost 0, čak i sa zaostalim sidrom", () => {
    const staff = makeStaff({ schedule_mode: "weekly", rotation_anchor: ANCHOR });
    expect(parityForStaff("2026-07-13", staff)).toBe(0);
  });

  it("rotating bez sidra pada na parnost 0", () => {
    const staff = makeStaff({ schedule_mode: "rotating", rotation_anchor: null });
    expect(parityForStaff("2026-07-13", staff)).toBe(0);
  });

  it("rotating sa sidrom prati parnost nedelje", () => {
    const staff = makeStaff({ schedule_mode: "rotating", rotation_anchor: ANCHOR });
    expect(parityForStaff("2026-07-07", staff)).toBe(0);
    expect(parityForStaff("2026-07-14", staff)).toBe(1);
  });
});

describe("bookingHorizonDays", () => {
  it("null (i nepostojeća kolona pre migracije) daje podrazumevanih 60", () => {
    expect(bookingHorizonDays(makeStaff())).toBe(DEFAULT_HORIZON_DAYS);
    // pre migracije kolone nema pa runtime vidi undefined
    expect(
      bookingHorizonDays({ booking_horizon_days: undefined as unknown as null })
    ).toBe(DEFAULT_HORIZON_DAYS);
  });

  it("postavljena vrednost se poštuje", () => {
    expect(bookingHorizonDays(makeStaff({ booking_horizon_days: 3 }))).toBe(3);
    expect(bookingHorizonDays(makeStaff({ booking_horizon_days: 90 }))).toBe(90);
  });

  it("vrednosti mimo opsega se klampuju (REST upis mimo UI-ja)", () => {
    expect(bookingHorizonDays(makeStaff({ booking_horizon_days: 365 }))).toBe(
      MAX_HORIZON_DAYS
    );
    expect(bookingHorizonDays(makeStaff({ booking_horizon_days: 0 }))).toBe(1);
    expect(bookingHorizonDays(makeStaff({ booking_horizon_days: -5 }))).toBe(1);
  });
});

describe("resolveWindow", () => {
  it("bez izuzetka čita pravilo i seče sekunde na HH:MM", () => {
    expect(resolveWindow(ANCHOR, makeStaff(), [makeHours()], null)).toEqual({
      start: "09:00",
      end: "17:00",
    });
  });

  it("ne radi kad nema reda ili je is_working false", () => {
    expect(resolveWindow(ANCHOR, makeStaff(), [], null)).toBeNull();
    expect(
      resolveWindow(ANCHOR, makeStaff(), [makeHours({ is_working: false })], null)
    ).toBeNull();
    // red za drugi dan u nedelji se ne računa
    expect(
      resolveWindow(ANCHOR, makeStaff(), [makeHours({ day_of_week: 2 })], null)
    ).toBeNull();
  });

  it("red drugog zaposlenog se ignoriše", () => {
    expect(
      resolveWindow(ANCHOR, makeStaff(), [makeHours({ staff_id: "staff-2" })], null)
    ).toBeNull();
  });

  it("rotacija A/B: ista sedmica dana, različita vremena po parnosti", () => {
    const staff = makeStaff({ schedule_mode: "rotating", rotation_anchor: ANCHOR });
    const hours = [
      makeHours({ week_parity: 0 }), // A: 09-17
      makeHours({
        id: "wh-2",
        week_parity: 1,
        start_time: "13:00:00",
        end_time: "21:00:00",
      }), // B: 13-21
    ];
    expect(resolveWindow("2026-07-06", staff, hours, null)).toEqual({
      start: "09:00",
      end: "17:00",
    });
    expect(resolveWindow("2026-07-13", staff, hours, null)).toEqual({
      start: "13:00",
      end: "21:00",
    });
  });

  it("izuzetak sa vremenom GAZI pravilo", () => {
    expect(resolveWindow(ANCHOR, makeStaff(), [makeHours()], makeException())).toEqual({
      start: "12:00",
      end: "20:00",
    });
  });

  it("izuzetak is_off znači ne radi, i preko radnog dana", () => {
    expect(
      resolveWindow(ANCHOR, makeStaff(), [makeHours()], makeException({ is_off: true }))
    ).toBeNull();
  });

  it("izuzetak bez vremena (nepotpun) se tretira kao ne radi", () => {
    expect(
      resolveWindow(
        ANCHOR,
        makeStaff(),
        [makeHours()],
        makeException({ start_time: null, end_time: null })
      )
    ).toBeNull();
  });
});
