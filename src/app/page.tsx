import Link from "next/link";
import { CalendarCheck, Globe, Scissors, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const features = [
  {
    icon: Globe,
    title: "Sajt bez muke",
    text: "Tvoj salon dobija moderan sajt sa cenovnikom, timom i galerijom — bez programera i bez održavanja.",
  },
  {
    icon: CalendarCheck,
    title: "Online zakazivanje",
    text: "Klijenti sami biraju uslugu, frizera i slobodan termin. Nema više propuštenih poziva.",
  },
  {
    icon: Users,
    title: "Smene i tim",
    text: "Raspored po smenama za svakog zaposlenog — termini se nude samo kada neko stvarno radi.",
  },
  {
    icon: Scissors,
    title: "Za salone svih vrsta",
    text: "Frizerski i beauty saloni, barberšopovi, kozmetički i masažni studiji.",
  },
];

export default function HomePage() {
  return (
    <main className="flex-1">
      <header className="border-b">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <span className="text-xl font-bold tracking-tight">Terminer</span>
          <nav className="flex items-center gap-2">
            <Button variant="ghost" asChild>
              <Link href="/prijava">Prijava</Link>
            </Button>
            <Button asChild>
              <Link href="/registracija">Napravi svoj salon</Link>
            </Button>
          </nav>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-4 py-24 text-center">
        <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl">
          Sajt i online zakazivanje za tvoj salon — za par minuta
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
          Terminer je domaća platforma za frizerske i beauty salone. Registruj
          salon, unesi usluge i radno vreme, i klijenti odmah mogu da zakazuju
          online.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Button size="lg" asChild>
            <Link href="/registracija">Kreni besplatno</Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/demo">Pogledaj demo salon</Link>
          </Button>
        </div>
      </section>

      <section className="border-t bg-muted/40">
        <div className="mx-auto grid max-w-5xl gap-4 px-4 py-16 sm:grid-cols-2">
          {features.map((f) => (
            <Card key={f.title}>
              <CardContent className="flex gap-4 pt-6">
                <f.icon className="size-8 shrink-0 text-primary" />
                <div>
                  <h3 className="font-semibold">{f.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{f.text}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <footer className="border-t">
        <div className="mx-auto max-w-5xl px-4 py-8 text-sm text-muted-foreground">
          © {new Date().getFullYear()} Terminer
        </div>
      </footer>
    </main>
  );
}
