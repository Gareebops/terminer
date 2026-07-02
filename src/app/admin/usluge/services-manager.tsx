"use client";

import { useState, useTransition } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
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
import { formatPrice } from "@/lib/booking/slots";
import type { Service } from "@/lib/types";
import { deleteService, upsertService } from "../actions";

function ServiceForm({
  service,
  onDone,
}: {
  service?: Service;
  onDone: () => void;
}) {
  const [name, setName] = useState(service?.name ?? "");
  const [description, setDescription] = useState(service?.description ?? "");
  const [duration, setDuration] = useState(String(service?.duration_minutes ?? 30));
  const [price, setPrice] = useState(String(service?.price ?? ""));
  const [isActive, setIsActive] = useState(service?.is_active ?? true);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await upsertService({
        id: service?.id,
        name,
        description,
        durationMinutes: Number(duration),
        price: Number(price || 0),
        isActive,
      });
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
        <Label htmlFor="s-name">Naziv *</Label>
        <Input id="s-name" required value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="s-desc">Opis</Label>
        <Textarea
          id="s-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="s-duration">Trajanje (min) *</Label>
          <Input
            id="s-duration"
            type="number"
            min={5}
            max={480}
            step={5}
            required
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="s-price">Cena (RSD)</Label>
          <Input
            id="s-price"
            type="number"
            min={0}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Switch id="s-active" checked={isActive} onCheckedChange={setIsActive} />
        <Label htmlFor="s-active">Aktivna (vidljiva za zakazivanje)</Label>
      </div>
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Čuvanje..." : "Sačuvaj"}
      </Button>
    </form>
  );
}

export function ServicesManager({ services }: { services: Service[] }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Service | undefined>();
  const [, startTransition] = useTransition();

  function onDelete(id: string) {
    if (!confirm("Obrisati uslugu?")) return;
    startTransition(async () => {
      const res = await deleteService(id);
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
            <Plus className="size-4" /> Dodaj uslugu
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Izmeni uslugu" : "Nova usluga"}</DialogTitle>
          </DialogHeader>
          <ServiceForm
            key={editing?.id ?? "new"}
            service={editing}
            onDone={() => {
              setOpen(false);
              setEditing(undefined);
            }}
          />
        </DialogContent>
      </Dialog>

      <div className="mt-4 space-y-2">
        {services.map((s) => (
          <div
            key={s.id}
            className="flex items-center justify-between rounded-lg border p-4"
          >
            <div>
              <p className="font-medium">
                {s.name}{" "}
                {!s.is_active && <Badge variant="outline">Neaktivna</Badge>}
              </p>
              <p className="text-sm text-muted-foreground">
                {s.duration_minutes} min · {formatPrice(s.price, s.currency)}
              </p>
            </div>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setEditing(s);
                  setOpen(true);
                }}
              >
                <Pencil className="size-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => onDelete(s.id)}>
                <Trash2 className="size-4 text-destructive" />
              </Button>
            </div>
          </div>
        ))}
        {services.length === 0 && (
          <p className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
            Još nema usluga. Dodaj prvu da bi klijenti mogli da zakazuju.
          </p>
        )}
      </div>
    </div>
  );
}
