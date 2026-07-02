"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2 } from "lucide-react";
import {
  deleteShiftTemplate,
  updateStaffServices,
  updateWorkingHours,
  upsertShiftTemplate,
} from "../../actions";
import { DAY_NAMES_SR, formatPrice } from "@/lib/booking/slots";
import type { Service, ShiftTemplate, WorkingHours } from "@/lib/types";

interface DayRow {
  dayOfWeek: number;
  isWorking: boolean;
  startTime: string;
  endTime: string;
}

// Prikaz pon–ned (day_of_week: 0 = nedelja)
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

function buildDayRows(hours: WorkingHours[]): DayRow[] {
  return DAY_ORDER.map((dow) => {
    const h = hours.find((x) => x.day_of_week === dow);
    return {
      dayOfWeek: dow,
      isWorking: h?.is_working ?? false,
      startTime: h?.start_time?.slice(0, 5) ?? "09:00",
      endTime: h?.end_time?.slice(0, 5) ?? "17:00",
    };
  });
}

function ShiftTemplatesCard({
  staffId,
  templates,
}: {
  staffId: string;
  templates: ShiftTemplate[];
}) {
  const [name, setName] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("16:00");
  const [pending, startTransition] = useTransition();

  function addTemplate(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await upsertShiftTemplate({ staffId, name, startTime, endTime });
      if (res.ok) {
        toast.success("Smena je dodata.");
        setName("");
      } else {
        toast.error(res.error ?? "Greška.");
      }
    });
  }

  function remove(id: string) {
    if (!confirm("Obrisati smenu? Nestaće i sa svih datuma gde je dodeljena.")) return;
    startTransition(async () => {
      const res = await deleteShiftTemplate(id);
      if (!res.ok) toast.error(res.error ?? "Greška.");
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Smene (šabloni)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {templates.map((t) => (
          <div
            key={t.id}
            className="flex items-center justify-between rounded-lg border px-3 py-2"
          >
            <span className="text-sm">
              <span className="font-medium">{t.name}</span>{" "}
              <span className="text-muted-foreground">
                {t.start_time.slice(0, 5)}–{t.end_time.slice(0, 5)}
              </span>
            </span>
            <Button variant="ghost" size="icon" onClick={() => remove(t.id)}>
              <Trash2 className="size-4 text-destructive" />
            </Button>
          </div>
        ))}
        {templates.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Npr. &quot;Prepodne 09–16&quot; i &quot;Popodne 14–20&quot;. Smene se
            dodeljuju po datumu na stranici Smene.
          </p>
        )}
        <form onSubmit={addTemplate} className="flex flex-wrap items-center gap-2">
          <Input
            placeholder="Naziv (npr. Prepodne)"
            className="w-44"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Input
            type="time"
            className="w-28"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
          />
          <span className="text-muted-foreground">–</span>
          <Input
            type="time"
            className="w-28"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
          />
          <Button type="submit" disabled={pending} variant="outline">
            <Plus className="size-4" /> Dodaj
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export function StaffDetail({
  staffId,
  services,
  assignedServiceIds,
  workingHours,
  shiftTemplates,
}: {
  staffId: string;
  services: Service[];
  assignedServiceIds: string[];
  workingHours: WorkingHours[];
  shiftTemplates: ShiftTemplate[];
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set(assignedServiceIds));
  const [days, setDays] = useState<DayRow[]>(() => buildDayRows(workingHours));
  const [savingServices, startServices] = useTransition();
  const [savingHours, startHours] = useTransition();

  function toggleService(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function setDay(dow: number, patch: Partial<DayRow>) {
    setDays((prev) =>
      prev.map((d) => (d.dayOfWeek === dow ? { ...d, ...patch } : d))
    );
  }

  function saveServices() {
    startServices(async () => {
      const res = await updateStaffServices(staffId, [...selected]);
      if (res.ok) toast.success("Usluge su sačuvane.");
      else toast.error(res.error ?? "Greška.");
    });
  }

  function saveHours() {
    for (const d of days) {
      if (d.isWorking && d.startTime >= d.endTime) {
        toast.error(`${DAY_NAMES_SR[d.dayOfWeek]}: početak mora biti pre kraja.`);
        return;
      }
    }
    startHours(async () => {
      const res = await updateWorkingHours(staffId, days);
      if (res.ok) toast.success("Radno vreme je sačuvano.");
      else toast.error(res.error ?? "Greška.");
    });
  }

  return (
    <div className="space-y-6">
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Radno vreme</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {days.map((d) => (
            <div key={d.dayOfWeek} className="flex items-center gap-3">
              <Switch
                id={`day-${d.dayOfWeek}`}
                checked={d.isWorking}
                onCheckedChange={(c) => setDay(d.dayOfWeek, { isWorking: c })}
              />
              <Label htmlFor={`day-${d.dayOfWeek}`} className="w-24 font-normal">
                {DAY_NAMES_SR[d.dayOfWeek]}
              </Label>
              {d.isWorking ? (
                <div className="flex items-center gap-2">
                  <Input
                    type="time"
                    className="w-28"
                    value={d.startTime}
                    onChange={(e) => setDay(d.dayOfWeek, { startTime: e.target.value })}
                  />
                  <span className="text-muted-foreground">–</span>
                  <Input
                    type="time"
                    className="w-28"
                    value={d.endTime}
                    onChange={(e) => setDay(d.dayOfWeek, { endTime: e.target.value })}
                  />
                </div>
              ) : (
                <span className="text-sm text-muted-foreground">Ne radi</span>
              )}
            </div>
          ))}
          <p className="text-xs text-muted-foreground">
            Ovo je podrazumevana nedelja. Smene za konkretan datum (kada stignu)
            imaju prednost nad ovim rasporedom.
          </p>
          <Button onClick={saveHours} disabled={savingHours} className="mt-2">
            {savingHours ? "Čuvanje..." : "Sačuvaj radno vreme"}
          </Button>
        </CardContent>
      </Card>

      <ShiftTemplatesCard staffId={staffId} templates={shiftTemplates} />
    </div>
  );
}
