"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Pencil, Plus, Scissors, Sparkles, Trash2 } from "lucide-react";
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
import { formatPrice } from "@/lib/booking/slots";
import type { Service } from "@/lib/types";
import {
  deleteService,
  insertSampleServices,
  moveService,
  upsertService,
} from "../actions";

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
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Service | undefined>();
  const [toDelete, setToDelete] = useState<Service | null>(null);
  const [pending, startTransition] = useTransition();
  const [samplesPending, startSamples] = useTransition();

  function addSamples() {
    startSamples(async () => {
      const res = await insertSampleServices();
      if (res.ok) {
        // Primeri se ubacuju samo u prazan cenovnik = praktično uvek tokom
        // vodiča, pa toast nudi povratak na sledeći korak
        toast.success("Ubačeno 8 primera - izmeni cene i trajanja po svom cenovniku.", {
          action: { label: "Sledeći korak", onClick: () => router.push("/admin") },
        });
      } else {
        toast.error(res.error ?? "Greška.");
      }
    });
  }

  function onDelete(id: string) {
    startTransition(async () => {
      const res = await deleteService(id);
      if (!res.ok) toast.error(res.error ?? "Greška.");
      setToDelete(null);
    });
  }

  function move(id: string, direction: "up" | "down") {
    startTransition(async () => {
      const res = await moveService(id, direction);
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
        {services.map((s, i) => (
          <div
            key={s.id}
            className="flex items-center justify-between rounded-2xl bg-white p-4 shadow-[0_4px_24px_rgba(20,25,20,0.06)]"
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
              {/* Redosled na sajtu prati redosled u ovoj listi */}
              <Button
                variant="ghost"
                size="icon"
                title="Pomeri gore"
                disabled={pending || i === 0}
                onClick={() => move(s.id, "up")}
              >
                <ArrowUp className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                title="Pomeri dole"
                disabled={pending || i === services.length - 1}
                onClick={() => move(s.id, "down")}
              >
                <ArrowDown className="size-4" />
              </Button>
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
              <Button variant="ghost" size="icon" onClick={() => setToDelete(s)}>
                <Trash2 className="size-4 text-destructive" />
              </Button>
            </div>
          </div>
        ))}
        {services.length === 0 && (
          <div className="rounded-[2rem] border border-dashed p-8 text-center">
            <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-mint/50 text-ink">
              <Scissors className="size-5" />
            </span>
            <p className="mt-3 text-lg font-bold tracking-tight">Dodaj svoje usluge</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
              Sve što radiš - šišanje, farbanje, brada - sa cenom i trajanjem.
              Trajanje određuje koliko termin zauzima u kalendaru.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <Button
                className="rounded-full"
                onClick={() => {
                  setEditing(undefined);
                  setOpen(true);
                }}
              >
                <Plus className="size-4" /> Dodaj uslugu
              </Button>
              <Button
                variant="outline"
                className="rounded-full"
                disabled={samplesPending}
                onClick={addSamples}
              >
                <Sparkles className="size-4" />
                {samplesPending ? "Ubacivanje..." : "Ubaci primere (8 usluga)"}
              </Button>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Primere posle izmeni ili obriši - tu su da ne krećeš od nule.
            </p>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!toDelete}
        title={`Obrisati uslugu „${toDelete?.name ?? ""}“?`}
        description="Usluga sa postojećim rezervacijama se umesto brisanja deaktivira."
        pending={pending}
        onConfirm={() => toDelete && onDelete(toDelete.id)}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}
