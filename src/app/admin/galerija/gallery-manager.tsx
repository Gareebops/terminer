"use client";

import Image from "next/image";
import { useRef, useState, useTransition } from "react";
import { ArrowLeft, ArrowRight, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { createClient } from "@/lib/supabase/client";
import { prepareImageForUpload } from "@/lib/image";
import type { Gallery } from "@/lib/types";
import { addGalleryImage, deleteGalleryImage, moveGalleryImage } from "../actions";

const MAX_IMAGES = 24;

export function GalleryManager({
  tenantId,
  images,
}: {
  tenantId: string;
  images: Gallery[];
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [toDelete, setToDelete] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = [...(e.target.files ?? [])];
    e.target.value = "";
    if (files.length === 0) return;
    if (images.length + files.length > MAX_IMAGES) {
      toast.error(`Najviše ${MAX_IMAGES} fotografija u galeriji.`);
      return;
    }

    setUploading(true);
    const supabase = createClient();
    let ok = 0;
    for (const file of files) {
      if (!file.type.startsWith("image/") || file.size > 15 * 1024 * 1024) {
        toast.error(`${file.name}: nije slika ili je veća od 15 MB.`);
        continue;
      }
      // Kompresija/WebP pre uploada (galerija je najveći potrošač prostora)
      const prepared = await prepareImageForUpload(file, 1600);
      if ("error" in prepared) {
        toast.error(`${file.name}: ${prepared.error}`);
        continue;
      }
      const path = `${tenantId}/gallery/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${prepared.ext}`;
      const { error } = await supabase.storage
        .from("tenant-media")
        .upload(path, prepared.blob, { contentType: prepared.blob.type });
      if (error) {
        toast.error(`${file.name}: upload nije uspeo.`);
        continue;
      }
      const { data } = supabase.storage.from("tenant-media").getPublicUrl(path);
      const res = await addGalleryImage(data.publicUrl);
      if (res.ok) ok += 1;
      else toast.error(res.error ?? "Greška.");
    }
    setUploading(false);
    // Srpska množina: 1 fotografija, 2-4 fotografije, 5+ fotografija
    if (ok > 0) {
      const rec = ok === 1 ? "fotografija" : ok < 5 ? "fotografije" : "fotografija";
      toast.success(ok === 1 ? "Dodata 1 fotografija." : `Dodato ${ok} ${rec}.`);
    }
  }

  function remove(id: string) {
    startTransition(async () => {
      const res = await deleteGalleryImage(id);
      if (!res.ok) toast.error(res.error ?? "Greška.");
      setToDelete(null);
    });
  }

  function move(id: string, direction: "up" | "down") {
    startTransition(async () => {
      const res = await moveGalleryImage(id, direction);
      if (!res.ok) toast.error(res.error ?? "Greška.");
    });
  }

  return (
    <div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={onFiles}
      />
      <Button disabled={uploading} onClick={() => fileRef.current?.click()}>
        <Upload className="size-4" />
        {uploading ? "Otpremanje..." : "Dodaj fotografije"}
      </Button>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {/* Kontrole su na telefonu uvek vidljive (nema hovera), na desktopu
            se pojavljuju na prelaz mišem */}
        {images.map((g, i) => (
          <div key={g.id} className="group relative">
            <Image
              src={g.image_url}
              alt=""
              width={300}
              height={300}
              className="aspect-square w-full rounded-lg object-cover"
            />
            <button
              onClick={() => setToDelete(g.id)}
              title="Obriši"
              className="absolute right-2 top-2 rounded-md bg-black/60 p-1.5 text-white transition sm:opacity-0 sm:group-hover:opacity-100"
            >
              <Trash2 className="size-4" />
            </button>
            <div className="absolute bottom-2 left-2 flex gap-1 transition sm:opacity-0 sm:group-hover:opacity-100">
              <button
                onClick={() => move(g.id, "up")}
                disabled={pending || i === 0}
                title="Pomeri napred"
                className="rounded-md bg-black/60 p-1.5 text-white disabled:opacity-40"
              >
                <ArrowLeft className="size-4" />
              </button>
              <button
                onClick={() => move(g.id, "down")}
                disabled={pending || i === images.length - 1}
                title="Pomeri nazad"
                className="rounded-md bg-black/60 p-1.5 text-white disabled:opacity-40"
              >
                <ArrowRight className="size-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <ConfirmDialog
        open={!!toDelete}
        title="Obrisati fotografiju?"
        description="Fotografija nestaje sa sajta, a fajl se briše iz galerije."
        pending={pending}
        onConfirm={() => toDelete && remove(toDelete)}
        onCancel={() => setToDelete(null)}
      />
      {images.length === 0 && (
        <div className="mt-6 rounded-[2rem] border border-dashed p-8 text-center">
          <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-mint/50 text-ink">
            <Upload className="size-5" />
          </span>
          <p className="mt-3 text-lg font-bold tracking-tight">Pokaži najbolje radove</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            Fotografije se prikazuju u galeriji na sajtu - dobre slike prodaju
            bolje od bilo kog teksta. Počni sa 4-6 najboljih.
          </p>
          <Button
            className="mt-5 rounded-full"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="size-4" />
            {uploading ? "Otpremanje..." : "Otpremi fotografije"}
          </Button>
        </div>
      )}
    </div>
  );
}
