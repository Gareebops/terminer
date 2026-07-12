import { describe, expect, it } from "vitest";
import { HEARTBEAT_MS, isOnline, ONLINE_THRESHOLD_MS, presenceLabel } from "./presence";

// Indikator "online" u superadmin panelu: pogrešan prag znači da Mihajlo
// zove vlasnika "vidim da si u panelu" dok ovaj nije - ili obrnuto.

const NOW = new Date("2026-07-12T12:00:00Z");
const iso = (msAgo: number) => new Date(NOW.getTime() - msAgo).toISOString();

describe("isOnline", () => {
  it("svež heartbeat = online, stariji od praga nije", () => {
    expect(isOnline(iso(0), NOW)).toBe(true);
    expect(isOnline(iso(ONLINE_THRESHOLD_MS - 1000), NOW)).toBe(true);
    expect(isOnline(iso(ONLINE_THRESHOLD_MS), NOW)).toBe(false);
  });

  it("bez heartbeata ili sa neispravnim datumom nije online", () => {
    expect(isOnline(null, NOW)).toBe(false);
    expect(isOnline(undefined, NOW)).toBe(false);
    expect(isOnline("nije-datum", NOW)).toBe(false);
  });

  it("budući timestamp nije online (REST falsifikat), mali skew jeste", () => {
    // "2030" upisan direktno kroz REST ne sme da daje trajno online
    expect(isOnline(iso(-365 * 86_400_000), NOW)).toBe(false);
    expect(isOnline(iso(-(HEARTBEAT_MS + 1000)), NOW)).toBe(false);
    // Zazor za skew server ↔ baza: heartbeat "iz budućnosti" do 1 intervala
    expect(isOnline(iso(-30_000), NOW)).toBe(true);
  });
});

describe("presenceLabel", () => {
  it("online unutar praga", () => {
    expect(presenceLabel(iso(60_000), NOW)).toBe("online");
  });

  it("minuti pa sati pa datum", () => {
    expect(presenceLabel(iso(5 * 60_000), NOW)).toBe("pre 5 min");
    expect(presenceLabel(iso(3 * 3_600_000), NOW)).toBe("pre 3 h");
    expect(presenceLabel(iso(3 * 86_400_000), NOW)).toBe(
      new Date(NOW.getTime() - 3 * 86_400_000).toLocaleDateString("sr-Latn-RS")
    );
  });

  it("null za nepoznato", () => {
    expect(presenceLabel(null, NOW)).toBeNull();
    expect(presenceLabel("nije-datum", NOW)).toBeNull();
  });
});
