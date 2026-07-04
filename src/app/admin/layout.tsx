import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { getAdminContext } from "@/lib/admin";
import { subscriptionInfo } from "@/lib/billing";
import { CONTACT_EMAIL } from "@/components/legal-page";
import { AdminNav } from "./admin-nav";
import { LogoutButton } from "./logout-button";

function SubscriptionBanner({
  status,
  daysLeft,
}: {
  status: string;
  daysLeft: number;
}) {
  if (status === "active") return null;

  const styles: Record<string, string> = {
    trial: "bg-lavender text-ink",
    grace: "bg-amber-400 text-amber-950",
    expired: "bg-red-500 text-white",
  };
  const text: Record<string, string> = {
    trial: `Probni period - još ${daysLeft} ${daysLeft === 1 ? "dan" : "dana"} besplatnog korišćenja.`,
    grace: `Pretplata je istekla - online zakazivanje se pauzira za ${daysLeft} ${daysLeft === 1 ? "dan" : "dana"}.`,
    expired:
      "Pretplata je istekla i online zakazivanje je pauzirano. Tvoj sajt je i dalje aktivan.",
  };

  return (
    <div
      className={`mb-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl px-5 py-3 text-sm font-semibold ${styles[status]}`}
    >
      <span>{text[status]}</span>
      <Link
        href="/admin/podesavanja#pretplata"
        className="rounded-full bg-black/10 px-4 py-1.5 text-xs font-bold underline-offset-2 hover:underline"
      >
        Preuzmi fakturu →
      </Link>
    </div>
  );
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { tenant } = await getAdminContext();
  const sub = subscriptionInfo(tenant);

  return (
    <div
      className="admin-scope flex min-h-screen flex-1 gap-4 bg-canvas p-4 font-display text-ink"
      style={{ ["--radius" as string]: "1rem" }}
    >
      <aside className="sticky top-4 flex h-[calc(100vh-2rem)] w-60 shrink-0 flex-col rounded-3xl bg-ink text-white">
        <div className="p-5 pb-2">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-white/50">
            Terminer
          </p>
          <p className="mt-1.5 truncate text-lg font-bold tracking-tight">
            {tenant.name}
          </p>
          <Link
            href={`/${tenant.slug}`}
            target="_blank"
            className="mt-1 flex items-center gap-1 text-xs text-white/50 hover:text-white"
          >
            /{tenant.slug} <ExternalLink className="size-3" />
          </Link>
        </div>
        <AdminNav />
        <div className="border-t border-white/10 p-3">
          <LogoutButton />
        </div>
      </aside>
      <main className="min-w-0 flex-1 py-2 pr-2">
        {tenant.suspended_at && (
          <div className="mb-4 rounded-2xl bg-red-600 px-5 py-3 text-sm font-semibold text-white">
            Salon je suspendovan i sajt nije javno dostupan.
            {tenant.suspended_reason && ` Razlog: ${tenant.suspended_reason}.`}{" "}
            Kontaktiraj podršku: {CONTACT_EMAIL}
          </div>
        )}
        <SubscriptionBanner status={sub.status} daysLeft={sub.daysLeft} />
        {children}
      </main>
    </div>
  );
}
