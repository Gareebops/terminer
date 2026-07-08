"use client";

import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Copy, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import { prepareImageForUpload } from "@/lib/image";
import {
  updateStaffHorizon,
  updateStaffPhoto,
  updateStaffServices,
  updateStaffSchedule,
} from "../../actions";
import { DAY_NAMES_SR, formatDateISO, formatPrice } from "@/lib/booking/slots";
import {
  addDaysISO,
  DEFAULT_HORIZON_DAYS,
  mondayOf,
  weekParityFor,
} from "@/lib/booking/schedule";
import { ScheduleConflictDialog } from "../../schedule-conflict-dialog";
import type {
  ScheduleConflict,
  ScheduleMode,
  Service,
  Staff,
  WorkingHours,
} from "@/lib/types";

interface DayRow {
  dayOfWeek: number;
  isWorking: boolean;
  startTime: string;
  endTime: string;
}

// Prikaz pon–ned (day_of_week: 0 = nedelja)
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

function buildDayRows(hours: WorkingHours[], parity: 0 | 1, fallback?: DayRow[]): DayRow[] {
  return DAY_ORDER.map((dow, i) => {
    const h = hours.find((x) => x.day_of_week === dow && x.week_parity === parity);
    if (!h && fallback) return { ...fallback[i] };
    return {
      dayOfWeek: dow,
      isWorking: h?.is_working ?? false,
      startTime: h?.start_time?.slice(0, 5) ?? "09:00",
      endTime: h?.end_time?.slice(0, 5) ?? "17:00",
    };
  });
}

function validateDays(days: DayRow[], prefix: string): string | null {
  for (const d of days) {
    if (d.isWorking && d.startTime >= d.endTime) {
      return `${prefix}${DAY_NAMES_SR[d.dayOfWeek]}: početak mora biti pre kraja.`;
    }
  }
  return null;
}

