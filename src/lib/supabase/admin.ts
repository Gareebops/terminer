import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Service-role klijent - zaobilazi RLS. SME da se koristi SAMO na serveru
// (server actions / route handlers), nikad u klijentskom kodu. (Namerno bez
// `import "server-only"`: paket nije zavisnost projekta, a dodavanje pred
// launch nosi rizik po lockfile/@emnapi u CI - kandidat za posle launcha.)
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
