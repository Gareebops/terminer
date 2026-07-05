# Terminer — stanje projekta (handoff za AI/developera)

> Poslednje ažuriranje: 4. jul 2026. Ovaj dokument je izvor istine o tome šta je
> urađeno, kako je urađeno i šta je sledeće. Pre bilo kakvog rada pročitaj ga ceo,
> pa proveri `git log --oneline` za eventualne novije izmene.

**Novo od 4.7:** (1) Registracija traži ime/telefon + verifikaciju mejla —
`/auth/callback` ruta, "Proveri sanduče" ekran, ponovno slanje linka; email
potvrda naloga UKLJUČENA u Supabase. (2) Resend RADI NA PRODUKCIJI
(`potvrda@terminer.rs`, domen verifikovan; ključ u .env.local i na Vercelu).
(3) Pokušan redizajn šablona salona (MINERVA stil) — Mihajlo tražio REVERT,
stari šablon mu je draži; commit sa redizajnom postoji u istoriji (27848fc)
ako ikad zatreba. (4) Demo salon pretvoren u ugledni primer "Salon Aura":
novi sadržaj + 12 AI fotografija uklj. zlatni logo monogram (vidi "Test podaci"); adresa Svetogorska 27 Beograd, zlatna #b45309, pill dugmad; verifikovano uživo
uključujući booking za novu koloristkinju.

## 1. Šta je Terminer

Multi-tenant SaaS za frizerske/beauty salone u Srbiji — "domaći Wix za frizere".
Vlasnik salona se registruje, prođe onboarding i dobije **mini-sajt sa online
zakazivanjem** na `terminer.rs/{slug}` + admin panel. Klijenti salona zakazuju
kao gosti (bez naloga).

- Vlasnik: Mihajlo (milosevicmihajlo13@gmail.com), komunikacija na srpskom.
- Inspiracija: njegova ranija single-tenant app github.com/Gareebops/akademijadjordje.
- **Status: komercijalna faza.** MVP prezentovan frizeru (jako zadovoljan),
  postoji nekoliko sigurnih klijenata. Naplata implementirana (proba + paywall).

## 2. Stack i pokretanje

| | |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack), TypeScript, `src/` layout |
| UI | Tailwind 4, shadcn/ui (radix base), lucide-react, sonner, motion |
| Baza/Auth/Storage | Supabase (cloud projekat `hmsvyoyjlwkdhevsbavh`, region Frankfurt) |
| Fontovi | Geist (default), Plus Jakarta Sans (Terminer brend), + 4 para za salone |

```bash
npm run dev            # localhost:3000
npm run build          # mora proći pre svakog commita
npx tsc --noEmit       # brza provera tipova (ignoriši greške iz .next/)
supabase db push       # migracije — MORA pokrenuti Mihajlo (traži DB lozinku koju samo on zna)
```

`.env.local` (postoji, popunjen): `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
`SUPER_ADMIN_EMAIL` (pristup /superadmin, zarez-separisano).
Popunjeni i rade (lokalno i na Vercelu): `RESEND_API_KEY`,
`EMAIL_FROM="Terminer <potvrda@terminer.rs>"`; na Vercelu još
`NEXT_PUBLIC_APP_URL=https://terminer.rs`.

**Test podaci u bazi:**
- Salon `demo` = **"Salon Aura"** (objavljen, "plaćen" do 2027) — UGLEDNI PRIMER
  za prezentacije: 8 usluga sa opisima, 3 zaposlena (Đorđe, Marko, Jovana
  koloristkinja) sa AI portretima, hero enterijer i 6 slika galerije
  (Higgsfield soul_2, u storage `{tenant}/site/`), radno vreme pon–sub.
  NE BRISATI pre launcha — ovo je javni showcase. Seed rezervacija
  (Test Testić) obrisana 5.7; u `customers` je ostao samo seed klijent
  "Test Testić" (obrisati uz ostale test podatke pre launcha).
