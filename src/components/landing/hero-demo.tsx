"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Check } from "lucide-react";
import { datumSr } from "@/lib/datum";

// Samoodigravajuća demonstracija booking flowa u telefon okviru.
// Faze: usluga → frizer → termin → uspeh, pa petlja ispočetka.

const PHASES = [
  { key: "usluga", dur: 2300, tapAt: 1400 },
  { key: "frizer", dur: 2000, tapAt: 1200 },
  { key: "termin", dur: 2600, tapAt: 1700 },
  { key: "uspeh", dur: 3000, tapAt: null },
] as const;

const SERVICES = [
  { name: "Fade", meta: "40 min", price: "900" },
  { name: "Muško šišanje", meta: "30 min", price: "700" },
  { name: "Šišanje + brada", meta: "45 min", price: "1.000" },
];

const STAFF = [
  { name: "Đorđe", bio: "Majstor za fade" },
  { name: "Marko", bio: "Specijalista za bradu" },
];

const SLOTS = ["10:00", "10:30", "11:00", "12:00", "12:30", "13:00"];

// Sledeći petak (nikad današnji) - fiktivni demo, ali datum u prošlosti
// bi delovao zapušteno. sr-Latn-RS daje "10. jul" oblik.
function nextFridayLabel(): string {
  const d = new Date();
  d.setDate(d.getDate() + (((5 - d.getDay() + 7) % 7) || 7));
  return `Petak, ${datumSr(d, { day: "numeric", month: "long" })}`;
}

const listStagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09 } },
};
const listItem = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

function Tap({ children, active }: { children: React.ReactNode; active: boolean }) {
  return (
    <motion.div animate={active ? { scale: [1, 0.95, 1] } : {}} transition={{ duration: 0.35 }}>
      {children}
    </motion.div>
  );
}

