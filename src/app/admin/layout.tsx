import Link from "next/link";
import {
  CalendarDays,
  CalendarRange,
  ClipboardList,
  ExternalLink,
  LayoutDashboard,
  Scissors,
  Settings,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { getAdminContext } from "@/lib/admin";
import { LogoutButton } from "./logout-button";

const nav = [
  { href: "/admin", label: "Početna", icon: LayoutDashboard },
  { href: "/admin/kalendar", label: "Kalendar", icon: CalendarDays },
  { href: "/admin/rezervacije", label: "Rezervacije", icon: ClipboardList },
  { href: "/admin/usluge", label: "Usluge", icon: Scissors },
  { href: "/admin/zaposleni", label: "Zaposleni", icon: Users },
  { href: "/admin/smene", label: "Smene", icon: CalendarRange },
  { href: "/admin/podesavanja", label: "Podešavanja", icon: Settings },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { tenant } = await getAdminContext();

  return (
    <div className="flex min-h-screen flex-1">
      <aside className="flex w-56 shrink-0 flex-col border-r bg-muted/30">
        <div className="border-b p-4">
          <p className="truncate font-semibold">{tenant.name}</p>
          <Link
            href={`/${tenant.slug}`}
            target="_blank"
            className="mt-1 flex items-center gap-1 text-xs text-muted-foreground hover:underline"
          >
            /{tenant.slug} <ExternalLink className="size-3" />
          </Link>
        </div>
        <nav className="flex-1 space-y-1 p-2">
          {nav.map((item) => (
            <Button
              key={item.href}
              variant="ghost"
              className="w-full justify-start"
              asChild
            >
              <Link href={item.href}>
                <item.icon className="size-4" />
                {item.label}
              </Link>
            </Button>
          ))}
        </nav>
        <div className="border-t p-2">
          <LogoutButton />
        </div>
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
