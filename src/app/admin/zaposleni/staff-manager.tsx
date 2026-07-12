"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { ConfirmDialog } from "@/components/confirm-dialog";
import type { Staff } from "@/lib/types";
import { deleteStaff, upsertStaff } from "../actions";

function StaffForm({
  member,
  onDone,
}: {
  member?: Staff;
  onDone: (createdId?: string) => void;
}) {
  const [name, setName] = useState(member?.name ?? "");
  const [bio, setBio] = useState(member?.bio ?? "");
  const [isActive, setIsActive] = useState(member?.is_active ?? true);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await upsertStaff({ id: member?.id, name, bio, isActive });
      if (res.ok) {
        if (!member) {
          onDone(res.id);
        } else {
          toast.success("Sačuvano.");
          onDone();
        }
      } else {
        toast.error(res.error ?? "Nešto nije uspelo. Pokušaj ponovo.");
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
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Staff | undefined>();
  const [toDelete, setToDelete] = useState<Staff | null>(null);
  const [pending, startTransition] = useTransition();

  function onDelete(id: string) {
    startTransition(async () => {
      const res = await deleteStaff(id);
      if (!res.ok) toast.error(res.error ?? "Nešto nije uspelo. Pokušaj ponovo.");
      setToDelete(null);
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
            onDone={(createdId) => {
              setOpen(false);
              setEditing(undefined);
              // Nov zaposleni: pravo na njegovu stranicu - tamo su usluge,
              // radno vreme i fotografija koje treba proveriti
              if (createdId) {
                toast.success("Dodato - proveri usluge koje radi i radno vreme.");
                router.push(`/admin/zaposleni/${createdId}`);
              }
            }}
          />
        </DialogContent>
      </Dialog>

      <div className="mt-4 space-y-2">
        {staff.map((m) => (
          <div
            key={m.id}
            className="flex items-center justify-between rounded-2xl bg-white p-4 shadow-card"
          >
            <Link
              href={`/admin/zaposleni/${m.id}`}
              className="flex min-w-0 flex-1 items-center gap-3"
            >
              {/* Fotografija (kao u kalendaru/rasporedu/wizardu) - lakše
                  prepoznavanje; inicijal je fallback */}
              {m.photo_url ? (
                <Image
                  src={m.photo_url}
                  alt=""
                  width={40}
                  height={40}
                  className="size-10 shrink-0 rounded-full object-cover"
                />
              ) : (
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted font-semibold">
                  {m.name.charAt(0)}
                </div>
              )}
              <div className="min-w-0">
                <p className="break-words font-medium">
                  {m.name}{" "}
                  {!m.is_active && <Badge variant="outline">Neaktivan</Badge>}
                </p>
                <p className="line-clamp-1 text-sm text-muted-foreground">
                  {m.bio ?? "Usluge i radno vreme"}
                </p>
              </div>
              <ChevronRight className="ml-auto size-4 text-muted-foreground" />
            </Link>
            <div className="ml-3 flex gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="max-sm:size-10"
                aria-label="Izmeni"
                title="Izmeni"
                onClick={() => {
                  setEditing(m);
                  setOpen(true);
                }}
              >
                <Pencil className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="max-sm:size-10"
                aria-label={`Obriši zaposlenog „${m.name}“`}
                title="Obriši"
                onClick={() => setToDelete(m)}
              >
                <Trash2 className="size-4 text-destructive" />
              </Button>
            </div>
          </div>
        ))}
        {staff.length === 0 && (
          <div className="rounded-[2rem] border border-dashed p-8 text-center">
            <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-lavender/60 text-ink">
              <Plus className="size-5" />
            </span>
            <p className="mt-3 text-lg font-bold tracking-tight">Dodaj svoj tim</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-ink/70">
              I ako radiš sam - ti si tim. Klijenti biraju kod koga zakazuju, a
              slobodni termini se prave od radnog vremena. Novi zaposleni odmah
              dobija pon-sub 09-20, lako se menja.
            </p>
            <Button
              className="mt-5 rounded-full"
              onClick={() => {
                setEditing(undefined);
                setOpen(true);
              }}
            >
              <Plus className="size-4" /> Dodaj zaposlenog
            </Button>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!toDelete}
        title={`Obrisati zaposlenog „${toDelete?.name ?? ""}“?`}
        description="Zaposleni sa postojećim rezervacijama se umesto brisanja deaktivira."
        pending={pending}
        onConfirm={() => toDelete && onDelete(toDelete.id)}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}