function PhoneScreen({ phase, tapped }: { phase: number; tapped: boolean }) {
  return (
    <div className="flex h-full flex-col px-4 pb-4 pt-3">
      {/* Mini zaglavlje salona */}
      <div className="mb-3 flex items-center gap-2">
        <span className="flex size-6 items-center justify-center rounded-lg bg-ink text-[10px] font-bold text-white">
          S
        </span>
        <span className="text-xs font-bold">Salon Studio</span>
        <span className="ml-auto size-2 rounded-full bg-mint-strong" />
      </div>

      <div className="relative flex-1">
        <AnimatePresence mode="wait">
          {phase === 0 && (
            <motion.div
              key="usluga"
              className="space-y-1.5"
              variants={listStagger}
              initial="hidden"
              animate="show"
              exit={{ opacity: 0, x: -16, transition: { duration: 0.18 } }}
            >
              <p className="text-[10px] font-bold uppercase tracking-wider text-ink/70">
                Izaberi uslugu
              </p>
              {SERVICES.map((s, i) => (
                <motion.div key={s.name} variants={listItem}>
                  <Tap active={tapped && i === 0}>
                    <div
                      className={`flex items-center justify-between rounded-xl border px-3 py-2 transition-colors duration-300 ${
                        tapped && i === 0
                          ? "border-ink bg-ink text-white"
                          : "border-ink/10 bg-white"
                      }`}
                    >
                      <div>
                        <p className="text-xs font-bold">{s.name}</p>
                        <p className={`text-[10px] ${tapped && i === 0 ? "text-white/60" : "text-ink/45"}`}>
                          {s.meta}
                        </p>
                      </div>
                      <span className="text-xs font-bold">{s.price} RSD</span>
                    </div>
                  </Tap>
                </motion.div>
              ))}
            </motion.div>
          )}

          {phase === 1 && (
            <motion.div
              key="frizer"
              className="space-y-1.5"
              variants={listStagger}
              initial="hidden"
              animate="show"
              exit={{ opacity: 0, x: -16, transition: { duration: 0.18 } }}
            >
              <p className="text-[10px] font-bold uppercase tracking-wider text-ink/70">
                Kod koga
              </p>
              {STAFF.map((m, i) => (
                <motion.div key={m.name} variants={listItem}>
                  <Tap active={tapped && i === 0}>
                    <div
                      className={`flex items-center gap-2.5 rounded-xl border px-3 py-2 transition-colors duration-300 ${
                        tapped && i === 0
                          ? "border-ink bg-ink text-white"
                          : "border-ink/10 bg-white"
                      }`}
                    >
                      <span
                        className={`flex size-7 items-center justify-center rounded-full text-[10px] font-bold ${
                          tapped && i === 0 ? "bg-mint text-ink" : "bg-ink/5"
                        }`}
                      >
                        {m.name.charAt(0)}
                      </span>
                      <div>
                        <p className="text-xs font-bold">{m.name}</p>
                        <p className={`text-[10px] ${tapped && i === 0 ? "text-white/60" : "text-ink/45"}`}>
                          {m.bio}
                        </p>
                      </div>
                    </div>
                  </Tap>
                </motion.div>
              ))}
            </motion.div>
          )}

          {phase === 2 && (
            <motion.div
              key="termin"
              variants={listStagger}
              initial="hidden"
              animate="show"
              exit={{ opacity: 0, x: -16, transition: { duration: 0.18 } }}
            >
              {/* suppressHydrationWarning: oko ponoći se server i klijent
                  mogu razići za dan - nebitno za fiktivni demo */}
              <p
                suppressHydrationWarning
                className="text-[10px] font-bold uppercase tracking-wider text-ink/70"
              >
                {nextFridayLabel()}
              </p>
              <motion.div variants={listItem} className="mt-1.5 flex gap-1.5">
                {["Danas", "Sutra", "Pet", "Sub"].map((d, i) => (
                  <span
                    key={d}
                    className={`rounded-lg px-2.5 py-1 text-[10px] font-bold ${
                      i === 2 ? "bg-ink text-white" : "bg-ink/5 text-ink/70"
                    }`}
                  >
                    {d}
                  </span>
                ))}
              </motion.div>
              <div className="mt-2 grid grid-cols-3 gap-1.5">
                {SLOTS.map((s, i) => (
                  <motion.div key={s} variants={listItem}>
                    <Tap active={tapped && i === 3}>
                      <div
                        className={`rounded-lg border py-1.5 text-center text-[11px] font-bold transition-colors duration-300 ${
                          tapped && i === 3
                            ? "border-ink bg-ink text-white"
                            : "border-ink/10 bg-white"
                        }`}
                      >
                        {s}
                      </div>
                    </Tap>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {phase === 3 && (
            <motion.div
              key="uspeh"
              className="flex h-full flex-col items-center justify-center pb-6 text-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.18 } }}
            >
              <motion.span
                className="flex size-14 items-center justify-center rounded-full bg-mint text-ink"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 260, damping: 15, delay: 0.1 }}
              >
                <Check className="size-7" strokeWidth={3} />
              </motion.span>
              {/* konfete */}
              {[...Array(6)].map((_, i) => (
                <motion.span
                  key={i}
                  className={`absolute size-1.5 rounded-full ${i % 2 === 0 ? "bg-mint-strong" : "bg-lavender-strong"}`}
                  style={{ left: `${28 + i * 9}%`, top: "38%" }}
                  initial={{ opacity: 0, y: 0 }}
                  animate={{ opacity: [0, 1, 0], y: [-4, -26 - (i % 3) * 8] }}
                  transition={{ duration: 0.9, delay: 0.25 + i * 0.05 }}
                />
              ))}
              <motion.p
                className="mt-3 text-sm font-extrabold"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                Termin zakazan!
              </motion.p>
              <motion.p
                className="mt-0.5 text-[11px] text-ink/70"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.45 }}
              >
                Fade kod Đorđa · petak u 12:00
              </motion.p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Progres tačkice */}
      <div className="flex justify-center gap-1.5 pt-2">
        {PHASES.map((p, i) => (
          <span
            key={p.key}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i === phase ? "w-5 bg-ink" : "w-1.5 bg-ink/15"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

// Plutajuće notifikacije oko telefona
function FloatingCards() {
  return (
    <>
      <motion.div
        className="absolute -left-4 top-14 z-10 hidden rounded-2xl bg-white px-4 py-3 shadow-[0_8px_32px_rgba(20,25,20,0.14)] sm:block lg:-left-16"
        animate={{ opacity: [0, 1, 1, 0], y: [12, 0, 0, -8] }}
        transition={{ duration: 5, times: [0, 0.12, 0.85, 1], repeat: Infinity, repeatDelay: 3 }}
      >
        <p className="text-[10px] font-bold uppercase tracking-wider text-ink/70">
          Nova rezervacija
        </p>
        <p className="mt-0.5 text-sm font-bold text-ink">Ana M. · sutra 14:30</p>
      </motion.div>

      <motion.div
        className="absolute -right-2 top-40 z-10 hidden items-center gap-2 rounded-full bg-mint px-4 py-2 shadow-[0_8px_32px_rgba(20,25,20,0.14)] sm:flex lg:-right-10"
        animate={{ opacity: [0, 1, 1, 0], y: [12, 0, 0, -8] }}
        transition={{
          duration: 5,
          times: [0, 0.12, 0.85, 1],
          repeat: Infinity,
          repeatDelay: 3,
          delay: 2.6,
        }}
      >
        <span className="text-sm font-extrabold text-ink">+38%</span>
        <span className="text-xs font-semibold text-ink/70">više termina</span>
      </motion.div>

      <motion.div
        className="absolute -left-2 bottom-16 z-10 hidden rounded-full bg-lavender px-4 py-2 shadow-[0_8px_32px_rgba(20,25,20,0.14)] sm:block lg:-left-12"
        animate={{ opacity: [0, 1, 1, 0], y: [12, 0, 0, -8] }}
        transition={{
          duration: 5,
          times: [0, 0.12, 0.85, 1],
          repeat: Infinity,
          repeatDelay: 3,
          delay: 5.2,
        }}
      >
        <p className="text-xs font-bold text-ink">Bez propuštenih poziva ✂️</p>
      </motion.div>
    </>
  );
}

// compact: samo telefon, bez sjaja i plutajućih kartica (za welcome dijalog u adminu)
export function HeroDemo({ compact = false }: { compact?: boolean }) {
  const reduce = useReducedMotion();
  const [phase, setPhase] = useState(0);
  const [tapped, setTapped] = useState(false);

  useEffect(() => {
    if (reduce) return;
    const cfg = PHASES[phase];
    const timers: ReturnType<typeof setTimeout>[] = [];
    if (cfg.tapAt !== null) {
      timers.push(setTimeout(() => setTapped(true), cfg.tapAt));
    }
    // Reset tap-a ide u isti timer koji menja fazu: React batchuje oba
    // setState-a u jedan render, pa nova faza uvek kreće bez tap markera.
    timers.push(
      setTimeout(() => {
        setTapped(false);
        setPhase((phase + 1) % PHASES.length);
      }, cfg.dur)
    );
    return () => timers.forEach(clearTimeout);
  }, [phase, reduce]);

  return (
    <div className="relative mx-auto w-fit">
      {/* Mekani sjaj iza telefona */}
      {!compact && (
        <div className="absolute left-1/2 top-1/2 -z-0 size-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-mint/25 blur-3xl" />
      )}

      {!reduce && !compact && <FloatingCards />}

      {/* Telefon */}
      <div className="relative z-[1] h-[420px] w-[230px] rounded-[2.2rem] bg-ink p-2 shadow-[0_24px_64px_rgba(20,25,20,0.35)]">
        <div className="relative h-full overflow-hidden rounded-[1.7rem] bg-surface-light font-display text-ink">
          {/* notch */}
          <div className="absolute left-1/2 top-1.5 z-10 h-1.5 w-14 -translate-x-1/2 rounded-full bg-ink/15" />
          <div className="h-full pt-4">
            {reduce ? (
              <PhoneScreen phase={3} tapped={false} />
            ) : (
              <PhoneScreen phase={phase} tapped={tapped} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
