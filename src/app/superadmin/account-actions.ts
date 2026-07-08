"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { bustTenantSiteCache } from "@/lib/tenant";
import { logAdminAction } from "@/lib/audit";
import { assertSuperAdmin } from "./actions";

// Kontrola naloga sa superadmin panela. Principi:
// - superadmin NIKAD ne postavlja lozinku direktno (samo šalje reset mejl)
// - svaka akcija se upisuje u superadmin_audit_log
// - suspenzija skida sajt sa javnog interneta i blokira ponovnu objavu;
//   brisanje je nepovratno i traži potvrdu slug-om

type ActionResult = { ok: boolean; error?: string };

const uuidSchema = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

async function getTenantWithOwner(tenantId: string) {
  const db = createAdminClient();
  const { data: tenant } = await db
    .from("tenants")
    .select("*")
    .eq("id", tenantId)
    .maybeSingle();
  if (!tenant) return null;

  const { data: membership } = await db
    .from("tenant_members")
    .select("user_id")
    .eq("tenant_id", tenantId)
    .eq("role", "owner")
    .limit(1)
    .maybeSingle();

  let owner: { id: string; email: string; confirmed: boolean } | null = null;
  if (membership) {
    const { data } = await db.auth.admin.getUserById(membership.user_id);
    if (data.user?.email) {
      owner = {
        id: data.user.id,
        email: data.user.email,
        confirmed: !!data.user.email_confirmed_at,
      };
    }
  }
  return { db, tenant, owner };
}

function label(t: { name: string; slug: string }) {
  return `${t.name} (/${t.slug})`;
}

async function baseUrl(): Promise<string> {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  const hdrs = await headers();
  const proto = hdrs.get("x-forwarded-proto") ?? "http";
  return `${proto}://${hdrs.get("host") ?? "localhost:3000"}`;
}

// ---------- Nivo 1: suspenzija ----------

export async function suspendTenant(input: {
  tenantId: string;
  reason: string;
}): Promise<ActionResult> {
  const me = await assertSuperAdmin();
  if (!me) return { ok: false, error: "Nemaš pristup." };
  const parsed = z
    .object({ tenantId: uuidSchema, reason: z.string().trim().min(3).max(300) })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "Upiši razlog suspenzije (min 3 znaka)." };

  const ctx = await getTenantWithOwner(parsed.data.tenantId);
  if (!ctx) return { ok: false, error: "Salon nije pronađen." };
  if (ctx.tenant.suspended_at) return { ok: false, error: "Salon je već suspendovan." };

  const { error } = await ctx.db
    .from("tenants")
    .update({
      suspended_at: new Date().toISOString(),
      suspended_reason: parsed.data.reason,
      is_published: false,
    })
    .eq("id", ctx.tenant.id);
  if (error) return { ok: false, error: "Suspenzija nije uspela." };
  // Suspendovan salon za javnost ne postoji - keširan sajt mora odmah dole
  bustTenantSiteCache(ctx.tenant.slug);

  await logAdminAction({
    adminEmail: me.email,
    action: "suspenzija",
    tenantId: ctx.tenant.id,
    tenantLabel: label(ctx.tenant),
    details: { reason: parsed.data.reason, was_published: ctx.tenant.is_published },
  });
  revalidatePath("/superadmin");
  return { ok: true };
}

export async function unsuspendTenant(tenantId: string): Promise<ActionResult> {
  const me = await assertSuperAdmin();
  if (!me) return { ok: false, error: "Nemaš pristup." };
  if (!uuidSchema.safeParse(tenantId).success) return { ok: false, error: "Neispravan ID." };

  const ctx = await getTenantWithOwner(tenantId);
  if (!ctx) return { ok: false, error: "Salon nije pronađen." };
  if (!ctx.tenant.suspended_at) return { ok: false, error: "Salon nije suspendovan." };

  // Sajt ostaje neobjavljen - vlasnik ga svesno objavljuje ponovo
  const { error } = await ctx.db
    .from("tenants")
    .update({ suspended_at: null, suspended_reason: null })
    .eq("id", tenantId);
  if (error) return { ok: false, error: "Ukidanje suspenzije nije uspelo." };
  bustTenantSiteCache(ctx.tenant.slug);

  await logAdminAction({
    adminEmail: me.email,
    action: "ukidanje suspenzije",
    tenantId,
    tenantLabel: label(ctx.tenant),
  });
  revalidatePath("/superadmin");
  return { ok: true };
}

// ---------- Nivo 1: pomoć oko pristupa ----------

export async function sendOwnerPasswordReset(tenantId: string): Promise<ActionResult> {
  const me = await assertSuperAdmin();
  if (!me) return { ok: false, error: "Nemaš pristup." };
  const ctx = await getTenantWithOwner(tenantId);
  if (!ctx?.owner) return { ok: false, error: "Vlasnik nije pronađen." };

  const { error } = await ctx.db.auth.resetPasswordForEmail(ctx.owner.email, {
    redirectTo: `${await baseUrl()}/auth/callback?next=/nova-lozinka`,
  });
  if (error) return { ok: false, error: "Slanje nije uspelo." };

  await logAdminAction({
    adminEmail: me.email,
    action: "poslat reset lozinke",
    tenantId,
    tenantLabel: label(ctx.tenant),
    details: { to: ctx.owner.email },
  });
  return { ok: true };
}

