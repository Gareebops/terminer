import type { Page } from "@playwright/test";

// Seed podaci (supabase/seed.sql) na koje se testovi oslanjaju
export const DEMO_TENANT_ID = "00000000-0000-0000-0000-000000000001";
export const DEMO_SLUG = "demo";

// Nalog koji global-setup kreira u LOKALNOJ bazi (nikad ne postoji u
// produkciji - guard u setup-u ionako odbija sve što nije localhost)
export const E2E_ADMIN = {
  email: "e2e-admin@terminer.test",
  password: "e2e-Lozinka-123!",
};

export async function loginAsAdmin(page: Page): Promise<void> {
  await page.goto("/prijava");
  await page.fill("#email", E2E_ADMIN.email);
  await page.fill("#password", E2E_ADMIN.password);
  await page.getByRole("button", { name: "Prijavi se" }).click();
  await page.waitForURL("**/admin");
}

// Datumi u zoni salona (Europe/Belgrade) - CI radi u UTC, pa bi posle
// 22h leti "sutra" po runneru bilo "danas" po salonu
export function belgradeToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Belgrade" }).format(new Date());
}

function addDaysISO(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// Sutrašnji dan, preskačući nedelju (seed: nedelja neradna) - da testovi
// koji gledaju slotove u wizardu ne padnu jednom nedeljno
export function sledeciRadniDan(): string {
  let iso = addDaysISO(belgradeToday(), 1);
  if (new Date(`${iso}T12:00:00Z`).getUTCDay() === 0) iso = addDaysISO(iso, 1);
  return iso;
}

export const SLOT_RE = /^\d{2}:\d{2}$/;

// Današnji dan može biti neradan ili bez slobodnih termina (CI se vrti u
// svako doba) - idi kroz traku dana dok se ne pojave slotovi. Testovi koji
// ovo dele deterministički završe na istom danu.
export async function dodjiDoDanaSaSlotovima(page: Page): Promise<void> {
  const slot = page.getByRole("button", { name: SLOT_RE }).first();
  const prazno = page.getByText("Nema slobodnih termina");
  const dani = page.locator(".scrollbar-none > button:not([disabled])");

  for (let i = 1; i <= 10; i++) {
    await Promise.race([
      slot.waitFor({ timeout: 15_000 }).catch(() => {}),
      prazno.waitFor({ timeout: 15_000 }).catch(() => {}),
    ]);
    if (await slot.isVisible()) return;
    await dani.nth(i).click();
  }
  throw new Error("Nijedan slobodan termin u prvih 10 radnih dana - proveri seed.");
}

// Potvrdni link iz lokalnog mail hvatača (port 54324). Noviji CLI koristi
// Mailpit, stariji Inbucket - helper proba oba API-ja.
export async function nadjiPotvrdniLink(email: string): Promise<string> {
  const izvuci = (text: string): string | null =>
    text.match(/https?:\/\/[^\s"'<>]*verify[^\s"'<>]*/)?.[0]?.replace(/&amp;/g, "&") ?? null;

  for (let pokusaj = 0; pokusaj < 30; pokusaj++) {
    // Mailpit
    try {
      const res = await fetch(
        `http://127.0.0.1:54324/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`
      );
      if (res.ok) {
        const data = (await res.json()) as { messages?: { ID: string }[] };
        const id = data.messages?.[0]?.ID;
        if (id) {
          const msg = (await (
            await fetch(`http://127.0.0.1:54324/api/v1/message/${id}`)
          ).json()) as { Text?: string; HTML?: string };
          const link = izvuci(`${msg.Text ?? ""} ${msg.HTML ?? ""}`);
          if (link) return link;
        }
      }
    } catch {
      // hvatač možda još podiže - probaj ponovo
    }
    // Inbucket (stariji CLI)
    try {
      const mailbox = email.split("@")[0];
      const res = await fetch(`http://127.0.0.1:54324/api/v1/mailbox/${mailbox}`);
      if (res.ok) {
        const list = (await res.json()) as { id: string }[];
        const id = list.at(-1)?.id;
        if (id) {
          const msg = (await (
            await fetch(`http://127.0.0.1:54324/api/v1/mailbox/${mailbox}/${id}`)
          ).json()) as { body?: { text?: string; html?: string } };
          const link = izvuci(`${msg.body?.text ?? ""} ${msg.body?.html ?? ""}`);
          if (link) return link;
        }
      }
    } catch {
      // ignoriši - sledeći krug
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`Potvrdni mejl za ${email} nije stigao u mail hvatač (54324).`);
}
