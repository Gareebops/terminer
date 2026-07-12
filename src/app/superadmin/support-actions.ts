"use server";

import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SupportConversation, SupportMessage } from "@/lib/support-chat";
import { assertSuperAdmin } from "./actions";

// Live chat podrške - strana superadmina (/superadmin/poruke). Sve ide
// service rolom posle assertSuperAdmin provere, kao ostatak panela; chat
// poruke su same sebi evidencija pa se NAMERNO ne upisuju u audit log.

export interface InboxItem {
  conversation: SupportConversation;
  tenantName: string;
  slug: string;
  lastMessage: Pick<SupportMessage, "sender" | "body" | "created_at"> | null;
  unread: number;
}

export async function listSupportInbox(): Promise<{ ok: boolean; items: InboxItem[] }> {
  const me = await assertSuperAdmin();
  if (!me) return { ok: false, items: [] };
  const db = createAdminClient();

  const { data: conversations, error } = await db
    .from("support_conversations")
    .select("*, tenants(name, slug)")
    .order("last_message_at", { ascending: false })
    .limit(100);
  // Pre primene migracije tabela ne postoji - strana prikazuje prazno
  if (error || !conversations) return { ok: false, items: [] };
  if (conversations.length === 0) return { ok: true, items: [] };

  // Jedan upit za sve poruke listanih razgovora; izvod poslednje i broj
  // nepročitanih se računaju ovde (PostgREST nema group by)
  const { data: messages } = await db
    .from("support_messages")
    .select("conversation_id, sender, body, created_at")
    .in(
      "conversation_id",
      conversations.map((c) => c.id)
    )
    .order("created_at", { ascending: true });

  const byConversation = new Map<string, NonNullable<typeof messages>>();
  for (const m of messages ?? []) {
    const list = byConversation.get(m.conversation_id) ?? [];
    list.push(m);
    byConversation.set(m.conversation_id, list);
  }

  const items = conversations.map((c) => {
    const list = byConversation.get(c.id) ?? [];
    const readAt = new Date(c.support_read_at).getTime();
    return {
      conversation: c as SupportConversation,
      tenantName:
        (c.tenants as unknown as { name: string } | null)?.name ?? "Nepoznat salon",
      slug: (c.tenants as unknown as { slug: string } | null)?.slug ?? "",
      lastMessage: list.at(-1) ?? null,
      unread: list.filter(
        (m) => m.sender === "owner" && new Date(m.created_at).getTime() > readAt
      ).length,
    };
  });
  return { ok: true, items };
}

export interface SupportThread {
  conversation: SupportConversation;
  tenantName: string;
  slug: string;
  messages: SupportMessage[];
}

const uuidLoose = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

export async function getSupportThread(
  conversationId: string
): Promise<{ ok: boolean; thread?: SupportThread }> {
  if (!uuidLoose.safeParse(conversationId).success) return { ok: false };
  const me = await assertSuperAdmin();
  if (!me) return { ok: false };
  const db = createAdminClient();

  const [{ data: conversation }, { data: messages }] = await Promise.all([
    db
      .from("support_conversations")
      .select("*, tenants(name, slug)")
      .eq("id", conversationId)
      .maybeSingle(),
    db
      .from("support_messages")
      .select("id, conversation_id, sender, body, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(200),
  ]);
  if (!conversation) return { ok: false };

  // Otvoren thread = pročitane poruke (kao owner_read_at u widgetu)
  const now = new Date().toISOString();
  await db
    .from("support_conversations")
    .update({ support_read_at: now })
    .eq("id", conversationId);
  conversation.support_read_at = now;

  return {
    ok: true,
    thread: {
      conversation: conversation as SupportConversation,
      tenantName:
        (conversation.tenants as unknown as { name: string } | null)?.name ??
        "Nepoznat salon",
      slug: (conversation.tenants as unknown as { slug: string } | null)?.slug ?? "",
      messages: (messages ?? []) as SupportMessage[],
    },
  };
}

const replySchema = z.object({
  conversationId: uuidLoose,
  body: z.string().trim().min(1, "Poruka je prazna.").max(4000, "Poruka je predugačka."),
});

export async function replySupportMessage(input: {
  conversationId: string;
  body: string;
}): Promise<{ ok: boolean; error?: string }> {
  const parsed = replySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Neispravni podaci." };
  }
  const me = await assertSuperAdmin();
  if (!me) return { ok: false, error: "Nemaš pristup." };
  const db = createAdminClient();

  const { data: conversation } = await db
    .from("support_conversations")
    .select("id, tenant_id, status")
    .eq("id", parsed.data.conversationId)
    .maybeSingle();
  if (!conversation) return { ok: false, error: "Razgovor nije pronađen." };

  const { error: insertError } = await db.from("support_messages").insert({
    tenant_id: conversation.tenant_id,
    conversation_id: conversation.id,
    sender: "support",
    body: parsed.data.body,
  });
  if (insertError) return { ok: false, error: "Nešto nije uspelo. Pokušaj ponovo." };

  // Odgovor u zatvorenom razgovoru ga ponovo otvara - vlasnikov widget
  // prikazuje najskoriji razgovor po aktivnosti pa odgovor stiže do njega.
  // Ako salon u međuvremenu već ima drugi otvoren razgovor, unique index
  // "jedan otvoren po salonu" odbija reopen (23505) - onda samo bump.
  const now = new Date().toISOString();
  const { error: updateError } = await db
    .from("support_conversations")
    .update({ last_message_at: now, support_read_at: now, status: "open" })
    .eq("id", conversation.id);
  if (updateError) {
    await db
      .from("support_conversations")
      .update({ last_message_at: now, support_read_at: now })
      .eq("id", conversation.id);
  }
  return { ok: true };
}

