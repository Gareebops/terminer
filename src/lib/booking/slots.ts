// Čista logika za računanje slobodnih termina (bez zavisnosti od baze).

export type TimeRange = { start: string; end: string }; // "HH:MM"

export function toMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export function fromMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function overlaps(a: TimeRange, b: TimeRange): boolean {
  return toMinutes(a.start) < toMinutes(b.end) && toMinutes(b.start) < toMinutes(a.end);
}

export interface SlotInput {
  workStart: string;
  workEnd: string;
  durationMinutes: number;
  step?: number; // razmak između ponuđenih početaka, default 30
  busy: TimeRange[];
  isToday?: boolean;
  nowMinutes?: number;
}

export function generateAvailableSlots(input: SlotInput): string[] {
  const step = input.step ?? 30;
  const start = toMinutes(input.workStart);
  const end = toMinutes(input.workEnd);
  const result: string[] = [];
  for (let t = start; t + input.durationMinutes <= end; t += step) {
    if (input.isToday && input.nowMinutes !== undefined && t <= input.nowMinutes) continue;
    const slot = { start: fromMinutes(t), end: fromMinutes(t + input.durationMinutes) };
    if (input.busy.some((b) => overlaps(slot, b))) continue;
    result.push(slot.start);
  }
  return result;
}

export function formatDateISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function formatPrice(price: number, currency = "RSD"): string {
  return `${Number(price).toLocaleString("sr-RS")} ${currency}`;
}

export const DAY_NAMES_SR = [
  "Nedelja",
  "Ponedeljak",
  "Utorak",
  "Sreda",
  "Četvrtak",
  "Petak",
  "Subota",
];
