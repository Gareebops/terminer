"use server";

import { headers } from "next/headers";
import { after } from "next/server";
import { z } from "zod";
import { getAdminContext } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { sendSupportChatNotice } from "@/lib/email";
import { excerpt, type SupportConversation, type SupportMessage } from "@/lib/support-chat";

// Live chat podrške - strana vlasnika salona. Sve ide session klijentom
// pod RLS-om (kao ostatak admin zone); superadmin strana je u
// superadmin/support-actions.ts. Razgovor se otvara prvom porukom, tada
// superadminu ide mejl; posle zatvaranja sledeća poruka otvara nov razgovor.

export type SupportChatState =
  | { ok: true; conversation: SupportConversation | null; messages: SupportMessage[] }
  | { ok: false };

// Poslednji razgovor po AKTIVNOSTI (ne otvaranju) - odgovor podrške u
// starijem razgovoru ga vraća u widget umesto da ostane nevidljiv.
export async function getSupportChat(input?: {
  markRead?: boolean;
}): Promise<SupportChatState> {
  const { tenant } = await getAdminContext();
  const supabase = await createClient();

  // RLS ionako sužava na članstvo; tenant filter je odbrana u dubinu
  const { data: conversation, error } = await supabase
    .from("support_conversations")
    .select("*")
    .eq("tenant_id", tenant.id)
    .order("last_message_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  // Pad upita = najverovatnije migracija još nije primenjena (42P01);
  // widget se tada tiho sakriva umesto da ruši admin
  if (error) return { ok: false };
  if (!conversation) return { ok: true, conversation: null, messages: [] };

  const { data: messages, error: msgError } = await supabase
    .from("support_messages")
    .select("id, conversation_id, sender, body, created_at")
    .eq("conversation_id", conversation.id)
    .order("created_at", { ascending: true })
    .limit(200);
  if (msgError) return { ok: false };

  if (input?.markRead) {
    const now = new Date().toISOString();
    await supabase
      .from("support_conversations")
      .update({ owner_read_at: now })
      .eq("id", conversation.id);
    conversation.owner_read_at = now;
  }

  return {
    ok: true,
    conversation: conversation as SupportConversation,
    messages: (messages ?? []) as SupportMessage[],
  };
}

const messageSchema = z.object({
  body: z.string().trim().min(1, "Poruka je prazna.").max(4000, "Poruka je predugačka."),
});

export async function sendSupportMessage(input: {
  body: string;
}): Promise<{ ok: boolean; error?: string }> {
  const parsed = messageSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Neispravni podaci." };
  }
  const { tenant, userId } = await getAdminContext();
  const supabase = await createClient();

  // Otvoren razgovor ili nov; partial unique index brani duplo otvaranje
  // pa se na 23505 (paralelno slanje) piše u onaj koji je pretekao
  let { data: conversation } = await supabase
    .from("support_conversations")
    .select("id, status")
    .eq("tenant_id", tenant.id)
    .eq("status", "open")
    .maybeSingle();

  let opened = false;
  if (!conversation) {
    const { data: created, error: createError } = await supabase
      .from("support_conversations")
      .insert({ tenant_id: tenant.id })
      .select("id, status")
      .single();
    if (createError?.code === "23505") {
      const { data: existing } = await supabase
        .from("support_conversations")
        .select("id, status")
        .eq("tenant_id", tenant.id)
        .eq("status", "open")
        .maybeSingle();
      conversation = existing;
    } else if (createError || !created) {
      return { ok: false, error: "Nešto nije uspelo. Pokušaj ponovo." };
    } else {
      conversation = created;
      opened = true;
    }
  }
  if (!conversation) return { ok: false, error: "Nešto nije uspelo. Pokušaj ponovo." };

  const { error: insertError } = await supabase.from("support_messages").insert({
    tenant_id: tenant.id,
    conversation_id: conversation.id,
    sender: "owner",
    sender_user_id: userId,
    body: parsed.data.body,
  });
  if (insertError) return { ok: false, error: "Nešto nije uspelo. Pokušaj ponovo." };

  const now = new Date().toISOString();
  await supabase
    .from("support_conversations")
    .update({ last_message_at: now, owner_read_at: now })
    .eq("id", conversation.id);

  // Mejl superadminu SAMO pri otvaranju razgovora, posle odgovora (after) -
  // vlasnik ne čeka Resend; request API-ji se čitaju pre callback-a
  if (opened) {
    const { data: claims } = await supabase.auth.getClaims();
    const ownerEmail = (claims?.claims.email as string | undefined) ?? null;
    const hdrs = await headers();
    const proto = hdrs.get("x-forwarded-proto") ?? "http";
    const host = hdrs.get("host") ?? "localhost:3000";
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? `${proto}://${host}`;
    const notice = {
      salonName: tenant.name,
      slug: tenant.slug,
      ownerEmail,
      firstMessage: excerpt(parsed.data.body, 300),
      inboxUrl: `${baseUrl}/superadmin/poruke`,
    };
    after(() => sendSupportChatNotice(notice));
  }

  return { ok: true };
}
