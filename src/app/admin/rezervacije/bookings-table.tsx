"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { updateBookingStatus } from "../actions";
import type { Booking, BookingStatus } from "@/lib/types";

const statusLabels: Record<BookingStatus, string> = {
  pending: "Na čekanju",
  confirmed: "Potvrđeno",
  cancelled: "Otkazano",
  completed: "Završeno",
  no_show: "Nije došao",
};

const statusStyles: Record<BookingStatus, string> = {
  pending: "bg-ink/5 text-ink",
  confirmed: "bg-mint text-ink",
  cancelled: "bg-red-100 text-red-900",
  completed: "bg-lavender text-ink",
  no_show: "bg-red-100 text-red-900",
};

type Row = Booking & {
  services: { name: string } | null;
  staff: { name: string } | null;
};

export function BookingsTable({ bookings }: { bookings: Row[] }) {
  const [pending, startTransition] = useTransition();

  function setStatus(id: string, status: BookingStatus) {
    startTransition(async () => {
      const res = await updateBookingStatus(id, status);
      if (!res.ok) toast.error(res.error ?? "Greška.");
    });
  }

  if (bookings.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
        Nema predstojećih rezervacija.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Datum</TableHead>
          <TableHead>Vreme</TableHead>
          <TableHead>Klijent</TableHead>
          <TableHead>Telefon</TableHead>
          <TableHead>Usluga</TableHead>
          <TableHead>Radnik</TableHead>
          <TableHead>Status</TableHead>
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {bookings.map((b) => (
          <TableRow key={b.id}>
            <TableCell>{new Date(`${b.date}T12:00:00`).toLocaleDateString("sr-RS")}</TableCell>
            <TableCell>
              {b.start_time.slice(0, 5)}–{b.end_time.slice(0, 5)}
            </TableCell>
            <TableCell className="font-medium">{b.customer_name}</TableCell>
            <TableCell>
              <a href={`tel:${b.customer_phone}`} className="hover:underline">
                {b.customer_phone}
              </a>
            </TableCell>
            <TableCell>{b.services?.name ?? "—"}</TableCell>
            <TableCell>{b.staff?.name ?? "—"}</TableCell>
            <TableCell>
              <Badge className={`border-0 font-semibold ${statusStyles[b.status]}`}>
                {statusLabels[b.status]}
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
                  {(Object.keys(statusLabels) as BookingStatus[])
                    .filter((s) => s !== b.status)
                    .map((s) => (
                      <DropdownMenuItem key={s} onClick={() => setStatus(b.id, s)}>
                        {statusLabels[s]}
                      </DropdownMenuItem>
                    ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
