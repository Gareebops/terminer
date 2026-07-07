"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { CalendarPlus, Check, Clock } from "lucide-react";
import { ConfettiBurst } from "@/components/confetti";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { createBooking, getAvailableSlots } from "@/lib/booking/actions";
import { buildICS, downloadICS } from "@/lib/booking/ics";
import {
  bookingHorizonDays,
  DEFAULT_HORIZON_DAYS,
} from "@/lib/booking/schedule";
import { formatDateISO, formatPrice, DAY_NAMES_SR } from "@/lib/booking/slots";
import type { Service, Staff } from "@/lib/types";

interface Props {
  slug: string;
  salonName: string;
  address?: string | null;
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
    <ol className="flex items-center gap-1 sm:gap-2">
      {STEP_LABELS.map((label, i) => {
        const isDone = done || i < step;
        const isCurrent = !done && i === step;
        const clickable = !done && i < step && !!onStepClick;
        const circle = (
          <span
            className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
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
          <li key={label} className="flex flex-1 items-center gap-1 sm:gap-2">
            {clickable ? (
              <button
                type="button"
                onClick={() => onStepClick(i as Step)}
                title={`Nazad na korak: ${label}`}
                className="cursor-pointer transition-opacity hover:opacity-75"
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

// Traka narednih dana - brže od punog kalendara. Broj dana = horizont
// zakazivanja izabranog zaposlenog (server sprovodi istu granicu).
function DayStrip({
  count,
  selected,
  onSelect,
}: {
  count: number;
  selected: string | null;
  onSelect: (date: string) => void;
}) {
  const days = useMemo(() => {
    const out: { iso: string; dayName: string; label: string; isToday: boolean }[] = [];
    const now = new Date();
    for (let i = 0; i < count; i++) {
      const d = new Date(now);
      d.setDate(now.getDate() + i);
      out.push({
        iso: formatDateISO(d),
        dayName: i === 0 ? "Danas" : i === 1 ? "Sutra" : DAY_NAMES_SR[d.getDay()].slice(0, 3),
        label: `${d.getDate()}.${d.getMonth() + 1}.`,
        isToday: i === 0,
      });
    }
    return out;
  }, [count]);

  return (
    <div className="scrollbar-none flex gap-2 overflow-x-auto pb-2">
      {days.map((d) => (
        <button
          key={d.iso}
          onClick={() => onSelect(d.iso)}
          className={`flex min-w-16 shrink-0 flex-col items-center rounded-lg border px-3 py-2 text-sm transition-colors ${
            selected === d.iso
              ? "border-primary bg-primary text-primary-foreground"
              : "hover:bg-accent"
          }`}
        >
          <span className="text-xs opacity-80">{d.dayName}</span>
          <span className="font-semibold">{d.label}</span>
        </button>
      ))}
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
  const cls = accent
    ? "rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary"
    : "rounded-full border px-3 py-1 text-sm text-muted-foreground";
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
  const [date, setDate] = useState<string | null>(null);
  const [slots, setSlots] = useState<string[] | null>(null);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  // Honeypot: pravi korisnik ga ne vidi ni ne popunjava; bot koji ga
  // popuni biva odbijen na serveru
  const [website, setWebsite] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  // Korak "Frizer" je preskočen (uslugu radi samo jedan) - "Nazad" sa
  // termina tada vodi pravo na usluge
  const [staffSkipped, setStaffSkipped] = useState(false);
  const [pending, startTransition] = useTransition();

  function go(target: Step) {
    setDirection(target > step ? 1 : -1);
    setStep(target);
  }

  // Današnji dan je preselektovan - korak "Termin" odmah nudi slotove
  // umesto praznog "Izaberi dan". U efektu (ne u useState init) da SSR i
  // klijent ne bi izračunali različit datum oko ponoći.
  useEffect(() => {
    setDate((d) => d ?? formatDateISO(new Date()));
  }, []);

  const availableStaff = useMemo(() => {
    if (!service) return [];
    const ids = new Set(
      staffServices.filter((x) => x.service_id === service.id).map((x) => x.staff_id)
    );
    return staff.filter((s) => ids.has(s.id));
  }, [service, staff, staffServices]);

  useEffect(() => {
    if (!service || !member || !date) return;
    setSlots(null);
    setTime(null);
    setSlotsError(null);
    // Brzo preklikavanje dana: odgovor za stari dan sme da stigne posle
    // novog - zastareli rezultat se ignoriše da ne prikaže pogrešne termine
    let active = true;
    getAvailableSlots({ slug, staffId: member.id, serviceId: service.id, date }).then(
      (res) => {
        if (!active) return;
        if ("error" in res) {
          // Trajna poruka umesto toasta - "nema termina" bi bilo obmanjujuće
          // kad je zakazivanje pauzirano ili salon nedostupan
          setSlotsError(res.error);
          setSlots([]);
        } else {
          setSlots(res.slots);
        }
      }
    );
    return () => {
      active = false;
    };
  }, [slug, service, member, date]);

  function pickService(s: Service) {
    setService(s);
    const ids = new Set(
      staffServices.filter((x) => x.service_id === s.id).map((x) => x.staff_id)
    );
    const eligible = staff.filter((m) => ids.has(m.id));
    // Jedini koji radi uslugu se bira sam - korak "Frizer" se preskače
    if (eligible.length === 1) {
      setMember(eligible[0]);
      setStaffSkipped(true);
      go(2);
    } else {
      setMember(null);
      setStaffSkipped(false);
      go(1);
    }
  }

  // Klik na pređeni korak u indikatoru: preskočen korak "Frizer" vodi na usluge
  function jumpToStep(target: Step) {
    if (target === 1 && staffSkipped) {
      go(0);
      return;
    }
    go(target);
  }

  function submit() {
    if (!service || !member || !date || !time) return;
    startTransition(async () => {
      const res = await createBooking({
        slug,
        staffId: member.id,
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
        setDone(true);
      } else {
        toast.error(res.error);
        if (res.error.includes("zauzet")) {
          setTime(null);
          setSlots(null);
          const r = await getAvailableSlots({
            slug,
            staffId: member.id,
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
    ? `${DAY_NAMES_SR[new Date(`${date}T12:00:00`).getDay()]}, ${new Date(`${date}T12:00:00`).toLocaleDateString("sr-RS")}`
    : "";

  if (done && service && member && date && time) {
    const details = [
      { k: "Usluga", v: service.name },
      { k: "Kod koga", v: member.name },
      { k: "Termin", v: `${dateLabel} u ${time}` },
      { k: "Cena", v: formatPrice(service.price, service.currency) },
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
              {emailSent && (
                <p className="mt-4 text-center text-sm text-muted-foreground">
                  Potvrdu sa linkom za otkazivanje smo poslali na {email}.
                </p>
              )}
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                <Button
                  variant="outline"
                  onClick={() =>
                    downloadICS(
                      `termin-${date}.ics`,
                      buildICS({
                        title: `${service.name} - ${salonName}`,
                        description: `Kod: ${member.name}`,
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
                <Button asChild>
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
          {member && (
            <SummaryChip key={`m-${member.id}`}>{member.name}</SummaryChip>
          )}
          {date && time && (
            <SummaryChip key={`t-${date}-${time}`}>
              {dateLabel} u {time}
            </SummaryChip>
          )}
          <SummaryChip key={`p-${service.id}`} accent>
            {formatPrice(service.price, service.currency)}
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
                  className="flex w-full items-center justify-between rounded-lg border p-4 text-left transition-colors hover:bg-accent"
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
                    {formatPrice(s.price, s.currency)}
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
              {availableStaff.map((m) => (
                <button
                  key={m.id}
                  className="flex w-full items-center gap-3 rounded-lg border p-4 text-left transition-colors hover:bg-accent"
                  onClick={() => {
                    setMember(m);
                    go(2);
                  }}
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
              <Button variant="ghost" onClick={() => go(0)}>
                Nazad
              </Button>
            </div>
          )}

          {step === 2 && (
            <div>
              <DayStrip
                count={member ? bookingHorizonDays(member) : DEFAULT_HORIZON_DAYS}
                selected={date}
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
                  <p className="rounded-lg bg-amber-100 px-3 py-2 text-sm font-medium text-amber-950">
                    {slotsError}
                  </p>
                )}
                {date && !slotsError && slots !== null && slots.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    Nema slobodnih termina za ovaj dan. Probaj drugi.
                  </p>
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
                          className="w-full"
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
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Telefon *</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+381 6x xxx xxxx"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email (za potvrdu)</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
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
                <Button variant="ghost" onClick={() => go(2)}>
                  Nazad
                </Button>
                <Button
                  className="h-12 flex-1 text-base sm:h-9 sm:flex-none sm:text-sm"
                  disabled={pending || name.trim().length < 2 || phone.trim().length < 6}
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
