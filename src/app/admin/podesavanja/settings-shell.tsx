"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { ExternalLink, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SiteSettings } from "@/lib/types";
import { AppearanceForm } from "./appearance-form";
import { SettingsForm } from "./settings-form";

export function SettingsShell({
  tenantId,
  slug,
  settings,
}: {
  tenantId: string;
  slug: string;
  settings: SiteSettings | null;
}) {
  const [refreshKey, setRefreshKey] = useState(0);
  const onSaved = useCallback(() => setRefreshKey((k) => k + 1), []);

  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="max-w-xl space-y-6">
        <AppearanceForm
          tenantId={tenantId}
          primaryColor={settings?.primary_color ?? "#18181b"}
          logoUrl={settings?.logo_url ?? null}
          heroImageUrl={settings?.hero_image_url ?? null}
          theme={settings?.theme ?? null}
          onSaved={onSaved}
        />
        <SettingsForm settings={settings} onSaved={onSaved} />
      </div>

      {/* Živi pregled sajta (mobilni prikaz) */}
      <div className="hidden xl:block">
        <div className="sticky top-6">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground">
              Pregled sajta
            </p>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="icon"
                title="Osveži pregled"
                onClick={onSaved}
              >
                <RefreshCw className="size-4" />
              </Button>
              <Button variant="ghost" size="icon" title="Otvori sajt" asChild>
                <Link href={`/${slug}`} target="_blank">
                  <ExternalLink className="size-4" />
                </Link>
              </Button>
            </div>
          </div>
          <div className="overflow-hidden rounded-[2rem] border-8 border-ink shadow-[0_4px_24px_rgba(20,25,20,0.12)]">
            <iframe
              key={refreshKey}
              src={`/${slug}`}
              title="Pregled sajta"
              className="h-[640px] w-full bg-white"
            />
          </div>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Osvežava se posle svakog čuvanja.
          </p>
        </div>
      </div>
    </div>
  );
}
