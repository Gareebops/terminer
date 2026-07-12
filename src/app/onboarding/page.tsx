"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createSalon } from "./actions";

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/đ/g, "dj")
    .replace(/[čć]/g, "c")
    .replace(/š/g, "s")
    .replace(/ž/g, "z")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export default function OnboardingPage() {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        const res = await createSalon({ name, slug });
        if (res?.error) toast.error(res.error);
      } catch (err) {
        // redirect() iz uspešne akcije baca Next kontrolni izuzetak - taj
        // MORA da se propusti; guta se samo stvarni mrežni pad
        if (
          err &&
          typeof err === "object" &&
          "digest" in err &&
          typeof err.digest === "string" &&
          err.digest.startsWith("NEXT_")
        ) {
          throw err;
        }
        toast.error("Nešto nije uspelo. Pokušaj ponovo.");
      }
    });
  }

  return (
    <main className="flex flex-1 items-center justify-center bg-canvas px-4 py-16 font-display">
      <Card className="w-full max-w-md rounded-3xl border-0 shadow-card">
        <CardHeader>
          <CardTitle className="text-2xl font-extrabold tracking-tight">Napravi svoj salon</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Naziv salona</Label>
              <Input
                id="name"
                className="h-11"
                required
                placeholder="npr. Studio Milica"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (!slugTouched) setSlug(slugify(e.target.value));
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="slug">Adresa sajta</Label>
              <div className="flex items-center gap-1">
                <span className="text-sm text-muted-foreground">terminer.rs/</span>
                <Input
                  id="slug"
                  className="h-11"
                  required
                  value={slug}
                  onChange={(e) => {
                    setSlugTouched(true);
                    setSlug(slugify(e.target.value));
                  }}
                />
              </div>
              {/* Za promenu sluga ne postoji UI - bolje reći odmah nego da
                  vlasnik posle traži gde da je promeni */}
              <p className="text-xs text-muted-foreground">
                Ovo postaje trajna adresa tvog sajta i kasnije se ne menja -
                izaberi je pažljivo.
              </p>
            </div>
            <Button type="submit" variant="brand-mint" className="h-11 w-full" disabled={pending}>
              {pending ? "Kreiranje..." : "Napravi salon"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
