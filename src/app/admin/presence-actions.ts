"use server";

import { getAdminContext } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";

// Heartbeat prisustva: PresencePing (admin layout) zove ovo na mount i
// svakih HEARTBEAT_MS dok je tab vidljiv. Upis ide service rolom posle
// provere sesije (getAdminContext redirect-uje neulogovane). Pad upisa se
// guta - pre migracije 20260712000001 kolona ne postoji, a indikator u
// superadmin panelu je informativan, ne sme da pravi šum u adminu.
export async function pingPresence(): Promise<{ ok: boolean }> {
  const { userId, tenant } = await getAdminContext();
  const db = createAdminClient();
  const { error } = await db
    .from("tenant_members")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("tenant_id", tenant.id)
    .eq("user_id", userId);
  return { ok: !error };
}
