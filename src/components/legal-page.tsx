import Link from "next/link";

// Zajednički okvir za statične pravne stranice (privatnost, uslovi) -
// Terminer brend, bez interakcija. Kontakt adresa je na jednom mestu;
// kad legne domen, zameniti sa kontakt@terminer.rs.
export const CONTACT_EMAIL = "milosevicmihajlo13@gmail.com";

export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <main className="flex-1 bg-canvas font-display text-ink">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-4 py-5">
        <Link href="/" className="text-xl font-extrabold tracking-tight">
          Terminer
        </Link>
        <Link
          href="/"
          className="rounded-full border border-ink/10 px-5 py-2.5 text-sm font-semibold transition-colors hover:bg-ink/5"
        >
          Nazad na početnu
        </Link>
      </header>

      <article className="mx-auto max-w-3xl px-4 pb-16">
        <div className="rounded-[2rem] bg-white p-8 shadow-card sm:p-12">
          <h1 className="text-3xl font-extrabold tracking-tight">{title}</h1>
          <p className="mt-2 text-sm font-medium text-ink/70">
            Poslednja izmena: {updated}
          </p>
          <div className="legal-prose mt-8 space-y-6 text-[15px] leading-relaxed text-ink/80 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-ink [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5">
            {children}
          </div>
        </div>
      </article>

      <footer className="mx-auto flex max-w-3xl items-center justify-between px-4 pb-10 text-sm font-medium text-ink/70">
        <span>© {new Date().getFullYear()} Terminer</span>
        <span>Napravljeno u Srbiji</span>
      </footer>
    </main>
  );
}
