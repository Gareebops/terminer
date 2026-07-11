"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, MessageCircle, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { chatTimeLabel, excerpt } from "@/lib/support-chat";
import {
  closeSupportConversation,
  getSupportThread,
  listSupportInbox,
  replySupportMessage,
  type InboxItem,
  type SupportThread,
} from "../support-actions";

// Dvopanelni inbox (lista + thread); na telefonu jedan panel sa "nazad".
// Polling kao u vlasničkom widgetu: bez websocketa, 5s dok je tab vidljiv.
const POLL_MS = 5_000;

export function SupportInbox({ initialItems }: { initialItems: InboxItem[] }) {
  const [items, setItems] = useState(initialItems);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [thread, setThread] = useState<SupportThread | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastCountRef = useRef(0);

  const refresh = useCallback(async () => {
    // Mrežni pad je prolazan - sledeći poll pokušava ponovo, bez
    // unhandled rejection (Sentry šum na lošoj vezi)
    try {
      const [inbox, threadResult] = await Promise.all([
        listSupportInbox(),
        selectedId ? getSupportThread(selectedId) : Promise.resolve(null),
      ]);
      if (inbox.ok) setItems(inbox.items);
      if (threadResult?.ok && threadResult.thread) setThread(threadResult.thread);
    } catch {
      // ignoriši - polling nastavlja
    }
  }, [selectedId]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, POLL_MS);
    return () => clearInterval(interval);
  }, [refresh]);

  const messageCount = thread?.messages.length ?? 0;
  useEffect(() => {
    if (messageCount === lastCountRef.current) return;
    lastCountRef.current = messageCount;
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messageCount]);

  async function openThread(id: string) {
    setSelectedId(id);
    setThread(null);
    let result: Awaited<ReturnType<typeof getSupportThread>>;
    try {
      result = await getSupportThread(id);
    } catch {
      result = { ok: false };
    }
    if (result.ok && result.thread) {
      setThread(result.thread);
      // Otvaranjem je pročitano - badge u listi se gasi odmah
      setItems((prev) =>
        prev.map((i) => (i.conversation.id === id ? { ...i, unread: 0 } : i))
      );
    } else {
      toast.error("Razgovor nije pronađen.");
      setSelectedId(null);
    }
  }

  async function handleReply(e: React.FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body || !selectedId || sending) return;
    setSending(true);
    let result: { ok: boolean; error?: string };
    try {
      result = await replySupportMessage({ conversationId: selectedId, body });
    } catch {
      result = { ok: false };
    } finally {
      setSending(false);
    }
    if (!result.ok) {
      toast.error(result.error ?? "Nešto nije uspelo. Pokušaj ponovo.");
      return;
    }
    setDraft("");
    await refresh();
  }

  async function handleClose() {
    if (!selectedId) return;
    let result: { ok: boolean; error?: string };
    try {
      result = await closeSupportConversation(selectedId);
    } catch {
      result = { ok: false };
    }
    if (!result.ok) {
      toast.error(result.error ?? "Nešto nije uspelo. Pokušaj ponovo.");
      return;
    }
    toast.success("Razgovor je zatvoren.");
    await refresh();
  }

  if (items.length === 0) {
    return (
      <div className="mt-10 flex flex-col items-center gap-3 rounded-[2rem] bg-white p-12 text-center shadow-card">
        <MessageCircle className="size-8 text-ink/30" />
        <p className="text-sm font-medium text-ink/70">
          Još nema razgovora - kad vlasnik salona otvori chat iz admina,
          pojaviće se ovde.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6 gap-4 md:grid md:grid-cols-[minmax(0,20rem)_1fr] md:items-start">
      {/* Lista razgovora (na telefonu se krije dok je thread otvoren) */}
      <div className={`space-y-2 ${selectedId ? "hidden md:block" : ""}`}>
        {items.map(({ conversation, tenantName, lastMessage, unread }) => (
          <button
            key={conversation.id}
            type="button"
            onClick={() => void openThread(conversation.id)}
            className={`w-full rounded-2xl p-4 text-left transition-colors ${
              selectedId === conversation.id
                ? "bg-ink text-white"
                : "bg-white shadow-card hover:bg-ink/5"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="min-w-0 truncate font-bold">{tenantName}</p>
              {unread > 0 && (
                <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-mint px-1 text-xs font-bold text-ink">
                  {unread}
                </span>
              )}
            </div>
            <p
              className={`mt-1 truncate text-sm ${
                selectedId === conversation.id ? "text-white/70" : "text-ink/70"
              }`}
            >
              {lastMessage
                ? `${lastMessage.sender === "support" ? "Ti: " : ""}${excerpt(lastMessage.body, 60)}`
                : "Bez poruka"}
            </p>
            <p
              className={`mt-1 text-xs font-medium ${
                selectedId === conversation.id ? "text-white/50" : "text-ink/60"
              }`}
            >
              {conversation.status === "closed" ? "Zatvoren · " : ""}
              {lastMessage ? chatTimeLabel(lastMessage.created_at) : ""}
            </p>
          </button>
        ))}
      </div>

      {/* Thread */}
      {selectedId ? (
        <div className="flex h-[min(34rem,calc(100dvh-14rem))] flex-col overflow-hidden rounded-[2rem] bg-white shadow-card">
          <div className="flex items-center justify-between gap-3 border-b border-ink/10 p-4 pl-5">
            <div className="flex min-w-0 items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                aria-label="Nazad na listu razgovora"
                className="flex size-10 shrink-0 items-center justify-center rounded-full text-ink/70 hover:bg-ink/5 hover:text-ink md:hidden"
              >
                <ArrowLeft className="size-5" />
              </button>
              <div className="min-w-0">
                <p className="truncate font-extrabold tracking-tight">
                  {thread?.tenantName ?? "…"}
                </p>
                {thread && (
                  <a
                    href={`/${thread.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-medium text-ink/60 hover:text-ink"
                  >
                    /{thread.slug}
                  </a>
                )}
              </div>
            </div>
            {thread?.conversation.status === "open" ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => void handleClose()}
                className="h-9 shrink-0 rounded-full px-4"
              >
                <Check className="size-4" /> Zatvori
              </Button>
            ) : (
              thread && (
                <span className="shrink-0 rounded-full bg-ink/10 px-3 py-1 text-xs font-semibold text-ink/70">
                  Zatvoren
                </span>
              )
            )}
          </div>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
            {thread?.messages.map((m) => (
              <div
                key={m.id}
                className={`flex flex-col ${
                  m.sender === "support" ? "items-end" : "items-start"
                }`}
              >
                <div
                  className={`max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm font-medium ${
                    m.sender === "support"
                      ? "rounded-br-md bg-mint text-ink"
                      : "rounded-bl-md bg-ink/5 text-ink"
                  }`}
                >
                  {m.body}
                </div>
                <span className="mt-0.5 px-1 text-[10px] font-medium text-ink/60">
                  {m.sender === "support" ? "Ti · " : ""}
                  {chatTimeLabel(m.created_at)}
                </span>
              </div>
            ))}
          </div>

          <form
            onSubmit={handleReply}
            className="flex items-end gap-2 border-t border-ink/10 p-3"
          >
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
              placeholder="Odgovori..."
              aria-label="Odgovor vlasniku salona"
              className="max-h-28 min-h-11 flex-1 resize-none rounded-2xl border border-ink/15 bg-white px-3.5 py-2.5 text-sm font-medium outline-none placeholder:text-ink/50 focus-visible:border-ink/40"
            />
            <Button
              type="submit"
              variant="brand"
              disabled={sending || draft.trim().length === 0}
              aria-label="Pošalji odgovor"
              className="size-11 rounded-full"
            >
              <Send className="size-4.5" />
            </Button>
          </form>
        </div>
      ) : (
        <div className="hidden h-[min(34rem,calc(100dvh-14rem))] items-center justify-center rounded-[2rem] bg-white/60 text-sm font-medium text-ink/60 md:flex">
          Izaberi razgovor iz liste.
        </div>
      )}
    </div>
  );
}
