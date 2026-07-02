// Generisanje .ics fajla za "Dodaj u kalendar" — floating lokalno vreme,
// dovoljno za telefonske kalendare (termin je ionako u zoni salona).

export function buildICS(input: {
  title: string;
  description?: string;
  location?: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string; // HH:MM
}): string {
  const dt = (time: string) => `${input.date.replace(/-/g, "")}T${time.replace(":", "")}00`;
  const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/[,;]/g, (m) => `\\${m}`);
  const uid = `${Date.now()}-${Math.random().toString(36).slice(2)}@terminer`;

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Terminer//SR",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTART:${dt(input.startTime)}`,
    `DTEND:${dt(input.endTime)}`,
    `SUMMARY:${esc(input.title)}`,
    ...(input.description ? [`DESCRIPTION:${esc(input.description)}`] : []),
    ...(input.location ? [`LOCATION:${esc(input.location)}`] : []),
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

export function downloadICS(filename: string, ics: string) {
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
