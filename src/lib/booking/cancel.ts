// Prozor za otkazivanje preko linka iz mejla (Mihajlova odluka 11.7):
// klijent može da se predomisli SAT VREMENA od trenutka zakazivanja -
// posle toga link ne radi i klijent zove salon. Termin koji je već počeo
// se brani posebnom proverom (cancelBooking), nezavisno od ovog prozora.
export const CANCEL_WINDOW_MINUTES = 60;

// created_at je timestamptz (apsolutni trenutak) pa poređenje ne zavisi
// od vremenske zone salona. Neispravan datum ne zaključava otkazivanje.
export function linkCancelExpired(createdAtISO: string, nowMs: number): boolean {
  const created = Date.parse(createdAtISO);
  if (Number.isNaN(created)) return false;
  return nowMs - created > CANCEL_WINDOW_MINUTES * 60_000;
}

// Za server komponente: sat se čita ovde, ne u renderu (react-hooks/purity;
// isti obrazac kao nowInZone) - stranica je ionako dinamička po zahtevu
export function linkCancelExpiredNow(createdAtISO: string): boolean {
  return linkCancelExpired(createdAtISO, Date.now());
}
