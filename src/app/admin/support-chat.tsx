"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MessageCircle, Send, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { plural } from "@/lib/plural";
import {
  chatTimeLabel,
  countUnread,
  type SupportConversation,
  type SupportMessage,
} from "@/lib/support-chat";
import { getSupportChat, sendSupportMessage } from "./support-chat-actions";

// Plutajući live chat sa Terminer podrškom (dole desno u celom adminu).
// Nema websocketa - poruke se povlače server akcijom: na 4s dok je panel
// otvoren, na 60s u pozadini (badge nepročitanih). Pre primene migracije
// prvi upit padne pa se widget tiho sakriva.
const OPEN_POLL_MS = 4_000;
const IDLE_POLL_MS = 60_000;

interface ChatData {
  conversation: SupportConversation | null;
  messages: SupportMessage[];
}

export function SupportChat() {
  const [hidden, setHidden] = useState(false);
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<ChatData | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastCountRef = useRef(0);

  const refresh = useCallback(async (markRead: boolean) => {
    const state = await getSupportChat({ markRead });
    if (!state.ok) {
      setHidden(true);
      return;
    }
    setData({ conversation: state.conversation, messages: state.messages });
  }, []);

  // Prvi fetch odmah (badge), pa polling tempom koji prati stanje panela;
  // skriveni tab ne vuče ništa (preview gotcha + štednja zahteva).
  // Otvoren panel = pročitano (markRead pomera owner_read_at).
  // setTimeout lanac umesto poziva u telu efekta - setState sme samo u
  // callback-u spoljnog sistema (react-hooks/set-state-in-effect).
  useEffect(() => {
    if (hidden) return;
    let cancelled = false;
    let timer: number;
    const tick = async () => {
      if (document.visibilityState === "visible") await refresh(open);
      if (!cancelled) {
        timer = window.setTimeout(tick, open ? OPEN_POLL_MS : IDLE_POLL_MS);
      }
    };
    timer = window.setTimeout(tick, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [refresh, open, hidden]);

  // Nove poruke drže skrol na dnu dok je panel otvoren
  const messageCount = data?.messages.length ?? 0;
  useEffect(() => {
    if (!open || messageCount === lastCountRef.current) return;
    lastCountRef.current = messageCount;
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [open, messageCount]);

  // Ništa dok prvi fetch ne prođe: pre primene migracije widget ne sme
  // ni da blesne, a posle nje se pojavi sa ispravnim badge-om
  if (hidden || data === null) return null;

  const conversation = data.conversation;
  const messages = data.messages;
  const unread = conversation
    ? countUnread(messages, "support", conversation.owner_read_at)
    : 0;

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    const result = await sendSupportMessage({ body });
    setSending(false);
    if (!result.ok) {
      toast.error(result.error ?? "Nešto nije uspelo. Pokušaj ponovo.");
      return;
    }
    setDraft("");
    await refresh(true);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={
          unread > 0
            ? `Podrška - ${unread} ${plural(unread, ["nepročitana poruka", "nepročitane poruke", "nepročitanih poruka"])}`
            : "Podrška"
        }
        className="fixed bottom-4 right-4 z-40 flex size-14 items-center justify-center rounded-full bg-ink text-white shadow-lg transition-transform hover:scale-105"
      >
        <MessageCircle className="size-6" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-mint px-1 text-xs font-bold text-ink">
            {unread}
          </span>
        )}
      </button>
    );
  }

  return (
    <div
      role="dialog"
      aria-label="Razgovor sa podrškom"
      className="fixed bottom-4 right-4 z-40 flex h-[min(30rem,calc(100dvh-5rem))] w-[calc(100vw-2rem)] max-w-sm flex-col overflow-hidden rounded-[2rem] bg-white shadow-card"
    >
      <div className="flex items-start justify-between gap-3 border-b border-ink/10 p-4 pl-5">
        <div>
          <p className="text-base font-extrabold tracking-tight">Podrška</p>
          <p className="text-xs font-medium text-ink/70">
            Terminer tim - obično odgovaramo u toku dana.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Zatvori razgovor sa podrškom"
          className="flex size-10 shrink-0 items-center justify-center rounded-full text-ink/70 transition-colors hover:bg-ink/5 hover:text-ink"
        >
          <X className="size-5" />
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <MessageCircle className="size-8 text-ink/30" />
            <p className="max-w-[16rem] text-sm font-medium text-ink/70">
              Ćao! Tu smo za sva pitanja o Termineru - napiši nam poruku.
            </p>
          </div>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex flex-col ${m.sender === "owner" ? "items-end" : "items-start"}`}
          >
            <div
              className={`max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm font-medium ${
                m.sender === "owner"
                  ? "rounded-br-md bg-mint text-ink"
                  : "rounded-bl-md bg-ink/5 text-ink"
              }`}
            >
              {m.body}
            </div>
            <span className="mt-0.5 px-1 text-[10px] font-medium text-ink/60">
              {m.sender === "support" && "Podrška · "}
              {chatTimeLabel(m.created_at)}
            </span>
          </div>
        ))}
        {conversation?.status === "closed" && (
          <p className="pt-1 text-center text-xs font-medium text-ink/60">
            Razgovor je zatvoren - nova poruka otvara nov razgovor.
          </p>
        )}
      </div>

      <form onSubmit={handleSend} className="flex items-end gap-2 border-t border-ink/10 p-3">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              e.currentTarget.form?.requestSubmit();
            }
          }}
          rows={1}
          maxLength={4000}
          placeholder="Napiši poruku..."
          aria-label="Poruka za podršku"
          className="max-h-28 min-h-11 flex-1 resize-none rounded-2xl border border-ink/15 bg-white px-3.5 py-2.5 text-sm font-medium outline-none placeholder:text-ink/50 focus-visible:border-ink/40"
        />
        <Button
          type="submit"
          variant="brand"
          disabled={sending || draft.trim().length === 0}
          aria-label="Pošalji poruku"
          className="size-11 rounded-full"
        >
          <Send className="size-4.5" />
        </Button>
      </form>
    </div>
  );
}
