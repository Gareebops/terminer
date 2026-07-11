"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { CalendarDays, CalendarPlus, Check, Clock, Copy, Users } from "lucide-react";
import { ConfettiBurst } from "@/components/confetti";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  createBooking,
  getAvailableSlots,
  type DayAvailability,
} from "@/lib/booking/actions";
import { buildICS, downloadICS } from "@/lib/booking/ics";
import {
  addDaysISO,
  bookingHorizonDays,
  DEFAULT_HORIZON_DAYS,
} from "@/lib/booking/schedule";
import { formatPriceRange, DAY_NAMES_SR } from "@/lib/booking/slots";
import { datumSr } from "@/lib/datum";
import type { Service, Staff } from "@/lib/types";

interface Props {
  slug: string;
  salonName: string;
  address?: string | null;
  // Telefon salona - na ekranu uspeha kao alternativa linku za otkazivanje
  salonPhone?: string | null;
  // Današnji datum U ZONI SALONA (server prop) - browser klijenta iz druge
  // vremenske zone bi "Danas" izračunao pogrešno
  todayISO: string;
  services: Service[];
  staff: Staff[];
  staffServices: { staff_id: string; service_id: string }[];
}

type Step = 0 | 1 | 2 | 3;
// "Kod koga" umesto "Frizer": platforma služi i kozmetičkim i masažnim
// studijima, gde "frizer" ne odgovara
const STEP_LABELS = ["Usluga", "Kod koga", "Termin", "Podaci"];

function StepIndicator({
  step,
  done,
  onStepClick,
}: {
  step: Step;
  done: boolean;
  // Klik na već pređeni korak vraća nazad (undefined = nije klikabilno)
  onStepClick?: (step: Step) => void;
}) {
  return (
    <ol aria-label="Koraci zakazivanja" className="flex items-center gap-1 sm:gap-2">
      {STEP_LABELS.map((label, i) => {
        const isDone = done || i < step;
        const isCurrent = !done && i === step;
        const clickable = !done && i < step && !!onStepClick;
        const circle = (
          <span
            className={`flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
              isDone
                ? "bg-primary text-primary-foreground"
                : isCurrent
                  ? "border-2 border-primary text-primary"
                  : "border text-muted-foreground"
            }`}
          >
            {isDone ? <Check className="size-3.5" /> : i + 1}
          </span>
        );
        return (
          <li
            key={label}
            aria-current={isCurrent ? "step" : undefined}
            className="flex flex-1 items-center gap-1 sm:gap-2"
          >
            {clickable ? (
              <button
                type="button"
                onClick={() => onStepClick(i as Step)}
                title={`Nazad na korak: ${label}`}
                className="-m-1.5 cursor-pointer p-1.5 transition-opacity hover:opacity-75"
              >
                {circle}
              </button>
            ) : (
              circle
            )}
            <span
              className={`hidden text-xs sm:block ${isCurrent ? "font-semibold" : "text-muted-foreground"}`}
            >
              {label}
            </span>
            {i < STEP_LABELS.length - 1 && (
              <span className="h-px flex-1 bg-border" aria-hidden />
            )}
          </li>
        );
      })}
    </ol>
  );
}

