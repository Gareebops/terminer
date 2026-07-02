"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { ChevronRight, Pencil, Plus, Trash2 } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { Staff } from "@/lib/types";
import { deleteStaff, upsertStaff } from "../actions";

function StaffForm({ member, onDone }: { member?: Staff; onDone: () => void }) {
  const [name, setName] = useState(member?.name ?? "");
  const [bio, setBio] = useState(member?.bio ?? "");
  const [isActive, setIsActive] = useState(member?.is_active ?? true);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await upsertStaff({ id: member?.id, name, bio, isActive });
      if (res.ok) {
        toast.success("Sačuvano.");
        onDone();
      } else {
        toast.error(res.error ?? "Greška.");
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="st-name">Ime *</Label>
        <Input id="st-name" required value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="st-bio">Kratak opis</Label>
        <Textarea id="st-bio" value={bio} onChange={(e) => setBio(e.target.value)} />
      </div>
      <div className="flex items-center gap-2">
        <Switch id="st-active" checked={isActive} onCheckedChange={setIsActive} />
        <Label htmlFor="st-active">Aktivan (prima rezervacije)</Label>
      </div>
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Čuvanje..." : "Sačuvaj"}
      </Button>
    </form>
  );
}

export function StaffManager({ staff }: { staff: Staff[] }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Staff | undefined>();
  const [, startTransition] = useTransition();

  function onDelete(id: string) {
    if (!confirm("Obrisati zaposlenog?")) return;
    startTransition(async () => {
      const res = await deleteStaff(id);
      if (!res.ok) toast.error(res.error ?? "Greška.");
    });
  }

  return (
    <div>
      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) setEditing(undefined);
        }}
      >
        <DialogTrigger asChild>
          <Button>
            <Plus className="size-4" /> Dodaj zaposlenog
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Izmeni zaposlenog" : "Novi zaposleni"}</DialogTitle>
          </DialogHeader>
          <StaffForm
            key={editing?.id ?? "new"}
            member={editing}
            onDone={() => {
              setOpen(false);
              setEditing(undefined);
            }}
          />
        </DialogContent>
      </Dialog>

      <div className="mt-4 space-y-2">
        {staff.map((m) => (
          <div
            key={m.id}
            className="flex items-center justify-between rounded-lg border p-4"
          >
            <Link
              href={`/admin/zaposleni/${m.id}`}
              className="flex flex-1 items-center gap-3"
            >
              <div className="flex size-10 items-center justify-center rounded-full bg-muted font-semibold">
                {m.name.charAt(0)}
              </div>
              <div>
                <p className="font-medium">
                  {m.name}{" "}
                  {!m.is_active && <Badge variant="outline">Neaktivan</Badge>}
                </p>
                <p className="text-sm text-muted-foreground">
                  {m.bio ?? "Usluge i radno vreme"}
                </p>
              </div>
              <ChevronRight className="ml-auto size-4 text-muted-foreground" />
            </Link>
            <div className="ml-3 flex gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setEditing(m);
                  setOpen(true);
                }}
              >
                <Pencil className="size-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => onDelete(m.id)}>
                <Trash2 className="size-4 text-destructive" />
              </Button>
            </div>
          </div>
        ))}
        {staff.length === 0 && (
          <p className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
            Dodaj bar jednog zaposlenog da bi zakazivanje radilo.
          </p>
        )}
      </div>
    </div>
  );
}