function PhotoCard({
  staffId,
  tenantId,
  photoUrl,
}: {
  staffId: string;
  tenantId: string;
  photoUrl: string | null;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Izaberi sliku (JPG, PNG ili WebP).");
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      toast.error("Slika je veća od 15 MB.");
      return;
    }
    startTransition(async () => {
      // Kompresija/WebP pre uploada - i HEIC sa iPhone-a postaje upotrebljiv
      const prepared = await prepareImageForUpload(file, 800);
      if ("error" in prepared) {
        toast.error(prepared.error);
        return;
      }
      const supabase = createClient();
      // Timestamp u imenu razbija keš pri zameni slike
      const path = `${tenantId}/staff/${staffId}-${Date.now()}.${prepared.ext}`;
      const { error } = await supabase.storage
        .from("tenant-media")
        .upload(path, prepared.blob, { upsert: true, contentType: prepared.blob.type });
      if (error) {
        toast.error("Upload nije uspeo. Pokušaj ponovo.");
        return;
      }
      const { data } = supabase.storage.from("tenant-media").getPublicUrl(path);
      const res = await updateStaffPhoto(staffId, data.publicUrl);
      if (res.ok) toast.success("Fotografija je sačuvana.");
      else toast.error(res.error ?? "Greška.");
    });
  }

  function removePhoto() {
    startTransition(async () => {
      const res = await updateStaffPhoto(staffId, null);
      if (res.ok) toast.success("Fotografija je uklonjena.");
      else toast.error(res.error ?? "Greška.");
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Fotografija</CardTitle>
      </CardHeader>
      <CardContent className="flex items-center gap-4">
        {photoUrl ? (
          <Image
            src={photoUrl}
            alt="Fotografija zaposlenog"
            width={80}
            height={80}
            className="size-20 rounded-full object-cover"
          />
        ) : (
          <div className="flex size-20 items-center justify-center rounded-full bg-muted text-sm text-muted-foreground">
            Nema
          </div>
        )}
        <div className="flex gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onFile}
          />
          <Button
            variant="outline"
            disabled={pending}
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="size-4" />
            {pending ? "Otpremanje..." : photoUrl ? "Zameni" : "Otpremi"}
          </Button>
          {photoUrl && (
            <Button variant="ghost" disabled={pending} onClick={removePhoto}>
              Ukloni
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function DayRowsEditor({
  days,
  onChange,
}: {
  days: DayRow[];
  onChange: (days: DayRow[]) => void;
}) {
  function setDay(dow: number, patch: Partial<DayRow>) {
    onChange(days.map((d) => (d.dayOfWeek === dow ? { ...d, ...patch } : d)));
  }

  return (
    <div className="space-y-3">
      {days.map((d) => (
        // Na telefonu red ne staje u širinu (prekid + w-full gura vremena u
        // svoj red, uvučen ispod naziva dana); od sm: sve u jednoj liniji
        <div key={d.dayOfWeek} className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <Switch
            checked={d.isWorking}
            onCheckedChange={(c) => setDay(d.dayOfWeek, { isWorking: c })}
          />
          <Label
            className="w-24 font-normal"
            onClick={() => setDay(d.dayOfWeek, { isWorking: !d.isWorking })}
          >
            {DAY_NAMES_SR[d.dayOfWeek]}
          </Label>
          {d.isWorking ? (
            <div className="flex w-full items-center gap-2 pl-12 sm:w-auto sm:pl-0">
              <Input
                type="time"
                className="min-w-0 flex-1 sm:w-28 sm:flex-none"
                value={d.startTime}
                onChange={(e) => setDay(d.dayOfWeek, { startTime: e.target.value })}
              />
              <span className="text-muted-foreground">–</span>
              <Input
                type="time"
                className="min-w-0 flex-1 sm:w-28 sm:flex-none"
                value={d.endTime}
                onChange={(e) => setDay(d.dayOfWeek, { endTime: e.target.value })}
              />
            </div>
          ) : (
            <span className="text-sm text-muted-foreground">Ne radi</span>
          )}
        </div>
      ))}
    </div>
  );
}

// Koliko dana unapred klijenti vide termine kod ovog zaposlenog.
// Čuva se odmah pri izboru - podešavanje, ne forma.
const HORIZON_OPTIONS = [
  { value: 3, label: "3 dana" },
  { value: 7, label: "7 dana" },
  { value: 14, label: "14 dana" },
  { value: 30, label: "30 dana" },
  { value: 60, label: "60 dana (podrazumevano)" },
  { value: 90, label: "90 dana" },
];

function HorizonCard({ staff }: { staff: Staff }) {
  const [value, setValue] = useState(
    String(staff.booking_horizon_days ?? DEFAULT_HORIZON_DAYS)
  );
  const [pending, startTransition] = useTransition();

  function onChange(v: string) {
    const prev = value;
    setValue(v);
    startTransition(async () => {
      const res = await updateStaffHorizon(staff.id, Number(v));
      if (res.ok) {
        toast.success("Sačuvano.");
      } else {
        setValue(prev);
        toast.error(res.error ?? "Greška.");
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Zakazivanje unapred</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Label className="font-normal">Klijenti vide narednih</Label>
          <Select value={value} onValueChange={onChange} disabled={pending}>
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {HORIZON_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={String(o.value)}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <p className="text-xs text-muted-foreground">
          Kraći horizont je zgodan kad se raspored često menja - klijenti ne
          mogu da zakažu dalje nego što je raspored siguran. Već zakazani
          termini ostaju i ako horizont skratiš.
        </p>
      </CardContent>
    </Card>
  );
}

function ScheduleCard({
  staff,
  workingHours,
  guideActive,
}: {
  staff: Staff;
  workingHours: WorkingHours[];
  guideActive: boolean;
}) {
  const router = useRouter();
  const today = formatDateISO(new Date());
  const [mode, setMode] = useState<ScheduleMode>(staff.schedule_mode);
  const [thisWeekParity, setThisWeekParity] = useState<0 | 1>(
    staff.schedule_mode === "rotating" && staff.rotation_anchor
      ? weekParityFor(today, staff.rotation_anchor)
      : 0
  );
  const [weekA, setWeekA] = useState<DayRow[]>(() => buildDayRows(workingHours, 0));
  const [weekB, setWeekB] = useState<DayRow[]>(() =>
    buildDayRows(workingHours, 1, buildDayRows(workingHours, 0))
  );
  const [conflicts, setConflicts] = useState<ScheduleConflict[] | null>(null);
  const [pending, startTransition] = useTransition();

  const monday = mondayOf(today);
  const sunday = addDaysISO(monday, 6);
  const weekLabel = `${dayMonth(monday)} – ${dayMonth(sunday)}`;

  function dayMonth(iso: string): string {
    const d = new Date(`${iso}T12:00:00`);
    return `${d.getDate()}.${d.getMonth() + 1}.`;
  }

  function save(force: boolean) {
    const err =
      validateDays(weekA, mode === "rotating" ? "Nedelja A — " : "") ??
      (mode === "rotating" ? validateDays(weekB, "Nedelja B — ") : null);
    if (err) {
      toast.error(err);
      return;
    }
    startTransition(async () => {
      const res = await updateStaffSchedule({
        staffId: staff.id,
        mode,
        thisWeekParity: mode === "rotating" ? thisWeekParity : undefined,
        weekA,
        weekB: mode === "rotating" ? weekB : undefined,
        force,
      });
      if (res.ok) {
        setConflicts(null);
        // Tokom vodiča: čuvanje radnog vremena je štikliralo korak, pa
        // toast nudi povratak na vodič
        toast.success(
          "Radno vreme je sačuvano.",
          guideActive
            ? { action: { label: "Nastavi vodič", onClick: () => router.push("/admin") } }
            : undefined
        );
      } else if ("conflicts" in res && res.conflicts) {
        setConflicts(res.conflicts);
      } else {
        toast.error(res.error ?? "Greška.");
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Radno vreme</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs value={mode} onValueChange={(v) => setMode(v as ScheduleMode)}>
          <TabsList>
            <TabsTrigger value="weekly">Isto svake nedelje</TabsTrigger>
            <TabsTrigger value="rotating">Smene A i B</TabsTrigger>
          </TabsList>
        </Tabs>

        {mode === "weekly" ? (
          <DayRowsEditor days={weekA} onChange={setWeekA} />
        ) : (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <Label className="font-normal">Ova nedelja ({weekLabel}) je:</Label>
              <Select
                value={String(thisWeekParity)}
                onValueChange={(v) => setThisWeekParity(Number(v) as 0 | 1)}
              >
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Smena A</SelectItem>
                  <SelectItem value="1">Smena B</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">
              Smene se dalje smenjuju same: posle A ide B, pa opet A — ne moraš
              ništa da popunjavaš iz nedelje u nedelju.
            </p>
            <div className="space-y-3">
              <p className="text-sm font-medium">Smena A</p>
              <DayRowsEditor days={weekA} onChange={setWeekA} />
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Smena B</p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setWeekB(weekA.map((d) => ({ ...d })))}
                >
                  <Copy className="size-3.5" /> Prepiši iz A
                </Button>
              </div>
              <DayRowsEditor days={weekB} onChange={setWeekB} />
            </div>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Slobodan dan, odmor ili drugačije vreme za pojedinačan datum se
          podešavaju na stranici Raspored.
        </p>
        <Button onClick={() => save(false)} disabled={pending} className="mt-2">
          {pending ? "Čuvanje..." : "Sačuvaj radno vreme"}
        </Button>
      </CardContent>

      <ScheduleConflictDialog
        conflicts={conflicts}
        onCancel={() => setConflicts(null)}
        onConfirm={() => save(true)}
        pending={pending}
      />
    </Card>
  );
}

export function StaffDetail({
  staff,
  services,
  assignedServiceIds,
  workingHours,
  guideActive,
}: {
  staff: Staff;
  services: Service[];
  assignedServiceIds: string[];
  workingHours: WorkingHours[];
  guideActive: boolean;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set(assignedServiceIds));
  const [savingServices, startServices] = useTransition();

  function toggleService(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function saveServices() {
    startServices(async () => {
      const res = await updateStaffServices(staff.id, [...selected]);
      if (res.ok) toast.success("Usluge su sačuvane.");
      else toast.error(res.error ?? "Greška.");
    });
  }

  return (
    <div className="space-y-6">
      <PhotoCard staffId={staff.id} tenantId={staff.tenant_id} photoUrl={staff.photo_url} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Usluge koje radi</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {services.map((s) => (
            <div key={s.id} className="flex items-center gap-3">
              <Checkbox
                id={`svc-${s.id}`}
                checked={selected.has(s.id)}
                onCheckedChange={(c) => toggleService(s.id, c === true)}
              />
              <Label htmlFor={`svc-${s.id}`} className="flex-1 font-normal">
                {s.name}
                <span className="ml-2 text-muted-foreground">
                  {s.duration_minutes} min · {formatPrice(s.price, s.currency)}
                </span>
              </Label>
            </div>
          ))}
          {services.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Prvo dodaj usluge u meniju Usluge.
            </p>
          )}
          <Button
            onClick={saveServices}
            disabled={savingServices || services.length === 0}
            className="mt-2"
          >
            {savingServices ? "Čuvanje..." : "Sačuvaj usluge"}
          </Button>
        </CardContent>
      </Card>

      <ScheduleCard staff={staff} workingHours={workingHours} guideActive={guideActive} />

      <HorizonCard staff={staff} />
    </div>
  );
}
