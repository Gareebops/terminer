// Path segmenti koje aplikacija koristi kao svoje rute - ne smeju postati
// slug salona (statička ruta bi zasenila sajt i slug bi bio zauzet zauvek).
// Koristi ga proxy (tenant rezolucija) i onboarding (validacija pri kreiranju).
export const RESERVED_SLUGS = new Set([
  "admin",
  "superadmin",
  "faktura",
  "prijava",
  "registracija",
  "onboarding",
  "auth",
  "zaboravljena-lozinka",
  "nova-lozinka",
  "privatnost",
  "uslovi",
  "api",
  "_next",
  "favicon.ico",
  // root metadata ruta bez ekstenzije (sitemap.xml/robots.txt/icon.svg
  // slug regex ionako odbija zbog tačke) - opengraph-image bi zasenio [slug]
  "opengraph-image",
  // rezerve za buduće rute / zabuna sa poddomenima
  "www",
  "app",
  "blog",
  "pomoc",
  "podrska",
  "kontakt",
  "cenovnik",
  "terminer",
]);
