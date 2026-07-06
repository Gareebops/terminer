// Labele i boje statusa — preslikano iz web verzije (src/lib/booking/status.ts)
// da mobilna i web app pričaju istim jezikom.
import { Colors } from "@/constants/theme";
import type { BookingStatus } from "./types";

export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  pending: "Na čekanju",
  confirmed: "Potvrđeno",
  cancelled: "Otkazano",
  completed: "Završeno",
  no_show: "Nije došao",
};

export const BOOKING_STATUS_COLORS: Record<
  BookingStatus,
  { bg: string; text: string }
> = {
  pending: { bg: "rgba(23, 24, 26, 0.05)", text: Colors.ink },
  confirmed: { bg: Colors.mint, text: Colors.ink },
  cancelled: { bg: "#FEE2E2", text: "#7F1D1D" },
  completed: { bg: Colors.lavender, text: Colors.ink },
  no_show: { bg: "#FEE2E2", text: "#7F1D1D" },
};
