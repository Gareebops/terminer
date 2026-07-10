"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Loader2, Phone, Search } from "lucide-react";
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
import { datumSr } from "@/lib/datum";
import { updateBookingStatus } from "../actions";
import type { Booking, BookingStatus } from "@/lib/types";

type Row = Booking & {
  services: { name: string } | null;
  staff: { name: string } | null;
};

// Promena statusa - isti meni u tabeli (desktop) i karticama (telefon)
function StatusMenu({
  booking,
  pending,
  onSet,
}: {
  booking: Row;
  pending: boolean;
  onSet: (id: string, status: BookingStatus) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="max-sm:h-10" disabled={pending}>
          Izmeni
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {(Object.keys(BOOKING_STATUS_LABELS) as BookingStatus[])
          .filter((st) => st !== booking.status)
          .map((st) => (
            <DropdownMenuItem key={st} onClick={() => onSet(booking.id, st)}>
              {BOOKING_STATUS_LABELS[st]}
            </DropdownMenuItem>
          ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

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
      if (!res.ok) toast.error(res.error ?? "Nešto nije uspelo. Pokušaj ponovo.");
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
        <>
        {/* Telefon: kartice umesto tabele sa 8 kolona horizontalnog skrola */}
        <div className="space-y-2 sm:hidden">
          {bookings.map((b) => (
            <div key={b.id} className="rounded-2xl border p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold">
                  {datumSr(b.date, { weekday: "short", day: "numeric", month: "numeric" })}{" "}
                  · {b.start_time.slice(0, 5)}–{b.end_time.slice(0, 5)}
                </p>
                <Badge
                  className={`border-0 font-semibold ${BOOKING_STATUS_STYLES[b.status]}`}
                >
                  {BOOKING_STATUS_LABELS[b.status]}
                </Badge>
              </div>
              <p className="mt-1 font-medium">{b.customer_name}</p>
              <p className="text-sm text-muted-foreground">
                {b.services?.name ?? "-"} · {b.staff?.name ?? "-"}
              </p>
              <div className="mt-1 flex items-center justify-between gap-2">
                <a
                  href={`tel:${b.customer_phone}`}
                  className="flex min-h-10 items-center gap-1.5 text-sm font-medium hover:underline"
                >
                  <Phone className="size-3.5" /> {b.customer_phone}
                </a>
                <StatusMenu booking={b} pending={pending} onSet={setStatus} />
              </div>
            </div>
          ))}
        </div>
        <div className="hidden sm:block">
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
                <TableCell>{datumSr(b.date)}</TableCell>
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
                  <StatusMenu booking={b} pending={pending} onSet={setStatus} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </div>
        </>
      )}
    </div>
  );
}
