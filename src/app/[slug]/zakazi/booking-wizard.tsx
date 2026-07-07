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

// Traka narednih 14 dana - brže od punog kalendara
function DayStrip({
  selected,
  onSelect,
}: {
  selected: string | null;
  onSelect: (date: string) => void;
}) {
  const days = useMemo(() => {
    const out: { iso: string; dayName: string; label: string; isToday: boolean }[] = [];
    const now = new Date();
    for (let i = 0; i < 14; i++) {
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
  }, []);

  return (
    <div className="flex gap-2 overflow-x-auto pb-2">
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

function StepPane({
  stepKey,
  children,
}: {
  stepKey: string;
  children: React.ReactNode;
}) {
  const reduce = useReducedMotion();
  if (reduce) return <div>{children}</div>;
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={stepKey}
        initial={{ opacity: 0, x: 24 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -24 }}
        transition={{ duration: 0.22, ease: "easeOut" }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
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
      setStep(2);
    } else {
      setMember(null);
      setStaffSkipped(false);
      setStep(1);
    }
  }

  // Klik na pređeni korak u indikatoru: preskočen korak "Frizer" vodi na usluge
  function jumpToStep(target: Step) {
    if (target === 1 && staffSkipped) {
      setStep(0);
      return;
    }
    setStep(target);
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
          setStep(2);
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
    return (
      <Card>
        {/* Mala proslava - klijent ovo pamti (poštuje reduced-motion) */}
        <ConfettiBurst />
        <CardContent className="pt-10 pb-10 text-center">
          {reduce ? (
            <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Check className="size-8" />
            </span>
          ) : (
            <motion.span
              className="mx-auto flex size-16 items-center justify-center rounded-full bg-primary text-primary-foreground"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 16 }}
            >
              <Check className="size-8" />
            </motion.span>
          )}
          <h2 className="mt-5 font-heading text-2xl font-bold">Termin je zakazan!</h2>
          {/* Bez "kod {ime}" - imena se ne menjaju kroz padeže programski */}
          <p className="mt-2 text-muted-foreground">
            {service.name} · {member.name}
          </p>
          <p className="font-medium">
            {dateLabel} u {time}
          </p>
          {emailSent && (
            <p className="mt-2 text-sm text-muted-foreground">
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
          <p className="mt-4 text-sm text-muted-foreground">
            Vidimo se, {name.split(" ")[0]}!
          </p>
        </CardContent>
      </Card>
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

      {/* Rezime izbora */}
      {service && (
        <p className="mt-4 text-sm text-muted-foreground">
          {service.name}
          {member && <> · {member.name}</>}
          {date && time && (
            <>
              {" "}
              · {dateLabel} u {time}
            </>
          )}
        </p>
      )}

      <div className="mt-6">
        <StepPane stepKey={String(step)}>
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
                    setStep(2);
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
              <Button variant="ghost" onClick={() => setStep(0)}>
                Nazad
              </Button>
            </div>
          )}

          {step === 2 && (
            <div>
              <DayStrip selected={date} onSelect={setDate} />
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
                  <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                    {slots.map((s) => (
                      <Button
                        key={s}
                        variant={time === s ? "default" : "outline"}
                        onClick={() => {
                          // Izbor vremena odmah vodi na podatke - jedan klik manje
                          setTime(s);
                          setStep(3);
                        }}
                      >
                        {s}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
              <div className="mt-6 flex gap-2">
                <Button
                  variant="ghost"
                  onClick={() => setStep(staffSkipped ? 0 : 1)}
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
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setStep(2)}>
                  Nazad
                </Button>
                <Button
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