export async function resendOwnerConfirmation(tenantId: string): Promise<ActionResult> {
  const me = await assertSuperAdmin();
  if (!me) return { ok: false, error: "Nemaš pristup." };
  const ctx = await getTenantWithOwner(tenantId);
  if (!ctx?.owner) return { ok: false, error: "Vlasnik nije pronađen." };
  if (ctx.owner.confirmed) return { ok: false, error: "Nalog je već potvrđen." };

  const { error } = await ctx.db.auth.resend({
    type: "signup",
    email: ctx.owner.email,
    options: { emailRedirectTo: `${await baseUrl()}/auth/callback` },
  });
  if (error) return { ok: false, error: "Slanje nije uspelo." };

  await logAdminAction({
    adminEmail: me.email,
    action: "poslata potvrda naloga",
    tenantId,
    tenantLabel: label(ctx.tenant),
    details: { to: ctx.owner.email },
  });
  return { ok: true };
}

// ---------- Nivo 2: izvoz podataka ----------

export async function exportTenantData(
  tenantId: string
): Promise<{ ok: true; json: string; filename: string } | { ok: false; error: string }> {
  const me = await assertSuperAdmin();
  if (!me) return { ok: false, error: "Nemaš pristup." };
  const ctx = await getTenantWithOwner(tenantId);
  if (!ctx) return { ok: false, error: "Salon nije pronađen." };

  const tables = [
    "site_settings",
    "services",
    "staff",
    "staff_services",
    "working_hours",
    "shift_assignments",
    "customers",
    "bookings",
    "blocked_slots",
    "gallery",
    "invoices",
  ] as const;

  const data: Record<string, unknown> = {
    exported_at: new Date().toISOString(),
    tenant: ctx.tenant,
    owner_email: ctx.owner?.email ?? null,
  };
  for (const t of tables) {
    const { data: rows, error } = await ctx.db.from(t).select("*").eq("tenant_id", tenantId);
    if (error) return { ok: false, error: `Izvoz tabele ${t} nije uspeo.` };
    data[t] = rows;
  }

  await logAdminAction({
    adminEmail: me.email,
    action: "izvoz podataka",
    tenantId,
    tenantLabel: label(ctx.tenant),
  });
  return {
    ok: true,
    json: JSON.stringify(data, null, 2),
    filename: `terminer-izvoz-${ctx.tenant.slug}-${new Date().toISOString().slice(0, 10)}.json`,
  };
}

// ---------- Nivo 1: brisanje ----------

export async function deleteTenant(input: {
  tenantId: string;
  confirmSlug: string;
}): Promise<ActionResult> {
  const me = await assertSuperAdmin();
  if (!me) return { ok: false, error: "Nemaš pristup." };
  const ctx = await getTenantWithOwner(input.tenantId);
  if (!ctx) return { ok: false, error: "Salon nije pronađen." };
  if (input.confirmSlug !== ctx.tenant.slug) {
    return { ok: false, error: "Slug se ne poklapa - brisanje otkazano." };
  }

  // 1) Storage fajlovi salona (logo, hero, tim, galerija)
  const { data: files } = await ctx.db.storage
    .from("tenant-media")
    .list(ctx.tenant.id, { limit: 1000 });
  const paths: string[] = [];
  for (const f of files ?? []) {
    if (f.id) paths.push(`${ctx.tenant.id}/${f.name}`);
    else {
      // folder - izlistaj i njegov sadržaj
      const { data: sub } = await ctx.db.storage
        .from("tenant-media")
        .list(`${ctx.tenant.id}/${f.name}`, { limit: 1000 });
      for (const s of sub ?? []) paths.push(`${ctx.tenant.id}/${f.name}/${s.name}`);
    }
  }
  if (paths.length > 0) {
    await ctx.db.storage.from("tenant-media").remove(paths);
  }

  // 2) Tenant red - kaskada nosi sve child tabele (uklj. fakture i članstva)
  const { error } = await ctx.db.from("tenants").delete().eq("id", ctx.tenant.id);
  if (error) return { ok: false, error: "Brisanje salona nije uspelo." };
  bustTenantSiteCache(ctx.tenant.slug);

  // 3) Auth nalog vlasnika - samo ako ne vodi nijedan drugi salon
  let ownerDeleted = false;
  if (ctx.owner) {
    const { data: other } = await ctx.db
      .from("tenant_members")
      .select("tenant_id")
      .eq("user_id", ctx.owner.id)
      .limit(1);
    if (!other || other.length === 0) {
      const { error: delErr } = await ctx.db.auth.admin.deleteUser(ctx.owner.id);
      ownerDeleted = !delErr;
    }
  }

  await logAdminAction({
    adminEmail: me.email,
    action: "brisanje salona",
    tenantLabel: label(ctx.tenant),
    details: {
      owner_email: ctx.owner?.email ?? null,
      owner_account_deleted: ownerDeleted,
      storage_files_deleted: paths.length,
    },
  });
  revalidatePath("/superadmin");
  return { ok: true };
}

