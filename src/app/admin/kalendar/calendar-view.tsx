"use client";

import Image from "next/image";
import { useEffect, useRef, useState, useTransition } from "react";
import { Phone, Plus, Prohibit } from "@/components/icons";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
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
import { ConfirmDialog } from "@/components/confirm-dialog";
import { fromMinutes, toMinutes } from "@/lib/booking/slots";
import { plural } from "@/lib/plural";
import {
  BOOKING_STATUS_LABELS,
  BOOKING_STATUS_STYLES,
} from "@/lib/booking/status";
import type {
  BlockedSlot,
  Booking,
  BookingStatus,
  ScheduleConflict,
  Service,
  Staff,
} from "@/lib/types";
import {
  adminCreateBooking,
  createBlockedSlot,
  deleteBlockedSlot,
  getStaffDayBusy,
  updateBookingStatus,
  type StaffDayBusy,
} from "../actions";
import { ScheduleConflictDialog } from "../schedule-conflict-dialog";

const PX_PER_MIN = 1.4;

// Prostor iznad prvog i ispod poslednjeg sata - labela sata je centrirana
// na liniju (translate -50%) pa bi se bez ovoga "08:00" seklo na ivici skrola
const PAD_Y = 12;

// Šrafura = nedostupno (van radnog vremena, isti jezik kao blokade)
const HATCH =
  "repeating-linear-gradient(135deg, rgba(0,0,0,0.07) 0 2px, transparent 2px 8px)";

type BookingRow = Booking & { services: { name: string } | null };

