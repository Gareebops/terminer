// Čista logika rasporeda (bez baze): pravilo po zaposlenom + izuzeci po datumu.
//
// Pravilo: schedule_mode "weekly" čita samo redove week_parity=0;
// "rotating" bira parnost 0 (nedelja A) ili 1 (nedelja B) prema udaljenosti
// od rotation_anchor (ponedeljak neke A-nedelje). Izuzetak za konkretan
// datum (shift_assignments) uvek gazi pravilo.

import type { ScheduleException, Staff, WorkingHours } from "@/lib/types";

export type WorkWindow = { start: string; end: string } | null;

const DAY_MS = 24 * 60 * 60 * 1000;

function utc(dateISO: string): number {
  return new Date(`${dateISO}T00:00:00Z`).getTime();
}

export function dayOfWeek(dateISO: string): number {
  return new Date(`${dateISO}T12:00:00Z`).getUTCDay();
}

export function mondayOf(dateISO: string): string {
  const d = new Date(`${dateISO}T12:00:00Z`);
  const day = d.getUTCDay(); // 0 = nedelja
  d.setUTCDate(d.getUTCDate() + (day === 0 ? -6 : 1 - day));
  return d.toISOString().slice(0, 10);
}

export function addDaysISO(dateISO: string, n: number): string {
  const d = new Date(`${dateISO}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// 0 = nedelja A, 1 = nedelja B; radi i za datume pre sidra
export function weekParityFor(dateISO: string, anchor: string): 0 | 1 {
  const weeks = Math.round((utc(mondayOf(dateISO)) - utc(mondayOf(anchor))) / (7 * DAY_MS));
  return (((weeks % 2) + 2) % 2) as 0 | 1;
}

export function parityForStaff(dateISO: string, staff: Staff): 0 | 1 {
  if (staff.schedule_mode !== "rotating" || !staff.rotation_anchor) return 0;
  return weekParityFor(dateISO, staff.rotation_anchor);
}

// ---------- Horizont zakazivanja ----------
// Koliko dana unapred (računajući danas) se gostima nude termini.
// null/nepostojeća kolona = podrazumevano; clamp čuva server od
// vrednosti mimo ponuđenih (direktan REST upis i sl.).

export const DEFAULT_HORIZON_DAYS = 60;
export const MAX_HORIZON_DAYS = 90;

export function bookingHorizonDays(
  staff: Pick<Staff, "booking_horizon_days">
): number {
  const days = staff.booking_horizon_days ?? DEFAULT_HORIZON_DAYS;
  return Math.max(1, Math.min(days, MAX_HORIZON_DAYS));
}

// Radno okno za datum: izuzetak gazi pravilo; null = ne radi
export function resolveWindow(
  dateISO: string,
  staff: Staff,
  hours: WorkingHours[],
  exception: ScheduleException | null | undefined
): WorkWindow {
  if (exception) {
    if (exception.is_off || !exception.start_time || !exception.end_time) return null;
    return {
      start: exception.start_time.slice(0, 5),
      end: exception.end_time.slice(0, 5),
    };
  }
  const parity = parityForStaff(dateISO, staff);
  const dow = dayOfWeek(dateISO);
  const row = hours.find(
    (h) => h.staff_id === staff.id && h.day_of_week === dow && h.week_parity === parity
  );
  if (!row || !row.is_working) return null;
  return { start: row.start_time.slice(0, 5), end: row.end_time.slice(0, 5) };
}