// ---------- Nivo 2: email i vlasništvo ----------

export async function changeOwnerEmail(input: {
  tenantId: string;
  newEmail: string;
}): Promise<ActionResult> {
  const me = await assertSuperAdmin();
  if (!me) return { ok: false, error: "Nemaš pristup." };
  const parsed = z
    .object({ tenantId: uuidSchema, newEmail: z.string().trim().email().max(200) })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "Neispravna email adresa." };

  const ctx = await getTenantWithOwner(parsed.data.tenantId);
  if (!ctx?.owner) return { ok: false, error: "Vlasnik nije pronađen." };

  const { error } = await ctx.db.auth.admin.updateUserById(ctx.owner.id, {
    email: parsed.data.newEmail,
    email_confirm: true,
  });
  if (error) {
    return {
      ok: false,
      error: error.message.includes("already")
        ? "Nalog sa tom adresom već postoji."
        : "Promena nije uspela.",
    };
  }

  await logAdminAction({
    adminEmail: me.email,
    action: "promena email adrese vlasnika",
    tenantId: ctx.tenant.id,
    tenantLabel: label(ctx.tenant),
    details: { from: ctx.owner.email, to: parsed.data.newEmail },
  });
  revalidatePath("/superadmin");
  return { ok: true };
}

export async function transferOwnership(input: {
  tenantId: string;
  newOwnerEmail: string;
}): Promise<ActionResult> {
  const me = await assertSuperAdmin();
  if (!me) return { ok: false, error: "Nemaš pristup." };
  const parsed = z
    .object({ tenantId: uuidSchema, newOwnerEmail: z.string().trim().email() })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "Neispravna email adresa." };

  const ctx = await getTenantWithOwner(parsed.data.tenantId);
  if (!ctx?.owner) return { ok: false, error: "Vlasnik nije pronađen." };

  // Novi vlasnik mora imati postojeći, potvrđen nalog
  const { data: users } = await ctx.db.auth.admin.listUsers({ perPage: 1000 });
  const target = users.users.find(
    (u) => u.email?.toLowerCase() === parsed.data.newOwnerEmail.toLowerCase()
  );
  if (!target) {
    return { ok: false, error: "Nalog sa tom adresom ne postoji - neka se prvo registruje." };
  }
  if (!target.email_confirmed_at) {
    return { ok: false, error: "Nalog novog vlasnika još nije potvrđen." };
  }
  if (target.id === ctx.owner.id) {
    return { ok: false, error: "Taj nalog je već vlasnik." };
  }

  // Jedan vlasnik = jedan salon (postojeće pravilo platforme)
  const { data: existing } = await ctx.db
    .from("tenant_members")
    .select("tenant_id")
    .eq("user_id", target.id)
    .limit(1);
  if (existing && existing.length > 0) {
    return { ok: false, error: "Taj nalog već vodi drugi salon." };
  }

  const { error } = await ctx.db
    .from("tenant_members")
    .update({ user_id: target.id })
    .eq("tenant_id", ctx.tenant.id)
    .eq("role", "owner")
    .eq("user_id", ctx.owner.id);
  if (error) return { ok: false, error: "Prenos nije uspeo." };

  await logAdminAction({
    adminEmail: me.email,
    action: "prenos vlasništva",
    tenantId: ctx.tenant.id,
    tenantLabel: label(ctx.tenant),
    details: { from: ctx.owner.email, to: target.email },
  });
  revalidatePath("/superadmin");
  return { ok: true };
}

// ---------- Nivo 3: impersonacija ----------

// "Uđi kao vlasnik": magic link vlasnika se verifikuje u OVOM browseru,
// pa superadmin sesija postaje sesija vlasnika (povratak: odjava + prijava).
// Upotreba isključivo za podršku, uz saglasnost korisnika; sve se loguje.
export async function impersonateOwner(tenantId: string): Promise<ActionResult> {
  const me = await assertSuperAdmin();
  if (!me) return { ok: false, error: "Nemaš pristup." };
  const ctx = await getTenantWithOwner(tenantId);
  if (!ctx?.owner) return { ok: false, error: "Vlasnik nije pronađen." };

  const { data: link, error } = await ctx.db.auth.admin.generateLink({
    type: "magiclink",
    email: ctx.owner.email,
  });
  if (error || !link.properties?.hashed_token) {
    return { ok: false, error: "Generisanje pristupa nije uspelo." };
  }

  await logAdminAction({
    adminEmail: me.email,
    action: "impersonacija (ulaz kao vlasnik)",
    tenantId: ctx.tenant.id,
    tenantLabel: label(ctx.tenant),
    details: { owner_email: ctx.owner.email },
  });

  // Verifikacija kroz session klijent upisuje kolačiće vlasnika u ovaj browser
  const supabase = await createClient();
  const { error: otpError } = await supabase.auth.verifyOtp({
    type: "email",
    token_hash: link.properties.hashed_token,
  });
  if (otpError) return { ok: false, error: "Preuzimanje sesije nije uspelo." };

  redirect("/admin");
}
