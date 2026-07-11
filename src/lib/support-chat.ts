// Deljeni tipovi i čista logika live chata podrške (vlasnik salona <->
// Terminer podrška). Bez importa server koda - koristi se i u klijentskim
// komponentama i u unit testovima.

export type SupportSender = "owner" | "support";

export interface SupportMessage {
  id: string;
  conversation_id: string;
  sender: SupportSender;
  body: string;
  created_at: string; // ISO
}

export interface SupportConversation {
  id: string;
  tenant_id: string;
  status: "open" | "closed";
  created_at: string;
  last_message_at: string;
  owner_read_at: string;
  support_read_at: string;
}

// Poruke druge strane novije od read markera = nepročitane
export function countUnread(
  messages: Pick<SupportMessage, "sender" | "created_at">[],
  from: SupportSender,
  readAt: string
): number {
  const read = new Date(readAt).getTime();
  return messages.filter(
    (m) => m.sender === from && new Date(m.created_at).getTime() > read
  ).length;
}

// Izvod poruke za mejl/listu razgovora: bez prelome, sečeno na celu reč
export function excerpt(body: string, max = 160): string {
  const oneLine = body.replace(/\s+/g, " ").trim();
  if (oneLine.length <= max) return oneLine;
  const cut = oneLine.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > max * 0.6 ? lastSpace : max).trimEnd()}…`;
}

// Vreme poruke: danas samo sat, starije i datum. Fiksna zona salona/podrške
// (proizvod radi samo u Srbiji) - i deterministični testovi u UTC CI-ju.
const TZ = "Europe/Belgrade";

export function chatTimeLabel(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  const dayFmt = new Intl.DateTimeFormat("sr-Latn-RS", {
    timeZone: TZ,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  });
  const time = new Intl.DateTimeFormat("sr-Latn-RS", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
  if (dayFmt.format(d) === dayFmt.format(now)) return time;
  const date = new Intl.DateTimeFormat("sr-Latn-RS", {
    timeZone: TZ,
    day: "numeric",
    month: "numeric",
  }).format(d);
  return `${date} ${time}`;
}
