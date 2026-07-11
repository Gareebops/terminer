// Prozor za otkazivanje preko linka iz mejla (Mihajlova odluka 11.7,
// dopunjena istog dana): linkom se otkazuje NAJKASNIJE 48h PRE POČETKA
// termina; termin zakazan unutar poslednjih 48h može da se otkaže samo u
// PRVOM SATU od zakazivanja (predomišljanje). Kasnije klijent zove salon -
// poslednja dva dana su pod kontrolom salona. Termin koji je već počeo
// brani posebna provera u cancelBooking, nezavisno od ovog prozora.
export const CANCEL_WINDOW_MINUTES = 60;
export const CANCEL_CUTOFF_HOURS = 48;

// created_at i starts_at su timestamptz (apsolutni trenuci) pa poređenja
// ne zavise od vremenske zone salona. Neispravan datum ne zaključava
// otkazivanje (fail-open prema klijentu).
export function linkCancelExpired(
  createdAtISO: string,
  startsAtISO: string,
  nowMs: number
): boolean {
  const created = Date.parse(createdAtISO);
  if (Number.isNaN(created)) return false;
  // Prvi sat od zakazivanja - predomišljanje uvek dozvoljeno
  if (nowMs - created <= CANCEL_WINDOW_MINUTES * 60_000) return false;
  // Do 48h pre početka termina - oslobađanje slota salonu i dalje pomaže
  const starts = Date.parse(startsAtISO);
  if (!Number.isNaN(starts) && starts - nowMs >= CANCEL_CUTOFF_HOURS * 3_600_000) {
    return false;
  }
  return true;
}

// Za server komponente: sat se čita ovde, ne u renderu (react-hooks/purity;
// isti obrazac kao nowInZone) - stranica je ionako dinamička po zahtevu
export function linkCancelExpiredNow(
  createdAtISO: string,
  startsAtISO: string
): boolean {
  return linkCancelExpired(createdAtISO, startsAtISO, Date.now());
}
