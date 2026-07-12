import { datumSr } from "@/lib/datum";

// Prisustvo admina u panelu: klijent u adminu (PresencePing) upisuje
// heartbeat na tenant_members.last_seen_at svakih HEARTBEAT_MS dok je tab
// vidljiv. "Online" = otkucaj mlađi od praga (2 intervala + zazor da spor
// upis/mreža ne trepće indikator).
export const HEARTBEAT_MS = 60_000;
export const ONLINE_THRESHOLD_MS = 3 * 60_000;

export function isOnline(
  lastSeen: string | null | undefined,
  now: Date
): boolean {
  if (!lastSeen) return false;
  const t = new Date(lastSeen).getTime();
  return Number.isFinite(t) && now.getTime() - t < ONLINE_THRESHOLD_MS;
}

// Ljudski opis poslednje aktivnosti u panelu: "online" / "pre 5 min" /
// "pre 3 h" / datum. null = heartbeat još nije viđen (pre migracije ili
// vlasnik nije otvarao admin od uvođenja).
export function presenceLabel(
  lastSeen: string | null | undefined,
  now: Date
): string | null {
  if (!lastSeen) return null;
  const t = new Date(lastSeen).getTime();
  if (!Number.isFinite(t)) return null;
  if (isOnline(lastSeen, now)) return "online";
  const diff = now.getTime() - t;
  if (diff < 3_600_000) return `pre ${Math.max(1, Math.round(diff / 60_000))} min`;
  if (diff < 86_400_000) return `pre ${Math.round(diff / 3_600_000)} h`;
  return datumSr(lastSeen);
}
