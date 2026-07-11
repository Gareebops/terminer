"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { CalendarX, Check, Clock, Phone } from "@/components/icons";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cancelBooking } from "@/lib/booking/actions";
import { datumSr } from "@/lib/datum";
import { DAY_NAMES_SR } from "@/lib/booking/slots";
import type { BookingStatus } from "@/lib/types";

interface CancelCardBooking {
  id: string;
  cancelToken: string;
  date: string;
  startTime: string;
  endTime: string;
  status: BookingStatus;
  customerName: string;
  serviceName: string;
  staffName: string;
}

export function CancelCard({
  slug,
  booking,
  isPast,
  windowExpired = false,
  salonPhone = null,
}: {
  slug: string;
  booking: CancelCardBooking | null;
  isPast: boolean;
  // Prošlo je više od sat vremena od zakazivanja - link više ne otkazuje
  windowExpired?: boolean;
  salonPhone?: string | null;
}) {
  const [cancelled, setCancelled] = useState(false);
  // Otkazivanje traži potvrdu - slučajan klik iz mejla ne sme da obriše
  // termin bez pitanja (nema "undo")
  const [confirming, setConfirming] = useState(false);
  // Prozor može da istekne dok stranica stoji otvorena - server tada vraća
  // code pa kartica pređe u "istekao" prikaz umesto večitog dugmeta
  const [expiredNow, setExpiredNow] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!booking) {
    return (
      <Card>
        <CardContent className="pt-10 pb-10 text-center">
          <h2 className="font-heading text-2xl font-bold">Rezervacija nije pronađena</h2>
          <p className="mt-2 text-muted-foreground">
            Link nije važeći ili je rezervacija u međuvremenu obrisana.
          </p>
          <Button asChild className="mt-6 h-11">
            <Link href={`/${slug}`}>Nazad na sajt</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const dateLabel = `${DAY_NAMES_SR[new Date(`${booking.date}T12:00:00`).getDay()]}, ${datumSr(booking.date)}`;

  const isCancelled = cancelled || booking.status === "cancelled";
  const expired = windowExpired || expiredNow;
  const canCancel =
    !isCancelled &&
    !isPast &&
    !expired &&
    ["pending", "confirmed"].includes(booking.status);

  function confirmCancel() {
    if (!booking) return;
    startTransition(async () => {
      const res = await cancelBooking({
        bookingId: booking.id,
        cancelToken: booking.cancelToken,
      });
      if (res.ok) {
        setCancelled(true);
      } else if (res.code === "window_expired") {
        setExpiredNow(true);
        setConfirming(false);
      } else {
        toast.error(res.error ?? "Otkazivanje nije uspelo. Pokušaj ponovo.");
      }
    });
  }

  return (
    <Card>
      <CardContent className="pt-10 pb-10 text-center">
        {isCancelled ? (
          <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <CalendarX className="size-8" />
          </span>
        ) : (
          <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Clock className="size-8" />
          </span>
        )}

        <h2 className="mt-5 font-heading text-2xl font-bold">
          {isCancelled ? "Termin je otkazan" : "Tvoj termin"}
        </h2>
        {/* Bez "kod {ime}" - imena se ne menjaju kroz padeže programski */}
        <p className="mt-2 text-muted-foreground">
          {booking.serviceName}
          {booking.staffName && <> · {booking.staffName}</>}
        </p>
        <p className="font-medium">
          {dateLabel} u {booking.startTime}
        </p>

        {isCancelled ? (
          <p className="mt-4 text-sm text-muted-foreground">
            {cancelled ? (
              <span className="inline-flex items-center gap-1">
                <Check className="size-4" /> Otkazivanje je zabeleženo. Slobodno zakaži novi termin.
              </span>
            ) : (
              "Ova rezervacija je već otkazana."
            )}
          </p>
        ) : isPast ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Termin je već prošao, pa otkazivanje više nije moguće.
          </p>
        ) : expired ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Termin je za manje od 48 sati, a prošlo je više od sat vremena od
            zakazivanja - otkazivanje preko linka više nije moguće.
            {salonPhone
              ? " Za izmenu ili otkazivanje pozovi salon."
              : " Za izmenu ili otkazivanje javi se salonu - kontakt je na sajtu salona."}
          </p>
        ) : !canCancel ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Ova rezervacija se ne može otkazati preko linka. Pozovi salon za izmenu.
          </p>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">
            {booking.customerName.split(" ")[0]}, ako ti termin ne odgovara, otkaži ga
            ovde - mesto se odmah oslobađa.
          </p>
        )}

        {canCancel && confirming ? (
          <div className="mx-auto mt-6 max-w-sm space-y-3 rounded-xl bg-destructive/10 p-4">
            <p className="text-sm font-medium">
              Sigurno otkazuješ termin? Mesto se odmah oslobađa za druge.
            </p>
            <div className="flex justify-center gap-2">
              <Button
                variant="ghost"
                className="h-11"
                onClick={() => setConfirming(false)}
                disabled={pending}
              >
                Odustani
              </Button>
              <Button variant="destructive" className="h-11" onClick={confirmCancel} disabled={pending}>
                <CalendarX className="size-4" />
                {pending ? "Otkazivanje…" : "Da, otkaži"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {canCancel && (
              <Button variant="destructive" className="h-11" onClick={() => setConfirming(true)}>
                <CalendarX className="size-4" /> Otkaži termin
              </Button>
            )}
            {expired && !isCancelled && salonPhone && (
              <Button className="h-11" asChild>
                <a href={`tel:${salonPhone}`}>
                  <Phone className="size-4" /> {salonPhone}
                </a>
              </Button>
            )}
            <Button
              variant={
                canCancel || (expired && !isCancelled && salonPhone)
                  ? "outline"
                  : "default"
              }
              className="h-11"
              asChild
            >
              <Link href={isCancelled ? `/${slug}/zakazi` : `/${slug}`}>
                {isCancelled ? "Zakaži novi termin" : "Nazad na sajt"}
              </Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
