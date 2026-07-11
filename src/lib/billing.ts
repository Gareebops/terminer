// Status pretplate salona. Model: 30 dana probe → faktura → paid_until.
// Posle isteka ide grace period, pa se pauzira SAMO online zakazivanje -
// sajt salona ostaje živ uvek.

export const GRACE_DAYS = 7;

export type SubscriptionStatus = "trial" | "active" | "grace" | "expired";

export interface SubscriptionInfo {
  status: SubscriptionStatus;
  // preostali dani: za trial/active do isteka, za grace do pauziranja
  daysLeft: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function subscriptionInfo(tenant: {
  trial_ends_at: string;
  paid_until: string | null;
}): SubscriptionInfo {
  const now = Date.now();
  const trialEnd = new Date(tenant.trial_ends_at).getTime();
  // paid_until je datum - važi do kraja tog dana
  const paidEnd = tenant.paid_until
    ? new Date(`${tenant.paid_until}T23:59:59`).getTime()
    : 0;

  if (paidEnd >= now) {
    return { status: "active", daysLeft: Math.ceil((paidEnd - now) / DAY_MS) };
  }
  // I kad je ranija uplata istekla, proba koja još traje se poštuje
  if (trialEnd >= now) {
    return { status: "trial", daysLeft: Math.ceil((trialEnd - now) / DAY_MS) };
  }

  const graceEnd = Math.max(trialEnd, paidEnd) + GRACE_DAYS * DAY_MS;
  if (graceEnd >= now) {
    return { status: "grace", daysLeft: Math.ceil((graceEnd - now) / DAY_MS) };
  }
  return { status: "expired", daysLeft: 0 };
}

export function isBookingPaused(tenant: {
  trial_ends_at: string;
  paid_until: string | null;
}): boolean {
  return subscriptionInfo(tenant).status === "expired";
}

// Podsetnik superadminu iz dnevnog crona: proba ističe za TAČNO `days`
// dana (daysLeft je ceil, pa svaki salon uslov ispuni na tačno jedan dan -
// to je i zaštita od duplog slanja bez čuvanja stanja)
export function trialReminderDue(
  tenant: { trial_ends_at: string; paid_until: string | null },
  days: number
): boolean {
  const info = subscriptionInfo(tenant);
  return info.status === "trial" && info.daysLeft === days;
}
