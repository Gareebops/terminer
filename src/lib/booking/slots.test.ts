import { describe, expect, it } from "vitest";
import {
  formatDateISO,
  fromMinutes,
  generateAvailableSlots,
  overlaps,
  toMinutes,
} from "./slots";

describe("toMinutes / fromMinutes", () => {
  it("pretvara HH:MM u minute i nazad", () => {
    expect(toMinutes("00:00")).toBe(0);
    expect(toMinutes("09:30")).toBe(570);
    expect(toMinutes("23:59")).toBe(1439);
    expect(fromMinutes(570)).toBe("09:30");
    expect(fromMinutes(0)).toBe("00:00");
    expect(fromMinutes(605)).toBe("10:05");
  });
});

describe("overlaps", () => {
  it("prepoznaje preklapanje", () => {
    expect(
      overlaps({ start: "09:00", end: "10:00" }, { start: "09:30", end: "10:30" })
    ).toBe(true);
    // sadržan interval
    expect(
      overlaps({ start: "09:00", end: "12:00" }, { start: "10:00", end: "10:30" })
    ).toBe(true);
  });

  it("dodirivanje granica NIJE preklapanje (kraj = početak sledećeg)", () => {
    expect(
      overlaps({ start: "09:00", end: "10:00" }, { start: "10:00", end: "11:00" })
    ).toBe(false);
    expect(
      overlaps({ start: "10:00", end: "11:00" }, { start: "09:00", end: "10:00" })
    ).toBe(false);
  });
});

describe("generateAvailableSlots", () => {
  it("nudi početke na 30 min dok usluga staje u radno vreme", () => {
    expect(
      generateAvailableSlots({
        workStart: "09:00",
        workEnd: "11:00",
        durationMinutes: 30,
        busy: [],
      })
    ).toEqual(["09:00", "09:30", "10:00", "10:30"]);
  });

  it("duža usluga isključuje kasne početke (mora da stane cela)", () => {
    expect(
      generateAvailableSlots({
        workStart: "09:00",
        workEnd: "11:00",
        durationMinutes: 60,
        busy: [],
      })
    ).toEqual(["09:00", "09:30", "10:00"]);
  });

  it("zauzeti termin uklanja sve početke koji bi ga presekli", () => {
    expect(
      generateAvailableSlots({
        workStart: "09:00",
        workEnd: "12:00",
        durationMinutes: 60,
        busy: [{ start: "10:00", end: "10:30" }],
      })
      // 09:30 i 10:00 bi se preklopili sa zauzećem; 10:30 kreće tačno posle
    ).toEqual(["09:00", "10:30", "11:00"]);
  });

  it("blokada koja ne pada na pun slot seče susedne početke, ali nudi kraj blokade", () => {
    expect(
      generateAvailableSlots({
        workStart: "09:00",
        workEnd: "11:30",
        durationMinutes: 30,
        busy: [{ start: "10:15", end: "10:45" }],
      })
      // 10:00 i 10:30 se preklapaju sa blokadom; 10:45 kreće tačno posle nje
    ).toEqual(["09:00", "09:30", "10:45", "11:00"]);
  });

  it("nudi početak tačno na kraju zauzeća - kratka usluga ne ostavlja mrtvo vreme", () => {
    expect(
      generateAvailableSlots({
        workStart: "09:00",
        workEnd: "10:00",
        durationMinutes: 20,
        busy: [{ start: "09:00", end: "09:20" }],
      })
      // Bez kandidata na kraju zauzeća 09:20-09:30 bi bilo nezakazivo
    ).toEqual(["09:20", "09:30"]);
  });

  it("kraj zauzeća blizu kraja radnog vremena se ne nudi ako usluga ne staje", () => {
    expect(
      generateAvailableSlots({
        workStart: "09:00",
        workEnd: "10:00",
        durationMinutes: 30,
        busy: [{ start: "09:30", end: "09:45" }],
      })
      // 09:45 + 30 min prelazi kraj radnog vremena
    ).toEqual(["09:00"]);
  });

  it("filter 'danas' važi i za početke na kraju zauzeća", () => {
    expect(
      generateAvailableSlots({
        workStart: "09:00",
        workEnd: "11:00",
        durationMinutes: 30,
        busy: [{ start: "09:00", end: "09:20" }],
        isToday: true,
        nowMinutes: toMinutes("09:20"),
      })
      // 09:20 je tačno "sada" pa je isključen
    ).toEqual(["09:30", "10:00", "10:30"]);
  });

  it("za danas ne nudi početke koji su već prošli (t <= sada)", () => {
    expect(
      generateAvailableSlots({
        workStart: "09:00",
        workEnd: "11:00",
        durationMinutes: 30,
        busy: [],
        isToday: true,
        nowMinutes: toMinutes("09:30"),
      })
      // 09:00 prošao, 09:30 = tačno sada pa je isključen
    ).toEqual(["10:00", "10:30"]);
  });

  it("poštuje custom step", () => {
    expect(
      generateAvailableSlots({
        workStart: "09:00",
        workEnd: "10:00",
        durationMinutes: 15,
        step: 15,
        busy: [],
      })
    ).toEqual(["09:00", "09:15", "09:30", "09:45"]);
  });

  it("vraća prazno kad usluga ne staje u okno", () => {
    expect(
      generateAvailableSlots({
        workStart: "09:00",
        workEnd: "09:45",
        durationMinutes: 60,
        busy: [],
      })
    ).toEqual([]);
  });
});

describe("formatDateISO", () => {
  it("formatira lokalni datum kao YYYY-MM-DD sa vodećim nulama", () => {
    expect(formatDateISO(new Date(2026, 0, 5))).toBe("2026-01-05");
    expect(formatDateISO(new Date(2026, 11, 31))).toBe("2026-12-31");
  });
});
