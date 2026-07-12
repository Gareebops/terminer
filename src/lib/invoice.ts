// Fakture za Terminer članarine - izdavalac Čvorište.
// NBS IPS QR format po specifikaciji iz postojećeg Čvorište invoice sistema.

export const ISSUER = {
  name: "Čvorište",
  address: "Svetosavska 3",
  city: "18101 Niš",
  pib: "114833116",
  mb: "28392036",
  bank: "Erste Bank A.D. Novi Sad",
  account: "340-0001000228996-85",
  // račun u 18-cifrenom obliku za IPS QR (bez crtica, sredina dopunjena nulama)
  accountIps: "340000100022899685",
} as const;

export const PLANS = {
  monthly: { label: "Mesečna članarina", amount: 1990, months: 1 },
  yearly: { label: "Godišnja članarina", amount: 19900, months: 12 },
} as const;

export type PlanId = keyof typeof PLANS;

export function formatAmount(n: number): string {
  return n.toLocaleString("sr-RS", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// NBS IPS QR payload: K:PR|V:01|C:1|R:{račun}|N:{naziv}|I:RSD{iznos}|SF:{šifra}|S:{svrha}|RO:{poziv na broj}
export function buildIpsQr(input: {
  amount: number;
  invoiceNumber: number;
  invoiceYear: number;
}): string {
  const amount = input.amount.toFixed(2).replace(".", ",");
  // poziv na broj: model 00 + godina + redni broj (npr. 002026007)
  const ro = `00${input.invoiceYear}${String(input.invoiceNumber).padStart(3, "0")}`;
  return [
    "K:PR",
    "V:01",
    "C:1",
    `R:${ISSUER.accountIps}`,
    `N:${ISSUER.name}, ${ISSUER.address}, Niš`,
    `I:RSD${amount}`,
    "SF:289",
    "S:Terminer članarina",
    `RO:${ro}`,
  ].join("|");
}

export function invoiceLabel(inv: { number: number; year: number }): string {
  return `${inv.number}/${inv.year}`;
}

// Dodaje mesece na YYYY-MM-DD uz klamp na poslednji dan ciljanog meseca:
// 31.1. + 1 mesec = 28.2, ne 3.3. (podne izbegava DST rubove)
export function addMonths(dateStr: string, months: number): string {
  const d = new Date(`${dateStr}T12:00:00`);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, lastDay));
  return d.toISOString().slice(0, 10);
}

// Period nove fakture: počinje danas, ili dan posle postojećeg isteka ako
// je pretplata još plaćena - periodi se lančano nastavljaju bez rupa.
export function invoicePeriod(
  paidUntil: string | null,
  months: number,
  today: string
): { from: string; to: string } {
  const from =
    paidUntil && paidUntil >= today
      ? new Date(new Date(`${paidUntil}T12:00:00`).getTime() + 86400000)
          .toISOString()
          .slice(0, 10)
      : today;
  return { from, to: addMonths(from, months) };
}

// Vraćanje pogrešno naplaćene fakture u "na čekanju": paid_until se dira
// SAMO ako ga je upravo ta faktura postavila (current == njen period_to) -
// tada pada na najkasniji period_to preostalih plaćenih faktura (ili null).
// Ručne korekcije i produžetci bez fakture se ne pregaze.
export function revertedPaidUntil(
  current: string | null,
  revertedPeriodTo: string,
  otherPaidPeriodTos: string[]
): { change: boolean; value: string | null } {
  if (current !== revertedPeriodTo) return { change: false, value: current };
  const latest = otherPaidPeriodTos.reduce<string | null>(
    (max, d) => (max === null || d > max ? d : max),
    null
  );
  return { change: true, value: latest };
}

export type InvoiceStatus = "issued" | "paid" | "cancelled";

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  issued: "Na čekanju",
  paid: "Plaćena",
  cancelled: "Stornirana",
};

export interface Invoice {
  id: string;
  // null = salon obrisan; faktura kao finansijski zapis ostaje (migracija
  // 20260712000001), tenant_label čuva ime salona za prikaz
  tenant_id: string | null;
  tenant_label?: string | null;
  number: number;
  year: number;
  plan: PlanId;
  amount: number;
  period_from: string;
  period_to: string;
  buyer_info: string | null;
  status: InvoiceStatus;
  paid_at: string | null;
  created_at: string;
}
