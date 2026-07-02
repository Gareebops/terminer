// Konverzija lokalnog vremena salona (IANA zona) u UTC bez spoljne biblioteke.

function tzOffsetMs(timeZone: string, utcDate: Date): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = Object.fromEntries(
    dtf.formatToParts(utcDate).map((p) => [p.type, p.value])
  );
  const asUTC = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) % 24,
    Number(parts.minute),
    Number(parts.second)
  );
  return asUTC - utcDate.getTime();
}

// "2026-07-01" + "14:30" u zoni salona → UTC Date
export function zonedToUtc(dateStr: string, timeStr: string, timeZone: string): Date {
  const utcGuess = new Date(`${dateStr}T${timeStr}:00Z`);
  const offset = tzOffsetMs(timeZone, utcGuess);
  return new Date(utcGuess.getTime() - offset);
}

// Trenutni datum ("YYYY-MM-DD") i minuti od ponoći u zoni salona
export function nowInZone(timeZone: string): { date: string; minutes: number } {
  const dtf = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const parts = Object.fromEntries(
    dtf.formatToParts(new Date()).map((p) => [p.type, p.value])
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: (Number(parts.hour) % 24) * 60 + Number(parts.minute),
  };
}