- Salon `studio-test` — Mihajlov probni salon (neobjavljen).
- Test admin: `test-admin@terminer.dev` / `terminer-test-123` (owner demo salona,
  u SUPER_ADMIN_EMAIL listi). **Obrisati pre produkcije.**
- Seed za novu bazu: `supabase/seed.sql`.

## 3. Arhitektura — ključne odluke (NE menjati bez razloga)

1. **Jedna baza, `tenant_id` na svemu + RLS.** Javno čitanje samo za objavljene
   salone; rezervacije i klijenti NIKAD javno čitljivi.
2. **Tenant rezolucija je centralizovana**: path-based (`/{slug}`) u
   [src/proxy.ts](src/proxy.ts) (Next 16 konvencija umesto middleware) +
   [src/lib/tenant.ts](src/lib/tenant.ts) (`getTenantSite`, React cache).
   Prelazak na subdomene = izmena samo ta dva mesta.
3. **Javne booking operacije idu kroz server akcije sa service-role klijentom**
   ([src/lib/booking/actions.ts](src/lib/booking/actions.ts)) — RLS nema javni
   write; server validira sve. Klijentski kod NIKAD ne odlučuje o dostupnosti.
4. **Duplo zakazivanje brani Postgres exclusion constraint** (`bookings_no_overlap`,
   btree_gist, tstzrange po staff_id, samo pending/confirmed). Insert koji pukne
   sa kodom `23P01` = termin zauzet.
5. **Gost-booking**: ime + telefon (+ opciono email); `customers` se upsertuje po
   `(tenant_id, phone)`; `cancel_token` na rezervaciji čeka email funkcionalnost.
6. **Neobjavljen salon**: vlasnik ga vidi i može da testira ceo booking (anonimni
   ne mogu ni do stranice zbog RLS); žuti baner podseća da objavi.
7. **Vremena**: baza čuva `date + start/end time` (lokalno vreme salona) I
   `starts_at/ends_at` (UTC, za constraint). Konverzija u
   [src/lib/booking/timezone.ts](src/lib/booking/timezone.ts), zona `Europe/Belgrade`.

## 4. Šema baze (3 migracije u `supabase/migrations/`)

- `20260701000001_init.sql` — sve tabele + RLS + storage bucket `tenant-media`
  (putanja fajla mora počinjati tenant_id-jem; javno čitanje, upis samo članovi):
  `tenants`, `tenant_members` (owner/admin/staff), `site_settings`, `services`,
  `staff`, `staff_services`, `working_hours` (nedeljni default, dow 0=nedelja),
  `shift_templates` + `shift_assignments` (smena za datum GAZI working_hours;
  `is_off` = slobodan dan), `customers`, `bookings`, `blocked_slots`
  (staff_id null = ceo salon), `gallery`. Helper funkcije `is_member`,
  `has_tenant_role` (security definer).
- `20260702000001_theme.sql` — `site_settings.theme` jsonb (`font_pair`, `mode`).
- `20260703000001_billing.sql` — `tenants.trial_ends_at` (default now()+30d),
  `paid_until`, `billing_note`. (+ `20260703000002/3` fakture i status)
- `20260704000001_superadmin.sql` — `tenants.suspended_at/suspended_reason`,
  tabela `superadmin_audit_log` (RLS bez policy = samo service role) i
  kolonske privilegije na `tenants` (authenticated: update samo
  name/is_published/billing_note, insert samo name/slug — zatvara rupu gde je
  vlasnik REST-om mogao da menja svoj paid_until).
- `20260705000001_tenant_integritet.sql` — primenjena 5.7. Composite FK-ovi
  `(tenant_id, staff_id/service_id/...)` na bookings, staff_services,
  working_hours, shift_templates, shift_assignments, blocked_slots: zatvara
  cross-tenant rupu gde je vlasnik jednog salona mogao REST-om da ubaci
  booking/smenu sa tuđim staff_id i blokira tuđi kalendar. Uz to su slot
  upiti u booking akcijama dobili tenant_id filter (odbrana u dubinu).
