import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Rezervisani path segmenti koji nisu tenant slug-ovi.
const RESERVED = new Set([
  "admin",
  "superadmin",
  "prijava",
  "registracija",
  "onboarding",
  "api",
  "_next",
  "favicon.ico",
]);

export default async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  // --- Tenant rezolucija ---
  // MVP: path-based (terminer.rs/{slug}). Kada pređemo na subdomene,
  // ovde se iz request.headers.get("host") izvuče slug i uradi rewrite
  // na /{slug}/... — ostatak aplikacije se ne menja.
  const firstSegment = request.nextUrl.pathname.split("/")[1] ?? "";
  if (firstSegment && !RESERVED.has(firstSegment)) {
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
