// Normalizacija broja telefona u kanonski oblik, da isti klijent ne postane
// tri različita ("060 123 456", "060/123-456", "+38160123456") i da se
// anti-spam limit po telefonu ne zaobilazi razmacima.

export function normalizePhone(raw: string): string {
  let p = raw.trim().replace(/[^\d+]/g, "");
  // "+" sme samo na početku
  p = p.startsWith("+") ? `+${p.slice(1).replace(/\+/g, "")}` : p.replace(/\+/g, "");
  // međunarodni prefiks "00" → "+"
  if (p.startsWith("00")) p = `+${p.slice(2)}`;
  // "381..." bez plusa - prepisan međunarodni format (domaći brojevi
  // počinju nulom, pa nema kolizije)
  if (/^381\d{6,}$/.test(p)) p = `+${p}`;
  // domaći format sa vodećom nulom → +381 (tržište je Srbija)
  if (p.startsWith("0")) p = `+381${p.slice(1)}`;
  return p;
}
