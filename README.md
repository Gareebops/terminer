# Terminer

Multi-tenant platforma za frizerske i beauty salone: svaki salon dobija svoj
mini-sajt sa online zakazivanjem termina — "domaći Wix za frizere".

## Stack

- **Next.js 16** (App Router, TypeScript) + **Tailwind 4** + **shadcn/ui**
- **Supabase** — Postgres, Auth, Storage; izolacija salona preko `tenant_id` + RLS
- Javne booking operacije idu kroz server akcije sa service-role ključem
  (rezervacije i podaci klijenata nikad nisu javno čitljivi)
- Duplo zakazivanje sprečava **exclusion constraint** u Postgresu, ne klijentski kod

## Pokretanje

1. Napravi Supabase projekat na [supabase.com](https://supabase.com) (ili lokalno
   `supabase start`, potreban Docker).
2. Primeni migracije i seed:
   ```bash
   supabase link --project-ref <ref>   # za cloud projekat
   supabase db push                    # primenjuje supabase/migrations
   # seed (demo salon): pokreni sadržaj supabase/seed.sql u SQL editoru
   ```
3. Popuni `.env.local` (vidi `.env.example`): URL, anon key, service role key.
4. ```bash
   npm install
   npm run dev
   ```

## URL struktura (path-based multi-tenancy)

| Ruta | Šta je |
|---|---|
| `/` | Landing platforme (marketing + registracija) |
| `/{slug}` | Javni mini-sajt salona (hero, usluge, tim, galerija, kontakt) |
| `/{slug}/zakazi` | Booking čarobnjak: usluga → frizer → datum/termin → potvrda |
| `/prijava`, `/registracija`, `/onboarding` | Nalozi vlasnika i kreiranje salona |
| `/admin/*` | Admin panel salona (rezervacije, usluge, zaposleni, podešavanja) |

Tenant se rezoluje u [src/proxy.ts](src/proxy.ts) — prelazak na subdomene
(`salon.terminer.rs`) ili custom domene menja samo taj fajl.

## Arhitektura ukratko

- `src/lib/tenant.ts` — jedina tačka rezolucije tenant-a iz slug-a
- `src/lib/booking/` — čista logika slotova (`slots.ts`), timezone konverzija,
  server akcije za dostupnost/zakazivanje/otkazivanje (`actions.ts`)
- `src/lib/admin.ts` — kontekst ulogovanog člana salona; admin upiti idu preko
  session klijenta pa RLS garantuje izolaciju
- `supabase/migrations/` — kompletna šema: tenants, members, services, staff,
  working_hours, shift_templates/assignments, bookings, blocked_slots,
  customers, site_settings, gallery + RLS politike + storage bucket

## Logika dostupnosti termina

1. Radno okno frizera za datum: dodeljena smena (`shift_assignments` →
   `shift_templates`) ima prednost; inače nedeljno `working_hours`.
2. Zauzeće: aktivne rezervacije + blokirani termini (frizer ili ceo salon).
3. Slotovi se nude na korak od 30 min, u vremenskoj zoni salona.
4. Upis rezervacije: validacija na serveru + exclusion constraint u bazi
   (istovremeni pokušaji → drugi dobija "termin je upravo zauzet").

## Sledeći koraci (roadmap)

- [ ] Email potvrde i otkazivanje preko linka (Resend) — `cancel_token` već postoji u šemi
- [ ] Admin: kalendar pregled, blokiranje termina, smene UI (šema je spremna)
- [ ] Admin: dodela usluga po zaposlenom, radno vreme po danu (UI)
- [ ] Upload slika (logo, tim, galerija) u `tenant-media` bucket
- [ ] Teme/boje sajta, subdomeni, custom domeni
- [ ] SMS/Viber podsetnici, evidencija klijenata, statistika, naplata pretplate
