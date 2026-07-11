"use client";

import { Warning } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DAY_NAMES_SR } from "@/lib/booking/slots";
import { plural } from "@/lib/plural";
import type { ScheduleConflict } from "@/lib/types";

function formatDate(date: string): string {
  const d = new Date(`${date}T12:00:00`);
  return `${DAY_NAMES_SR[d.getDay()].toLowerCase()}, ${d.getDate()}.${d.getMonth() + 1}.`;
}

// Izmena rasporeda koja postojeće rezervacije ostavlja van radnog vremena
// nikad ne prolazi ćutke: vlasnik vidi tačno koje i bira šta dalje.
export function ScheduleConflictDialog({
  conflicts,
  onCancel,
  onConfirm,
  pending,
}: {
  conflicts: ScheduleConflict[] | null;
  onCancel: () => void;
  onConfirm: () => void;
  pending?: boolean;
}) {
  const open = !!conflicts && conflicts.length > 0;
  if (!open) return null;
  const list = conflicts!;

  return (
    <Dialog open onOpenChange={(o) => !o && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Warning className="size-5 text-amber-600" />
            Rezervacije ispadaju iz radnog vremena
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Posle ove izmene {list.length}{" "}
          {plural(list.length, ["rezervacija", "rezervacije", "rezervacija"])} ostaje van radnog
          vremena. Rezervacije se ne otkazuju same — premesti ih ili otkaži u
          meniju Rezervacije, ili sačuvaj izmenu svejedno.
        </p>
        <ul className="max-h-56 space-y-2 overflow-y-auto">
          {list.map((c, i) => (
            <li key={i} className="rounded-lg border px-3 py-2 text-sm">
              <div className="font-medium">
                {formatDate(c.date)} · {c.start_time}–{c.end_time} · {c.staff_name}
              </div>
              <div className="text-muted-foreground">
                {c.customer_name}
                {c.service_name ? ` · ${c.service_name}` : ""}
              </div>
            </li>
          ))}
        </ul>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel}>
            Odustani
          </Button>
          <Button onClick={onConfirm} disabled={pending}>
            {pending ? "Čuvanje..." : "Sačuvaj svejedno"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
