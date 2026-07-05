"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { SiteSettings } from "@/lib/types";
import { updateSettings } from "../actions";

// Objava sajta više NIJE ovde - "Objavi sajt" dugme živi u admin layoutu
// (publish-control.tsx), vidljivo na svakoj stranici.
export function SettingsForm({
  settings,
  onSaved,
}: {
  settings: SiteSettings | null;
  onSaved?: () => void;
}) {
  const [heroTitle, setHeroTitle] = useState(settings?.hero_title ?? "");
  const [heroSubtitle, setHeroSubtitle] = useState(settings?.hero_subtitle ?? "");
  const [phone, setPhone] = useState(settings?.phone ?? "");
  const [email, setEmail] = useState(settings?.email ?? "");
  const [address, setAddress] = useState(settings?.address ?? "");
  const [city, setCity] = useState(settings?.city ?? "");
  const [instagram, setInstagram] = useState(settings?.instagram ?? "");
  const [showTeam, setShowTeam] = useState(settings?.show_team ?? true);
  const [showGallery, setShowGallery] = useState(settings?.show_gallery ?? true);
  const [showPrices, setShowPrices] = useState(settings?.show_prices ?? true);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await updateSettings({
        heroTitle,
        heroSubtitle,
        phone,
        email,
        address,
        city,
        instagram,
        showTeam,
        showGallery,
        showPrices,
      });
      if (res.ok) {
        toast.success("Sačuvano.");
        onSaved?.();
      } else {
        toast.error(res.error ?? "Greška.");
      }
    });
  }

  return (
    <div className="space-y-6">
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="hero-title">Naslov na sajtu</Label>
          <Input
            id="hero-title"
            value={heroTitle}
            onChange={(e) => setHeroTitle(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="hero-subtitle">Podnaslov</Label>
          <Textarea
            id="hero-subtitle"
            value={heroSubtitle}
            onChange={(e) => setHeroSubtitle(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="set-phone">Telefon</Label>
            <Input id="set-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="set-email">Email</Label>
            <Input id="set-email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="set-address">Adresa</Label>
            <Input
              id="set-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="set-city">Grad</Label>
            <Input id="set-city" value={city} onChange={(e) => setCity(e.target.value)} />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="set-instagram">Instagram</Label>
          <Input
            id="set-instagram"
            placeholder="@salon"
            value={instagram}
            onChange={(e) => setInstagram(e.target.value)}
          />
        </div>

        <div className="space-y-3 rounded-lg border p-4">
          <p className="text-sm font-medium">Sekcije na sajtu</p>
          <div className="flex items-center justify-between">
            <Label htmlFor="show-team">Prikaži tim</Label>
            <Switch id="show-team" checked={showTeam} onCheckedChange={setShowTeam} />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="show-gallery">Prikaži galeriju</Label>
            <Switch
              id="show-gallery"
              checked={showGallery}
              onCheckedChange={setShowGallery}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="show-prices">Prikaži cene</Label>
            <Switch
              id="show-prices"
              checked={showPrices}
              onCheckedChange={setShowPrices}
            />
          </div>
        </div>

        <Button type="submit" disabled={pending}>
          {pending ? "Čuvanje..." : "Sačuvaj izmene"}
        </Button>
      </form>
    </div>
  );
}
