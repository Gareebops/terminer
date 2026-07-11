"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { CaretLeft, CaretRight, X } from "@/components/icons";
import { FadeUp, ZoomOnHover } from "@/components/animate";
import type { Gallery } from "@/lib/types";

// Galerija sa lightbox pregledom: tap na rad = pun prikaz, strelice/swipe
// za listanje, Escape ili tap na pozadinu za izlaz. Lightbox je Radix
// Dialog: focus trap, Escape, zaključan skrol i vraćanje fokusa na
// kliknutu sličicu dolaze iz primitiva.
export function GalleryGrid({ images }: { images: Gallery[] }) {
  const [idx, setIdx] = useState<number | null>(null);
  // Početna X koordinata dodira - za swipe listanje na telefonu
  const [touchX, setTouchX] = useState<number | null>(null);

  const step = useCallback(
    (delta: number) => {
      setIdx((i) =>
        i === null ? i : (i + delta + images.length) % images.length
      );
    },
    [images.length]
  );

  // Escape i zaključavanje skrola rešava Radix; ovde samo strelice
  useEffect(() => {
    if (idx === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") step(-1);
      if (e.key === "ArrowRight") step(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [idx, step]);

  return (
    <>
      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {images.map((g, i) => (
          <FadeUp key={g.id} delay={i * 0.05}>
            <ZoomOnHover className="overflow-hidden rounded-[calc(var(--surface-radius)*1.5)]">
              <button
                type="button"
                onClick={() => setIdx(i)}
                className="block w-full cursor-zoom-in"
                aria-label="Uvećaj fotografiju"
              >
                <Image
                  src={g.image_url}
                  alt=""
                  width={400}
                  height={400}
                  className="aspect-square w-full object-cover"
                />
              </button>
            </ZoomOnHover>
          </FadeUp>
        ))}
      </div>

      <DialogPrimitive.Root open={idx !== null} onOpenChange={(o) => !o && setIdx(null)}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Content
            aria-describedby={undefined}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 outline-none"
            onClick={() => setIdx(null)}
            onTouchStart={(e) => setTouchX(e.touches[0].clientX)}
            onTouchEnd={(e) => {
              if (touchX === null) return;
              const dx = e.changedTouches[0].clientX - touchX;
              // Prag od 48px razdvaja swipe od običnog tapa (tap = zatvaranje)
              if (Math.abs(dx) > 48) step(dx < 0 ? 1 : -1);
              setTouchX(null);
            }}
          >
            <DialogPrimitive.Title className="sr-only">
              Fotografija iz galerije
            </DialogPrimitive.Title>
            {idx !== null && (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={images[idx].image_url}
                  alt=""
                  className="max-h-[85vh] max-w-full rounded-[calc(var(--surface-radius)*1.5)] object-contain"
                  onClick={(e) => e.stopPropagation()}
                />
                <DialogPrimitive.Close asChild>
                  <button
                    type="button"
                    aria-label="Zatvori"
                    className="absolute right-4 top-4 rounded-full bg-white/10 p-2.5 text-white transition-colors hover:bg-white/25"
                  >
                    <X className="size-5" />
                  </button>
                </DialogPrimitive.Close>
                {images.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        step(-1);
                      }}
                      aria-label="Prethodna"
                      className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2.5 text-white transition-colors hover:bg-white/25"
                    >
                      <CaretLeft className="size-6" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        step(1);
                      }}
                      aria-label="Sledeća"
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2.5 text-white transition-colors hover:bg-white/25"
                    >
                      <CaretRight className="size-6" />
                    </button>
                    <span className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white">
                      {idx + 1} / {images.length}
                    </span>
                  </>
                )}
              </>
            )}
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  );
}
