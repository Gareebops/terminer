"use client";

import { useState, useTransition } from "react";
import { Ban, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toMinutes } from "@/lib/booking/slots";
import type { BlockedSlot, Booking, Service, Staff } from "@/lib/types";
import {
  adminCreateBooking,
  createBlockedSlot,
  deleteBlockedSlot,
} from "../actions";

const DAY_START = 7 * 60; // 07:00
const DAY_END = 22 * 60; // 22:00
const PX_PER_MIN = 1.1;

// Šrafura = nedostupno (van radnog vremena, isti jezik kao blokade)
const HATCH =
  "repeating-linear-gradient(135deg, rgba(0,0,0,0.07) 0 2px, transparent 2px 8px)";

function top(minutes: number): number {
  return (minutes - DAY_START) * PX_PER_MIN;
}

type BookingRow = Booking & { services: { name: string } | null };

function NewBookingDialog({
  day,
  staff,
  services,
}: {
  day: string;
  staff: Staff[];
  services: Service[];
}) {
  const [open, setOpen] = useState(false);
  const [serviceId, setServiceId] = useState("");
  const [staffId, setStaffId] = useState("");
  const [date, setDate] = useState(day);
  const [time, setTime] = useState("12:00");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await adminCreateBooking({
        serviceId,
        staffId,
        date,
        time,
        customerName: name,
        customerPhone: phone,
      });
      if (res.ok) {
        toast.success("Rezervacija je upisana.");
        setOpen(false);
        setName("");
        setPhone("");
      } else {
        toast.error(res.error ?? "Greška.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" /> Nova rezervacija
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ručno zakazivanje</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Usluga *</Label>
            <Select value={serviceId} onValueChange={setServiceId} required>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Izaberi uslugu" />
              </SelectTrigger>
              <SelectContent>
                {services.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name} ({s.duration_minutes} min)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Radnik *</Label>
            <Select value={staffId} onValueChange={setStaffId} required>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Izaberi radnika" />
              </SelectTrigger>
              <SelectContent>
                {staff.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="nb-date">Datum *</Label>
              <Input
                id="nb-date"
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nb-time">Vreme *</Label>
              <Input
                id="nb-time"
                type="time"
                required
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="nb-name">Ime klijenta *</Label>
            <Input
              id="nb-name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="nb-phone">Telefon *</Label>
            <Input
              id="nb-phone"
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          <Button
            type="submit"
            className="w-full"
            disabled={pending || !serviceId || !staffId}
          >
            {pending ? "Upisivanje..." : "Upiši rezervaciju"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function BlockDialog({ day, staff }: { day: string; staff: Staff[] }) {
  const [open, setOpen] = useState(false);
  const [staffId, setStaffId] = useState("salon");
  const [date, setDate] = useState(day);
  const [startTime, setStartTime] = useState("12:00");
  const [endTime, setEndTime] = useState("13:00");
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await createBlockedSlot({
        staffId: staffId === "salon" ? undefined : staffId,
        date,
        startTime,
        endTime,
        reason,
      });
      if (res.ok) {
        toast.success("Termin je blokiran.");
        setOpen(false);
        setReason("");
      } else {
        toast.error(res.error ?? "Greška.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Ban className="size-4" /> Blokiraj termin
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Blokiranje termina</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Za koga</Label>
            <Select value={staffId} onValueChange={setStaffId}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="salon">Ceo salon</SelectItem>
                {staff.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="bl-date">Datum</Label>
              <Input
                id="bl-date"
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bl-start">Od</Label>
              <Input
                id="bl-start"
                type="time"
                required
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bl-end">Do</Label>
              <Input
                id="bl-end"
                type="time"
                required
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="bl-reason">Razlog (opciono)</Label>
            <Input
              id="bl-reason"
              placeholder="npr. pauza, odmor, privatno"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Blokiranje..." : "Blokiraj"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function CalendarView({
  day,
  staff,
  services,
  bookings,
  blockedSlots,
  windows,
}: {
  day: string;
  staff: Staff[];
  services: Service[];
  bookings: BookingRow[];
  blockedSlots: BlockedSlot[];
  // Radno okno po zaposlenom za taj dan; null = ne radi
  windows: Record<string, { start: string; end: string } | null>;
}) {
  const [, startTransition] = useTransition();

  function removeBlock(id: string) {
    if (!confirm("Ukloniti blokadu?")) return;
    startTransition(async () => {
      const res = await deleteBlockedSlot(id);
      if (!res.ok) toast.error(res.error ?? "Greška.");
    });
  }

  if (staff.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
        Prvo dodaj zaposlene.
      </p>
    );
  }

  const hours: number[] = [];
  for (let m = DAY_START; m < DAY_END; m += 60) hours.push(m);
  const gridHeight = (DAY_END - DAY_START) * PX_PER_MIN;

  return (
    <div>
      <div className="mb-4 flex gap-2">
        <NewBookingDialog day={day} staff={staff} services={services} />
        <BlockDialog day={day} staff={staff} />
      </div>

      <div className="overflow-x-auto rounded-[2rem] bg-white p-3 shadow-[0_4px_24px_rgba(20,25,20,0.06)]">
        <div
          className="grid"
          style={{
            gridTemplateColumns: `56px repeat(${staff.length}, minmax(160px, 1fr))`,
          }}
        >
          {/* Zaglavlje */}
          <div className="border-b bg-muted/40 p-2" />
          {staff.map((m) => (
            <div
              key={m.id}
              className="border-b border-l bg-muted/40 p-2 text-center text-sm font-medium"
            >
              {m.name}
            </div>
          ))}

          {/* Vremenska osa */}
          <div className="relative" style={{ height: gridHeight }}>
            {hours.map((m) => (
              <span
                key={m}
                className="absolute right-2 -translate-y-1/2 text-xs text-muted-foreground"
                style={{ top: top(m) }}
              >
                {String(m / 60).padStart(2, "0")}:00
              </span>
            ))}
          </div>

          {/* Kolone po zaposlenom */}
          {staff.map((m) => {
            const myBookings = bookings.filter((b) => b.staff_id === m.id);
            const myBlocks = blockedSlots.filter(
              (b) => b.staff_id === m.id || b.staff_id === null
            );
            const win = windows[m.id] ?? null;
            const winStart = win ? Math.max(toMinutes(win.start), DAY_START) : 0;
            const winEnd = win ? Math.min(toMinutes(win.end), DAY_END) : 0;
            return (
              <div
                key={m.id}
                className="relative border-l"
                style={{ height: gridHeight }}
              >
                {hours.map((h) => (
                  <div
                    key={h}
                    className="absolute inset-x-0 border-t border-dashed border-muted"
                    style={{ top: top(h) }}
                  />
                ))}
                {win === null ? (
                  <div className="absolute inset-0" style={{ backgroundImage: HATCH }}>
                    <span className="absolute left-1/2 top-8 -translate-x-1/2 rounded-full bg-white px-3 py-1 text-xs font-medium text-ink/50 ring-1 ring-ink/10">
                      Ne radi
                    </span>
                  </div>
                ) : (
                  <>
                    {winStart > DAY_START && (
                      <div
                        className="absolute inset-x-0 top-0"
                        style={{ height: top(winStart), backgroundImage: HATCH }}
                      />
                    )}
                    {winEnd < DAY_END && (
                      <div
                        className="absolute inset-x-0 bottom-0"
                        style={{ top: top(winEnd), backgroundImage: HATCH }}
                      />
                    )}
                  </>
                )}
                {myBlocks.map((b) => {
                  const s = toMinutes(b.start_time.slice(0, 5));
                  const e = toMinutes(b.end_time.slice(0, 5));
                  return (
                    <button
                      key={b.id}
                      onClick={() => removeBlock(b.id)}
                      title={`Blokirano${b.reason ? `: ${b.reason}` : ""} - klik za uklanjanje`}
                      className="absolute inset-x-1 rounded-xl bg-ink/[0.04] px-2 py-1 text-left text-xs text-ink/60 ring-1 ring-ink/10 hover:ring-red-400"
                      style={{
                        top: top(s),
                        height: (e - s) * PX_PER_MIN,
                        backgroundImage:
                          "repeating-linear-gradient(135deg, rgba(0,0,0,0.07) 0 2px, transparent 2px 8px)",
                      }}
                    >
                      <span className="font-medium">Blokirano</span>
                      {b.reason && <span> · {b.reason}</span>}
                    </button>
                  );
                })}
                {myBookings.map((b) => {
                  const s = toMinutes(b.start_time.slice(0, 5));
                  const e = toMinutes(b.end_time.slice(0, 5));
                  return (
                    <div
                      key={b.id}
                      title={`${b.customer_name} · ${b.customer_phone}`}
                      className="absolute inset-x-1 overflow-hidden rounded-xl bg-ink px-2 py-1 text-xs text-white"
                      style={{ top: top(s), height: Math.max((e - s) * PX_PER_MIN, 22) }}
                    >
                      <span className="font-medium">
                        {b.start_time.slice(0, 5)} {b.customer_name}
                      </span>
                      <span className="opacity-80"> · {b.services?.name}</span>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Klik na blokadu je uklanja. Statusi rezervacija se menjaju u meniju
        Rezervacije.
      </p>
    </div>
  );
}