// Dugme sa skrivenim native date inputom: skok na datum bez listanja
// trake (kod horizonta od 60+ dana listanje je mučenje, na telefonu
// native picker radi najbolje)
function JumpToDate({
  min,
  max,
  onPick,
}: {
  min: string;
  max: string;
  onPick: (date: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="relative shrink-0">
      <button
        type="button"
        aria-label="Izaberi datum iz kalendara"
        title="Izaberi datum iz kalendara"
        onClick={() => {
          const el = inputRef.current;
          if (!el) return;
          // showPicker traži korisnički gest - klik na dugme jeste
          if ("showPicker" in el) el.showPicker();
          else (el as HTMLInputElement).focus();
        }}
        className="flex h-full min-h-16 w-12 flex-col items-center justify-center rounded-[var(--surface-radius)] border transition-colors hover:bg-accent"
      >
        <CalendarDays className="size-5" />
      </button>
      <input
        ref={inputRef}
        type="date"
        min={min}
        max={max}
        tabIndex={-1}
        aria-hidden
        className="pointer-events-none absolute inset-0 h-full w-full opacity-0"
        onChange={(e) => {
          if (e.target.value >= min && e.target.value <= max) onPick(e.target.value);
        }}
      />
    </div>
  );
}

// Traka narednih dana - brže od punog kalendara. Broj dana = horizont
// zakazivanja izabrane osobe (server sprovodi istu granicu); neradni dani
// su prigušeni i neklikabilni čim server javi dostupnost.
function DayStrip({
  todayISO,
  count,
  selected,
  openByDate,
  onSelect,
}: {
  todayISO: string;
  count: number;
  selected: string | null;
  // null = dostupnost se još učitava (svi dani izgledaju obično)
  openByDate: Map<string, boolean> | null;
  onSelect: (date: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const days = useMemo(() => {
    const out: { iso: string; dayName: string; label: string }[] = [];
    for (let i = 0; i < count; i++) {
      const iso = addDaysISO(todayISO, i);
      const d = new Date(`${iso}T12:00:00`);
      out.push({
        iso,
        dayName:
          i === 0 ? "Danas" : i === 1 ? "Sutra" : DAY_NAMES_SR[d.getDay()].slice(0, 3),
        label: `${d.getDate()}.${d.getMonth() + 1}.`,
      });
    }
    return out;
  }, [count, todayISO]);

  // Izabrani dan uvek u vidokrugu - bitno posle skoka kroz mini-kalendar
  useEffect(() => {
    if (!selected) return;
    containerRef.current
      ?.querySelector(`[data-date="${selected}"]`)
      ?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [selected]);

  return (
    <div className="flex gap-2">
      <JumpToDate
        min={todayISO}
        max={addDaysISO(todayISO, count - 1)}
        onPick={onSelect}
      />
      <div ref={containerRef} className="scrollbar-none flex gap-2 overflow-x-auto pb-2">
        {days.map((d) => {
          const closed = openByDate ? openByDate.get(d.iso) === false : false;
          return (
            <button
              key={d.iso}
              data-date={d.iso}
              aria-pressed={selected === d.iso}
              disabled={closed}
              title={closed ? "Ne radi" : undefined}
              onClick={() => onSelect(d.iso)}
              className={`flex min-w-16 shrink-0 flex-col items-center rounded-[var(--surface-radius)] border px-3 py-2 text-sm transition-colors ${
                selected === d.iso
                  ? "border-primary bg-primary text-primary-foreground"
                  : closed
                    ? "cursor-not-allowed opacity-40"
                    : "hover:bg-accent"
              }`}
            >
              <span className={`text-xs opacity-80 ${closed ? "line-through" : ""}`}>
                {d.dayName}
              </span>
              <span className={`font-semibold ${closed ? "line-through" : ""}`}>
                {d.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Smer prati kretanje kroz tok: napred = sadržaj ulazi zdesna,
// nazad = sleva. custom prop stiže i do exit animacije kroz AnimatePresence.
const paneVariants = {
  enter: (dir: 1 | -1) => ({ opacity: 0, x: 28 * dir }),
  center: { opacity: 1, x: 0 },
  exit: (dir: 1 | -1) => ({ opacity: 0, x: -28 * dir }),
};

function StepPane({
  stepKey,
  direction,
  children,
}: {
  stepKey: string;
  direction: 1 | -1;
  children: React.ReactNode;
}) {
  const reduce = useReducedMotion();
  if (reduce) return <div>{children}</div>;
  return (
    <AnimatePresence mode="wait" custom={direction}>
      <motion.div
        key={stepKey}
        custom={direction}
        variants={paneVariants}
        initial="enter"
        animate="center"
        exit="exit"
        transition={{ duration: 0.22, ease: "easeOut" }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

// Čip u živom rezimeu: uskoči spring animacijom kad izbor legne;
// promena vrednosti (drugi key) ponovi ulazak
function SummaryChip({
  children,
  accent = false,
}: {
  children: React.ReactNode;
  accent?: boolean;
}) {
  const reduce = useReducedMotion();
  // max-w-full + truncate: predugačak naziv usluge se seče elipsom umesto
  // da pilula iscuri van ekrana (pun naziv je vidljiv na koraku izbora)
  const cls = accent
    ? "max-w-full truncate rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary"
    : "max-w-full truncate rounded-full border px-3 py-1 text-sm text-muted-foreground";
  if (reduce) return <span className={cls}>{children}</span>;
  return (
    <motion.span
      layout
      className={cls}
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 420, damping: 26 }}
    >
      {children}
    </motion.span>
  );
}

export function BookingWizard({
  slug,
  salonName,
  address,
  salonPhone,
  todayISO,
  services,
  staff,
  staffServices,
}: Props) {
  const reduce = useReducedMotion();
  const [step, setStep] = useState<Step>(0);
  // Smer poslednje promene koraka - StepPane klizi u pravom pravcu
  const [direction, setDirection] = useState<1 | -1>(1);
  const [done, setDone] = useState(false);
  const [service, setService] = useState<Service | null>(null);
  const [member, setMember] = useState<Staff | null>(null);
  // "Svejedno mi je": server bira među svima koji rade uslugu
  const [anyStaff, setAnyStaff] = useState(false);
  // Današnji dan preselektovan (datum salona stiže kao prop, pa se SSR i
  // klijent slažu) - korak "Termin" odmah nudi slotove
  const [date, setDate] = useState<string | null>(todayISO);
  const [slots, setSlots] = useState<string[] | null>(null);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  // Radni/neradni dani horizonta - stižu uz prvi upit slotova po osobi
  const [days, setDays] = useState<DayAvailability | null>(null);
  const daysKeyRef = useRef<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  // Inline greške koraka "Podaci" - dugme je uvek aktivno, a poruka kaže
  // ŠTA fali (sivo dugme bez objašnjenja ubija konverziju)
  const [fieldErrors, setFieldErrors] = useState<{
    name?: string;
    phone?: string;
    email?: string;
  }>({});
  // Honeypot: pravi korisnik ga ne vidi ni ne popunjava; bot koji ga
  // popuni biva odbijen na serveru
  const [website, setWebsite] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  // Rezultat uspešnog bookinga: dodeljena osoba (bitno kod "svejedno") i
  // token za link otkazivanja na ekranu uspeha
  const [result, setResult] = useState<{ cancelToken: string; staffName: string } | null>(null);
  const [cancelCopied, setCancelCopied] = useState(false);
  // Korak "Kod koga" je preskočen (uslugu radi samo jedan) - "Nazad" sa
  // termina tada vodi pravo na usluge
  const [staffSkipped, setStaffSkipped] = useState(false);
  const [pending, startTransition] = useTransition();

  // Svaka promena koraka ide i u browser istoriju: sistemsko "nazad" na
  // telefonu vraća na prethodni korak umesto da izbaci iz celog toka.
  // Korak se čuva u history STATE OBJEKTU (bez promene URL-a): promena
  // searchParams kroz pushState okida Next router re-render koji zamrzne
  // izlaznu animaciju StepPane (AnimatePresence mode="wait" nikad ne
  // montira novi korak). Nextov interni state se čuva kroz spread.
  function go(target: Step, fromHistory = false) {
    setDirection(target > step ? 1 : -1);
    setStep(target);
    if (!fromHistory && typeof window !== "undefined") {
      window.history.pushState({ ...window.history.state, korak: target }, "");
    }
  }

  useEffect(() => {
    // Ulazna stranica wizarda = korak 0, da "nazad" sa koraka 1 ima metu
    window.history.replaceState({ ...window.history.state, korak: 0 }, "");
  }, []);

  useEffect(() => {
    const onPop = (e: PopStateEvent) => {
      // Posle uspešnog zakazivanja ulaznica ostaje - forma se ne vraća
      if (done) return;
      const k = (e.state as { korak?: number } | null)?.korak;
      const target = Math.min(3, Math.max(0, Number(k ?? 0) || 0)) as Step;
      if (target !== step) {
        setDirection(target > step ? 1 : -1);
        setStep(target);
      }
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [step, done]);

  const availableStaff = useMemo(() => {
    if (!service) return [];
    const ids = new Set(
      staffServices.filter((x) => x.service_id === service.id).map((x) => x.staff_id)
    );
    return staff.filter((s) => ids.has(s.id));
  }, [service, staff, staffServices]);

  // Ključ izbora osobe za upite ("any" = svejedno)
  const staffKey = anyStaff ? "any" : (member?.id ?? null);

  // Promena izbora poništava stare slotove odmah tokom rendera (React
  // obrazac "adjusting state during render" sa poređenjem prethodnog
  // ključa) - nema međukadra sa terminima starog izbora, a effect ispod
  // ostaje samo za mrežni poziv
  const selectionKey = `${slug}|${service?.id ?? ""}|${staffKey ?? ""}|${date ?? ""}`;
  const [prevSelectionKey, setPrevSelectionKey] = useState(selectionKey);
  if (prevSelectionKey !== selectionKey) {
    setPrevSelectionKey(selectionKey);
    setSlots(null);
    setTime(null);
    setSlotsError(null);
  }

  useEffect(() => {
    if (!service || !staffKey || !date) return;
    // Brzo preklikavanje dana: odgovor za stari dan sme da stigne posle
    // novog - zastareli rezultat se ignoriše da ne prikaže pogrešne termine
    let active = true;
    getAvailableSlots({
      slug,
      staffId: staffKey,
      serviceId: service.id,
      date,
      // Dostupnost dana se traži jednom po osobi, uz prvi upit slotova
      includeDays: daysKeyRef.current !== staffKey,
    }).then((res) => {
      if (!active) return;
      if ("error" in res) {
        // Trajna poruka umesto toasta - "nema termina" bi bilo obmanjujuće
        // kad je zakazivanje pauzirano ili salon nedostupan
        setSlotsError(res.error);
        setSlots([]);
      } else {
        setSlots(res.slots);
        if (res.days) {
          setDays(res.days);
          daysKeyRef.current = staffKey;
        }
      }
    });
    return () => {
      active = false;
    };
  }, [slug, service, staffKey, date]);

  // Ako je preselektovani dan neradan (npr. danas je nedelja), sam pređi
  // na prvi radni - klijent ne treba da pogađa kad salon radi. Podešavanje
  // tokom rendera umesto effect-a: skok na prvi radni dan odmah, bez
  // međukadra sa neradnim danom (setDate prebacuje na radni dan, pa se
  // uslov u sledećem prolazu više ne pali)
  if (days && date) {
    const current = days.find((d) => d.date === date);
    if (current && !current.open) {
      const firstOpen = days.find((d) => d.open);
      if (firstOpen && firstOpen.date !== date) setDate(firstOpen.date);
    }
  }

  const openByDate = useMemo(
    () => (days ? new Map(days.map((d) => [d.date, d.open])) : null),
    [days]
  );

  // Prvi sledeći radni dan posle izabranog - prečica kad je dan pun/prazan,
  // umesto da klijent ručno preklikava dane
  const nextOpenDay = useMemo(() => {
    if (!days || !date) return null;
    return days.find((d) => d.date > date && d.open) ?? null;
  }, [days, date]);

  function pickService(s: Service) {
    setService(s);
    const ids = new Set(
      staffServices.filter((x) => x.service_id === s.id).map((x) => x.staff_id)
    );
    const eligible = staff.filter((m) => ids.has(m.id));
    // Jedini koji radi uslugu se bira sam - korak "Kod koga" se preskače
    if (eligible.length === 1) {
      setMember(eligible[0]);
      setAnyStaff(false);
      setDays(null);
      setStaffSkipped(true);
      go(2);
    } else {
      setMember(null);
      setAnyStaff(false);
      setDays(null);
      setStaffSkipped(false);
      go(1);
    }
  }

  function pickMember(m: Staff | null) {
    setMember(m);
    setAnyStaff(m === null);
    setDays(null);
    go(2);
  }

  // Klik na pređeni korak u indikatoru: preskočen korak "Kod koga" vodi na usluge
  function jumpToStep(target: Step) {
    if (target === 1 && staffSkipped) {
      go(0);
      return;
    }
    go(target);
  }

  function submit() {
    if (!service || (!member && !anyStaff) || !date || !time) return;
    const errs: typeof fieldErrors = {};
    if (name.trim().length < 2) errs.name = "Upiši ime i prezime.";
    if (phone.trim().length < 6) errs.phone = "Upiši broj telefona.";
    if (email.trim() && !/^\S+@\S+\.\S+$/.test(email.trim())) {
      errs.email = "Email adresa ne izgleda ispravno.";
    }
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) return;
    startTransition(async () => {
      const res = await createBooking({
        slug,
        staffId: anyStaff ? "any" : member!.id,
        serviceId: service.id,
        date,
        time,
        customerName: name,
        customerPhone: phone,
        customerEmail: email,
        note,
        website,
      });
      if (res.ok) {
        setEmailSent(res.emailSent);
        setResult({ cancelToken: res.cancelToken, staffName: res.staffName });
        setDone(true);
      } else {
        toast.error(res.error);
        if (res.error.includes("zauzet")) {
          setTime(null);
          setSlots(null);
          const r = await getAvailableSlots({
            slug,
            staffId: anyStaff ? "any" : member!.id,
            serviceId: service.id,
            date,
          });
          setSlots("error" in r ? [] : r.slots);
          go(2);
        }
      }
    });
  }

  function endTimeFor(start: string): string {
    const [h, m] = start.split(":").map(Number);
    const total = h * 60 + m + (service?.duration_minutes ?? 30);
    return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
  }

  const dateLabel = date
    ? `${DAY_NAMES_SR[new Date(`${date}T12:00:00`).getDay()]}, ${datumSr(date)}`
    : "";

  const horizonCount = days
    ? days.length
    : anyStaff
      ? Math.max(DEFAULT_HORIZON_DAYS, ...availableStaff.map(bookingHorizonDays))
      : member
        ? bookingHorizonDays(member)
        : DEFAULT_HORIZON_DAYS;

  if (done && service && result && date && time) {
    const cancelUrl = `${window.location.origin}/${slug}/otkazivanje/${result.cancelToken}`;
    const copyCancelUrl = async () => {
      try {
        await navigator.clipboard.writeText(cancelUrl);
        setCancelCopied(true);
        setTimeout(() => setCancelCopied(false), 2000);
      } catch {
        toast.error("Kopiranje nije uspelo.");
      }
    };
    const details = [
      { k: "Usluga", v: service.name },
      { k: "Kod koga", v: result.staffName },
      { k: "Termin", v: `${dateLabel} u ${time}` },
      { k: "Cena", v: formatPriceRange(service.price, service.price_max, service.currency) },
    ];
    return (
      <>
        {/* Mala proslava - klijent ovo pamti (poštuje reduced-motion).
            Van motion wrappera: fixed pozicija bi se vezala za transform. */}
        <ConfettiBurst />
        <motion.div
          initial={reduce ? false : { opacity: 0, y: -32, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 220, damping: 22 }}
        >
          {/* "Ulaznica": perforacija deli proslavu od detalja termina */}
          <Card className="relative overflow-hidden">
            <CardContent className="pt-10 pb-2 text-center">
              {reduce ? (
                <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Check className="size-8" />
                </span>
              ) : (
                <motion.span
                  className="mx-auto flex size-16 items-center justify-center rounded-full bg-primary text-primary-foreground"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{
                    type: "spring",
                    stiffness: 260,
                    damping: 16,
                    delay: 0.15,
                  }}
                >
                  <Check className="size-8" />
                </motion.span>
              )}
              <h2 className="mt-5 font-heading text-2xl font-bold">
                Termin je zakazan!
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">{salonName}</p>
            </CardContent>

            <div className="relative px-6" aria-hidden>
              <div className="border-t border-dashed" />
              <span className="absolute -left-3 top-1/2 size-6 -translate-y-1/2 rounded-full border bg-background" />
              <span className="absolute -right-3 top-1/2 size-6 -translate-y-1/2 rounded-full border bg-background" />
            </div>

            <CardContent className="pt-2 pb-10">
              <dl className="mx-auto max-w-xs space-y-2 text-sm">
                {details.map(({ k, v }) => (
                  <div
                    key={k}
                    className="flex items-baseline justify-between gap-4"
                  >
                    <dt className="shrink-0 text-muted-foreground">{k}</dt>
                    <dd className="text-right font-medium">{v}</dd>
                  </div>
                ))}
              </dl>

              {/* Link za otkazivanje UVEK - klijent bez emaila inače nema
                  nikakav način da otkaže osim telefonom */}
              <div className="mx-auto mt-5 max-w-md rounded-xl bg-muted/60 px-4 py-3 text-left">
                <p className="text-xs font-medium text-muted-foreground">
                  {emailSent
                    ? `Potvrda sa linkom za otkazivanje je poslata na ${email}. Link možeš i odmah da sačuvaš:`
                    : "Ako ti termin ne bude odgovarao, otkaži ga ovim linkom - sačuvaj ga:"}
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                    {cancelUrl}
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0"
                    onClick={copyCancelUrl}
                  >
                    {cancelCopied ? (
                      <Check className="size-3.5" />
                    ) : (
                      <Copy className="size-3.5" />
                    )}
                    {cancelCopied ? "Kopirano" : "Kopiraj"}
                  </Button>
                </div>
                {salonPhone && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Za izmenu termina možeš i da pozoveš salon:{" "}
                    <a href={`tel:${salonPhone}`} className="font-medium hover:underline">
                      {salonPhone}
                    </a>
                  </p>
                )}
              </div>

              <div className="mt-6 flex flex-wrap justify-center gap-2">
                <Button
                  variant="outline"
                  className="h-10"
                  onClick={() =>
                    downloadICS(
                      `termin-${date}.ics`,
                      buildICS({
                        title: `${service.name} - ${salonName}`,
                        description: `Kod: ${result.staffName}`,
                        location: address ?? undefined,
                        date,
                        startTime: time,
                        endTime: endTimeFor(time),
                      })
                    )
                  }
                >
                  <CalendarPlus className="size-4" /> Dodaj u kalendar
                </Button>
                <Button asChild className="h-10">
                  <Link href={`/${slug}`}>Nazad na sajt</Link>
                </Button>
              </div>
              <p className="mt-4 text-center text-sm text-muted-foreground">
                Vidimo se, {name.split(" ")[0]}!
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </>
    );
  }

  return (
    <div>
      <StepIndicator step={step} done={done} onStepClick={jumpToStep} />
      {/* Na telefonu su labele koraka sakrivene - reci bar gde smo */}
      {!done && (
        <p className="mt-2 text-xs font-semibold text-muted-foreground sm:hidden">
          Korak {step + 1} od {STEP_LABELS.length} · {STEP_LABELS[step]}
        </p>
      )}

      {/* Živi rezime izbora: čipovi uskaču kako izbor raste, cena je uvek
          vidljiva od prvog koraka (klijent zna šta potvrđuje) */}
      {service && (
        <div className="mt-4 flex flex-wrap items-center gap-1.5">
          <SummaryChip key={`s-${service.id}`}>{service.name}</SummaryChip>
          {(member || anyStaff) && (
            <SummaryChip key={`m-${member?.id ?? "any"}`}>
              {member ? member.name : "Svejedno mi je"}
            </SummaryChip>
          )}
          {date && time && (
            <SummaryChip key={`t-${date}-${time}`}>
              {dateLabel} u {time}
            </SummaryChip>
          )}
          <SummaryChip key={`p-${service.id}`} accent>
            {formatPriceRange(service.price, service.price_max, service.currency)}
          </SummaryChip>
        </div>
      )}

      <div className="mt-6">
        <StepPane stepKey={String(step)} direction={direction}>
          {step === 0 && (
            <div className="space-y-2">
              {services.map((s) => (
                <button
                  key={s.id}
                  className="flex w-full items-center justify-between gap-4 rounded-[var(--surface-radius)] border p-4 text-left transition-colors hover:bg-accent"
                  onClick={() => pickService(s)}
                >
                  <div className="min-w-0">
                    <p className="font-medium">{s.name}</p>
                    {s.description && (
                      <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
                        {s.description}
                      </p>
                    )}
                    <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                      <Clock className="size-3.5" /> {s.duration_minutes} min
                    </p>
                  </div>
                  <span className="shrink-0 font-semibold text-primary">
                    {formatPriceRange(s.price, s.price_max, s.currency)}
                  </span>
                </button>
              ))}
              {services.length === 0 && (
                <p className="text-muted-foreground">
                  Online zakazivanje trenutno nije dostupno.
                </p>
              )}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-2">
              {/* "Svejedno mi je" na vrhu - klijent koji ne poznaje tim ne
                  mora da proverava dostupnost osobu po osobu */}
              {availableStaff.length > 1 && (
                <button
                  className="flex w-full items-center gap-3 rounded-[var(--surface-radius)] border border-dashed p-4 text-left transition-colors hover:bg-accent"
                  onClick={() => pickMember(null)}
                >
                  <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Users className="size-5" />
                  </div>
                  <div>
                    <p className="font-medium">Svejedno mi je</p>
                    <p className="text-sm text-muted-foreground">
                      Prikaži termine celog tima - salon dodeljuje osobu
                    </p>
                  </div>
                </button>
              )}
              {availableStaff.map((m) => (
                <button
                  key={m.id}
                  className="flex w-full items-center gap-3 rounded-[var(--surface-radius)] border p-4 text-left transition-colors hover:bg-accent"
                  onClick={() => pickMember(m)}
                >
                  {m.photo_url ? (
                    <Image
                      src={m.photo_url}
                      alt={m.name}
                      width={48}
                      height={48}
                      className="size-12 shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary">
                      {m.name.charAt(0)}
                    </div>
                  )}
                  <div>
                    <p className="font-medium">{m.name}</p>
                    {m.bio && <p className="text-sm text-muted-foreground">{m.bio}</p>}
                  </div>
                </button>
              ))}
              {availableStaff.length === 0 && (
                <p className="text-muted-foreground">
                  Trenutno niko ne radi ovu uslugu. Probaj drugu ili pozovi salon.
                </p>
              )}
              <Button variant="ghost" className="h-11 sm:h-9" onClick={() => go(0)}>
                Nazad
              </Button>
            </div>
          )}

          {step === 2 && (
            <div>
              <DayStrip
                todayISO={todayISO}
                count={horizonCount}
                selected={date}
                openByDate={openByDate}
                onSelect={setDate}
              />
              <div className="mt-4 min-h-32">
                {!date && (
                  <p className="text-sm text-muted-foreground">Izaberi dan.</p>
                )}
                {date && slots === null && (
                  <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                    {Array.from({ length: 12 }).map((_, i) => (
                      <Skeleton key={i} className="h-9" />
                    ))}
                  </div>
                )}
                {date && slotsError && (
                  <p className="rounded-[var(--surface-radius)] bg-amber-100 px-3 py-2 text-sm font-medium text-amber-950">
                    {slotsError}
                  </p>
                )}
                {date && !slotsError && slots !== null && slots.length === 0 && (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Nema slobodnih termina za ovaj dan.
                    </p>
                    {nextOpenDay ? (
                      <Button
                        variant="outline"
                        className="h-11"
                        onClick={() => setDate(nextOpenDay.date)}
                      >
                        Pogledaj {DAY_NAMES_SR[new Date(`${nextOpenDay.date}T12:00:00`).getDay()].toLowerCase()}{" "}
                        {new Date(`${nextOpenDay.date}T12:00:00`).getDate()}.
                        {new Date(`${nextOpenDay.date}T12:00:00`).getMonth() + 1}. →
                      </Button>
                    ) : (
                      <p className="text-sm text-muted-foreground">Probaj drugi dan.</p>
                    )}
                  </div>
                )}
                {date && slots !== null && slots.length > 0 && (
                  // key={date}: promena dana ponovi stagger ulazak slotova
                  <motion.div
                    key={date}
                    className="grid grid-cols-4 gap-2 sm:grid-cols-6"
                    initial={reduce ? false : "hidden"}
                    animate="show"
                    variants={{
                      show: { transition: { staggerChildren: 0.016 } },
                    }}
                  >
                    {slots.map((s) => (
                      <motion.div
                        key={s}
                        variants={{
                          hidden: { opacity: 0, y: 6, scale: 0.92 },
                          show: {
                            opacity: 1,
                            y: 0,
                            scale: 1,
                            transition: { duration: 0.18, ease: "easeOut" },
                          },
                        }}
                      >
                        <Button
                          className="h-11 w-full"
                          variant={time === s ? "default" : "outline"}
                          onClick={() => {
                            // Izbor vremena odmah vodi na podatke - jedan klik manje
                            setTime(s);
                            go(3);
                          }}
                        >
                          {s}
                        </Button>
                      </motion.div>
                    ))}
                  </motion.div>
                )}
              </div>
              <div className="mt-6 flex gap-2">
                <Button
                  variant="ghost"
                  className="h-11 sm:h-9"
                  onClick={() => go(staffSkipped ? 0 : 1)}
                >
                  Nazad
                </Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="max-w-md space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Ime i prezime *</Label>
                <Input
                  id="name"
                  className="h-11"
                  aria-invalid={!!fieldErrors.name}
                  aria-describedby={fieldErrors.name ? "name-error" : undefined}
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setFieldErrors((f) => ({ ...f, name: undefined }));
                  }}
                />
                {fieldErrors.name && (
                  <p id="name-error" className="text-xs font-medium text-destructive">
                    {fieldErrors.name}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Telefon *</Label>
                <Input
                  id="phone"
                  type="tel"
                  className="h-11"
                  placeholder="+381 6x xxx xxxx"
                  aria-invalid={!!fieldErrors.phone}
                  aria-describedby={fieldErrors.phone ? "phone-error" : undefined}
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value);
                    setFieldErrors((f) => ({ ...f, phone: undefined }));
                  }}
                />
                {fieldErrors.phone && (
                  <p id="phone-error" className="text-xs font-medium text-destructive">
                    {fieldErrors.phone}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email (za potvrdu)</Label>
                <Input
                  id="email"
                  type="email"
                  className="h-11"
                  aria-invalid={!!fieldErrors.email}
                  aria-describedby={fieldErrors.email ? "email-error" : undefined}
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setFieldErrors((f) => ({ ...f, email: undefined }));
                  }}
                />
                {fieldErrors.email && (
                  <p id="email-error" className="text-xs font-medium text-destructive">
                    {fieldErrors.email}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="note">Napomena</Label>
                <Textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} />
              </div>
              <div
                aria-hidden="true"
                className="absolute -left-[9999px] top-auto h-px w-px overflow-hidden"
              >
                <Label htmlFor="website">Website</Label>
                <Input
                  id="website"
                  name="website"
                  tabIndex={-1}
                  autoComplete="off"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                />
              </div>
              {/* Na telefonu: sticky traka na dnu ekrana sa full-width CTA;
                  na desktopu ostaje običan red dugmadi. Cena je već u
                  čipovima rezimea - na dugmetu bi bila ponavljanje. */}
              <div className="sticky bottom-0 z-10 -mx-4 flex items-center gap-2 border-t bg-background/85 px-4 py-3 backdrop-blur sm:static sm:z-auto sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:backdrop-blur-none">
                <Button variant="ghost" className="h-11 sm:h-9" onClick={() => go(2)}>
                  Nazad
                </Button>
                <Button
                  className="h-12 flex-1 text-base sm:h-9 sm:flex-none sm:text-sm"
                  disabled={pending}
                  onClick={submit}
                >
                  {pending ? "Zakazujem..." : "Potvrdi termin"}
                </Button>
              </div>
            </div>
          )}
        </StepPane>
      </div>
    </div>
  );
}
