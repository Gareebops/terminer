"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { Dialog as DialogPrimitive } from "radix-ui";
import { ExternalLink, Menu, X } from "lucide-react";
import { AdminNav } from "./admin-nav";
import { LogoutButton } from "./logout-button";
import { PublishControl } from "./publish-control";

// Mobilno zaglavlje admina (ispod lg): tamna traka sa hamburgerom koja
// otvara drawer sa istom navigacijom kao desktop sidebar. Drawer je Radix
// Dialog (ne ručni div): focus trap, Escape, zaključan skrol pozadine i
// vraćanje fokusa na hamburger dolaze besplatno. NAMERNO bez
// data-slot="dialog-content" - admin-scope CSS bi mu nametnuo beli izgled.
export function MobileHeader({
  tenantName,
  slug,
  isPublished,
  suspended,
}: {
  tenantName: string;
  slug: string;
  isPublished: boolean;
  suspended: boolean;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Klik na stavku menija menja rutu - drawer se sam zatvara.
  // Obrazac "adjusting state during render" iz React dokumentacije:
  // poredimo prethodnu rutu i zatvaramo drawer bez effect-a.
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setOpen(false);
  }

  return (
    <header className="lg:hidden">
      <div className="flex items-center justify-between gap-3 rounded-[2rem] bg-ink px-5 py-3 text-white">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/50">
            Terminer
          </p>
          <p className="truncate text-base font-bold tracking-tight">{tenantName}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <PublishControl
            slug={slug}
            isPublished={isPublished}
            suspended={suspended}
            variant="mobile"
          />
          <button
            onClick={() => setOpen(true)}
            aria-label="Otvori meni"
            aria-expanded={open}
            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white/10 transition-colors hover:bg-white/20"
          >
            <Menu className="size-5" />
          </button>
        </div>
      </div>

      <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-ink/50" />
          <DialogPrimitive.Content
            aria-describedby={undefined}
            className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col rounded-r-[2rem] bg-ink font-display text-white shadow-2xl outline-none"
          >
            <DialogPrimitive.Title className="sr-only">
              Meni
            </DialogPrimitive.Title>
            <div className="flex items-start justify-between p-5 pb-2">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-white/50">
                  Terminer
                </p>
                <p className="mt-1.5 truncate text-lg font-bold tracking-tight">
                  {tenantName}
                </p>
                <Link
                  href={`/${slug}`}
                  target="_blank"
                  className="mt-1 flex items-center gap-1 text-xs text-white/50 hover:text-white"
                >
                  /{slug} <ExternalLink className="size-3" />
                </Link>
              </div>
              <DialogPrimitive.Close asChild>
                <button
                  aria-label="Zatvori meni"
                  className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/10 transition-colors hover:bg-white/20"
                >
                  <X className="size-4" />
                </button>
              </DialogPrimitive.Close>
            </div>
            <div className="scrollbar-none min-h-0 flex-1 overflow-y-auto">
              <AdminNav />
            </div>
            <div className="border-t border-white/10 p-3">
              <LogoutButton />
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </header>
  );
}
