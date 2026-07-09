import { describe, expect, it } from "vitest";
import { buildICS } from "./ics";

// .ics ide klijentu u mejl potvrde ("Dodaj u kalendar") - pokvaren format
// znači termin koji telefon ne ume da uveze.

describe("buildICS", () => {
  const base = {
    title: "Muško šišanje - Salon Aura",
    date: "2026-07-15",
    startTime: "14:30",
    endTime: "15:00",
  };

  it("gradi validan VCALENDAR/VEVENT sa CRLF prelomima", () => {
    const ics = buildICS(base);
    const lines = ics.split("\r\n");
    expect(lines[0]).toBe("BEGIN:VCALENDAR");
    expect(lines.at(-1)).toBe("END:VCALENDAR");
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("END:VEVENT");
    // nema golih \n van CRLF parova
    expect(ics.replace(/\r\n/g, "")).not.toContain("\n");
  });

  it("vreme je u floating lokalnom formatu bez zone", () => {
    const ics = buildICS(base);
    expect(ics).toContain("DTSTART:20260715T143000");
    expect(ics).toContain("DTEND:20260715T150000");
  });

  it("escape-uje zapete i tačka-zapete u tekstu (iCalendar pravilo)", () => {
    const ics = buildICS({
      ...base,
      title: "Šišanje, pranje; feniranje",
      location: "Obrenovićeva 10, Niš",
    });
    expect(ics).toContain("SUMMARY:Šišanje\\, pranje\\; feniranje");
    expect(ics).toContain("LOCATION:Obrenovićeva 10\\, Niš");
  });

  it("opis i lokacija su opcioni", () => {
    const bez = buildICS(base);
    expect(bez).not.toContain("DESCRIPTION:");
    expect(bez).not.toContain("LOCATION:");

    const sa = buildICS({ ...base, description: "Kod: Đorđe" });
    expect(sa).toContain("DESCRIPTION:Kod: Đorđe");
  });

  it("svaki događaj ima jedinstven UID", () => {
    const a = buildICS(base).match(/UID:(.+)/)?.[1];
    const b = buildICS(base).match(/UID:(.+)/)?.[1];
    expect(a).toBeTruthy();
    expect(a).toMatch(/@terminer/);
    expect(a).not.toBe(b);
  });
});
