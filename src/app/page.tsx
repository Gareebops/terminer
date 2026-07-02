import Link from "next/link";
import {
  ArrowUpRight,
  CalendarCheck,
  Globe,
  Scissors,
  Users,
} from "lucide-react";

const features = [
  {
    icon: Globe,
    title: "Sajt bez muke",
    text: "Tvoj salon dobija moderan sajt sa cenovnikom, timom i galerijom — bez programera i bez održavanja.",
    surface: "bg-white shadow-[0_4px_24px_rgba(20,25,20,0.06)]",
  },
  {
    icon: CalendarCheck,
    title: "Online zakazivanje",
    text: "Klijenti sami biraju uslugu, frizera i slobodan termin. Nema više propuštenih poziva.",
    surface: "bg-mint",
  },
  {
    icon: Users,
    title: "Smene i tim",
    text: "Raspored po smenama za svakog zaposlenog — termini se nude samo kada neko stvarno radi.",
    surface: "bg-lavender",
  },
  {
    icon: Scissors,
    title: "Za salone svih vrsta",
    text: "Frizerski i beauty saloni, barberšopovi, kozmetički i masažni studiji.",
    surface: "bg-white shadow-[0_4px_24px_rgba(20,25,20,0.06)]",
  },
];

export default function HomePage() {
  return (
    <main className="flex-1 bg-canvas font-display text-ink">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-4 py-5">
        <span className="text-xl font-extrabold tracking-tight">Terminer</span>
        <nav className="flex items-center gap-2">
          <Link
            href="/prijava"
            className="rounded-full border border-ink/10 px-5 py-2.5 text-sm font-semibold transition-colors hover:bg-ink/5"
          >
            Prijava
          </Link>
          <Link
            href="/registracija"
            className="rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-85"
          >
            Napravi svoj salon
          </Link>
        </nav>
      </header>

      {/* Tamna hero kartica */}
      <section className="mx-auto max-w-5xl px-4 pt-4">
        <div className="rounded-[2rem] bg-ink px-6 py-20 text-center text-white sm:py-24">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-white/50">
            Domaća platforma za salone
          </p>
          <h1 className="mx-auto mt-5 max-w-3xl text-4xl font-extrabold leading-tight tracking-tight sm:text-6xl">
            Sajt i online zakazivanje za tvoj salon — za par minuta
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-white/60">
            Registruj salon, unesi usluge i radno vreme, izaberi izgled — i
            klijenti odmah mogu da zakazuju online.
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <Link
              href="/registracija"
              className="flex items-center gap-2 rounded-full bg-mint px-7 py-3.5 font-bold text-ink transition-transform hover:scale-[1.03]"
            >
              Kreni besplatno <ArrowUpRight className="size-4" />
            </Link>
            <Link
              href="/demo"
              className="rounded-full border border-white/20 px-7 py-3.5 font-semibold text-white/90 transition-colors hover:bg-white/10"
            >
              Pogledaj demo salon
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-5xl gap-4 px-4 py-16 sm:grid-cols-2">
        {features.map((f) => (
          <div key={f.title} className={`rounded-[2rem] p-7 ${f.surface}`}>
            <span className="flex size-11 items-center justify-center rounded-full bg-ink/[0.06]">
              <f.icon className="size-5" />
            </span>
            <h3 className="mt-5 text-lg font-bold tracking-tight">{f.title}</h3>
            <p className="mt-2 text-sm font-medium leading-relaxed text-ink/60">
              {f.text}
            </p>
          </div>
        ))}
      </section>

      <footer className="mx-auto flex max-w-5xl items-center justify-between px-4 pb-10 text-sm font-medium text-ink/50">
        <span>© {new Date().getFullYear()} Terminer</span>
        <span>Napravljeno u Srbiji</span>
      </footer>
    </main>
  );
}
