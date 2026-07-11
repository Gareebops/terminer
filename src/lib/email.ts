import { Resend } from "resend";
import { buildICS } from "@/lib/booking/ics";

// Slanje mejlova preko Resend-a. Bez RESEND_API_KEY sve funkcije samo
// preskoče slanje (uz warn u logu) - booking flow nikad ne sme da padne
// zbog mejla. Sandbox Resend nalog šalje isključivo na mejl vlasnika
// naloga; pravi domen menja samo EMAIL_FROM adresu.

const FROM_FALLBACK = "Terminer <onboarding@resend.dev>";

function dateLabelSr(date: string): string {
  // sr-Latn - podrazumevani "sr-RS" daje ćirilicu, a sajt je na latinici
  return new Intl.DateTimeFormat("sr-Latn-RS", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${date}T12:00:00`));
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export interface BookingEmailInput {
  to: string;
  salonName: string;
  serviceName: string;
  staffName: string;
  date: string; // YYYY-MM-DD (lokalno vreme salona)
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  address: string | null;
  salonPhone: string | null;
  cancelUrl: string;
}

function confirmationHtml(input: BookingEmailInput): string {
  const rows: [string, string][] = [
    ["Usluga", input.serviceName],
    ["Kod", input.staffName],
    ["Datum", dateLabelSr(input.date)],
    ["Vreme", `${input.startTime} – ${input.endTime}`],
    ...(input.address ? ([["Adresa", input.address]] as [string, string][]) : []),
  ];

  const rowsHtml = rows
    .map(
      ([k, v]) => `
        <tr>
          <td style="padding:6px 16px 6px 0;color:#71717a;font-size:14px;white-space:nowrap;vertical-align:top;">${k}</td>
          <td style="padding:6px 0;color:#18181b;font-size:14px;font-weight:600;">${escapeHtml(v)}</td>
        </tr>`
    )
    .join("");

  const phoneNote = input.salonPhone
    ? `, a kasnije pozovi salon na <a href="tel:${escapeHtml(input.salonPhone)}" style="color:#18181b;">${escapeHtml(input.salonPhone)}</a>`
    : "";

  return `<!doctype html>
<html lang="sr">
<body style="margin:0;padding:24px 12px;background:#f4f4f5;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:520px;margin:0 auto;">
    <div style="background:#ffffff;border-radius:16px;padding:32px;">
      <p style="margin:0;font-size:13px;letter-spacing:0.04em;text-transform:uppercase;color:#71717a;">${escapeHtml(input.salonName)}</p>
      <h1 style="margin:8px 0 4px;font-size:22px;color:#18181b;">Termin je zakazan ✔</h1>
      <p style="margin:0 0 20px;font-size:14px;color:#52525b;">Ovo je potvrda tvoje rezervacije.</p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-top:1px solid #e4e4e7;padding-top:8px;">${rowsHtml}</table>
      <p style="margin:24px 0 0;font-size:13px;color:#71717a;line-height:1.6;">
        Ne odgovara ti termin? Možeš da ga
        <a href="${input.cancelUrl}" style="color:#18181b;font-weight:600;">otkažeš ovde</a>
        najkasnije 48 sati pre početka (termin zakazan za manje od 48h - u roku
        od sat vremena od zakazivanja)${phoneNote}.
      </p>
    </div>
    <p style="margin:16px 0 0;text-align:center;font-size:12px;color:#a1a1aa;">
      Poslato preko <a href="https://terminer.rs" style="color:#a1a1aa;">Terminer</a> zakazivanja.
    </p>
  </div>
</body>
</html>`;
}

// Obaveštenje salonu (site_settings.email) o novoj ili otkazanoj
// rezervaciji - da vlasnik ne mora da proverava kalendar.
export interface OwnerNoticeInput {
  to: string;
  kind: "new" | "cancelled";
  salonName: string;
  serviceName: string;
  staffName: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  customerName: string;
  customerPhone: string;
  note?: string | null;
}

function ownerNoticeHtml(input: OwnerNoticeInput): string {
  const rows: [string, string][] = [
    ["Usluga", input.serviceName],
    ["Zaposleni", input.staffName],
    ["Datum", dateLabelSr(input.date)],
    ["Vreme", `${input.startTime} – ${input.endTime}`],
    ["Klijent", input.customerName],
    ["Telefon", input.customerPhone],
    ...(input.note ? ([["Napomena", input.note]] as [string, string][]) : []),
  ];
  const rowsHtml = rows
    .map(
      ([k, v]) => `
        <tr>
          <td style="padding:6px 16px 6px 0;color:#71717a;font-size:14px;white-space:nowrap;vertical-align:top;">${k}</td>
          <td style="padding:6px 0;color:#18181b;font-size:14px;font-weight:600;">${escapeHtml(v)}</td>
        </tr>`
    )
    .join("");

  const title = input.kind === "new" ? "Nova rezervacija ✔" : "Rezervacija je otkazana";
  const intro =
    input.kind === "new"
      ? "Klijent je upravo zakazao termin online."
      : "Klijent je otkazao termin preko linka iz mejla - termin je ponovo slobodan.";

  return `<!doctype html>
<html lang="sr">
<body style="margin:0;padding:24px 12px;background:#f4f4f5;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:520px;margin:0 auto;">
    <div style="background:#ffffff;border-radius:16px;padding:32px;">
      <p style="margin:0;font-size:13px;letter-spacing:0.04em;text-transform:uppercase;color:#71717a;">${escapeHtml(input.salonName)}</p>
      <h1 style="margin:8px 0 4px;font-size:22px;color:#18181b;">${title}</h1>
      <p style="margin:0 0 20px;font-size:14px;color:#52525b;">${intro}</p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-top:1px solid #e4e4e7;padding-top:8px;">${rowsHtml}</table>
    </div>
    <p style="margin:16px 0 0;text-align:center;font-size:12px;color:#a1a1aa;">
      Poslato preko <a href="https://terminer.rs" style="color:#a1a1aa;">Terminer</a> zakazivanja.
    </p>
  </div>
</body>
</html>`;
}

export async function sendOwnerBookingNotice(
  input: OwnerNoticeInput
): Promise<{ sent: boolean }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("RESEND_API_KEY nije podešen - obaveštenje salonu preskočeno.");
    return { sent: false };
  }
  const prefix = input.kind === "new" ? "Nova rezervacija" : "Otkazan termin";
  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: process.env.EMAIL_FROM ?? FROM_FALLBACK,
      to: input.to,
      subject: `${prefix} - ${dateLabelSr(input.date)} u ${input.startTime}`,
      html: ownerNoticeHtml(input),
    });
    if (error) {
      console.error("Resend greška (obaveštenje salonu):", error);
      return { sent: false };
    }
    return { sent: true };
  } catch (err) {
    console.error("Slanje obaveštenja salonu nije uspelo:", err);
    return { sent: false };
  }
}

// Obaveštenje KLIJENTU da je salon otkazao njegov termin - da ne dođe
// pred zaključana vrata. Šalje se iz admin akcije promene statusa.
export interface CustomerCancelledInput {
  to: string;
  salonName: string;
  serviceName: string;
  staffName: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  salonPhone: string | null;
  bookingUrl: string;
}

function customerCancelledHtml(input: CustomerCancelledInput): string {
  const phoneNote = input.salonPhone
    ? ` ili pozovi salon na <a href="tel:${escapeHtml(input.salonPhone)}" style="color:#18181b;">${escapeHtml(input.salonPhone)}</a>`
    : "";
  return `<!doctype html>
<html lang="sr">
<body style="margin:0;padding:24px 12px;background:#f4f4f5;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:520px;margin:0 auto;">
    <div style="background:#ffffff;border-radius:16px;padding:32px;">
      <p style="margin:0;font-size:13px;letter-spacing:0.04em;text-transform:uppercase;color:#71717a;">${escapeHtml(input.salonName)}</p>
      <h1 style="margin:8px 0 4px;font-size:22px;color:#18181b;">Termin je otkazan</h1>
      <p style="margin:0 0 20px;font-size:14px;color:#52525b;">
        Tvoj termin
        <strong>${escapeHtml(input.serviceName)}</strong>${input.staffName ? ` (${escapeHtml(input.staffName)})` : ""}
        zakazan za <strong>${dateLabelSr(input.date)} u ${input.startTime}</strong>
        je otkazan u salonu.
      </p>
      <p style="margin:0;font-size:14px;color:#52525b;line-height:1.6;">
        Novi termin možeš da
        <a href="${input.bookingUrl}" style="color:#18181b;font-weight:600;">zakažeš ovde</a>${phoneNote}.
        Ako otkazivanje nisi tražio/la, javi se salonu.
      </p>
    </div>
    <p style="margin:16px 0 0;text-align:center;font-size:12px;color:#a1a1aa;">
      Poslato preko <a href="https://terminer.rs" style="color:#a1a1aa;">Terminer</a> zakazivanja.
    </p>
  </div>
</body>
</html>`;
}

export async function sendCustomerCancelledNotice(
  input: CustomerCancelledInput
): Promise<{ sent: boolean }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("RESEND_API_KEY nije podešen - obaveštenje klijentu preskočeno.");
    return { sent: false };
  }
  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: process.env.EMAIL_FROM ?? FROM_FALLBACK,
      to: input.to,
      subject: `Otkazan termin - ${input.salonName}, ${dateLabelSr(input.date)} u ${input.startTime}`,
      html: customerCancelledHtml(input),
    });
    if (error) {
      console.error("Resend greška (otkazivanje klijentu):", error);
      return { sent: false };
    }
    return { sent: true };
  } catch (err) {
    console.error("Slanje obaveštenja klijentu nije uspelo:", err);
    return { sent: false };
  }
}

// Obaveštenje SUPERADMINU da je vlasnik salona otvorio nov razgovor sa
// podrškom (live chat u adminu). Šalje se samo pri OTVARANJU razgovora,
// ne za svaku poruku - odgovara se iz /superadmin/poruke.
export interface SupportChatNoticeInput {
  salonName: string;
  slug: string;
  ownerEmail: string | null;
  firstMessage: string; // već sečen izvod (excerpt)
  inboxUrl: string;
}

function supportChatNoticeHtml(input: SupportChatNoticeInput): string {
  return `<!doctype html>
<html lang="sr">
<body style="margin:0;padding:24px 12px;background:#f4f4f5;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:520px;margin:0 auto;">
    <div style="background:#ffffff;border-radius:16px;padding:32px;">
      <p style="margin:0;font-size:13px;letter-spacing:0.04em;text-transform:uppercase;color:#71717a;">Terminer podrška</p>
      <h1 style="margin:8px 0 4px;font-size:22px;color:#18181b;">Nov razgovor sa podrškom</h1>
      <p style="margin:0 0 20px;font-size:14px;color:#52525b;">
        <strong>${escapeHtml(input.salonName)}</strong> (/${escapeHtml(input.slug)})${
          input.ownerEmail ? `, vlasnik ${escapeHtml(input.ownerEmail)}` : ""
        } je upravo otvorio chat.
      </p>
      <blockquote style="margin:0 0 24px;padding:12px 16px;background:#f4f4f5;border-radius:12px;font-size:14px;color:#18181b;">${escapeHtml(input.firstMessage)}</blockquote>
      <a href="${input.inboxUrl}" style="display:inline-block;background:#18181b;color:#ffffff;font-size:14px;font-weight:600;padding:10px 20px;border-radius:999px;text-decoration:none;">Odgovori u panelu</a>
    </div>
    <p style="margin:16px 0 0;text-align:center;font-size:12px;color:#a1a1aa;">
      Poslato preko <a href="https://terminer.rs" style="color:#a1a1aa;">Terminer</a> zakazivanja.
    </p>
  </div>
</body>
</html>`;
}

export async function sendSupportChatNotice(
  input: SupportChatNoticeInput
): Promise<{ sent: boolean }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("RESEND_API_KEY nije podešen - obaveštenje podršci preskočeno.");
    return { sent: false };
  }
  // Isti izvor istine kao pristup /superadmin panelu (zarez-separisana lista)
  const to = (process.env.SUPER_ADMIN_EMAIL ?? "")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);
  if (to.length === 0) {
    console.warn("SUPER_ADMIN_EMAIL nije podešen - obaveštenje podršci preskočeno.");
    return { sent: false };
  }
  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: process.env.EMAIL_FROM ?? FROM_FALLBACK,
      to,
      subject: `Nov razgovor sa podrškom - ${input.salonName}`,
      html: supportChatNoticeHtml(input),
    });
    if (error) {
      console.error("Resend greška (obaveštenje podršci):", error);
      return { sent: false };
    }
    return { sent: true };
  } catch (err) {
    console.error("Slanje obaveštenja podršci nije uspelo:", err);
    return { sent: false };
  }
}

export async function sendBookingConfirmation(
  input: BookingEmailInput
): Promise<{ sent: boolean }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("RESEND_API_KEY nije podešen - potvrda mejlom preskočena.");
    return { sent: false };
  }

  const ics = buildICS({
    title: `${input.serviceName} - ${input.salonName}`,
    description: `Kod: ${input.staffName}`,
    location: input.address ?? undefined,
    date: input.date,
    startTime: input.startTime,
    endTime: input.endTime,
  });

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: process.env.EMAIL_FROM ?? FROM_FALLBACK,
      to: input.to,
      subject: `Potvrda termina - ${input.salonName}, ${dateLabelSr(input.date)} u ${input.startTime}`,
      html: confirmationHtml(input),
      attachments: [{ filename: "termin.ics", content: Buffer.from(ics).toString("base64") }],
    });
    if (error) {
      console.error("Resend greška:", error);
      return { sent: false };
    }
    return { sent: true };
  } catch (err) {
    console.error("Slanje potvrde mejlom nije uspelo:", err);
    return { sent: false };
  }
}
