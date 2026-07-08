"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BOOKING_STATUS_LABELS,
  BOOKING_STATUS_STYLES,
} from "@/lib/booking/status";
import { updateBookingStatus } from "../actions";
import type { Booking, BookingStatus } from "@/lib/types";

type Row = Booking & {
  services: { name: string } | null;
  staff: { name: string } | null;
};

export function BookingsTable({
  bookings,
  history = false,
  query = "",
}: {
  bookings: Row[];
  history?: boolean;
  // Aktivan upit pretrage (iz URL-a) - pretraga se izvršava u bazi, pa
  // nalazi i istoriju stariju od učitanog limita
  query?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState(query);
  const [searching, startSearch] = useTransition();

  // Kucanje → debounce → URL (?q=) → server filtrira u bazi
  useEffect(() => {
    const t = setTimeout(() => {
      const trimmed = q.trim();
      if (trimmed === query) return;
      const params = new URLSearchParams();
      if (history) params.set("prikaz", "istorija");
      if (trimmed) params.set("q", trimmed);
      const qs = params.toString();
      startSearch(() => {
        router.replace(`/admin/rezervacije${qs ? `?${qs}` : ""}`);
      });
    }, 350);
    return () => clearTimeout(t);
  }, [q, query, history, router]);

  function setStatus(id: string, status: BookingStatus) {
    startTransition(async () => {
      const res = await updateBookingStatus(id, status);
      if (!res.ok) toast.error(res.error ?? "Greška.");
    });
  }

  // Bogato prazno stanje samo kad stvarno nema podataka; kod pretrage bez
  // rezultata polje mora ostati vidljivo da se upit izmeni
  if (bookings.length === 0 && !query) {
    return (
      <div className="rounded-[2rem] border border-dashed p-8 text-center">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-mint/50 text-ink">
          <CalendarDays className="size-5" />
        </span>
        <p className="mt-3 text-lg font-bold tracking-tight">
          {history ? "Još nema prošlih termina" : "Nema predstojećih rezervacija"}
        </p>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
          {history
            ? "Ovde će stajati završeni i otkazani termini - istorija se puni sama."
            : "Online rezervacije stižu same čim klijenti dobiju link sajta, a telefonske upisuješ ručno u Kalendaru."}
        </p>
        {!history && (
          <Button asChild className="mt-5 rounded-full">
            <Link href="/admin/kalendar?novo=1">Upiši termin ručno</Link>
          </Button>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="relative mb-4 max-w-xs">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Traži po imenu ili telefonu"
          className="pl-9 pr-9"
        />
        {searching && (
          <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>
      {bookings.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          Nema rezultata za „{query}“.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Datum</TableHead>
              <TableHead>Vreme</TableHead>
              <TableHead>Klijent</TableHead>
              <TableHead>Telefon</TableHead>
              <TableHead>Usluga</TableHead>
              <TableHead>Zaposleni</TableHead>
              <TableHead>Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {bookings.map((b) => (
              <TableRow key={b.id}>
                <TableCell>
                  {new Date(`${b.date}T12:00:00`).toLocaleDateString("sr-RS")}
                </TableCell>
                <TableCell>
                  {b.start_time.slice(0, 5)}–{b.end_time.slice(0, 5)}
                </TableCell>
                <TableCell className="font-medium">{b.customer_name}</TableCell>
                <TableCell>
                  <a href={`tel:${b.customer_phone}`} className="hover:underline">
                    {b.customer_phone}
                  </a>
                </TableCell>
                <TableCell>{b.services?.name ?? "-"}</TableCell>
                <TableCell>{b.staff?.name ?? "-"}</TableCell>
                <TableCell>
                  <Badge
                    className={`border-0 font-semibold ${BOOKING_STATUS_STYLES[b.status]}`}
                  >
                    {BOOKING_STATUS_LABELS[b.status]}
                  </Badge>
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" disabled={pending}>
                        Izmeni
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {(Object.keys(BOOKING_STATUS_LABELS) as BookingStatus[])
                        .filter((s) => s !== b.status)
                        .map((s) => (
                          <DropdownMenuItem key={s} onClick={() => setStatus(b.id, s)}>
                            {BOOKING_STATUS_LABELS[s]}
                          </DropdownMenuItem>
                        ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
