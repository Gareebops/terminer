"use client";

import { useEffect, useRef } from "react";
import { animate, useReducedMotion } from "motion/react";

// Broj koji se "izbroji" do vrednosti pri učitavanju (statistika na Početnoj).
// Uz prefers-reduced-motion prikazuje se odmah konačna vrednost.
export function CountUp({
  value,
  suffix = "",
}: {
  value: number;
  suffix?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const format = (v: number) => `${Math.round(v).toLocaleString("sr-RS")}${suffix}`;
    if (reduce || value === 0) {
      el.textContent = format(value);
      return;
    }
    const controls = animate(0, value, {
      duration: 0.7,
      ease: "easeOut",
      onUpdate: (v) => {
        el.textContent = format(v);
      },
    });
    return () => controls.stop();
  }, [value, suffix, reduce]);

  // Početni sadržaj = konačna vrednost (SSR i no-JS ostaju tačni)
  return <span ref={ref}>{`${value.toLocaleString("sr-RS")}${suffix}`}</span>;
}
