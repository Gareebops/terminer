// Labele i stilovi statusa rezervacije - deli ih tabela Rezervacija i
// dijalog termina u Kalendaru.
import type { BookingStatus } from "@/lib/types";

export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  pending: "Na čekanju",
  confirmed: "Potvrđeno",
  cancelled: "Otkazano",
  completed: "Završeno",
  no_show: "Nije došao",
};

export const BOOKING_STATUS_STYLES: Record<BookingStatus, string> = {
  pending: "bg-ink/5 text-ink",
  confirmed: "bg-mint text-ink",
  cancelled: "bg-red-100 text-red-900",
  completed: "bg-lavender text-ink",
  no_show: "bg-red-100 text-red-900",
};
