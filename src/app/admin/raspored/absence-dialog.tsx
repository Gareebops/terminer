"use client";

import { useState, useTransition } from "react";
import { CalendarSlash } from "@/components/icons";
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
import { createAbsence } from "../actions";
import { ScheduleConflictDialog } from "../schedule-conflict-dialog";
import { formatDateISO } from "@/lib/booking/slots";
import type { ScheduleConflict, Staff } from "@/lib/types";

// Odmor/bolovanje: opseg datuma odjednom, umesto klika po danu
export function AbsenceDialog({ staff }: { staff: Staff[] }) {
  const today = formatDateISO(new Date());
  const [open, setOpen] = useState(false);
  const [who, setWho] = useState("all");
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [conflicts, setConflicts] = useState<ScheduleConflict[] | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(force: boolean) {
    if (!from || !to || from > to) {
      toast.error("Proveri datume: 'od' mora biti pre 'do'.");
      return;
    }
    startTransition(async () => {
      const res = await createAbsence({
        staffIds: who === "all" ? staff.map((m) => m.id) : [who],
        from,
        to,
        force,
      });
      if (res.ok) {
        setConflicts(null);
        setOpen(false);
        toast.success("Odsustvo je upisano.");
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
          <Button variant="outline" disabled={staff.length === 0}>
            <CalendarSlash className="size-4" /> Odsustvo
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Odsustvo (odmor, bolovanje...)</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Za izabrane dane se ne primaju rezervacije. Pojedinačan dan se
            kasnije vraća klikom na njega u rasporedu.
          </p>
          <div className="space-y-2">
            <Label>Ko odsustvuje</Label>
            <Select value={who} onValueChange={setWho}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Svi zaposleni (npr. praznik)</SelectItem>
                {staff.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="abs-from">Od</Label>
              <Input
                id="abs-from"
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="abs-to">Do (uključeno)</Label>
              <Input
                id="abs-to"
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>
          </div>
          <Button disabled={pending} onClick={() => submit(false)}>
            {pending ? "Upisivanje..." : "Upiši odsustvo"}
          </Button>
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
