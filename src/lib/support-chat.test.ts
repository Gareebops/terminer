import { describe, expect, it } from "vitest";
import { chatTimeLabel, countUnread, excerpt } from "./support-chat";

const msg = (sender: "owner" | "support", created_at: string) => ({
  sender,
  created_at,
});

describe("countUnread", () => {
  it("broji samo poruke druge strane novije od read markera", () => {
    const messages = [
      msg("owner", "2026-07-11T10:00:00Z"),
      msg("support", "2026-07-11T10:05:00Z"),
      msg("support", "2026-07-11T11:00:00Z"),
      msg("owner", "2026-07-11T12:00:00Z"),
    ];
    expect(countUnread(messages, "support", "2026-07-11T10:30:00Z")).toBe(1);
    expect(countUnread(messages, "owner", "2026-07-11T09:00:00Z")).toBe(2);
  });

  it("poruka tačno na read markeru je pročitana", () => {
    const messages = [msg("support", "2026-07-11T10:00:00Z")];
    expect(countUnread(messages, "support", "2026-07-11T10:00:00Z")).toBe(0);
  });
});

describe("excerpt", () => {
  it("kratku poruku vraća celu, sa sažetim razmacima", () => {
    expect(excerpt("Zdravo,\n  treba mi   pomoć")).toBe("Zdravo, treba mi pomoć");
  });

  it("dugačku poruku seče na celu reč sa tri tačke", () => {
    const out = excerpt("reč ".repeat(100), 40);
    expect(out.length).toBeLessThanOrEqual(41);
    expect(out.endsWith("…")).toBe(true);
    expect(out).not.toContain("re…"); // nije presečeno usred reči
  });

  it("predugačku reč bez razmaka seče na tvrdoj granici", () => {
    const out = excerpt("a".repeat(300), 40);
    expect(out).toBe(`${"a".repeat(40)}…`);
  });
});

describe("chatTimeLabel", () => {
  // "sada" fiksirano: 11.7.2026. u podne po Beogradu
  const now = new Date("2026-07-11T12:00:00+02:00");

  it("današnja poruka: samo vreme", () => {
    expect(chatTimeLabel("2026-07-11T09:30:00+02:00", now)).toMatch(/^\d{2}:\d{2}$/);
  });

  it("starija poruka: datum + vreme", () => {
    expect(chatTimeLabel("2026-07-09T09:30:00+02:00", now)).toMatch(
      /^\d{1,2}\.\s?\d{1,2}\.\s?\d{2}:\d{2}$/
    );
  });

  it("'danas' se računa u zoni Beograda, ne UTC", () => {
    // 23:30 UTC prethodnog dana = 01:30 danas po Beogradu (leto, UTC+2)
    expect(chatTimeLabel("2026-07-10T23:30:00Z", now)).toMatch(/^\d{2}:\d{2}$/);
  });
});
