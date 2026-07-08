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
      const res = await createSalon({ name, slug });
      if (res?.error) toast.error(res.error);
    });
  }

  return (
    <main className="flex flex-1 items-center justify-center bg-canvas px-4 py-16 font-display">
      <Card className="w-full max-w-md rounded-3xl border-0 shadow-[0_4px_24px_rgba(20,25,20,0.06)]">
        <CardHeader>
          <CardTitle className="text-2xl font-extrabold tracking-tight">Napravi svoj salon</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Naziv salona</Label>
              <Input
                id="name"
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
            <Button type="submit" className="w-full rounded-full bg-mint font-bold text-ink hover:bg-mint/85" disabled={pending}>
              {pending ? "Kreiranje..." : "Napravi salon"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
