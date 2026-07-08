"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { setScheduleException } from "../actions";
import { ScheduleConflictDialog } from "../schedule-conflict-dialog";
import { DAY_NAMES_SR } from "@/lib/booking/slots";
import { parityForStaff, resolveWindow, type WorkWindow } from "@/lib/booking/schedule";
import type {
  ScheduleConflict,
  ScheduleException,
  Staff,
  WorkingHours,
} from "@/lib/types";

// Šrafura = "ne radi" (isti jezik kao blokade u Kalendaru)
const HATCH =
  "repeating-linear-gradient(135deg, rgba(0,0,0,0.07) 0 2px, transparent 2px 8px)";

// "09:00" -> "9", "08:30" -> "8:30" (kraće ćelije, čitljiviji grid)
function fmtT(t: string): string {
  const [h, m] = t.split(":");
  const hh = String(Number(h));
  return m === "00" ? hh : `${hh}:${m}`;
}

function fmtDate(date: string): string {
  const d = new Date(`${date}T12:00:00`);
  return `${DAY_NAMES_SR[d.getDay()].toLowerCase()}, ${d.getDate()}.${d.getMonth() + 1}.`;
}

type CellKind =
  | "shiftA" // pravilo, rotacija - nedelja A
  | "shiftB" // pravilo, rotacija - nedelja B
  | "weekly" // pravilo, ista nedelja
  | "off" // pravilo kaže ne radi
  | "exception" // izuzetak sa vremenom
  | "exceptionOff"; // izuzetak: ne radi taj dan

function cellInfo(
  date: string,
  member: Staff,
  hours: WorkingHours[],
  exception: ScheduleException | undefined
): { window: WorkWindow; kind: CellKind } {
  const window = resolveWindow(date, member, hours, exception ?? null);
  if (exception) {
    return { window, kind: exception.is_off ? "exceptionOff" : "exception" };
  }
  if (!window) return { window, kind: "off" };
  if (member.schedule_mode === "rotating") {
    return { window, kind: parityForStaff(date, member) === 0 ? "shiftA" : "shiftB" };
  }
  return { window, kind: "weekly" };
}

const CHIP_BASE =
  "inline-flex h-7 min-w-16 items-center justify-center rounded-full px-2.5 text-xs whitespace-nowrap transition-shadow hover:ring-2 hover:ring-ink/30";

function CellChip({ window, kind }: { window: WorkWindow; kind: CellKind }) {
  const label = window ? `${fmtT(window.start)}–${fmtT(window.end)}` : "Ne radi";
  switch (kind) {
    case "shiftA":
      return <span className={`${CHIP_BASE} bg-mint/60 font-medium text-ink`}>{label}</span>;
    case "shiftB":
      return <span className={`${CHIP_BASE} bg-lavender/50 font-medium text-ink`}>{label}</span>;
    case "weekly":
      return <span className={`${CHIP_BASE} border border-ink/15 bg-white text-ink/80`}>{label}</span>;
    case "exception":
      return <span className={`${CHIP_BASE} border-2 border-ink bg-white font-semibold text-ink`}>{label}</span>;
    case "exceptionOff":
      return (
        <span
          className={`${CHIP_BASE} border border-ink/10 text-ink/60`}
          style={{ backgroundImage: HATCH }}
        >
          Ne radi
        </span>
      );
    case "off":
      return <span className={`${CHIP_BASE} text-ink/30`}>—</span>;
  }
}

interface EditState {
  staffId: string;
  staffName: string;
  date: string;
  hasException: boolean;
  ruleWindow: WorkWindow; // šta bi važilo bez izuzetka
  working: boolean;
  startTime: string;
  endTime: string;
}

