// Fakture za Terminer članarine — izdavalac Čvorište.
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

export interface Invoice {
  id: string;
  tenant_id: string;
  number: number;
  year: number;
  plan: PlanId;
  amount: number;
  period_from: string;
  period_to: string;
  buyer_info: string | null;
  created_at: string;
}
