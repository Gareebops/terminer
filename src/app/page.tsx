import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowUpRight,
  CalendarCheck,
  Globe,
  Scissors,
  Users,
} from "lucide-react";
import { HeroItem, HeroStagger } from "@/components/animate";
import { CONTACT_EMAIL } from "@/components/legal-page";
import { FaqAccordion } from "@/components/landing/faq";
import { FAQ_ITEMS } from "@/components/landing/faq-items";
import { HeroDemo } from "@/components/landing/hero-demo";
import { TerminerLogo } from "@/components/terminer-logo";
import { jsonLdString, SITE_URL } from "@/lib/seo";

export const metadata: Metadata = { alternates: { canonical: "/" } };

// FAQPage structured data - Google ume da prikaže pitanja u rezultatima
const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ_ITEMS.map((item) => ({
    "@type": "Question",
    name: item.q,
    acceptedAnswer: { "@type": "Answer", text: item.a },
  })),
};

// Organizacija + aplikacija sa cenama: Google-u kaže ko stoji iza sajta
// i šta se nudi (cene iz sekcije Cenovnik - održavati zajedno)
const orgJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: "Terminer",
      url: SITE_URL,
      logo: `${SITE_URL}/icon.svg`,
      email: CONTACT_EMAIL,
    },
    {
      "@type": "SoftwareApplication",
      name: "Terminer",
      url: SITE_URL,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      description:
        "Platforma za frizerske, kozmetičke i beauty salone, barbershope i masažne studije: sopstveni mini-sajt i online zakazivanje termina.",
      publisher: { "@id": `${SITE_URL}/#organization` },
      offers: [
        {
          "@type": "Offer",
          name: "Mesečna članarina",
          price: "1990",
          priceCurrency: "RSD",
        },
        {
          "@type": "Offer",
          name: "Godišnja članarina",
          price: "19900",
          priceCurrency: "RSD",
        },
      ],
    },
  ],
};

const features = [
  {
    icon: Globe,
    title: "Sajt bez muke",
    text: "Tvoj salon dobija moderan sajt i web aplikaciju sa cenovnikom, timom i galerijom - bez programera i bez komplikovanog održavanja.",
    surface: "bg-white shadow-card",
  },
  {
    icon: CalendarCheck,
    title: "Online zakazivanje",
    text: "Klijenti sami biraju uslugu, osobu i slobodan termin. Nema više propuštenih poziva.",
    surface: "bg-mint",
  },
  {
    icon: Users,
    title: "Smene i tim",
    text: "Raspored po smenama za svakog zaposlenog - termini se nude samo kada neko stvarno radi.",
    surface: "bg-lavender",
  },
  {
    icon: Scissors,
    title: "Za salone svih vrsta",
    text: "Frizerski i beauty saloni, barberšopovi, kozmetički i masažni studiji.",
    surface: "bg-white shadow-card",
  },
];

