"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { CheckCircle2, Clock } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  createBooking,
  getAvailableSlots,
} from "@/lib/booking/actions";
import { formatDateISO, formatPrice, DAY_NAMES_SR } from "@/lib/booking/slots";
import type { Service, Staff } from "@/lib/types";

interface Props {
  slug: string;
  services: Service[];
  staff: Staff[];
  staffServices: { staff_id: string; service_id: string }[];
}

type Step = "service" | "staff" | "datetime" | "details" | "done";

export function BookingWizard({ slug, services, staff, staffServices }: Props) {
  const [step, setStep] = useState<Step>("service");
  const [service, setService] = useState<Service | null>(null);
  const [member, setMember] = useState<Staff | null>(null);
  const [date, setDate] = useState<Date | undefined>();
  const [slots, setSlots] = useState<string[] | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();

  const availableStaff = useMemo(() => {
    if (!service) return [];
    const ids = new Set(
      staffServices.filter((x) => x.service_id === service.id).map((x) => x.staff_id)
    );
    return staff.filter((s) => ids.has(s.id));
  }, [service, staff, staffServices]);

  // Učitaj slobodne termine kad se izabere datum
  useEffect(() => {
    if (!service || !member || !date) return;
    setSlots(null);
    setTime(null);
    const dateStr = formatDateISO(date);
    getAvailableSlots({
      slug,
      staffId: member.id,
      serviceId: service.id,
      date: dateStr,
    }).then((res) => {
      if ("error" in res) {
        toast.error(res.error);
        setSlots([]);
      } else {
        setSlots(res.slots);
      }
    });
  }, [slug, service, member, date]);

  function submit() {
    if (!service || !member || !date || !time) return;
    startTransition(async () => {
      const res = await createBooking({
        slug,
        staffId: member.id,
        serviceId: service.id,
        date: formatDateISO(date),
        time,
        customerName: name,
        customerPhone: phone,
        customerEmail: email,
        note,
      });
      if (res.ok) {
        setStep("done");
      } else {
        toast.error(res.error);
        if (res.error.includes("zauzet")) {
          // osveži slotove
          setTime(null);
          setSlots(null);
          const r = await getAvailableSlots({
            slug,
            staffId: member.id,
            serviceId: service.id,
            date: formatDateISO(date),
          });
          setSlots("error" in r ? [] : r.slots);
        }
      }
    });
  }

  const summary = service && (
    <div className="mb-6 flex flex-wrap items-center gap-2 text-sm">
      <Badge variant="secondary">{service.name}</Badge>
      {member && <Badge variant="secondary">{member.name}</Badge>}
      {date && time && (
        <Badge variant="secondary">
          {DAY_NAMES_SR[date.getDay()]} {date.toLocaleDateString("sr-RS")} u {time}
        </Badge>
      )}
    </div>
  );

  if (step === "done" && service && member && date && time) {
    return (
      <Card>
        <CardContent className="pt-8 pb-8 text-center">
          <CheckCircle2 className="mx-auto size-12 text-green-600" />
          <h2 className="mt-4 text-xl font-semibold">Termin je zakazan!</h2>
          <p className="mt-2 text-muted-foreground">
            {service.name} kod {member.name} —{" "}
            {date.toLocaleDateString("sr-RS")} u {time}.
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Vidimo se, {name.split(" ")[0]}!
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div>
      {summary}

      {step === "service" && (
        <div className="space-y-2">
          <h2 className="mb-4 font-semibold">1. Izaberi uslugu</h2>
          {services.map((s) => (
            <button
              key={s.id}
              className="flex w-full items-center justify-between rounded-lg border p-4 text-left transition-colors hover:bg-accent"
              onClick={() => {
                setService(s);
                setStep("staff");
              }}
            >
              <div>
                <p className="font-medium">{s.name}</p>
                <p className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Clock className="size-3.5" /> {s.duration_minutes} min
                </p>
              </div>
              <span className="font-semibold">{formatPrice(s.price, s.currency)}</span>
            </button>
          ))}
          {services.length === 0 && (
            <p className="text-muted-foreground">
              Online zakazivanje trenutno nije dostupno.
            </p>
          )}
        </div>
      )}

      {step === "staff" && (
        <div className="space-y-2">
          <h2 className="mb-4 font-semibold">2. Izaberi frizera</h2>
          {availableStaff.map((m) => (
            <button
              key={m.id}
              className="flex w-full items-center gap-3 rounded-lg border p-4 text-left transition-colors hover:bg-accent"
              onClick={() => {
                setMember(m);
                setStep("datetime");
              }}
            >
              <div className="flex size-10 items-center justify-center rounded-full bg-muted font-semibold">
                {m.name.charAt(0)}
              </div>
              <div>
                <p className="font-medium">{m.name}</p>
                {m.bio && <p className="text-sm text-muted-foreground">{m.bio}</p>}
              </div>
            </button>
          ))}
          {availableStaff.length === 0 && (
            <p className="text-muted-foreground">
              Nijedan frizer trenutno ne radi ovu uslugu.
            </p>
          )}
          <Button variant="ghost" onClick={() => setStep("service")}>
            Nazad
          </Button>
        </div>
      )}

      {step === "datetime" && (
        <div>
          <h2 className="mb-4 font-semibold">3. Izaberi datum i vreme</h2>
          <div className="grid gap-6 sm:grid-cols-[auto_1fr]">
            <Calendar
              mode="single"
              selected={date}
              onSelect={setDate}
              disabled={{ before: new Date() }}
              className="rounded-lg border"
            />
            <div>
              {!date && (
                <p className="text-sm text-muted-foreground">Prvo izaberi datum.</p>
              )}
              {date && slots === null && (
                <div className="grid grid-cols-3 gap-2">
                  {Array.from({ length: 9 }).map((_, i) => (
                    <Skeleton key={i} className="h-9" />
                  ))}
                </div>
              )}
              {date && slots !== null && slots.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Nema slobodnih termina za ovaj dan. Probaj drugi datum.
                </p>
              )}
              {date && slots !== null && slots.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {slots.map((s) => (
                    <Button
                      key={s}
                      variant={time === s ? "default" : "outline"}
                      onClick={() => setTime(s)}
                    >
                      {s}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="mt-6 flex gap-2">
            <Button variant="ghost" onClick={() => setStep("staff")}>
              Nazad
            </Button>
            <Button disabled={!date || !time} onClick={() => setStep("details")}>
              Nastavi
            </Button>
          </div>
        </div>
      )}

      {step === "details" && (
        <div className="max-w-md space-y-4">
          <h2 className="font-semibold">4. Tvoji podaci</h2>
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
            <Textarea
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setStep("datetime")}>
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
    </div>
  );
}
