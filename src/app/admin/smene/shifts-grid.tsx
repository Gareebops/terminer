"use client";

import Link from "next/link";
import { useTransition } from "react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { setShiftAssignment } from "../actions";
import { DAY_NAMES_SR } from "@/lib/booking/slots";
import type { ShiftAssignment, ShiftTemplate, Staff } from "@/lib/types";

export function ShiftsGrid({
  weekDates,
  staff,
  templates,
  assignments,
}: {
  weekDates: string[];
  staff: Staff[];
  templates: ShiftTemplate[];
  assignments: ShiftAssignment[];
}) {
  const [pending, startTransition] = useTransition();

  function cellValue(staffId: string, date: string): string {
    const a = assignments.find((x) => x.staff_id === staffId && x.date === date);
    if (!a) return "default";
    if (a.is_off) return "off";
    return a.shift_template_id ?? "default";
  }

  function onChange(staffId: string, date: string, value: string) {
    startTransition(async () => {
      const res = await setShiftAssignment({ staffId, date, value });
      if (!res.ok) toast.error(res.error ?? "Greška.");
    });
  }

  if (staff.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
        Prvo dodaj zaposlene.
      </p>
    );
  }

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className="border-b p-2 text-left font-medium">Zaposleni</th>
            {weekDates.map((d) => {
              const date = new Date(`${d}T12:00:00`);
              return (
                <th
                  key={d}
                  className={`border-b p-2 text-center font-medium ${d === todayStr ? "bg-accent/50" : ""}`}
                >
                  <div>{DAY_NAMES_SR[date.getDay()].slice(0, 3)}</div>
                  <div className="text-xs font-normal text-muted-foreground">
                    {date.getDate()}.{date.getMonth() + 1}.
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {staff.map((m) => {
            const myTemplates = templates.filter((t) => t.staff_id === m.id);
            return (
              <tr key={m.id}>
                <td className="border-b p-2 font-medium">{m.name}</td>
                {weekDates.map((d) => (
                  <td
                    key={d}
                    className={`border-b p-1 ${d === todayStr ? "bg-accent/50" : ""}`}
                  >
                    <Select
                      value={cellValue(m.id, d)}
                      onValueChange={(v) => onChange(m.id, d, v)}
                      disabled={pending}
                    >
                      <SelectTrigger className="h-8 w-full min-w-28 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="default">Podrazumevano</SelectItem>
                        {myTemplates.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.name} ({t.start_time.slice(0, 5)}–{t.end_time.slice(0, 5)})
                          </SelectItem>
                        ))}
                        <SelectItem value="off">Slobodan</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-3 text-xs text-muted-foreground">
        Smene za zaposlenog se definišu na njegovoj stranici (
        <Link href="/admin/zaposleni" className="underline">
          Zaposleni
        </Link>{" "}
        → izbor zaposlenog → Smene).
      </p>
    </div>
  );
}
