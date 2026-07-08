"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { bustTenantSiteCache } from "@/lib/tenant";
import { RESERVED_SLUGS } from "@/lib/reserved-slugs";

const schema = z.object({
  name: z.string().trim().min(2, "Unesi naziv salona.").max(80),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(
      /^[a-z0-9](?:-?[a-z0-9])*$/,
      "Adresa može da sadrži samo mala slova, brojeve i crtice."
    )
    .min(2)
    .max(40),
});

export async function createSalon(input: {
  name: string;
  slug: string;
}): Promise<{ error: string } | never> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Neispravni podaci." };
  }

  // Slug ne sme biti ruta aplikacije (/admin, /prijava...) - statička ruta
  // bi zasenila sajt salona i adresa bi bila trajno nedostupna
  if (RESERVED_SLUGS.has(parsed.data.slug)) {
    return { error: "Ta adresa je rezervisana. Probaj drugu." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/prijava");

  const db = createAdminClient();

  // Jedan vlasnik = jedan salon (za sada)
  const { data: existing } = await db
    .from("tenant_members")
    .select("tenant_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (existing) redirect("/admin");

  const { data: tenant, error } = await db
    .from("tenants")
    .insert({ name: parsed.data.name, slug: parsed.data.slug })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return { error: "Ta adresa je zauzeta. Probaj drugu." };
    }
    console.error("createSalon failed:", error);
    return { error: "Greška pri kreiranju salona. Pokušaj ponovo." };
  }

  const [memberRes, settingsRes] = await Promise.all([
    db.from("tenant_members").insert({
      tenant_id: tenant.id,
      user_id: user.id,
      role: "owner",
    }),
    db.from("site_settings").insert({
      tenant_id: tenant.id,
      hero_title: parsed.data.name,
    }),
  ]);
  if (memberRes.error || settingsRes.error) {
    console.error("createSalon setup failed:", memberRes.error, settingsRes.error);
    return { error: "Greška pri podešavanju salona. Kontaktiraj podršku." };
  }

  // Ako je neko ranije posetio /{slug} dok salon nije postojao, keširan je
  // "ne postoji" rezultat - obori ga da novi salon odmah bude dostupan
  bustTenantSiteCache(parsed.data.slug);

  redirect("/admin");
}
