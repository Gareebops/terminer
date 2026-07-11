"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";

// Skok na proizvoljan datum - strelice dan-po-dan su spore za "vidi
// sledeći petak". Native date picker: nula zavisnosti, na telefonu
// otvara sistemski točkić.
export function DateJump({ day }: { day: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="icon"
        aria-label="Izaberi datum iz kalendara"
        title="Izaberi datum iz kalendara"
        onClick={() => {
          const el = inputRef.current;
          if (!el) return;
          if ("showPicker" in el) el.showPicker();
          else (el as HTMLInputElement).focus();
        }}
      >
        <CalendarDays className="size-4" />
      </Button>
      <input
        ref={inputRef}
        type="date"
        value={day}
        tabIndex={-1}
        aria-hidden
        className="pointer-events-none absolute inset-0 h-full w-full opacity-0"
        onChange={(e) => {
          if (e.target.value) router.push(`/admin/kalendar?dan=${e.target.value}`);
        }}
      />
    </div>
  );
}
