"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDots,
  ClockUser,
  CreditCard,
  House,
  Images,
  Scissors,
  Sliders,
  Ticket,
  UsersThree,
} from "@/components/icons";

const nav = [
  { href: "/admin", label: "Početna", icon: House },
  { href: "/admin/kalendar", label: "Kalendar", icon: CalendarDots },
  { href: "/admin/rezervacije", label: "Rezervacije", icon: Ticket },
  { href: "/admin/usluge", label: "Usluge", icon: Scissors },
  { href: "/admin/zaposleni", label: "Zaposleni", icon: UsersThree },
  { href: "/admin/raspored", label: "Raspored", icon: ClockUser },
  { href: "/admin/galerija", label: "Galerija", icon: Images },
  { href: "/admin/pretplata", label: "Pretplata", icon: CreditCard },
  { href: "/admin/podesavanja", label: "Podešavanja", icon: Sliders },
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
