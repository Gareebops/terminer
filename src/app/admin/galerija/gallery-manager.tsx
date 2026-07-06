"use client";

import Image from "next/image";
import { useRef, useState, useTransition } from "react";
import { Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import type { Gallery } from "@/lib/types";
import { addGalleryImage, deleteGalleryImage } from "../actions";

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
  const [, startTransition] = useTransition();

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
      if (!file.type.startsWith("image/") || file.size > 8 * 1024 * 1024) {
        toast.error(`${file.name}: nije slika ili je veća od 8 MB.`);
        continue;
      }
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${tenantId}/gallery/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage
        .from("tenant-media")
        .upload(path, file);
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
    if (ok > 0) toast.success(`Dodato ${ok} ${ok === 1 ? "fotografija" : "fotografije"}.`);
  }

  function remove(id: string) {
    if (!confirm("Obrisati fotografiju?")) return;
    startTransition(async () => {
      const res = await deleteGalleryImage(id);
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
        {images.map((g) => (
          <div key={g.id} className="group relative">
            <Image
              src={g.image_url}
              alt=""
              width={300}
              height={300}
              className="aspect-square w-full rounded-lg object-cover"
            />
            <button
              onClick={() => remove(g.id)}
              title="Obriši"
              className="absolute right-2 top-2 rounded-md bg-black/60 p-1.5 text-white opacity-0 transition group-hover:opacity-100"
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        ))}
      </div>
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
