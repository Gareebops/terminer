import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { assertSuperAdmin } from "../actions";
import { listSupportInbox } from "../support-actions";
import { SupportInbox } from "./support-inbox";

// Inbox live chata podrške: razgovori svih salona, odgovaranje i
// zatvaranje. Vlasnička strana je widget u adminu (admin/support-chat.tsx).
export default async function SupportInboxPage() {
  const me = await assertSuperAdmin();
  if (!me) notFound();

  const { ok, items } = await listSupportInbox();

  return (
    <main className="min-h-screen flex-1 bg-canvas p-6 font-display text-ink">
      <div className="mx-auto max-w-5xl">
        <Link
          href="/superadmin"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink/70 hover:text-ink"
        >
          <ArrowLeft className="size-4" /> Superadmin
        </Link>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight">Poruke podrške</h1>
        <p className="mt-1 text-sm font-medium text-ink/70">
          Razgovori sa vlasnicima salona - novi razgovor stiže i mejlom.
        </p>
        {!ok && (
          <div className="mt-6 rounded-2xl bg-amber-200 px-5 py-3 text-sm font-semibold text-amber-950">
            Tabele chata još ne postoje u bazi - pokreni `supabase db push` pa
            osveži stranicu.
          </div>
        )}
        {ok && <SupportInbox initialItems={items} />}
      </div>
    </main>
  );
}
