import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Service-role klijent — zaobilazi RLS. SME da se koristi SAMO na serveru
// (server actions / route handlers), nikad u klijentskom kodu.
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