- `20260705000003_booking_zastita.sql` (`bookings.created_ip` za IP rate
  limit) + `20260705000004_fk_konsolidacija.sql` — primenjene 5.7.
  000004 je popravila regresiju iz 000001: composite FK-ovi su bili dodati
  PORED starih jednokolonskih pa je PostgREST embedding bio dvosmislen
  (PGRST201) i tiho je lomio kalendar/početnu/rezervacije, primenu smena u
  slotovima i otkazivanje. Sada je composite FK jedina veza po paru tabela
  (on delete ponašanje očuvano). POUKA za buduće migracije: kad se dodaje
  composite FK, stari jednokolonski FK se mora ukloniti u ISTOJ migraciji.
- `20260705000002_javno_citanje.sql` — primenjena 5.7.
  Sužava javno čitanje: (1) kolonske SELECT privilegije na `tenants` — javni
  klijenti vide samo id/slug/name/timezone/is_published/suspended_at/
  created_at, a paid_until/trial_ends_at/billing_note/suspended_reason više
  ne cure kroz REST; (2) working_hours/shift_templates/shift_assignments
  čitaju samo članovi (slotove ionako računa server service-role klijentom).
  Prateće izmene koda (kompatibilne i PRE migracije): `getTenantSite` bira
  eksplicitne kolone (`PublicTenant` tip), `getAdminContext` čita tenant red
  service-role klijentom posle provere članstva kroz RLS.

**Logika slobodnih termina** (server): okno = smena za taj datum ILI working_hours
→ minus aktivne rezervacije i blokade → slotovi na 30 min u zoni salona
([src/lib/booking/slots.ts](src/lib/booking/slots.ts) je čista, testabilna logika).

## 5. Dva dizajn sistema — VAŽNO razlikovanje

1. **Terminer brend** (admin, landing, auth, superadmin): fintech DS iz
   `~/Downloads/design-system.html`. Tokeni u globals.css: `bg-canvas` #E4E9E0,
   `bg-ink` #17181A, `bg-mint` #A6F5A6 (pozitivno/CTA), `bg-lavender` #B7A9F2
   (sekundarno), `bg-surface-light`. Font: Plus Jakarta Sans (`font-display`).
   Pravila: spoljne kartice 32px radius (`rounded-[2rem]`), unutrašnje 16px,
   dugmad/bedževi/selecti pill, JEDNA tamna kartica po ekranu, hatch šara =
   nedostupno/blokirano. `.admin-scope` CSS u globals.css automatski stilizuje
   shadcn komponente u adminu.
2. **Brend salona** (javni sajt + booking): svaki salon bira boju (auto kontrast
   + korekcija za tamnu podlogu u [src/lib/color.ts](src/lib/color.ts)), font par
   (5 kuriranih u [src/lib/fonts.ts](src/lib/fonts.ts)), svetlu/tamnu varijantu
   i dizajn dugmadi (`theme.button_style`: rounded/pill/square — CSS pravila u
   globals.css preko `data-button-style` atributa na wrapperu u [slug]/layout).
   Primena u [src/app/[slug]/layout.tsx](src/app/[slug]/layout.tsx) preko CSS
   varijabli (`--primary`, `--app-font-*`) i `.dark` klase. Boja brenda se
   na POZADINSKIM površinama renderuje kao suptilan gradijent iste nijanse
   (`brandGradient` u color.ts, ±7-8% svetline, 135°; pravilo
   `[data-button-style] .bg-primary` u globals.css) — tekst/ivice ostaju
   solid, kontrast teksta se računa prema najsvetlijem stopu; swatch-evi u
   podešavanjima prikazuju isti gradijent.
   **NIKAD ne gurati mint/lavandu u šablone salona.**

## 6. Šta je implementirano (po commitima)

Vidi `git log --oneline`. Ukratko, sve navedeno je urađeno i verifikovano uživo:

