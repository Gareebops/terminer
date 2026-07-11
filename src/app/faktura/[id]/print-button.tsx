"use client";

import { Printer } from "@/components/icons";

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-85"
    >
      <Printer className="size-4" />
      Štampaj / Sačuvaj PDF
    </button>
  );
}
