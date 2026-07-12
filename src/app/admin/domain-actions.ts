"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAdminContext } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  removeDomainFromVercel,
  vercelEnv,
  vercelFetch,
} from "@/lib/vercel-domains";

// Custom domen salona: povezivanje ide kroz Vercel Domains API (domen se
// dodaje na naš Vercel projekat), pa se čuva u tenants.custom_domain koju
// proxy koristi za rezoluciju hosta. Sve ide service-role klijentom posle
// provere članstva - kolona namerno nije upisiva kroz RLS.

const DOMAIN_RE =
  /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/;

// Adrese platforme se ne mogu vezati kao custom domen
const FORBIDDEN_SUFFIXES = ["terminer.rs", "vercel.app", "localhost"];

export interface DnsRecord {
  type: string;
  name: string;
  value: string;
}

export type DomainState =
  | "active" // verifikovan i DNS ispravan
  | "pending_dns" // čeka DNS podešavanje kod registrara
  | "needs_txt" // Vercel traži TXT verifikaciju (domen u upotrebi drugde)
  | "unknown";

export interface DomainStatus {
  domain: string;
  state: DomainState;
  records: DnsRecord[];
}

type Result<T> = ({ ok: true } & T) | { ok: false; error: string };

function normalizeDomain(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/\.$/, "");
}

// DNS uputstvo za registrara: apex (2 labele) ide na A zapis, poddomeni
// (www i ostali) na CNAME - standardna Vercel konfiguracija.
function dnsRecordsFor(domain: string, verification: DnsRecord[]): DnsRecord[] {
  if (verification.length > 0) return verification;
  const isApex = domain.split(".").length === 2;
  return isApex
    ? [{ type: "A", name: "@", value: "76.76.21.21" }]
    : [
        {
          type: "CNAME",
          name: domain.split(".")[0],
          value: "cname.vercel-dns.com",
        },
      ];
}

// Status domena sa Vercela: verifikacija (vlasništvo) + DNS konfiguracija
async function fetchDomainStatus(domain: string): Promise<DomainStatus> {
  const env = vercelEnv();
  if (!env) return { domain, state: "unknown", records: dnsRecordsFor(domain, []) };

  const [info, config] = await Promise.all([
    vercelFetch(`/v9/projects/${env.projectId}/domains/${domain}`),
    vercelFetch(`/v6/domains/${domain}/config`),
  ]);

  const verification = Array.isArray(info.body.verification)
    ? (info.body.verification as { type: string; domain: string; value: string }[]).map(
        (v) => ({ type: v.type, name: v.domain, value: v.value })
      )
    : [];
  const verified = info.body.verified === true;
  const misconfigured = config.body.misconfigured !== false;

  let state: DomainState;
  if (!verified && verification.length > 0) state = "needs_txt";
  else if (verified && !misconfigured) state = "active";
  else state = "pending_dns";

  return { domain, state, records: dnsRecordsFor(domain, verified ? [] : verification) };
}

export async function setCustomDomain(
  raw: string
): Promise<Result<{ status: DomainStatus }>> {
  const { role, tenant } = await getAdminContext();
  if (role !== "owner" && role !== "admin") {
    return { ok: false, error: "Nemaš dozvolu za ovu izmenu." };
  }

  const domain = normalizeDomain(raw);
  const parsed = z.string().min(4).max(253).regex(DOMAIN_RE).safeParse(domain);
  if (!parsed.success) {
    return { ok: false, error: "Unesi ispravan domen, npr. mojsalon.rs (bez https:// i putanje)." };
  }
  if (FORBIDDEN_SUFFIXES.some((s) => domain === s || domain.endsWith(`.${s}`))) {
    return { ok: false, error: "Ta adresa pripada platformi - unesi svoj domen." };
  }

  const env = vercelEnv();
  if (!env) {
    return {
      ok: false,
      error: "Povezivanje domena još nije aktivirano na ovom okruženju. Javi podršci.",
    };
  }

  const db = createAdminClient();

  // Zauzetost kod nas (unique constraint je krajnja brana, ovo je lepša poruka)
  const { data: taken } = await db
    .from("tenants")
    .select("id")
    .eq("custom_domain", domain)
    .neq("id", tenant.id)
    .maybeSingle();
  if (taken) return { ok: false, error: "Taj domen je već povezan sa drugim salonom." };

  // Dodavanje na Vercel projekat
  const added = await vercelFetch(`/v10/projects/${env.projectId}/domains`, {
    method: "POST",
    body: JSON.stringify({ name: domain }),
  });
  const errCode = (added.body.error as { code?: string } | undefined)?.code;
  if (added.status >= 400 && errCode !== "domain_already_exists") {
    if (errCode === "domain_taken" || errCode === "domain_already_in_use") {
      return {
        ok: false,
        error: "Domen je vezan za drugi Vercel projekat/nalog - prvo ga tamo otkači.",
      };
    }
    console.error("Vercel add domain failed:", added.status, added.body);
    return { ok: false, error: "Povezivanje sa Vercelom nije uspelo. Pokušaj ponovo." };
  }

  // Upis u bazu; stari domen (ako postoji i različit je) skidamo sa Vercela
  const previous = tenant.custom_domain ?? null;
  const { error } = await db
    .from("tenants")
    .update({ custom_domain: domain })
    .eq("id", tenant.id);
  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: "Taj domen je već povezan sa drugim salonom." };
    }
    console.error("setCustomDomain upis nije uspeo:", error);
    return { ok: false, error: "Čuvanje nije uspelo. Pokušaj ponovo." };
  }
  if (previous && previous !== domain) {
    await removeDomainFromVercel(previous);
  }

  revalidatePath("/admin/podesavanja");
  return { ok: true, status: await fetchDomainStatus(domain) };
}

export async function removeCustomDomain(): Promise<Result<object>> {
  const { role, tenant } = await getAdminContext();
  if (role !== "owner" && role !== "admin") {
    return { ok: false, error: "Nemaš dozvolu za ovu izmenu." };
  }
  const domain = tenant.custom_domain;
  if (!domain) return { ok: true };

  // 404 je u redu (već skinut sa Vercela) - bazu čistimo svakako
  await removeDomainFromVercel(domain);

  const db = createAdminClient();
  const { error } = await db
    .from("tenants")
    .update({ custom_domain: null })
    .eq("id", tenant.id);
  if (error) return { ok: false, error: "Uklanjanje nije uspelo. Pokušaj ponovo." };

  revalidatePath("/admin/podesavanja");
  return { ok: true };
}

export async function checkDomainStatus(): Promise<Result<{ status: DomainStatus }>> {
  const { tenant } = await getAdminContext();
  if (!tenant.custom_domain) return { ok: false, error: "Domen nije povezan." };
  return { ok: true, status: await fetchDomainStatus(tenant.custom_domain) };
}