// Proaktivna poruka salonu ("proba ti ističe, treba li pomoć?") - do sada
// je razgovor mogao da otvori samo vlasnik. Piše u postojeći otvoren
// razgovor ako ga ima; inače otvara nov sa owner_read_at na epohi da
// vlasnikov widget odmah pokaže nepročitanu poruku. Mejl vlasniku se NE
// šalje (mejl obaveštava podršku o porukama vlasnika, ne obrnuto).
export async function startSupportConversation(input: {
  tenantId: string;
  body: string;
}): Promise<{ ok: boolean; error?: string }> {
  const parsed = z
    .object({
      tenantId: uuidLoose,
      body: z
        .string()
        .trim()
        .min(1, "Poruka je prazna.")
        .max(4000, "Poruka je predugačka."),
    })
    .safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Neispravni podaci." };
  }
  const me = await assertSuperAdmin();
  if (!me) return { ok: false, error: "Nemaš pristup." };
  const db = createAdminClient();

  const { data: tenant } = await db
    .from("tenants")
    .select("id")
    .eq("id", parsed.data.tenantId)
    .maybeSingle();
  if (!tenant) return { ok: false, error: "Salon nije pronađen." };

  const now = new Date().toISOString();

  // Postojeći otvoren razgovor ima prednost (unique index ionako brani drugi)
  const { data: open } = await db
    .from("support_conversations")
    .select("id")
    .eq("tenant_id", tenant.id)
    .eq("status", "open")
    .maybeSingle();

  let conversationId = open?.id ?? null;
  if (!conversationId) {
    const { data: created, error: createError } = await db
      .from("support_conversations")
      .insert({
        tenant_id: tenant.id,
        status: "open",
        support_read_at: now,
        // Vlasnik ovu poruku još nije video - widget mora da pokaže badge
        owner_read_at: new Date(0).toISOString(),
      })
      .select("id")
      .maybeSingle();
    if (createError?.code === "23505") {
      // Trka: razgovor je upravo otvoren (vlasnik ili paralelni tab) - piši u njega
      const { data: raced } = await db
        .from("support_conversations")
        .select("id")
        .eq("tenant_id", tenant.id)
        .eq("status", "open")
        .maybeSingle();
      conversationId = raced?.id ?? null;
    } else {
      conversationId = created?.id ?? null;
    }
  }
  if (!conversationId) return { ok: false, error: "Nešto nije uspelo. Pokušaj ponovo." };

  const { error: insertError } = await db.from("support_messages").insert({
    tenant_id: tenant.id,
    conversation_id: conversationId,
    sender: "support",
    body: parsed.data.body,
  });
  if (insertError) return { ok: false, error: "Nešto nije uspelo. Pokušaj ponovo." };

  await db
    .from("support_conversations")
    .update({ last_message_at: now, support_read_at: now })
    .eq("id", conversationId);

  return { ok: true };
}

export async function closeSupportConversation(
  conversationId: string
): Promise<{ ok: boolean; error?: string }> {
  if (!uuidLoose.safeParse(conversationId).success) {
    return { ok: false, error: "Neispravni podaci." };
  }
  const me = await assertSuperAdmin();
  if (!me) return { ok: false, error: "Nemaš pristup." };
  const db = createAdminClient();

  const { error } = await db
    .from("support_conversations")
    .update({ status: "closed", support_read_at: new Date().toISOString() })
    .eq("id", conversationId);
  if (error) return { ok: false, error: "Nešto nije uspelo. Pokušaj ponovo." };
  return { ok: true };
}
