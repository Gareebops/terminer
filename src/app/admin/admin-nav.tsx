"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  CalendarRange,
  ClipboardList,
  CreditCard,
  Images,
  LayoutDashboard,
  Scissors,
  Settings,
  Users,
} from "lucide-react";

const nav = [
  { href: "/admin", label: "Početna", icon: LayoutDashboard },
  { href: "/admin/kalendar", label: "Kalendar", icon: CalendarDays },
  { href: "/admin/rezervacije", label: "Rezervacije", icon: ClipboardList },
  { href: "/admin/usluge", label: "Usluge", icon: Scissors },
  { href: "/admin/zaposleni", label: "Zaposleni", icon: Users },
  { href: "/admin/smene", label: "Smene", icon: CalendarRange },
  { href: "/admin/galerija", label: "Galerija", icon: Images },
  { href: "/admin/pretplata", label: "Pretplata", icon: CreditCard },
  { href: "/admin/podesavanja", label: "Podešavanja", icon: Settings },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex-1 space-y-1 p-3">
      {nav.map((item) => {
        const active =
          item.href === "/admin"
            ? pathname === "/admin"
            : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-2.5 rounded-full px-4 py-2.5 text-sm font-semibold transition-colors ${
              active
                ? "bg-mint text-ink"
                : "text-white/70 hover:bg-white/10 hover:text-white"
            }`}
          >
            <item.icon className="size-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