- **Javni deo**: landing sa WOW hero animacijom (telefon u kome se booking sam
  odigrava u petlji — [src/components/landing/hero-demo.tsx](src/components/landing/hero-demo.tsx))
  + cenovnik sekcija; mini-sajt salona (hero, cenovnik, tim, galerija, kontakt,
  scroll animacije — [src/components/animate.tsx](src/components/animate.tsx));
  booking čarobnjak sa koracima, trakom 14 dana, animacijama i ICS "Dodaj u kalendar".
- **Admin** (`/admin/*`): responzivan — ispod `lg` sidebar zamenjuje tamna
  traka sa hamburgerom i drawer ([admin/mobile-header.tsx](src/app/admin/mobile-header.tsx));
  tabele/gridovi imaju horizontalni scroll. **Objava sajta** je stalna
  kontrola u layoutu ([admin/publish-control.tsx](src/app/admin/publish-control.tsx)):
  neobjavljen = mint "Objavi sajt" dugme (sidebar + mobilna traka),
  objavljen = "● Sajt je online"; zvaničan dijalog sa adresom, kopiranjem
  linka i tihim "Skloni sajt sa mreže" uz potvrdu (switch iz Podešavanja
  uklonjen 5.7). Početna (dashboard statistika), Kalendar (dnevni grid
  po zaposlenima, ručno zakazivanje za telefonske klijente, blokade), Rezervacije
  (statusi), Usluge (CRUD), Zaposleni (CRUD + po zaposlenom: fotografija/upload,
  usluge checkbox, radno vreme po danu, šabloni smena), Smene (nedeljni grid
  dodele), Galerija (multi-upload), Podešavanja (sadržaj + Izgled: boja/font/
  varijanta/logo/hero slika + live preview sajta u telefon okviru).
- **Auth/onboarding**: registracija → onboarding (naziv + slug) → admin.
  Jedan vlasnik = jedan salon (za sada).
- **Zaštita gost-bookinga (5.7.)**: honeypot polje u wizardu, limit 3 aktivne
  rezervacije po telefonu, limit 5 rezervacija/sat po IP-u (koristi
  `bookings.created_ip`, migracija 000003), server-side horizont 60 dana
  (`MAX_DAYS_AHEAD` u booking akcijama). Salon dobija email na
  `site_settings.email` o svakoj novoj i otkazanoj online rezervaciji
  (`sendOwnerBookingNotice` u lib/email.ts). U /privatnost dodati napomenu
  o čuvanju IP adrese (checklist).
- **Email potvrde (Resend)**: posle uspešnog gost-bookinga sa emailom šalje se
  potvrda ([src/lib/email.ts](src/lib/email.ts) — HTML šablon na srpskom,
  .ics prilog, link za otkazivanje; bez `RESEND_API_KEY` slanje se preskače i
  booking nikad ne pada zbog mejla). Stranica za otkazivanje iz mejla:
  `/{slug}/otkazivanje/{cancel_token}` (tema salona; stanja: aktivan termin sa
  dugmetom, već otkazan, prošao, nevažeći link; koristi postojeću `cancelBooking`
  akciju). Wizard na kraju kaže da je potvrda poslata (`emailSent` u rezultatu
  `createBooking`). Base URL za link: `NEXT_PUBLIC_APP_URL` ili request headers.
- **Pre-launch paket**: pravne strane `/privatnost` i `/uslovi` (zajednički
  okvir [src/components/legal-page.tsx](src/components/legal-page.tsx), podaci
  firme se vuku iz `ISSUER` u lib/invoice.ts; linkovi u footeru landinga),
  `robots.ts` (blokira /admin, /superadmin, /faktura/, /onboarding),
  `generateMetadata` po salonu u `[slug]/layout.tsx` (naslov/opis salona
  umesto Terminerovog).