export function ScheduleGrid({
  weekDates,
  today,
  staff,
  hours,
  exceptions,
}: {
  weekDates: string[];
  // "Danas" u zoni salona (server) - browser datum ume da odstupa
  today: string;
  staff: Staff[];
  hours: WorkingHours[];
  exceptions: ScheduleException[];
}) {
  const [edit, setEdit] = useState<EditState | null>(null);
  const [conflicts, setConflicts] = useState<ScheduleConflict[] | null>(null);
  const [lastKind, setLastKind] = useState<"custom" | "off" | "clear">("custom");
  const [pending, startTransition] = useTransition();

  if (staff.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
        Prvo dodaj zaposlene.
      </p>
    );
  }

  const todayStr = today;

  function openCell(member: Staff, date: string) {
    const exception = exceptions.find((e) => e.staff_id === member.id && e.date === date);
    const { window } = cellInfo(date, member, hours, exception);
    const ruleWindow = resolveWindow(date, member, hours, null);
    const prefill = window ?? ruleWindow ?? { start: "09:00", end: "17:00" };
    setEdit({
      staffId: member.id,
      staffName: member.name,
      date,
      hasException: !!exception,
      ruleWindow,
      working: window !== null,
      startTime: prefill.start,
      endTime: prefill.end,
    });
  }

  function submit(kind: "custom" | "off" | "clear", force: boolean) {
    if (!edit) return;
    if (kind === "custom" && edit.startTime >= edit.endTime) {
      toast.error("Početak mora biti pre kraja.");
      return;
    }
    setLastKind(kind);
    startTransition(async () => {
      const res = await setScheduleException({
        staffId: edit.staffId,
        date: edit.date,
        kind,
        startTime: kind === "custom" ? edit.startTime : undefined,
        endTime: kind === "custom" ? edit.endTime : undefined,
        force,
      });
      if (res.ok) {
        setConflicts(null);
        setEdit(null);
        toast.success("Raspored je izmenjen.");
      } else if ("conflicts" in res && res.conflicts) {
        setConflicts(res.conflicts);
      } else {
        toast.error(res.error ?? "Greška.");
      }
    });
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className="border-b p-2 text-left font-medium">Zaposleni</th>
            {weekDates.map((d) => {
              const date = new Date(`${d}T12:00:00`);
              const isToday = d === todayStr;
              return (
                <th
                  key={d}
                  className={`border-b p-2 text-center font-medium ${isToday ? "bg-ink/[0.05]" : ""}`}
                >
                  <div>{DAY_NAMES_SR[date.getDay()].slice(0, 3)}</div>
                  <div className="text-xs font-normal text-muted-foreground">
                    {date.getDate()}.{date.getMonth() + 1}.
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {staff.map((m) => (
            <tr key={m.id}>
              <td className="border-b p-2">
                <div className="flex items-center gap-2.5">
                  {m.photo_url ? (
                    <Image
                      src={m.photo_url}
                      alt=""
                      width={32}
                      height={32}
                      className="size-8 shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-ink/10 text-xs font-bold">
                      {m.name.charAt(0)}
                    </span>
                  )}
                  <div>
                    <div className="font-medium">{m.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {m.schedule_mode === "rotating"
                        ? `Smene · ova nedelja: ${parityForStaff(weekDates[0], m) === 0 ? "A" : "B"}`
                        : "Isto svake nedelje"}
                    </div>
                  </div>
                </div>
              </td>
              {weekDates.map((d) => {
                const exception = exceptions.find(
                  (e) => e.staff_id === m.id && e.date === d
                );
                const info = cellInfo(d, m, hours, exception);
                // Izuzetak za prošli dan nema smisla - ćelija je samo prikaz
                const isPast = d < todayStr;
                return (
                  <td
                    key={d}
                    className={`border-b p-1.5 text-center ${d === todayStr ? "bg-ink/[0.05]" : ""}`}
                  >
                    {isPast ? (
                      <span className="opacity-40" title="Prošao dan">
                        <CellChip window={info.window} kind={info.kind} />
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => openCell(m, d)}
                        title="Izmeni samo ovaj dan"
                        className="cursor-pointer"
                      >
                        <CellChip window={info.window} kind={info.kind} />
                      </button>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-full bg-mint/60" /> smena A
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-full bg-lavender/50" /> smena B
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-full border border-ink/15 bg-white" /> radno vreme
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-full border-2 border-ink bg-white" /> izuzetak za taj dan
        </span>
        <span
          className="flex items-center gap-1.5"
        >
          <span className="size-3 rounded-full border border-ink/10" style={{ backgroundImage: HATCH }} />{" "}
          ne radi (izuzetak)
        </span>
      </div>

      <Dialog open={!!edit && !conflicts} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="sm:max-w-md">
          {edit && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {edit.staffName} — {fmtDate(edit.date)}
                </DialogTitle>
              </DialogHeader>
              <p className="text-sm text-muted-foreground">
                Po pravilu{" "}
                {edit.ruleWindow
                  ? `radi ${edit.ruleWindow.start}–${edit.ruleWindow.end}`
                  : "ne radi"}
                . Izmena važi samo za ovaj datum.
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={edit.working ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => setEdit({ ...edit, working: true })}
                >
                  Radi
                </Button>
                <Button
                  type="button"
                  variant={!edit.working ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => setEdit({ ...edit, working: false })}
                >
                  Ne radi
                </Button>
              </div>
              {edit.working && (
                <div className="flex items-center gap-2">
                  <Label className="font-normal text-muted-foreground">Od</Label>
                  <Input
                    type="time"
                    className="w-28"
                    value={edit.startTime}
                    onChange={(e) => setEdit({ ...edit, startTime: e.target.value })}
                  />
                  <Label className="font-normal text-muted-foreground">do</Label>
                  <Input
                    type="time"
                    className="w-28"
                    value={edit.endTime}
                    onChange={(e) => setEdit({ ...edit, endTime: e.target.value })}
                  />
                </div>
              )}
              <div className="flex items-center justify-between gap-2 pt-1">
                {edit.hasException ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={pending}
                    onClick={() => submit("clear", false)}
                  >
                    Vrati na uobičajeno
                  </Button>
                ) : (
                  <span />
                )}
                <Button
                  type="button"
                  disabled={pending}
                  onClick={() => submit(edit.working ? "custom" : "off", false)}
                >
                  {pending ? "Čuvanje..." : "Sačuvaj"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Za pauzu ili obavezu u toku dana koristi blokadu u{" "}
                <Link href="/admin/kalendar" className="underline">
                  Kalendaru
                </Link>
                .
              </p>
            </>
          )}
        </DialogContent>
      </Dialog>

      <ScheduleConflictDialog
        conflicts={conflicts}
        onCancel={() => setConflicts(null)}
        onConfirm={() => submit(lastKind, true)}
        pending={pending}
      />
    </div>
  );
}
