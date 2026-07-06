"use client";

import { useCallback, useState } from "react";
import type { SiteSettings } from "@/lib/types";
import { AppearanceForm } from "./appearance-form";
import { DomainCard } from "./domain-card";
import { PhonePreview } from "./phone-preview";
import { SettingsForm } from "./settings-form";

export function SettingsShell({
  tenantId,
  slug,
  customDomain,
  settings,
}: {
  tenantId: string;
  slug: string;
  customDomain: string | null;
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
        <DomainCard slug={slug} customDomain={customDomain} />
      </div>

      {/* Živi pregled sajta (mobilni prikaz) */}
      <div className="hidden xl:block">
        <div className="sticky top-6">
          <PhonePreview
            slug={slug}
            refreshKey={refreshKey}
            brandColor={settings?.primary_color ?? "#18181b"}
            onRefresh={onSaved}
          />
        </div>
      </div>
    </div>
  );
}
