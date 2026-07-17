"use client";

import Link from "next/link";
import { useState } from "react";
import { ExternalLink, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { brandGradient } from "@/lib/color";

// Živi pregled sajta u realističnom telefonu: bočna dugmad, odsjaj
// ekrana i ambijentalni sjaj u boji brenda salona. Svako čuvanje
// remount-uje iframe (refreshKey) pa se novi izgled "upali" kroz fade -
// pregled deluje živo.
export function PhonePreview({
  slug,
  refreshKey,
  brandColor,
  onRefresh,
}: {
  slug: string;
  refreshKey: number;
  brandColor: string;
  onRefresh: () => void;
}) {
  const [loaded, setLoaded] = useState(false);

  // Novi refreshKey = novi iframe - kreni ponovo od "učitava se".
  // Reset tokom rendera (React obrazac "adjusting state during render")
  // umesto effect-a, pa nema međukadra sa starim stanjem.
  const [prevRefreshKey, setPrevRefreshKey] = useState(refreshKey);
  if (prevRefreshKey !== refreshKey) {
    setPrevRefreshKey(refreshKey);
    setLoaded(false);
  }

  // Sakrij scrollbarove unutar "ekrana" (skrolovanje i dalje radi) -
  // iframe je same-origin pa stil možemo da ubacimo direktno
  function handleLoad(e: React.SyntheticEvent<HTMLIFrameElement>) {
    try {
      const doc = e.currentTarget.contentDocument;
      if (doc?.head) {
        const style = doc.createElement("style");
        style.textContent =
          "html{scrollbar-width:none;-ms-overflow-style:none}::-webkit-scrollbar{display:none}";
        doc.head.appendChild(style);
      }
    } catch {
      // tuđ origin (custom domen) - preskoči, ništa se ne lomi
    }
    setLoaded(true);
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-mint-strong opacity-75" />
            <span className="relative inline-flex size-2 rounded-full bg-mint-strong" />
          </span>
          Uživo pregled
        </p>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            title="Osveži pregled"
            onClick={onRefresh}
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

      <div className="relative">
        {/* Ambijentalni sjaj u boji brenda - "izlazi" iza telefona */}
        <div
          aria-hidden
          className="absolute inset-x-0 top-10 bottom-10 -z-10 opacity-30 blur-3xl transition-opacity duration-700"
          style={{ backgroundImage: brandGradient(brandColor), borderRadius: "50%" }}
        />

        {/* Telo telefona */}
        <div className="group relative mx-auto w-fit transition-transform duration-500 motion-safe:hover:scale-[1.015] motion-safe:hover:-rotate-1">
          {/* Bočna dugmad po uzoru na aktuelni Pixel Pro: desno kraće
              power pa duži volume rocker ispod, leva ivica čista
              (proporcije prenete sa pravog uređaja) */}
          <span
            aria-hidden
            className="absolute -right-1 top-32 h-9 w-1 rounded-r-full bg-ink"
          />
          <span
            aria-hidden
            className="absolute -right-1 top-[11rem] h-16 w-1 rounded-r-full bg-ink"
          />

          {/* Bez ring-a i sa tamnom podlogom ekrana: svetla ivica je na
              zaobljenim uglovima provirivala ispod iframe-a kao "bagovit"
              beli outline */}
          <div className="relative rounded-[3rem] bg-ink p-[10px] shadow-[0_30px_60px_-15px_rgba(20,25,20,0.45)]">
            {/* Ekran */}
            <div className="relative overflow-hidden rounded-[2.4rem] bg-ink">
              <iframe
                key={refreshKey}
                src={`/${slug}`}
                title="Pregled sajta"
                onLoad={handleLoad}
                className={`h-[600px] w-[300px] bg-white transition-opacity duration-500 ${
                  loaded ? "opacity-100" : "opacity-0"
                }`}
              />

              {/* Ekran namerno BEZ kamere/island izreza: iframe ne zna za
                  safe-area pa bi svaki izrez legao preko sadržaja sajta */}

              {/* Home indikator */}
              <span
                aria-hidden
                className="pointer-events-none absolute bottom-1.5 left-1/2 h-1 w-24 -translate-x-1/2 rounded-full bg-ink/30"
              />
              {/* Blagi odsjaj stakla preko gornjeg ugla */}
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 rounded-[2.4rem] bg-gradient-to-br from-white/[0.12] via-transparent to-transparent"
              />

              {/* Učitavanje: skeleton preko ekrana dok sajt ne stigne */}
              {!loaded && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-canvas">
                  <span className="size-8 animate-spin rounded-full border-2 border-ink/15 border-t-ink" />
                  <span className="text-xs font-medium text-ink/70">
                    Učitavam sajt...
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <p className="mt-3 text-center text-xs text-muted-foreground">
        Osvežava se posle svakog čuvanja - ovako sajt vide klijenti.
      </p>
    </div>
  );
}
