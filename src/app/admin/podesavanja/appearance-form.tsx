"use client";

import Image from "next/image";
import { useRef, useState, useTransition } from "react";
import { Check, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { createClient } from "@/lib/supabase/client";
import { prepareImageForUpload } from "@/lib/image";
import { brandGradient, gradientForeground } from "@/lib/color";
import { FONT_PAIRS, type FontPairId } from "@/lib/fonts";
import type { ButtonStyle, SiteTheme } from "@/lib/types";
import { updateAppearance, updateSiteImage } from "../actions";

const BUTTON_STYLES: { id: ButtonStyle; label: string; radius: string }[] = [
  { id: "rounded", label: "Zaobljena", radius: "0.5rem" },
  { id: "pill", label: "Pil", radius: "999px" },
  { id: "square", label: "Uglasta", radius: "0.25rem" },
];

const PRESETS: { name: string; value: string }[] = [
  { name: "Ugalj", value: "#18181b" },
  { name: "Zlatna", value: "#b45309" },
  { name: "Bordo", value: "#881337" },
  { name: "Tamnoplava", value: "#1e3a8a" },
  { name: "Zelena", value: "#166534" },
  { name: "Ljubičasta", value: "#6b21a8" },
];

function ImageUploadRow({
  kind,
  label,
  hint,
  tenantId,
  currentUrl,
  preview,
  onSaved,
}: {
  kind: "logo" | "hero";
  label: string;
  hint: string;
  tenantId: string;
  currentUrl: string | null;
  preview: "square" | "wide";
  onSaved?: () => void;
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
      // Logo ostaje mali, hero ide preko celog ekrana - različite dimenzije
      const prepared = await prepareImageForUpload(file, kind === "logo" ? 512 : 1920);
      if ("error" in prepared) {
        toast.error(prepared.error);
        return;
      }
      const supabase = createClient();
      const path = `${tenantId}/site/${kind}-${Date.now()}.${prepared.ext}`;
      const { error } = await supabase.storage
        .from("tenant-media")
        .upload(path, prepared.blob, { upsert: true, contentType: prepared.blob.type });
      if (error) {
        toast.error("Upload nije uspeo. Pokušaj ponovo.");
        return;
      }
      const { data } = supabase.storage.from("tenant-media").getPublicUrl(path);
      const res = await updateSiteImage(kind, data.publicUrl);
      if (res.ok) {
        toast.success("Sačuvano.");
        onSaved?.();
      } else {
        toast.error(res.error ?? "Greška.");
      }
    });
  }

  function remove() {
    startTransition(async () => {
      const res = await updateSiteImage(kind, null);
      if (res.ok) {
        toast.success("Uklonjeno.");
        onSaved?.();
      } else {
        toast.error(res.error ?? "Greška.");
      }
    });
  }

  return (
    <div className="flex items-center gap-4">
      {currentUrl ? (
        <Image
          src={currentUrl}
          alt={label}
          width={preview === "square" ? 56 : 112}
          height={56}
          className={
            preview === "square"
              ? "size-14 rounded-lg object-cover"
              : "h-14 w-28 rounded-lg object-cover"
          }
        />
      ) : (
        <div
          className={`flex h-14 items-center justify-center rounded-lg bg-muted text-xs text-muted-foreground ${preview === "square" ? "w-14" : "w-28"}`}
        >
          Nema
        </div>
      )}
      <div className="flex-1">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onFile}
      />
      <div className="flex gap-1">
        <Button
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() => fileRef.current?.click()}
        >
          <Upload className="size-4" />
          {pending ? "..." : currentUrl ? "Zameni" : "Otpremi"}
        </Button>
        {currentUrl && (
          <Button variant="ghost" size="sm" disabled={pending} onClick={remove}>
            Ukloni
          </Button>
        )}
      </div>
    </div>
  );
}