function NewBookingDialog({
  day,
  staff,
  services,
  open,
  onOpenChange,
  // Klik na prazno mesto u gridu otvara dijalog sa preselektovanim
  // zaposlenim i vremenom tog mesta
  initialStaffId = "",
  initialTime = "12:00",
}: {
  day: string;
  staff: Staff[];
  services: Service[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialStaffId?: string;
  initialTime?: string;
}) {
  const [serviceId, setServiceId] = useState("");
  const [staffId, setStaffId] = useState(initialStaffId);
  const [date, setDate] = useState(day);
  const [time, setTime] = useState(initialTime);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  // Zauzetost izabranog zaposlenog za izabrani dan - da se vreme ne
  // kucka naslepo pa puca na "termin se preklapa"
  const [busy, setBusy] = useState<StaffDayBusy | null>(null);
  const [pending, startTransition] = useTransition();

  // Bez kompletnog konteksta (zatvoren dijalog / obrisan datum) stara
  // zauzetost ne važi - reset ide tokom rendera ("adjusting state during
  // render" obrazac), a ne sinhrono u effect-u
  const busyKey = open && staffId && date ? `${staffId}|${date}` : null;
  const [prevBusyKey, setPrevBusyKey] = useState(busyKey);
  if (prevBusyKey !== busyKey) {
    setPrevBusyKey(busyKey);
    if (busyKey === null) setBusy(null);
  }

  useEffect(() => {
    if (!open || !staffId || !date) return;
    let active = true;
    getStaffDayBusy(staffId, date).then((res) => {
      if (active) setBusy(res.ok ? res.busy : null);
    });
    return () => {
      active = false;
    };
  }, [open, staffId, date]);

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
        note,
      });
      if (res.ok) {
        toast.success("Rezervacija je upisana.");
        onOpenChange(false);
        setName("");
        setPhone("");
        setNote("");
      } else {
        toast.error(res.error ?? "Nešto nije uspelo. Pokušaj ponovo.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
            <Label>Zaposleni *</Label>
            <Select value={staffId} onValueChange={setStaffId} required>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Izaberi zaposlenog" />
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
          {staffId && busy !== null && (
            <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
              {busy.length === 0 ? (
                "Taj dan još nema upisanih termina."
              ) : (
                <>
                  <span className="font-medium">Zauzeto:</span>{" "}
                  {busy.map((b) => `${b.start}–${b.end} (${b.label})`).join(", ")}
                </>
              )}
            </p>
          )}
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
          <div className="space-y-2">
            <Label htmlFor="nb-note">Napomena</Label>
            <Input
              id="nb-note"
              placeholder="npr. posebna želja klijenta"
              value={note}
              onChange={(e) => setNote(e.target.value)}
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

function BlockDialog({
  day,
  staff,
  defaultOpen = false,
}: {
  day: string;
  staff: Staff[];
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [staffId, setStaffId] = useState("salon");
  const [date, setDate] = useState(day);
  const [startTime, setStartTime] = useState("12:00");
  const [endTime, setEndTime] = useState("13:00");
  const [reason, setReason] = useState("");
  // Blokada preko postojećih rezervacija: server vraća listu, vlasnik odluči
  const [conflicts, setConflicts] = useState<ScheduleConflict[] | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(force: boolean) {
    startTransition(async () => {
      const res = await createBlockedSlot({
        staffId: staffId === "salon" ? undefined : staffId,
        date,
        startTime,
        endTime,
        reason,
        force,
      });
      if (res.ok) {
        setConflicts(null);
        toast.success("Termin je blokiran.");
        setOpen(false);
        setReason("");
      } else if ("conflicts" in res && res.conflicts) {
        setConflicts(res.conflicts);
      } else {
        toast.error(res.error ?? "Nešto nije uspelo. Pokušaj ponovo.");
      }
    });
  }

  return (
    <>
      <Dialog open={open && !conflicts} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline">
            <Prohibit className="size-4" /> Blokiraj termin
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Blokiranje termina</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit(false);
            }}
            className="space-y-4"
          >
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
            {/* Datum na mobilnom dobija ceo red - u trećini dijaloga se
                godina srpskog formata seče unutar polja */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="col-span-2 space-y-2 sm:col-span-1">
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

      <ScheduleConflictDialog
        conflicts={conflicts}
        onCancel={() => setConflicts(null)}
        onConfirm={() => submit(true)}
        pending={pending}
      />
    </>
  );
}

// Detalji termina: klik na blok u gridu - kontakt klijenta i promena
// statusa bez odlaska u Rezervacije
function BookingDialog({
  booking,
  staffName,
  onClose,
}: {
  booking: BookingRow | null;
  staffName: string;
  onClose: () => void;
}) {
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [pending, startTransition] = useTransition();

  function setStatus(status: BookingStatus) {
    if (!booking) return;
    startTransition(async () => {
      const res = await updateBookingStatus(booking.id, status);
      if (res.ok) {
        toast.success(
          status === "cancelled"
            ? "Termin je otkazan."
            : "Status je izmenjen."
        );
        setConfirmCancel(false);
        onClose();
      } else {
        toast.error(res.error ?? "Nešto nije uspelo. Pokušaj ponovo.");
      }
    });
  }

  const active =
    !!booking && ["pending", "confirmed"].includes(booking.status);

  return (
    <Dialog
      open={!!booking}
      onOpenChange={(o) => {
        if (!o) {
          setConfirmCancel(false);
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        {booking && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {booking.customer_name}
                <Badge
                  className={`border-0 font-semibold ${BOOKING_STATUS_STYLES[booking.status]}`}
                >
                  {BOOKING_STATUS_LABELS[booking.status]}
                </Badge>
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-1.5 text-sm">
              <p className="font-medium">
                {booking.start_time.slice(0, 5)}–{booking.end_time.slice(0, 5)} ·{" "}
                {booking.services?.name ?? "Usluga"}
              </p>
              <p className="text-muted-foreground">Zaposleni: {staffName}</p>
              <p>
                <a
                  href={`tel:${booking.customer_phone}`}
                  className="inline-flex items-center gap-1.5 font-medium hover:underline"
                >
                  <Phone className="size-3.5" /> {booking.customer_phone}
                </a>
              </p>
              {booking.note && (
                <p className="text-muted-foreground">Napomena: {booking.note}</p>
              )}
            </div>

            {active &&
              (confirmCancel ? (
                <div className="space-y-2 rounded-2xl bg-red-50 p-3">
                  <p className="text-sm font-medium text-red-900">
                    Otkazati termin? Klijent koji je ostavio email dobija
                    obaveštenje o otkazivanju.
                  </p>
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setConfirmCancel(false)}
                    >
                      Odustani
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={pending}
                      onClick={() => setStatus("cancelled")}
                    >
                      {pending ? "Otkazivanje..." : "Da, otkaži"}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button
                    size="sm"
                    disabled={pending}
                    onClick={() => setStatus("completed")}
                  >
                    Završeno
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() => setStatus("no_show")}
                  >
                    Nije došao
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-red-700 hover:text-red-800"
                    disabled={pending}
                    onClick={() => setConfirmCancel(true)}
                  >
                    Otkaži termin
                  </Button>
                </div>
              ))}
            {!active && (
              <div className="pt-1">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() => setStatus("confirmed")}
                >
                  Vrati na „Potvrđeno“
                </Button>
              </div>
            )}
          </>
        )}
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
  nowMinutes,
  openNew = false,
  openBlock = false,
}: {
  day: string;
  staff: Staff[];
  services: Service[];
  bookings: BookingRow[];
  blockedSlots: BlockedSlot[];
  // Radno okno po zaposlenom za taj dan; null = ne radi
  windows: Record<string, { start: string; end: string } | null>;
  // Trenutno vreme u zoni salona, samo kad je prikazan današnji dan
  nowMinutes: number | null;
  openNew?: boolean;
  openBlock?: boolean;
}) {
  const [selected, setSelected] = useState<BookingRow | null>(null);
  const [blockToRemove, setBlockToRemove] = useState<string | null>(null);
  // Dijalog ručnog zakazivanja: otvara ga dugme (bez prefilla) ili klik na
  // prazno mesto u gridu (sa zaposlenim i vremenom tog mesta); nonce
  // remount-uje dijalog da prefill legne u state
  const [newBooking, setNewBooking] = useState<{
    open: boolean;
    staffId?: string;
    time?: string;
    nonce: number;
  }>({ open: openNew, nonce: 0 });
  const [pending, startTransition] = useTransition();

  // Linija "sada": server daje početno vreme u zoni salona, klijent ga dalje
  // pomera prema stvarno proteklom vremenu. Brojanje otkucaja (+1 na minut)
  // je zaostajalo: pozadinski tabovi prigušuju tajmere, a tokom spavanja
  // računara interval uopšte ne kuca, pa se propušteni minuti nikad ne
  // nadoknade. Elapsed pristup + tick na fokus se sam ispravi pri povratku.
  const [nowMin, setNowMin] = useState(nowMinutes);
  // Svež serverski snapshot (promena dana / refresh) odmah pregazi lokalno
  // izvedeno vreme - tokom rendera ("adjusting state during render" obrazac),
  // a ne sinhrono u effect-u
  const [prevNowMinutes, setPrevNowMinutes] = useState(nowMinutes);
  if (prevNowMinutes !== nowMinutes) {
    setPrevNowMinutes(nowMinutes);
    setNowMin(nowMinutes);
  }
  useEffect(() => {
    if (nowMinutes === null) return;
    const anchoredAt = Date.now();
    const tick = () =>
      setNowMin(nowMinutes + Math.round((Date.now() - anchoredAt) / 60_000));
    const id = setInterval(tick, 30_000);
    document.addEventListener("visibilitychange", tick);
    window.addEventListener("focus", tick);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
      window.removeEventListener("focus", tick);
    };
  }, [nowMinutes]);

  // Pri otvaranju današnjeg dana grid se sam dovede do trenutnog vremena.
  // Skrol ide UNUTAR grid kontejnera, ne kroz celu stranicu - inače
  // auto-scroll sakrije zaglavlje sa navigacijom dana.
  const nowRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scrollRef.current;
    const now = nowRef.current;
    if (!el || !now) return;
    const top =
      now.getBoundingClientRect().top - el.getBoundingClientRect().top + el.scrollTop;
    el.scrollTop = top - el.clientHeight / 2;
  }, []);

  function removeBlock(id: string) {
    startTransition(async () => {
      const res = await deleteBlockedSlot(id);
      if (!res.ok) toast.error(res.error ?? "Nešto nije uspelo. Pokušaj ponovo.");
      setBlockToRemove(null);
    });
  }

  if (staff.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-8 text-center text-ink/70">
        Prvo dodaj zaposlene.
      </p>
    );
  }

  // Opseg prati stvarna radna okna (sat pre prvog i posle poslednjeg) -
  // fiksni 07-22 je pravio dva sata mrtve šrafure na vrhu svakog dana.
  // Termini/blokade van okna i dalje šire prikaz da ništa ne ispadne.
  const winList = Object.values(windows).filter(Boolean) as {
    start: string;
    end: string;
  }[];
  let dayStart: number;
  let dayEnd: number;
  if (winList.length > 0) {
    dayStart = Math.max(
      0,
      Math.floor((Math.min(...winList.map((w) => toMinutes(w.start))) - 60) / 60) * 60
    );
    dayEnd = Math.min(
      24 * 60,
      Math.ceil((Math.max(...winList.map((w) => toMinutes(w.end))) + 60) / 60) * 60
    );
  } else {
    // Niko ne radi taj dan - kratak prikaz, kolone su ionako šrafirane
    dayStart = 9 * 60;
    dayEnd = 17 * 60;
  }
  const widen = (startT: string, endT: string) => {
    dayStart = Math.min(dayStart, Math.floor(toMinutes(startT.slice(0, 5)) / 60) * 60);
    dayEnd = Math.max(dayEnd, Math.ceil(toMinutes(endT.slice(0, 5)) / 60) * 60);
  };
  bookings.forEach((b) => widen(b.start_time, b.end_time));
  blockedSlots.forEach((b) => widen(b.start_time, b.end_time));

  const top = (minutes: number) => (minutes - dayStart) * PX_PER_MIN + PAD_Y;
  const showNow = nowMin !== null && nowMin >= dayStart && nowMin <= dayEnd;

  const hours: number[] = [];
  for (let m = dayStart; m < dayEnd; m += 60) hours.push(m);
  const gridHeight = (dayEnd - dayStart) * PX_PER_MIN + PAD_Y * 2;

  const staffNameById = new Map(staff.map((m) => [m.id, m.name]));

  return (
    <div>
      <div className="mb-4 flex gap-2">
        <Button
          onClick={() => setNewBooking((s) => ({ open: true, nonce: s.nonce }))}
        >
          <Plus className="size-4" /> Nova rezervacija
        </Button>
        {/* key={day}: promena dana kroz strelice resetuje datume u formama */}
        <NewBookingDialog
          key={`nb-${day}-${newBooking.nonce}`}
          day={day}
          staff={staff}
          services={services}
          open={newBooking.open}
          onOpenChange={(o) => setNewBooking((s) => ({ ...s, open: o }))}
          initialStaffId={newBooking.staffId}
          initialTime={newBooking.time}
        />
        <BlockDialog key={`bl-${day}`} day={day} staff={staff} defaultOpen={openBlock} />
      </div>

      <div className="rounded-[2rem] bg-white p-3 shadow-card">
        <div ref={scrollRef} className="max-h-[70dvh] overflow-auto">
        <div
          className="grid"
          style={{
            gridTemplateColumns: `48px repeat(${staff.length}, minmax(160px, 1fr))`,
          }}
        >
          {/* Zaglavlje - sticky da imena ostanu vidljiva dok se grid skroluje;
              ugaono polje je i left-sticky da pokrije vremensku osu */}
          <div className="sticky left-0 top-0 z-30 border-b bg-white" />
          {staff.map((m) => {
            const count = bookings.filter((b) => b.staff_id === m.id).length;
            const radi = (windows[m.id] ?? null) !== null;
            return (
              <div
                key={m.id}
                className="sticky top-0 z-20 border-b border-l bg-white px-2 py-1.5 text-center text-sm font-semibold"
              >
                <span className="inline-flex max-w-full items-center justify-center gap-1.5">
                  {m.photo_url ? (
                    <Image
                      src={m.photo_url}
                      alt=""
                      width={24}
                      height={24}
                      className="size-6 shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-ink/10 text-[10px] font-bold">
                      {m.name.charAt(0)}
                    </span>
                  )}
                  <span className="truncate">{m.name}</span>
                </span>
                <span className="block truncate text-[11px] font-normal text-ink/60">
                  {count > 0
                    ? `${count} ${plural(count, ["termin", "termina", "termina"])}`
                    : radi
                      ? "bez termina"
                      : "ne radi"}
                </span>
              </div>
            );
          })}

          {/* Vremenska osa - left-sticky da sati ostanu vidljivi dok se
              kolone zaposlenih skroluju horizontalno (telefon) */}
          <div
            className="sticky left-0 z-10 bg-white"
            style={{ height: gridHeight }}
          >
            {hours.map((m) => (
              <span
                key={m}
                className="absolute right-2 -translate-y-1/2 text-xs tabular-nums text-muted-foreground"
                style={{ top: top(m) }}
              >
                {String(m / 60).padStart(2, "0")}:00
              </span>
            ))}
            {showNow && (
              <div
                ref={nowRef}
                className="absolute right-1 z-10 -translate-y-1/2"
                style={{ top: top(nowMin!) }}
              >
                <span className="rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-white">
                  {fromMinutes(nowMin!)}
                </span>
              </div>
            )}
          </div>

          {/* Kolone po zaposlenom */}
          {staff.map((m) => {
            const myBookings = bookings.filter((b) => b.staff_id === m.id);
            const myBlocks = blockedSlots.filter(
              (b) => b.staff_id === m.id || b.staff_id === null
            );
            const win = windows[m.id] ?? null;
            const winStart = win ? Math.max(toMinutes(win.start), dayStart) : 0;
            const winEnd = win ? Math.min(toMinutes(win.end), dayEnd) : 0;
            return (
              <div
                key={m.id}
                className="relative cursor-pointer border-l"
                style={{ height: gridHeight }}
                title="Klik na prazno mesto upisuje termin u to vreme"
                onClick={(e) => {
                  // Klik na termin/blokadu ima svoju akciju - preskoči
                  if ((e.target as HTMLElement).closest("button")) return;
                  const rect = e.currentTarget.getBoundingClientRect();
                  const raw = dayStart + (e.clientY - rect.top) / PX_PER_MIN;
                  const snapped = Math.max(
                    0,
                    Math.min(24 * 60 - 15, Math.round(raw / 15) * 15)
                  );
                  setNewBooking((s) => ({
                    open: true,
                    staffId: m.id,
                    time: fromMinutes(snapped),
                    nonce: s.nonce + 1,
                  }));
                }}
              >
                {hours.map((h) => (
                  <div
                    key={h}
                    className="absolute inset-x-0 border-t border-ink/[0.06]"
                    style={{ top: top(h) }}
                  />
                ))}
                {/* Linija trenutnog vremena (samo za današnji dan) */}
                {showNow && (
                  <div
                    className="pointer-events-none absolute inset-x-0 z-10 h-px bg-red-600"
                    style={{ top: top(nowMin!) }}
                  />
                )}
                {win === null ? (
                  <div className="absolute inset-0" style={{ backgroundImage: HATCH }}>
                    <span className="absolute left-1/2 top-8 -translate-x-1/2 rounded-full bg-white px-3 py-1 text-xs font-medium text-ink/70 ring-1 ring-ink/10">
                      Ne radi
                    </span>
                  </div>
                ) : (
                  <>
                    {winStart > dayStart && (
                      <div
                        className="absolute inset-x-0 top-0"
                        style={{ height: top(winStart), backgroundImage: HATCH }}
                      />
                    )}
                    {winEnd < dayEnd && (
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
                      onClick={() => setBlockToRemove(b.id)}
                      title={`Blokirano${b.reason ? `: ${b.reason}` : ""} - klik za uklanjanje`}
                      className="absolute inset-x-1 flex flex-col justify-center overflow-hidden rounded-lg bg-ink/[0.04] px-2 text-left text-xs text-ink/70 ring-1 ring-ink/10 hover:ring-red-400"
                      style={{
                        top: top(s),
                        height: Math.max((e - s) * PX_PER_MIN, 22),
                        backgroundImage: HATCH,
                      }}
                    >
                      <span className="w-full truncate">
                        <span className="font-medium">Blokirano</span>
                        {b.reason && ` · ${b.reason}`}
                      </span>
                    </button>
                  );
                })}
                {myBookings.map((b) => {
                  const s = toMinutes(b.start_time.slice(0, 5));
                  const e = toMinutes(b.end_time.slice(0, 5));
                  const h = Math.max((e - s) * PX_PER_MIN, 22);
                  // Sadržaj se NIKAD ne prelama: nizak čip = jedan red sa
                  // truncate, viši čip dobija i red sa uslugom - prelomljen
                  // tekst se na fiksnoj visini sekao/curio van čipa
                  const twoLines = h >= 38;
                  const dimmed =
                    b.status === "completed" || b.status === "no_show";
                  const statusNote =
                    b.status === "completed"
                      ? "završeno"
                      : b.status === "no_show"
                        ? "nije došao"
                        : null;
                  return (
                    <button
                      key={b.id}
                      onClick={() => setSelected(b)}
                      title={`${b.customer_name} · ${b.customer_phone} - klik za detalje`}
                      className={`absolute inset-x-1 flex flex-col overflow-hidden rounded-lg px-2 text-left text-xs leading-tight transition-shadow hover:ring-2 hover:ring-ink/30 ${
                        twoLines ? "justify-start py-1" : "justify-center"
                      } ${
                        dimmed
                          ? "bg-ink/10 text-ink/70 ring-1 ring-ink/10"
                          : "bg-ink text-white"
                      }`}
                      style={{ top: top(s), height: h }}
                    >
                      <span
                        className={`w-full truncate font-semibold ${
                          b.status === "no_show" ? "line-through" : ""
                        }`}
                      >
                        <span className="tabular-nums">
                          {b.start_time.slice(0, 5)}
                        </span>{" "}
                        {b.customer_name}
                      </span>
                      {twoLines && (
                        <span className="w-full truncate text-[11px] opacity-75">
                          {b.services?.name ?? "Usluga"}
                          {statusNote && ` · ${statusNote}`}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
        </div>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Klik na prazno mesto upisuje termin u to vreme; klik na termin otvara
        detalje i promenu statusa; klik na blokadu je uklanja. Sve isto možeš
        i kroz dugmad „Nova rezervacija“ i „Blokiraj termin“.
      </p>

      <BookingDialog
        key={selected?.id ?? "none"}
        booking={selected}
        staffName={selected ? (staffNameById.get(selected.staff_id) ?? "") : ""}
        onClose={() => setSelected(null)}
      />

      <ConfirmDialog
        open={!!blockToRemove}
        title="Ukloniti blokadu?"
        description="Vreme ponovo postaje dostupno za online zakazivanje."
        confirmLabel="Ukloni"
        pendingLabel="Uklanjanje..."
        pending={pending}
        onConfirm={() => blockToRemove && removeBlock(blockToRemove)}
        onCancel={() => setBlockToRemove(null)}
      />
    </div>
  );
}