- **Billing**: 30 dana probe → grace 7 dana → pauza SAMO online zakazivanja
  (sajt nikad ne gasimo). Baner u adminu. `/superadmin` (samo SUPER_ADMIN_EMAIL):
  lista salona + produženje +1/+3/+12 meseci. Logika u
  [src/lib/billing.ts](src/lib/billing.ts), enforcement u booking akcijama.

## 7. Naplata — poslovni model

- **Faktura + IPS QR + prenos na račun** (Stripe NE radi za srpske firme; MoR
  poput Paddle tek kod skaliranja van Srbije). Mihajlo ručno produžava na /superadmin.
- Cenovnik: **1.990 RSD/mes**, **19.900 RSD/god** (2 meseca gratis), founder
  cena 1.490 RSD/mes za prvih ~10 salona (usmeno, nije u kodu).
- **Fakture su samoposlužne, izdavalac je Čvorište** (Mihajlova firma; podaci
  hardkodovani u [src/lib/invoice.ts](src/lib/invoice.ts): PIB 114833116,
  Erste račun 340-0001000228996-85). Tok (redizajn 4.7): plaćanje ide kroz
  **PaymentModal** ([admin/payment-modal.tsx](src/app/admin/payment-modal.tsx))
  - veliki IPS QR + iznos + period + uputstvo; otvara se iz banera pri vrhu
  admina (CTA "Plati članarinu", [admin/subscription-banner.tsx](src/app/admin/subscription-banner.tsx))
  i sa nove stranice **/admin/pretplata** (status, "Produži članarinu" i za
  aktivne - period se lančano nastavlja, podaci za fakturu, istorija uplata).
  Podešavanja su sada čisto izgled/sadržaj (BillingCard obrisan). Modal zove
  `preparePayment(plan)` → postojeći `createInvoice` (globalna numeracija
  broj/godina, idempotentna po tenant+plan+period_from) → printabilna A4
  strana `/faktura/[id]` sa **NBS IPS QR** kodom (paket `qrcode`; payload
  format u lib/invoice.ts, poziv na broj = 00 + godina + redni broj).
  Pristup fakturi: član salona (RLS) ili superadmin. Admin baner vodi na
  Podešavanja#pretplata; superadmin lista sve izdate fakture po salonu.
  Period fakture kreće od danas ili od dana posle postojećeg paid_until.
- **Faktura je izvor istine o naplati**: status issued/paid/cancelled +
  paid_at. Superadmin "Označi plaćeno" → automatski paid_until =
  max(postojeći, period_to fakture). "Storno" samo za neplaćene (reuse u
  createInvoice ignoriše stornirane). Superadmin još ima: statistiku
  (aktivni/proba/naplaćeno u godini/fakture na čekanju), email vlasnika po
  salonu, "Proba +14d", gratis +1/+3/+12 mes i ručni "Datum…" za korekcije.
  Salon u BillingCard vidi status svake fakture (Na čekanju/Plaćena/Stornirana).
- **Superadmin kontrola naloga** (4.7, tri nivoa — akcije u
  [superadmin/account-actions.ts](src/app/superadmin/account-actions.ts), UI u
  account-controls.tsx): suspenzija (skida sajt + blokira objavu + baner
  vlasniku; ukidanje NE vraća objavu automatski), trajno brisanje (potvrda
  slugom; storage + kaskada + auth nalog vlasnika ako ne vodi drugi salon),
  reset lozinke / ponovna potvrda (superadmin NIKAD ne postavlja lozinku),
  promena email adrese vlasnika (uz proveru identiteta telefonom), prenos
  vlasništva (na postojeći potvrđen nalog bez salona), izvoz svih podataka
  tenanta (JSON download), impersonacija "Uđi kao vlasnik" (magiclink +
  verifyOtp = zamena sesije uz upozorenje; povratak = odjava/prijava).
  SVE akcije (i postojeće za naplatu) pišu u `superadmin_audit_log`;
  poslednjih 30 se vidi na dnu panela. Migracija primenjena 4.7;
  VERIFIKOVANO UŽIVO: suspenzija (javni 404 + booking blok + baner vlasniku
  + bedž), ukidanje (sajt ostaje neobjavljen dok ga vlasnik ne objavi),
  kolonske privilegije (42501 na paid_until/suspended_at, billing_note
  prolazi), izvoz, audit log, impersonacija (upozorenje → zamena sesije →
  /admin). Namerno NEtestirani na živim podacima: brisanje, promena mejla,
  prenos vlasništva (destruktivni; validacije na mestu). U uslove
  korišćenja dodati odredbu o impersonaciji uz saglasnost (checklist).