export function AppearanceForm({
  tenantId,
  primaryColor,
  logoUrl,
  heroImageUrl,
  theme,
  onSaved,
}: {
  tenantId: string;
  primaryColor: string;
  logoUrl: string | null;
  heroImageUrl: string | null;
  theme: SiteTheme | null;
  onSaved?: () => void;
}) {
  const [color, setColor] = useState(primaryColor);
  const [fontPair, setFontPair] = useState<FontPairId>(
    (theme?.font_pair as FontPairId) ?? "geist"
  );
  const [darkMode, setDarkMode] = useState(theme?.mode === "dark");
  const [buttonStyle, setButtonStyle] = useState<ButtonStyle>(
    theme?.button_style ?? "rounded"
  );
  const [pending, startTransition] = useTransition();

  function saveColor(next: string) {
    setColor(next);
    startTransition(async () => {
      const res = await updateAppearance({ primaryColor: next });
      if (res.ok) {
        toast.success("Boja je sačuvana.");
        onSaved?.();
      } else {
        toast.error(res.error ?? "Greška.");
      }
    });
  }

  function saveFontPair(next: FontPairId) {
    setFontPair(next);
    startTransition(async () => {
      const res = await updateAppearance({ fontPair: next });
      if (res.ok) {
        toast.success("Fontovi su sačuvani.");
        onSaved?.();
      } else {
        toast.error(res.error ?? "Greška.");
      }
    });
  }

  function saveButtonStyle(next: ButtonStyle) {
    setButtonStyle(next);
    startTransition(async () => {
      const res = await updateAppearance({ buttonStyle: next });
      if (res.ok) {
        toast.success("Dizajn dugmadi je sačuvan.");
        onSaved?.();
      } else {
        toast.error(res.error ?? "Greška.");
      }
    });
  }

  function saveMode(dark: boolean) {
    setDarkMode(dark);
    startTransition(async () => {
      const res = await updateAppearance({ mode: dark ? "dark" : "light" });
      if (res.ok) {
        toast.success(dark ? "Tamna varijanta." : "Svetla varijanta.");
        onSaved?.();
      } else {
        toast.error(res.error ?? "Greška.");
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Izgled sajta</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <Label>Boja brenda</Label>
          <p className="mb-3 mt-1 text-xs text-muted-foreground">
            Koristi se za dugmad i akcente na tvom sajtu i pri zakazivanju.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.value}
                type="button"
                title={p.name}
                disabled={pending}
                onClick={() => saveColor(p.value)}
                className="flex size-9 items-center justify-center rounded-full ring-2 ring-transparent transition hover:scale-105 data-[active=true]:ring-ring"
                data-active={color.toLowerCase() === p.value}
                style={{ backgroundColor: p.value, backgroundImage: brandGradient(p.value) }}
              >
                {color.toLowerCase() === p.value && (
                  <Check className="size-4 text-white" />
                )}
              </button>
            ))}
            <label
              className="flex h-9 cursor-pointer items-center gap-2 rounded-full border px-3 text-sm"
              title="Sopstvena boja"
            >
              <input
                type="color"
                value={color}
                disabled={pending}
                onChange={(e) => setColor(e.target.value)}
                onBlur={(e) => {
                  if (e.target.value.toLowerCase() !== primaryColor.toLowerCase()) {
                    saveColor(e.target.value);
                  }
                }}
                className="size-5 cursor-pointer appearance-none border-0 bg-transparent p-0"
              />
              Druga boja
            </label>
          </div>
        </div>

        <div>
          <Label>Fontovi</Label>
          <p className="mb-3 mt-1 text-xs text-muted-foreground">
            Karakter sajta - naslovi i tekst. Promena se vidi u pregledu desno.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {FONT_PAIRS.map((p) => (
              <button
                key={p.id}
                type="button"
                disabled={pending}
                onClick={() => saveFontPair(p.id)}
                data-active={fontPair === p.id}
                className="rounded-lg border p-3 text-left transition hover:bg-accent data-[active=true]:border-ring data-[active=true]:ring-1 data-[active=true]:ring-ring"
              >
                <p className="text-sm font-semibold">{p.label}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{p.description}</p>
              </button>
            ))}
          </div>
        </div>

        <div>
          <Label>Dizajn dugmadi</Label>
          <p className="mb-3 mt-1 text-xs text-muted-foreground">
            Oblik dugmadi na sajtu i pri zakazivanju.
          </p>
          <div className="grid grid-cols-3 gap-2">
            {BUTTON_STYLES.map((s) => (
              <button
                key={s.id}
                type="button"
                disabled={pending}
                onClick={() => saveButtonStyle(s.id)}
                data-active={buttonStyle === s.id}
                className="flex flex-col items-center gap-2 rounded-lg border p-3 transition hover:bg-accent data-[active=true]:border-ring data-[active=true]:ring-1 data-[active=true]:ring-ring"
              >
                <span
                  className="flex h-7 w-full max-w-24 items-center justify-center text-xs font-medium"
                  style={{
                    backgroundColor: color,
                    backgroundImage: brandGradient(color),
                    color: gradientForeground(color),
                    borderRadius: s.radius,
                  }}
                >
                  Zakaži
                </span>
                <span className="text-xs font-medium">{s.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between rounded-lg border p-3">
          <div>
            <Label htmlFor="site-dark">Tamna varijanta sajta</Label>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Tamna pozadina i svetao tekst - barbershop atmosfera.
            </p>
          </div>
          <Switch
            id="site-dark"
            checked={darkMode}
            onCheckedChange={saveMode}
            disabled={pending}
          />
        </div>

        <ImageUploadRow
          kind="logo"
          label="Logo"
          hint="Kvadratni format, prikazuje se u zaglavlju sajta."
          tenantId={tenantId}
          currentUrl={logoUrl}
          preview="square"
          onSaved={onSaved}
        />
        <ImageUploadRow
          kind="hero"
          label="Naslovna fotografija"
          hint="Široki format (npr. enterijer salona), pozadina vrha sajta."
          tenantId={tenantId}
          currentUrl={heroImageUrl}
          preview="wide"
          onSaved={onSaved}
        />
      </CardContent>
    </Card>
  );
}
