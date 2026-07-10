"use client"; // error boundary mora biti klijentska komponenta

import * as Sentry from "@sentry/nextjs";
import Link from "next/link";
import { useEffect } from "react";

// Brendirani ekran za neuhvaćene greške ispod root layouta. Poruka je
// generička (server ne prosleđuje detalje u produkciji); digest je šifra
// za pronalaženje greške u server logovima kad korisnik prijavi problem.
export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    // Greške uhvaćene boundary-jem ne stižu do window.onerror,
    // pa se Sentryju prijavljuju ručno (no-op bez DSN-a)
    Sentry.captureException(error);
    console.error(error);
  }, [error]);

  return (
    <main className="flex flex-1 items-center justify-center bg-canvas px-4 py-16 font-display text-ink">
      <div className="w-full max-w-xl rounded-[2rem] bg-ink px-8 py-14 text-center text-white sm:px-12">
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
          Nešto je pošlo naopako
        </h1>
        <p className="mx-auto mt-3 max-w-md font-medium text-white/60">
          Došlo je do neočekivane greške. Pokušaj ponovo — ako se greška
          ponavlja, javi nam se.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={() => unstable_retry()}
            className="rounded-full bg-mint px-7 py-3.5 font-bold text-ink transition-transform hover:scale-[1.03]"
          >
            Pokušaj ponovo
          </button>
          <Link
            href="/"
            className="rounded-full border border-white/20 px-7 py-3.5 font-semibold text-white/90 transition-colors hover:bg-white/10"
          >
            Nazad na početnu
          </Link>
        </div>
        {error.digest ? (
          <p className="mt-6 text-xs font-medium text-white/60">
            Šifra greške: {error.digest}
          </p>
        ) : null}
      </div>
    </main>
  );
}