## 8. Poznati gotchas

- **Vercel region funkcija MORA biti fra1** (isti kao Supabase, Frankfurt) —
  podešavanje je bilo iad1 (default; izvršavalo se u dub1), pa je svaki
  upit plaćao međuregionalni put. Postavljeno na fra1 kroz Vercel API 6.7.
  i AKTIVNO (region važi tek od sledećeg deploya posle promene!). Provera:
  `curl -sI https://terminer.rs/demo | grep x-vercel-id` →
  `fra1::fra1::...` je dobro.
- **Brzina admin navigacije**: `admin/loading.tsx` daje trenutni skeleton
  po kliku; `getAdminContext` koristi `getClaims()` (lokalna JWT verifikacija,
  ES256) umesto drugog `getUser()` round-tripa i JEDAN spojeni upit
  (`tenant_members` + embed `tenants(*)` service-rolom). Ne vraćati
  getUser/odvojene upite bez razloga.

- **Turbopack keš**: promene u `globals.css` @theme tokenima ponekad ne stignu
  do browsera → `rm -rf .next` + restart dev servera.
- `supabase db push` je interaktivan (DB lozinka) — može ga pokrenuti samo
  Mihajlo; AI treba da pripremi migraciju i zamoli ga.
- Zod `.uuid()` odbija ne-RFC UUID-jeve (seed koristi `000...0101`) — koristi se
  permisivni regex (`uuidSchema` u booking actions).
- Novi shadcn `init` ume da upiše cirkularni `--font-sans: var(--font-sans)` —
  već popravljeno, ali paziti kod dodavanja komponenti.
- `create-next-app` odbija velika slova u imenu foldera (Terminer) — scaffold
  rađen kroz temp folder.
- Preview/dev: booking wizard koristi datum browsera za "Danas/Sutra" traku;
  server računa u zoni salona.

## 9. Radni dogovori sa Mihajlom

- Komunikacija i UI na **srpskom**; commit poruke na srpskom.
- Posle svake celine: **verifikacija uživo kroz preview** (klik kroz flow,
  screenshot za vizuelne izmene) → `npm run build` → commit. Test podatke
  počistiti iz baze posle verifikacije.
- On donosi odluke o obimu; AI predlaže sa preporukom pa on kaže "kreni".
- AI memorija (van repoa) postoji u `~/.claude/projects/...Terminer/memory/`.

## 10. Šta je SLEDEĆE (dogovoren put do launcha)

0. ~~Deploy + domen~~ **GOTOVO 3.7.2026**: repo na github.com/Gareebops/terminer
   (svaki push na main = auto deploy), Vercel projekat "terminer"
   (`terminer-psi.vercel.app`), domen **terminer.rs** aktivan sa SSL-om.
   Smoke test prošao na produkciji (rute, RLS 404 za neobjavljene, admin
   redirect, pravi booking kroz wizard — obrisan posle provere). Env na
   Vercelu: 4 osnovne varijable; SUPER_ADMIN_EMAIL tamo NEMA test-admin.
   Čeka još: `NEXT_PUBLIC_APP_URL` env + Supabase Site URL (Mihajlo, u toku;
   odluka apex vs www kao primarni domen).
1. **Resend** — Mihajlo: nalog, verifikacija domena (DNS), `RESEND_API_KEY` u
   env (placeholder u `.env.local`), pa `EMAIL_FROM=potvrda@terminer.rs`.
   Kod je gotov; test uživo: booking sa emailom → potvrda → link otkazuje.
