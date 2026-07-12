"use client";

import { useEffect } from "react";
import { HEARTBEAT_MS } from "@/lib/presence";
import { pingPresence } from "./presence-actions";

// Nevidljiv otkucaj prisustva: dok je admin tab VIDLJIV, svakih HEARTBEAT_MS
// javi serveru "tu sam" (superadmin panel iz toga crta online indikator).
// Skriven tab ne kuca - "online" znači da neko stvarno gleda panel; povratak
// na tab kuca odmah da indikator ne kasni ceo interval.
export function PresencePing() {
  useEffect(() => {
    let stopped = false;
    const ping = () => {
      if (stopped || document.visibilityState !== "visible") return;
      // Mrežni pad (uspavan laptop, ugašen server) ne sme u konzolu -
      // sledeći interval ionako pokušava ponovo
      pingPresence().catch(() => {});
    };
    ping();
    const id = setInterval(ping, HEARTBEAT_MS);
    document.addEventListener("visibilitychange", ping);
    return () => {
      stopped = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", ping);
    };
  }, []);
  return null;
}
