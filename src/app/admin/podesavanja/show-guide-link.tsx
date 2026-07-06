"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { updateOnboarding } from "../actions";

// "Sakrij vodič" na Početnoj je do sada bio nepovratan - ovo je put nazad.
// Prikazuje se samo dok sajt nije objavljen (posle objave kartica vodiča
// ionako ne postoji).
export function ShowGuideLink() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function show() {
    startTransition(async () => {
      const res = await updateOnboarding({ guideHidden: false });
      if (res.ok) {
        toast.success("Vodič je vraćen na Početnu.");
        router.push("/admin");
      } else {
        toast.error(res.error ?? "Greška.");
      }
    });
  }

  return (
    <div className="mt-8 text-center">
      <button
        onClick={show}
        disabled={pending}
        className="text-xs text-ink/40 underline-offset-2 hover:underline"
      >
        {pending ? "Vraćanje..." : "Prikaži vodič za pokretanje na Početnoj"}
      </button>
    </div>
  );
}
