// Svi korisnički datumi idu kroz sr-Latn-RS: podrazumevani "sr-RS" vraća
// ĆIRILICU za imena dana i meseci (odluka od 6.7), a numerički format je
// identičan u obe varijante - jedan util sprečava da novi kod slučajno
// prikaže ćirilicu.
const LOCALE = "sr-Latn-RS";

// Datum kolone iz baze ("2026-07-10") parsiramo u podne da vremenska zona
// ne prevrne dan; timestamp (sadrži "T") ide direktno.
function toDate(d: string | Date): Date {
  if (d instanceof Date) return d;
  return new Date(d.includes("T") ? d : `${d}T12:00:00`);
}

// "2026-07-10" -> "10. 7. 2026." (uz opts i varijante sa imenom dana/meseca)
export function datumSr(d: string | Date, opts?: Intl.DateTimeFormatOptions): string {
  return toDate(d).toLocaleDateString(LOCALE, opts);
}

// Timestamp -> "10. 7. 2026. 19:05:33" (superadmin dnevnik i sl.)
export function datumVremeSr(d: string | Date): string {
  return toDate(d).toLocaleString(LOCALE);
}
