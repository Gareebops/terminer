// Srpska množina uz broj: 1 termin / 2-4 termina / 5+ termina,
// uz izuzetke 11-14 (11 termina) i 21, 31... (21 termin).
// forms = [jednina, paukal (2-4), množina (5+)]
export function plural(n: number, forms: [string, string, string]): string {
  const d = n % 10;
  const dd = n % 100;
  if (d === 1 && dd !== 11) return forms[0];
  if (d >= 2 && d <= 4 && (dd < 12 || dd > 14)) return forms[1];
  return forms[2];
}
