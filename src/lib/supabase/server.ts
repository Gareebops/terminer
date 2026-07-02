import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Server klijent vezan za sesiju ulogovanog korisnika (RLS važi).
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Poziv iz Server Component-a — middleware osvežava sesiju.
          }
        },
      },
    }
  );
}
