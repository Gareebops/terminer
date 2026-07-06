import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { RESERVED_SLUGS } from "@/lib/reserved-slugs";

// Hostovi platforme - na njima važi path-based rutiranje (/{slug}).
function isPlatformHost(hostHeader: string): boolean {
  const h = hostHeader.split(":")[0].toLowerCase();
  return (
    h === "terminer.rs" ||
    h === "www.terminer.rs" ||
    h === "localhost" ||
    h === "127.0.0.1" ||
    h.endsWith(".vercel.app") ||
    h.endsWith(".localhost")
  );
}

// Keš rezolucije custom domena (po instanci) - da svaki zahtev na custom
// domenu ne plaća upit ka bazi.
const domainCache = new Map<string, { slug: string | null; at: number }>();
const DOMAIN_CACHE_MS = 60_000;

// Host → slug preko tenants.custom_domain (javno čitljiva kolona; RLS pušta
// samo objavljene salone, pa domen proradi tek posle objave sajta).
// Posetilac na www varijanti se mapira i na apex unos i obrnuto.
async function resolveCustomDomain(hostHeader: string): Promise<string | null> {
  const host = hostHeader.split(":")[0].toLowerCase();
  const cached = domainCache.get(host);
  if (cached && Date.now() - cached.at < DOMAIN_CACHE_MS) return cached.slug;

  const alternate = host.startsWith("www.") ? host.slice(4) : `www.${host}`;
  let slug: string | null = null;
  try {
    const url =
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/tenants` +
      `?select=slug,custom_domain&custom_domain=in.(${host},${alternate})`;
    const res = await fetch(url, {
      headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! },
    });
    if (res.ok) {
      const rows = (await res.json()) as { slug: string; custom_domain: string }[];
      slug =
        (rows.find((r) => r.custom_domain === host) ?? rows[0])?.slug ?? null;
    }
  } catch {
    // mreža/greška → tretiraj kao nepoznat domen; keš sprečava dobovanje
  }
  domainCache.set(host, { slug, at: Date.now() });
  return slug;
}

export default async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  // --- Tenant rezolucija ---
  // 1) Custom domen (mojsalon.rs): host → slug, pa interni rewrite na
  //    /{slug}/... - ostatak aplikacije se ne menja. Linkovi u HTML-u koji
  //    već sadrže /{slug} se preusmere na čistu putanju (bez sluga u URL-u).
  const host = request.headers.get("host") ?? "";
  if (host && !isPlatformHost(host)) {
    const slug = await resolveCustomDomain(host);
    if (slug) {
      const path = request.nextUrl.pathname;
      if (path === `/${slug}` || path.startsWith(`/${slug}/`)) {
        const url = request.nextUrl.clone();
        url.pathname = path.slice(slug.length + 1) || "/";
        return NextResponse.redirect(url, 308);
      }
      const rewriteUrl = request.nextUrl.clone();
      rewriteUrl.pathname = `/${slug}${path === "/" ? "" : path}`;
      // Javni sajt salona: nema admin sesije, refresh kolačića nije potreban
      return NextResponse.rewrite(rewriteUrl);
    }
    // Nepoznat/neobjavljen domen → nastavi normalno (platforma odlučuje)
  }

  // 2) MVP: path-based (terminer.rs/{slug}).
  const firstSegment = request.nextUrl.pathname.split("/")[1] ?? "";
  if (firstSegment && !RESERVED_SLUGS.has(firstSegment)) {
    response.headers.set("x-tenant-slug", firstSegment);
  }

  // --- Osvežavanje Supabase sesije (standardni @supabase/ssr obrazac) ---
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Zaštita admin zone
  if (request.nextUrl.pathname.startsWith("/admin") && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/prijava";
    url.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mov|mp4)$).*)"],
};
