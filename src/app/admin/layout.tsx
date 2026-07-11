import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { getAdminContext } from "@/lib/admin";
import { subscriptionInfo } from "@/lib/billing";
import { CONTACT_EMAIL } from "@/components/legal-page";
import { AdminNav } from "./admin-nav";
import { LogoutButton } from "./logout-button";
import { MobileHeader } from "./mobile-header";
import { PublishControl } from "./publish-control";
import { SubscriptionBanner } from "./subscription-banner";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { tenant } = await getAdminContext();
  const sub = subscriptionInfo(tenant);

  return (
    <div
      className="admin-scope flex min-h-screen flex-1 flex-col gap-4 bg-canvas p-4 font-display text-ink lg:flex-row"
      style={{ ["--radius" as string]: "1rem" }}
    >
      <MobileHeader
        tenantName={tenant.name}
        slug={tenant.slug}
        isPublished={tenant.is_published}
        suspended={!!tenant.suspended_at}
      />
      <aside className="sticky top-4 hidden h-[calc(100vh-2rem)] w-60 shrink-0 flex-col rounded-[2rem] bg-ink text-white lg:flex">
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
        <div className="px-3 pt-2">
          <PublishControl
            slug={tenant.slug}
            isPublished={tenant.is_published}
            suspended={!!tenant.suspended_at}
            variant="sidebar"
          />
        </div>
        <AdminNav />
        <div className="border-t border-white/10 p-3">
          <LogoutButton />
        </div>
      </aside>
      <main className="min-w-0 flex-1 lg:py-2 lg:pr-2">
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
