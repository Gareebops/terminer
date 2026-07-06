// Priprema slike pre uploada (izvršava se u browseru): smanjivanje na
// razumnu dimenziju + WebP kompresija. Rešava dva problema odjednom:
// iPhone HEIC fotografije koje browseri ne umeju da prikažu (dekodabilne
// se konvertuju, nedekodabilne odbijaju sa jasnom porukom) i ogromne
// originalne fotografije koje bi usporile sajt salona.

const RENDERABLE = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);

function decodeViaImg(file: File): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => resolve(img);
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}

export type PreparedImage = { blob: Blob; ext: string };

export async function prepareImageForUpload(
  file: File,
  maxDim: number
): Promise<PreparedImage | { error: string }> {
  // Animirani GIF bi konverzijom izgubio animaciju - ide u originalu
  if (file.type === "image/gif") return { blob: file, ext: "gif" };

  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    bitmap = null;
  }
  let imgEl: HTMLImageElement | null = null;
  if (!bitmap) {
    imgEl = await decodeViaImg(file);
    if (!imgEl) {
      // Tipično HEIC na browseru koji ga ne dekodira
      return {
        error:
          "Ovaj format slike nije podržan (npr. HEIC sa iPhone-a). Sačuvaj fotografiju kao JPG ili PNG pa pokušaj ponovo.",
      };
    }
  }

  const width = bitmap ? bitmap.width : imgEl!.naturalWidth;
  const height = bitmap ? bitmap.height : imgEl!.naturalHeight;
  const scale = Math.min(1, maxDim / Math.max(width, height));

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext("2d");

  const original = (): PreparedImage | { error: string } =>
    RENDERABLE.has(file.type)
      ? { blob: file, ext: file.name.split(".").pop()?.toLowerCase() || "jpg" }
      : { error: "Slika nije mogla da se obradi. Probaj sa JPG ili PNG formatom." };

  if (!ctx) return original();
  ctx.drawImage(bitmap ?? imgEl!, 0, 0, canvas.width, canvas.height);
  bitmap?.close();
  if (imgEl) URL.revokeObjectURL(imgEl.src);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/webp", 0.85)
  );
  if (!blob) return original();
  return { blob, ext: "webp" };
}
