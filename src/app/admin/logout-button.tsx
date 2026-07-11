"use client";

import { SignOut } from "@/components/icons";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function LogoutButton() {
  const router = useRouter();

  return (
    <button
      className="flex w-full items-center gap-2.5 rounded-full px-4 py-2.5 text-sm font-semibold text-white/70 transition-colors hover:bg-white/10 hover:text-white"
      onClick={async () => {
        await createClient().auth.signOut();
        // Na prijavu, ne na landing - vlasnik koji se odjavio najčešće
        // hoće da se prijavi ponovo (drugi nalog, drugi uređaj...)
        router.push("/prijava");
        router.refresh();
      }}
    >
      <SignOut className="size-4" />
      Odjava
    </button>
  );
}
