import type { SupabaseClient, User } from "@supabase/supabase-js";

// Supabase admin API nema getUserByEmail ni "svi korisnici" poziv - samo
// listUsers sa stranicama. Ovi helperi prolaze SVE stranice, pa nalazi rade
// i posle 1000. korisnika (raniji poznati problem transferOwnership-a).
const PER_PAGE = 1000;

export async function listAllUsers(db: SupabaseClient): Promise<User[]> {
  const all: User[] = [];
  for (let page = 1; ; page++) {
    const { data, error } = await db.auth.admin.listUsers({
      page,
      perPage: PER_PAGE,
    });
    if (error) throw error;
    all.push(...data.users);
    if (data.users.length < PER_PAGE) return all;
  }
}

export async function findUserByEmail(
  db: SupabaseClient,
  email: string
): Promise<User | null> {
  const needle = email.toLowerCase();
  for (let page = 1; ; page++) {
    const { data, error } = await db.auth.admin.listUsers({
      page,
      perPage: PER_PAGE,
    });
    if (error) throw error;
    const hit = data.users.find((u) => u.email?.toLowerCase() === needle);
    if (hit) return hit;
    if (data.users.length < PER_PAGE) return null;
  }
}
