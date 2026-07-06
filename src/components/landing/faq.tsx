"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { FAQ_ITEMS } from "./faq-items";

export function FaqAccordion() {
  // Jedno otvoreno pitanje; prvo je otvoreno da sekcija ne deluje "zaključano"
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="mx-auto max-w-3xl space-y-3">
      {FAQ_ITEMS.map((item, i) => {
        const isOpen = open === i;
        return (
          <div
            key={item.q}
            className="rounded-3xl bg-white shadow-[0_4px_24px_rgba(20,25,20,0.06)]"
          >
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : i)}
              aria-expanded={isOpen}
              className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
            >
              <span className="font-bold tracking-tight">{item.q}</span>
              <span
                className={`flex size-8 shrink-0 items-center justify-center rounded-full transition-all duration-300 ${
                  isOpen ? "rotate-45 bg-ink text-white" : "bg-ink/[0.06] text-ink"
                }`}
              >
                <Plus className="size-4" />
              </span>
            </button>
            {/* grid-rows trik: glatka animacija visine bez merenja u JS-u */}
            <div
              className={`grid transition-[grid-template-rows] duration-300 ease-out ${
                isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
              }`}
            >
              <div className="overflow-hidden">
                <p className="px-6 pb-5 text-sm font-medium leading-relaxed text-ink/60">
                  {item.a}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
