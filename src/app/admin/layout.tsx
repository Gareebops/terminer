import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { getAdminContext } from "@/lib/admin";
import { AdminNav } from "./admin-nav";
import { LogoutButton } from "./logout-button";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { tenant } = await getAdminContext();

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
      <main className="min-w-0 flex-1 py-2 pr-2">{children}</main>
    </div>
  );
}
