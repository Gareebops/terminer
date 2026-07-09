import { createClient } from "@supabase/supabase-js";

// Zajednički guard: integracioni testovi diraju bazu (pišu rezervacije,
// prave tenante), pa rade ISKLJUČIVO protiv lokalnog stacka. Bez njega se
// preskaču - na Mihajlovom laptopu nema Dockera, a .env.local pokazuje na
// produkciju koju ne smemo da diramo.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

export const imaLokalniStack =
  /127\.0\.0\.1|localhost/.test(url) &&
  !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
  !!process.env.SUPABASE_SERVICE_ROLE_KEY;

export const DEMO_TENANT_ID = "00000000-0000-0000-0000-000000000001";
export const STAFF_MARKO = "00000000-0000-0000-0000-000000000202";
export const SERVICE_SISANJE = "00000000-0000-0000-0000-000000000101";

// Placeholder vrednosti kad stacka nema: describe telo se izvršava i pri
// skip-u (vitest kolekcija), pa konstruktor klijenta ne sme da baci grešku.
// Testovi su tada preskočeni, klijent se nikad ne koristi.
const PLACEHOLDER_URL = "http://127.0.0.1:54321";

export function anonKlijent() {
  return createClient(
    url || PLACEHOLDER_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder"
  );
}

export function serviceKlijent() {
  return createClient(
    url || PLACEHOLDER_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder",
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

export function sutraISO(): string {
  const d = new Date(Date.now() + 86_400_000);
  return d.toISOString().slice(0, 10);
}
