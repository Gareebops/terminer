"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  ArrowDown,
  ArrowUp,
  PencilSimple,
  Plus,
  Scissors,
  Sparkle,
  Trash,
} from "@/components/icons";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { formatPriceRange } from "@/lib/booking/slots";
import type { Service } from "@/lib/types";
import {
  deleteService,
  insertSampleServices,
  moveService,
  upsertService,
  type SampleServiceKind,
} from "../actions";

// Primeri cenovnika po delatnosti - platforma služi svim vrstama salona
const SAMPLE_KINDS: { id: SampleServiceKind; label: string }[] = [
  { id: "frizerski", label: "Frizerski salon" },
  { id: "barbershop", label: "Barbershop" },
  { id: "kozmetika", label: "Kozmetika i nokti" },
  { id: "masaza", label: "Masaža i spa" },
];

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
  // Prazno polje = fiksna cena (price_max null u bazi)
  const [priceMax, setPriceMax] = useState(String(service?.price_max ?? ""));
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
        priceMax: priceMax.trim() === "" ? null : Number(priceMax),
        isActive,
      });
      if (res.ok) {
        toast.success("Sačuvano.");
        onDone();
      } else {
        toast.error(res.error ?? "Nešto nije uspelo. Pokušaj ponovo.");
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
      <div className="grid grid-cols-3 gap-4">
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
        <div className="space-y-2">
          <Label htmlFor="s-price-max">do (opciono)</Label>
          <Input
            id="s-price-max"
            type="number"
            min={0}
            placeholder="raspon"
            value={priceMax}
            onChange={(e) => setPriceMax(e.target.value)}
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

  function addSamples(kind: SampleServiceKind) {
    startSamples(async () => {
      const res = await insertSampleServices(kind);
      if (res.ok) {
        // Primeri se ubacuju samo u prazan cenovnik = praktično uvek tokom
        // vodiča, pa toast nudi povratak na sledeći korak
        toast.success(
          `Ubačeno ${res.count ?? ""} primera - izmeni cene i trajanja po svom cenovniku.`,
          { action: { label: "Sledeći korak", onClick: () => router.push("/admin") } }
        );
      } else {
        toast.error(res.error ?? "Nešto nije uspelo. Pokušaj ponovo.");
      }
    });
  }

  function onDelete(id: string) {
    startTransition(async () => {
      const res = await deleteService(id);
      if (!res.ok) toast.error(res.error ?? "Nešto nije uspelo. Pokušaj ponovo.");
      setToDelete(null);
    });
  }

  function move(id: string, direction: "up" | "down") {
    startTransition(async () => {
      const res = await moveService(id, direction);
      if (!res.ok) toast.error(res.error ?? "Nešto nije uspelo. Pokušaj ponovo.");
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
            className="flex items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow-card"
          >
            <div className="min-w-0">
              <p className="break-words font-medium">
                {s.name}{" "}
                {!s.is_active && <Badge variant="outline">Neaktivna</Badge>}
              </p>
              <p className="text-sm text-muted-foreground">
                {s.duration_minutes} min · {formatPriceRange(s.price, s.price_max, s.currency)}
              </p>
            </div>
            <div className="flex gap-1">
              {/* Redosled na sajtu prati redosled u ovoj listi */}
              <Button
                variant="ghost"
                size="icon"
                className="max-sm:size-10"
                aria-label="Pomeri gore"
                title="Pomeri gore"
                disabled={pending || i === 0}
                onClick={() => move(s.id, "up")}
              >
                <ArrowUp className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="max-sm:size-10"
                aria-label="Pomeri dole"
                title="Pomeri dole"
                disabled={pending || i === services.length - 1}
                onClick={() => move(s.id, "down")}
              >
                <ArrowDown className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="max-sm:size-10"
                aria-label="Izmeni"
                title="Izmeni"
                onClick={() => {
                  setEditing(s);
                  setOpen(true);
                }}
              >
                <PencilSimple className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="max-sm:size-10"
                aria-label={`Obriši uslugu „${s.name}“`}
                title="Obriši"
                onClick={() => setToDelete(s)}
              >
                <Trash className="size-4 text-destructive" />
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
            <p className="mx-auto mt-1 max-w-md text-sm text-ink/70">
              Sve što radiš - od šišanja do masaže - sa cenom i trajanjem.
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
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="rounded-full"
                    disabled={samplesPending}
                  >
                    <Sparkle className="size-4" />
                    {samplesPending ? "Ubacivanje..." : "Ubaci primere za..."}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center">
                  {SAMPLE_KINDS.map((k) => (
                    <DropdownMenuItem key={k.id} onClick={() => addSamples(k.id)}>
                      {k.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <p className="mt-3 text-xs text-ink/70">
              Izaberi svoju delatnost - primere posle izmeni ili obriši, tu su
              da ne krećeš od nule.
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
