import Link from "next/link";
import { TerminerLogo } from "@/components/terminer-logo";

// Brendirana 404: hvata notFound() iz svih segmenata (pogrešan slug salona,
// nevažeći link otkazivanja, tuđa faktura...) i sve nepostojeće adrese.
export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col bg-canvas font-display text-ink">
      <header className="mx-auto flex w-full max-w-5xl items-center px-4 py-5">
        <TerminerLogo href="/" />
      </header>

      <div className="flex flex-1 items-center justify-center px-4 pb-16">
        <div className="w-full max-w-xl rounded-[2rem] bg-ink px-8 py-14 text-center text-white sm:px-12">
          <p className="text-7xl font-extrabold tracking-tight text-mint">404</p>
          <h1 className="mt-5 text-2xl font-extrabold tracking-tight sm:text-3xl">
            Stranica nije pronađena
          </h1>
          <p className="mx-auto mt-3 max-w-md font-medium text-white/60">
            Adresa je možda pogrešno ukucana, ili je stranica u međuvremenu
            premeštena ili uklonjena.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href="/"
              className="rounded-full bg-mint px-7 py-3.5 font-bold text-ink transition-transform hover:scale-[1.03]"
            >
              Nazad na početnu
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