2. **Custom domeni salona** — GOTOVO, verifikovano end-to-end 6.7. lokalno
   (povezivanje kroz karticu → Vercel API → proxy rewrite + 308 dedupe →
   status/DNS uputstvo → uklanjanje sa obe strane). Migracija
   `20260705000005` primenjena; `VERCEL_TOKEN` + `VERCEL_PROJECT_ID` u
   .env.local. ZA PRODUKCIJU još: iste 2 env varijable na Vercel projekat
   + git push (deploy novog proxy-ja) — bez toga akcije uredno javljaju
   da funkcija nije aktivirana. Arhitektura: kartica "Domen"
   u Podešavanjima ([podesavanja/domain-card.tsx](src/app/admin/podesavanja/domain-card.tsx))
   → server akcije ([admin/domain-actions.ts](src/app/admin/domain-actions.ts):
   Vercel Domains API add/remove/status + upis u `tenants.custom_domain`
   service-rolom, samo owner/admin) → proxy rezolucija hosta
   ([src/proxy.ts](src/proxy.ts): custom host → slug uz 60s keš po instanci,
   rewrite na /{slug}/..., a putanje koje već sadrže slug se 308-uju na
   čistu putanju). Domen radi tek kad je sajt objavljen (RLS). DNS
   uputstvo u kartici: apex → A 76.76.21.21, poddomen → CNAME
   cname.vercel-dns.com, TXT za verifikaciju kad Vercel traži.
3. **Prvi pravi salon** (Mihajlov frizer, founder cena) → pa šire.
4. Kasnije (Faza B/C dizajna): "vibe" preseti (font+boja+varijanta u 1 klik),
   hero layout varijante, redosled sekcija drag&drop, kompresija slika pre
   uploada (WebP), blur placeholderi, video hero, recenzije, SMS/Viber podsetnici,
   statistika++.

### Pre-launch checklist (uraditi UZ deploy, pre prvog klijenta)

- [ ] Obrisati test podatke iz baze: `test-admin@terminer.dev` (Supabase Auth +
      `tenant_members`), test fakture br. 1 i 3 iz 2026, test rezervacije.
      Odluka za Mihajla: da li salon `demo` ostaje kao javni showcase (onda mu
      prebaciti vlasništvo na Mihajlov nalog) ili se briše ceo tenant.
- [x] Supabase Auth: email potvrda naloga uključena (4.7).
- [ ] Supabase Auth mejlovi da idu preko Resend SMTP-a sa terminer.rs adrese
      i našim šablonima na srpskom ([supabase/templates/](supabase/templates/)
      — Mihajlo lepi u Dashboard → Authentication: SMTP Settings + Email
      Templates; uputstvo dobio 4.7).
- [ ] `CONTACT_EMAIL` u [src/components/legal-page.tsx](src/components/legal-page.tsx)
      prebaciti sa gmail-a na kontakt@terminer.rs kad domen legne.
- [ ] Pravne strane pregledati očima vlasnika: `/privatnost` i `/uslovi`
      (nacrt pisao AI 3.7.2026 — proveriti PIB/MB i formulacije).
- [ ] OG slika za deljenje linka (dizajnerski zadatak, može i posle launcha).

## 11. Kako da nastaviš (uputstvo za AI)

1. Pročitaj ovaj fajl + `git log --oneline -15` + eventualno README.md.
2. Pokreni dev server (`.claude/launch.json` ima konfiguraciju `terminer-dev`).
3. Za admin testiranje uloguj se kao test-admin (kredencijali gore).
4. Drži se arhitektonskih odluka iz sekcije 3 i dizajn podele iz sekcije 5.
5. Za izmene baze: napravi migracioni fajl pa traži od Mihajla `supabase db push`.
6. Verifikuj → build → commit (poruka na srpskom, Co-Authored-By Claude) →
   ažuriraj ovaj fajl ako se stanje bitno promenilo.