export default function HomePage() {
  return (
    <main className="flex-1 bg-canvas font-display text-ink">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdString(orgJsonLd) }}
      />
      <header className="mx-auto flex max-w-5xl items-center justify-between px-4 py-5">
        <TerminerLogo />
        <nav className="flex items-center gap-2">
          <Link
            href="/prijava"
            className="rounded-full border border-ink/10 px-5 py-2.5 text-sm font-semibold transition-colors hover:bg-ink/5"
          >
            Prijava
          </Link>
          {/* Na mobilnom je suvišno - hero odmah ispod ima "Kreni besplatno" */}
          <Link
            href="/registracija"
            className="hidden rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-85 sm:block"
          >
            Napravi svoj salon
          </Link>
        </nav>
      </header>

      {/* Tamna hero kartica sa živom demonstracijom */}
      <section className="mx-auto max-w-5xl px-4 pt-4">
        <div className="grid items-center gap-10 overflow-hidden rounded-[2rem] bg-ink px-6 py-14 text-white sm:px-10 lg:grid-cols-[1.15fr_1fr] lg:py-16">
          <HeroStagger>
            <HeroItem>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-white/50">
                Domaća platforma za salone
              </p>
            </HeroItem>
            <HeroItem>
              <h1 className="mt-5 max-w-xl text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
                Sajt i online zakazivanje za tvoj salon - za nekoliko minuta
              </h1>
            </HeroItem>
            <HeroItem>
              <p className="mt-6 max-w-lg text-lg text-white/60">
                Registruj salon ili studio, unesi usluge i radno vreme, izaberi
                izgled - i klijenti odmah mogu da zakazuju termine online.
              </p>
            </HeroItem>
            <HeroItem>
              <div className="mt-9 flex flex-wrap gap-3">
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
            </HeroItem>
          </HeroStagger>
          <div className="hidden justify-center sm:flex">
            <HeroDemo />
          </div>
          {/* Telefon: demo je najjači prodajni element - compact varijanta
              (bez sjaja i plutajućih kartica) staje ispod hero teksta */}
          <div className="flex justify-center sm:hidden">
            <HeroDemo compact />
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-5xl gap-4 px-4 py-16 sm:grid-cols-2">
        <h2 className="sr-only">Šta dobijaš</h2>
        {features.map((f) => (
          <div key={f.title} className={`rounded-[2rem] p-7 ${f.surface}`}>
            <span className="flex size-11 items-center justify-center rounded-full bg-ink/[0.06]">
              <f.icon className="size-5" />
            </span>
            <h3 className="mt-5 text-lg font-bold tracking-tight">{f.title}</h3>
            <p className="mt-2 text-sm font-medium leading-relaxed text-ink/70">
              {f.text}
            </p>
          </div>
        ))}
      </section>

      {/* Cenovnik */}
      <section className="mx-auto max-w-5xl px-4 pb-16">
        <div className="text-center">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-ink/70">
            Cenovnik
          </p>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">
            Jedna cena, sve uključeno
          </h2>
          <p className="mx-auto mt-3 max-w-xl font-medium text-ink/70">
            Košta koliko jedan termin mesečno - a pokrije se prvom
            rezervacijom.
          </p>
        </div>
        <div className="mx-auto mt-8 grid max-w-3xl gap-4 sm:grid-cols-2">
          <div className="rounded-[2rem] bg-white p-7 shadow-card">
            <p className="text-sm font-bold uppercase tracking-wider text-ink/70">
              Mesečno
            </p>
            <p className="mt-3 text-5xl font-extrabold tracking-tight">
              1.990 <span className="text-lg font-bold text-ink/70">RSD/mes</span>
            </p>
            <ul className="mt-5 space-y-2 text-sm font-medium text-ink/70">
              <li>✓ Sajt salona + online zakazivanje</li>
              <li>✓ Neograničeno rezervacija i zaposlenih</li>
              <li>✓ Smene, kalendar, statistika</li>
            </ul>
          </div>
          <div className="relative rounded-[2rem] bg-mint p-7">
            <span className="absolute right-5 top-5 rounded-full bg-ink px-3 py-1 text-xs font-bold text-white">
              2 meseca gratis
            </span>
            <p className="text-sm font-bold uppercase tracking-wider text-ink/70">
              Godišnje
            </p>
            <p className="mt-3 text-5xl font-extrabold tracking-tight">
              19.900 <span className="text-lg font-bold text-ink/70">RSD/god</span>
            </p>
            <ul className="mt-5 space-y-2 text-sm font-medium text-ink/70">
              <li>✓ Sve iz mesečnog plana</li>
              <li>✓ Ispadne 1.658 RSD mesečno</li>
              <li>✓ Jedna faktura godišnje</li>
            </ul>
          </div>
        </div>
        <p className="mt-6 text-center text-sm font-semibold text-ink/70">
          Prvih <span className="text-ink">30 dana je besplatno</span> - bez
          kartice, bez obaveze.{" "}
          <Link href="/registracija" className="underline">
            Probaj odmah
          </Link>
        </p>
      </section>

      {/* Česta pitanja */}
      <section className="mx-auto max-w-5xl px-4 pb-16">
        <div className="text-center">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-ink/70">
            Česta pitanja
          </p>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">
            Sve što te zanima pre starta
          </h2>
        </div>
        <div className="mt-8">
          <FaqAccordion />
        </div>
        <p className="mt-6 text-center text-sm font-semibold text-ink/70">
          Imaš još pitanja?{" "}
          <Link href="/demo" className="underline">
            Pogledaj demo salon
          </Link>{" "}
          ili{" "}
          <Link href="/registracija" className="underline">
            probaj besplatno
          </Link>
          .
        </p>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdString(faqJsonLd) }}
        />
      </section>

      <footer className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 pb-10 text-sm font-medium text-ink/70">
        <span>© {new Date().getFullYear()} Terminer</span>
        <nav className="flex gap-4">
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="hover:text-ink hover:underline"
          >
            Kontakt
          </a>
          <Link href="/privatnost" className="hover:text-ink hover:underline">
            Privatnost
          </Link>
          <Link href="/uslovi" className="hover:text-ink hover:underline">
            Uslovi
          </Link>
        </nav>
        <span>Napravljeno u Srbiji</span>
      </footer>
    </main>
  );
}
