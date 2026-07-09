import { createClient } from "@supabase/supabase-js";
import { DEMO_TENANT_ID, E2E_ADMIN } from "./fixtures";

// Pravi admin korisnika i vezuje ga za seed demo salon - u LOKALNOJ bazi.
// Guard ispod je namerno prvi red posla: E2E piše prave rezervacije, pa ne
// sme ni slučajno da se okrene ka produkciji (.env.local pokazuje na prod!).
export default async function globalSetup(): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

  if (!/127\.0\.0\.1|localhost/.test(url)) {
    throw new Error(
      "E2E testovi rade isključivo protiv LOKALNOG Supabase stacka. " +
        "Pokreni `supabase start` pa izvezi NEXT_PUBLIC_SUPABASE_URL / " +
        "NEXT_PUBLIC_SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY iz " +
        "`supabase status -o env` pre pokretanja (na CI-ju je to automatski)."
    );
  }

  const db = createClient(url, serviceKey);

  const { data: created, error } = await db.auth.admin.createUser({
    email: E2E_ADMIN.email,
    password: E2E_ADMIN.password,
    email_confirm: true,
  });

  let userId = created?.user?.id;
  if (!userId) {
    // Ponovljen run na istom stacku: korisnik već postoji
    const { data } = await db.auth.admin.listUsers();
    userId = data?.users.find((u) => u.email === E2E_ADMIN.email)?.id;
    if (!userId) {
      throw new Error(`E2E setup: kreiranje admin korisnika nije uspelo: ${error?.message}`);
    }
  }

  const { error: memberError } = await db
    .from("tenant_members")
    .upsert({ tenant_id: DEMO_TENANT_ID, user_id: userId, role: "owner" });
  if (memberError) {
    throw new Error(`E2E setup: članstvo nije upisano: ${memberError.message}`);
  }
}
