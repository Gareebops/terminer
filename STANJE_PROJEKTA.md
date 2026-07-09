# Terminer — stanje projekta (handoff za AI/developera)

> Poslednje ažuriranje: 8. jul 2026. Ovaj dokument je izvor istine o tome šta je
> urađeno, kako je urađeno i šta je sledeće. Pre bilo kakvog rada pročitaj ga ceo,
> pa proveri `git log --oneline` za eventualne novije izmene.

**⚠️ ROK 30.10.2026 — EKSPLICITNI GRANT-OVI (produkcija inače STAJE):**
Supabase tog datuma trajno ukida auto-expose ponašanje (tabele bez
eksplicitnog GRANT-a nedostupne kroz Data API, ČAK I ZA service_role).
Produkcija se danas oslanja na auto-expose (jedino tenants ima eksplicitne
kolonske grantove iz migracije javno_citanje); lokalni CI stack koristi
privremeni flag `auto_expose_new_tables = true` u supabase/config.toml
koji CLI istog datuma uklanja. PRE ROKA: migracija sa eksplicitnim
GRANT-ovima za anon/authenticated/service_role (matrica: service_role sve;
authenticated tenant tabele kroz RLS; anon samo select na javnim tabelama
- pazi da ne pregazi kolonske grantove tenants-a), `supabase db push` na
produkciju, ukloniti flag iz config.toml - integracioni testovi u
tests/integration tačno pokrivaju ovu matricu pa čuvaju ispravnost.
Otkriveno 9.7. pri podizanju CI-ja (novi CLI već primenjuje novi default).

**Novo od 9.7 (4) — ONBOARDING E2E + ANTI-SPAM GRANICA (CI zelen):**
[onboarding.spec.ts](tests/e2e/onboarding.spec.ts): ceo funnel novog
salona - registracija → "Proveri sanduče" → potvrdni link iz LOKALNOG
mail hvatača (fixtures `nadjiPotvrdniLink`: Mailpit API pa Inbucket
fallback, port 54324) → PKCE razmena kroz /auth/callback (ista putanja
kao Google auth!) → /onboarding → salon kreiran → welcome ekran
("Dobro došli u Terminer" + "Krenimo") → dashboard; test se sam čisti
(jedinstven email/slug po pokušaju + brisanje). [antispam.spec.ts](tests/e2e/antispam.spec.ts):
3 aktivne rezervacije istim telefonom (service role, 06-07:30 van grida)
→ četvrta kroz wizard odbijena porukom o limitu. E2E sada 9 testova.
CONFIG PARITET: [supabase/config.toml](supabase/config.toml) sada ima
enable_confirmations=true (kao produkcija - lokalni dev registracija
TRAŽI potvrdu mejla; hvatač na http://127.0.0.1:54324), site_url
localhost:3000 (PKCE kolačić je per-origin), redirect glob allowlist,
email_sent=100. DVE E2E LEKCIJE: (a) Radix Dialog stavlja aria-hidden
na ostatak strane - getByRole "ne vidi" elemente ispod modala, asertuj
modal pa ga zatvori; (b) posle server akcije sačekaj toast PRE
navigacije, inače trka (kalendar flake ispravljen čekanjem
"Rezervacija je upisana."). Preostalo od plana: superadmin akcije,
raspored kroz UI, lint čišćenje pa lint u CI.

**Novo od 9.7 (3) — ADMIN E2E PAKET (CI zelen iz prvog run-a):**
[kalendar.spec.ts](tests/e2e/kalendar.spec.ts): ručni upis termina kroz
kalendar (?novo=1, Radix select-ovi kroz getByRole dialog/combobox/option)
+ duplikat odbijen porukom o preklapanju; blokada celog salona 12-13h →
slotovi 12:00/12:30 nestaju iz javnog wizarda na tačno tom danu
(DayStrip [data-date] selektor), 13:00 ostaje; otkazivanje kroz tabelu
Rezervacija (Izmeni → Otkazano → badge). E2E sada 7 testova. VAŽNO za
buduće E2E: playwright.config `workers: 1` (deljena baza → strogo redom);
datumi SE RAČUNAJU U ZONI SALONA kroz fixtures `sledeciRadniDan()` (CI je
UTC; preskače nedelju). Preostalo od test plana: onboarding E2E (mailpit),
anti-spam granice, superadmin akcije, raspored kroz UI, lint čišćenje.

**Novo od 9.7 (2) — DRUGI TALAS TESTOVA + DST BUG FIX:** (1) Integracioni
test IZOLACIJE SALONA [izolacija.test.ts](tests/integration/izolacija.test.ts):
ulogovani vlasnik salona A ne vidi/ne menja klijente, rezervacije, radno
vreme ni neobjavljeni tenant red salona B (authenticated RLS putanja -
dopuna anon testovima). (2) Unit: [timezone.test.ts](src/lib/booking/timezone.test.ts)
(DST prelazi 29.3/25.10, nepostojeće i dvosmisleno vreme, prelaz preko
ponoći), [invoice.test.ts](src/lib/invoice.test.ts) (tačan NBS IPS QR
payload, poziv na broj, 18-cifreni račun, sr format iznosa, godišnji <
12×mesečni), [ics.test.ts](src/lib/booking/ics.test.ts) (CRLF, floating
vreme, iCalendar escape, UID). Ukupno 75 unit + 14 integracionih + 4 E2E.
(3) NAĐEN I ISPRAVLJEN PRAVI BUG kroz nove testove: zonedToUtc je u noći
DST prelaza grešio SAT VREMENA (jednoprolazna procena pomaka padne sa
pogrešne strane skazaljke) → starts_at/ends_at termina 00-02h na dan
prelaska bili pogrešni; sada dvoprolazni algoritam (standard), nepostojeće
vreme se gura napred preko rupe. Preostalo za testiranje (prioritetom):
admin E2E paket (kalendar upis, blokada→wizard, statusi, raspored kroz UI,
objava), onboarding E2E (mailpit hvata mejlove lokalno), anti-spam granice,
superadmin akcije, lint čišćenje pa lint u CI.

**Novo od 9.7 — TESTOVI + CI (GitHub Actions, CI ZELEN od prvog dana):**
Do sada su postojali samo
unit testovi čiste logike koje ništa nije pokretalo automatski (Vercel
deployuje i kad testovi padaju!). Sada: (1) **CI workflow**
[.github/workflows/ci.yml](.github/workflows/ci.yml) na svaki push/PR -
job "testovi-i-build" (vitest + `next build` sa dummy env, bez tajni) i
job "e2e" (podigne LOKALNI Supabase kroz `supabase start` - migracije +
seed automatski, config.toml je u repou - pa integracioni + Playwright).
(2) **Billing unit testovi** [billing.test.ts](src/lib/billing.test.ts):
12 testova za subscriptionInfo/isBookingPaused (granice trial/grace/
expired, paid_until do kraja dana, proba poštovana posle istekle uplate).
(3) **Integracioni** (tests/integration/, `npm run test:integration`,
vitest.integration.config.ts): RLS izolacija (anonimac ne vidi bookings/
customers/neobjavljene salone/billing kolone; kontrolna da objavljen salon
JESTE vidljiv) + dupla rezervacija (dva paralelna inserta → tačno jedan
prođe, 23P01; otkazan termin oslobađa slot). (4) **E2E Playwright**
(tests/e2e/, `npm run test:e2e`, mobilni viewport - Pixel 7): gost kroz
wizard zakaže pa otkaže linkom; zauzet slot nestaje iz ponude; admin
prijava + dashboard; **keš regresija** - izmena cene u adminu ODMAH
vidljiva na javnom sajtu (čuva bustTenantSiteCache od 8.7). VAŽNO O
BEZBEDNOSTI: integracioni i E2E rade ISKLJUČIVO protiv lokalnog stacka -
guard u tests/e2e/global-setup.ts i tests/integration/okruzenje.ts odbija/
preskače sve što nije localhost (lokalno na Mihajlovom Macu nema Dockera
pa se preskaču; .env.local pokazuje na PRODUKCIJU i testovi to ne smeju da
diraju). E2E setup pravi nalog e2e-admin@terminer.test u lokalnoj bazi i
kači ga na seed "demo" salon. Usput nađena i ispravljena DVA stvarna
problema: (a) serviceSchema/staffSchema koristili strogi z.uuid() koji
odbija seed ID-jeve - izmena seed usluge padala sa "Neispravni podaci"
(sada permisivni uuidLoose, ista konvencija kao booking akcije i
moveSchema); (b) auto-expose rok gore. Pencil dugme u uslugama dobilo
title="Izmeni" (a11y + selektor za test). Lint NIJE u CI-ju - 15 zatečenih
grešaka (react-hooks/set-state-in-effect po klijentskim komponentama) čeka
posebno sređivanje; kad se očiste, dodati `npm run lint` korak u workflow.

**Novo od 8.7 (6) — PERFORMANSE: KEŠIRANJE JAVNIH PODATAKA + BATCH SLOTOVA
+ RATE LIMIT:** Javne stranice salona više ne diraju bazu na svaku posetu.
(1) [lib/tenant.ts](src/lib/tenant.ts): `getTenantSite` sada prvo čita
KEŠIRANU javnu varijantu (`unstable_cache`, anon klijent BEZ kolačića —
vidi isto što i neulogovan posetilac; tag `tenant-site:{slug}`, TTL 300s
kao zaštitna mreža) i pada nazad na sesijski klijent SAMO kad keš vrati
null a posetilac ima `sb-*` kolačiće (preview neobjavljenog salona za
vlasnika — ponašanje identično starom). `cookies()` se čita BEZUSLOVNO pre
keša: drži rutu dinamičkom (svež HTML) i ne sme u cache scope. Invalidacija:
`bustTenantSiteCache(slug)` (=`updateTag`, trenutna — vlasnik odmah vidi
izmenu; sme SAMO iz server akcija) pozvana iz SVIH akcija koje menjaju
javni sadržaj: usluge (upsert/delete/primeri/redosled), tim (upsert/delete/
usluge člana/fotka/horizont), galerija, izgled, podešavanja, objava
(admin/actions.ts); billing korekcije + suspenzija/brisanje (superadmin —
paid_until/trial žive na keširanom tenant redu → pauza zakazivanja);
createSalon (obara eventualni keširan "ne postoji"). (2) Booking kontekst
(tenant+usluga+tim po slugu) keširan istim tagom, TTL 60s, u
[lib/booking/actions.ts](src/lib/booking/actions.ts) — provere suspenzije/
pauze pretplate su SVESNO VAN keša (računaju se iz keširanih polja pri
svakom pozivu, isti redosled grešaka kao pre). Rezervacije/blokade/raspored
se NIKAD ne keširaju. (3) Slotovi: umesto 4 upita PO ČLANU (getWorkWindow+
getBusyRanges), `fetchDayData` vuče shift_assignments/working_hours/
bookings/blocked_slots za SVE kandidate u 4 upita (`.in("staff_id",...)`)
— "any" u salonu sa 5 ljudi pada sa ~24 na ~8 upita po izboru datuma;
`resolveWindow` ionako bira red po članu/danu/parnosti (computeOpenDays
je već radio ovako). (4) `getAvailableSlots` dobio in-memory rate limit
30/min po IP-u (po instanci, kao domainCache; createBooking već ima
limite u bazi) — poruka se prikazuje kroz postojeći slotsError u wizardu.
(5) [proxy.ts](src/proxy.ts): bez `sb-*` kolačića preskače se ceo Supabase
auth blok (getUser) — anonimni posetilac ne plaća ništa; /admin bez
kolačića i dalje ide na /prijava (redirect proveren). VERIFIKOVANO:
41/41 vitest, build čist, /demo renderuje kompletno kroz keš (toplo
~120ms), getAvailableSlots direktnim pozivom akcije vraća slotove za
"any" i za konkretnog člana, includeDays radi (nedelja closed), rate
limit blokira tačno od 31. poziva, nepoznat slug 404, /admin 307 →
/prijava. NIJE testirano uživo (nema kredencijala u sesiji): owner
preview neobjavljenog salona ulogovanim nalogom — logika je 1:1 stari
kod, ali baci pogled pri sledećoj prijavi. NAPOMENA za budući rad: novi
upiti/akcije koje menjaju tenants/site_settings/services/staff/
staff_services/gallery MORAJU zvati `bustTenantSiteCache(tenant.slug)`.

**Novo od 8.7 (5) — GOOGLE AUTH VERIFIKOVAN E2E + ISPRAVKA REDIRECTA:**
Mihajlo podesio Google Cloud OAuth klijent i uključio provider u Supabase.
Živi test kroz njegov Chrome: dugme → Google account chooser → consent →
localhost:3000/auth/callback → **/admin sa Studio Test salonom** ✓;
automatsko POVEZIVANJE identiteta potvrđeno (postojeći nalog sada ima
email + google identitet, bez duplikata). DVE STVARI NAĐENE U TESTU:
(1) redirectTo sa query parametrom (?next=/admin) NIJE prolazio Supabase
allowlist → pad na Site URL (produkciju!); ispravka: GoogleButton šalje
čist /auth/callback, a default `next` u callback ruti promenjen sa
/onboarding na /admin (pokriva i potvrdu mejla - korisnik bez salona se
sa /admin ionako preusmerava na /onboarding). (2) Redirect URLs allowlist
uopšte nije imala localhost - Mihajlo dodao `http://localhost:3000/**` i
`https://terminer.rs/**`; wildcard usput POPRAVLJA i reset lozinke
(?next=/nova-lozinka je do sada verovatno padao na landing na produkciji
- checklist stavka "proveriti reset-password šablon" je bila stvarna
rupa). JOŠ PROVERITI nekad: reset lozinke E2E na produkciji. POUKA:
Supabase allowlist matchuje CEO URL - query parametri traže wildcard.
GOOGLE BRANDING: 8.7. Mihajlo popunio OAuth consent Branding (App name
Terminer, logo 512px iz TerminerMark SVG-a, home/privatnost/uslovi,
authorized domain terminer.rs) i POSLAO NA BRAND VERIFIKACIJU - dok
Google ne odobri (tipično 2-5 radnih dana) consent ekran prikazuje
supabase domen; posle odobrenja "Sign in to Terminer" + logo. Prijava
radi sve vreme. KAD STIGNE ODOBRENJE: proveriti ekran uživo. Potpuno
uklanjanje supabase domena iz sitnog teksta = Supabase Custom Domain
(~$35/mes sa Pro planom) - svesno ODLOŽENO do prelaska na plaćeni plan;
tada: CNAME auth.terminer.rs, novi redirect URI u Google klijentu,
NEXT_PUBLIC_SUPABASE_URL na Vercelu/.env.local/mobile, redeploy.

**Novo od 8.7 (4) — GOOGLE PRIJAVA/REGISTRACIJA (kod gotov; podešavanje
provajdera opisano dole, URAĐENO 8.7):**
`GoogleButton` + `AuthDivider` u [components/google-button.tsx](src/components/google-button.tsx)
(zvanični G znak inline SVG, `signInWithOAuth({provider:"google"})` sa
`redirectTo: /auth/callback?next=/admin`); dugmad na /prijava ("Nastavi
sa Google nalogom") i /registracija ("Registruj se Google nalogom") ispod
"ili" separatora. Server strana NIJE dirana - OAuth koristi ISTU PKCE
razmenu koda kao potvrda mejla (`/auth/callback` → exchangeCodeForSession;
@supabase/ssr deli verifier kroz cookie). next=/admin pokriva oba
slučaja: postojeći vlasnik ulazi u admin, novi korisnik se sa /admin
preusmerava na /onboarding (nema članstvo). Google korisnici nemaju
telefon u metadata - polje se nigde u kodu ne konzumira, pa ništa ne puca;
Supabase automatski povezuje Google identitet sa postojećim nalogom istog
POTVRĐENOG mejla. VERIFIKOVANO: dugmad renderuju, klik gađa
`{supabase}/auth/v1/authorize?provider=google` koji uredno vraća 400
"provider is not enabled" dok se ne uključi. MIHAJLO za aktivaciju:
(1) Google Cloud Console → OAuth consent screen (External, ime Terminer,
domen terminer.rs, PUBLISH u production - u testing modu rade samo test
korisnici; za email/profile scope nema Google review-a) → Credentials →
OAuth Client ID (Web): Authorized redirect URI =
`https://hmsvyoyjlwkdhevsbavh.supabase.co/auth/v1/callback`;
(2) Supabase Dashboard → Authentication → Providers → Google → Enable +
Client ID/Secret; (3) proveriti da Redirect URLs sadrže
localhost:3000/auth/callback i terminer.rs/auth/callback (email potvrda
već koristi iste, pa najverovatnije jesu); (4) živi test: Google
registracija → /onboarding, Google prijava postojećim → /admin.

**Novo od 8.7 (3) — UNIVERZALIZACIJA UI-ja (verifikovano kroz svež nalog,
test podaci obrisani):** platforma se obraća SVIM vrstama salona, ne samo
frizerima. (1) Copy: meta opis (layout.tsx) nabraja frizerske/kozmetičke/
beauty salone, barbershope i masažne studije (namerno "frizerske" prvo -
SEO); landing feature "uslugu, osobu i termin"; cenovnik "Košta koliko
jedan termin mesečno"; hero podnaslov i registracija "salon ili studio";
FAQ bez "frizera" i "šišanja"; hero-demo korak "Kod koga" (ostaje
barbershop primer - konkretno > generično); vodič korak 2 "Šišanje,
manikir, masaža"; prazno stanje Usluga "od šišanja do masaže"; placeholder
napomene u kalendaru neutralan; opisi font para "Moderno" i tamne
varijante bez "barbershop". Reč "salon" OSTAJE krovni pojam proizvoda
(industrijski prihvaćena; menjana samo na ulaznim tačkama). (2) PRIMERI
USLUGA PO DELATNOSTI: `SAMPLE_SERVICE_SETS` u admin/actions.ts (frizerski
8 / barbershop 7 / kozmetika i nokti 8 / masaža i spa 6, realne cene);
`insertSampleServices(kind)` vraća i count; u praznom stanju Usluga
dugme "Ubaci primere za..." otvara dropdown delatnosti. Bez migracije -
ništa se ne čuva. VERIFIKOVANO kroz svež nalog (auth admin API →
onboarding → prazan cenovnik → set "Masaža i spa" → 6 usluga + toast);
nalog i tenant obrisani. SVESNO ODLOŽENO: `business_type` kolona (ima
smisla tek uz vibe presete po delatnosti iz faze B/C) i drugi demo salon
(marketing, ne kod). POUKA: Radix DropdownMenu se ne otvara na JS
.click() u preview-u - treba preview_click (pravi pointer eventi).

**Novo od 8.7 (2) — VELIKI UX PAKET (ceo izveštaj UX pregleda rešen; 5
commita, sve verifikovano kroz preview, bez migracija):** posle prolaska
kroz sve tokove urađeno redom:
(1) **Wizard**: korak "Kod koga" ima **"Svejedno mi je"** (staffId "any" —
server računa uniju slotova svih koji rade uslugu, pri upisu bira
NASUMIČNO među slobodnima, na 23P01 proba sledećeg kandidata; ime
dodeljenog vraća `createBooking.staffName`); **neradni dani prigušeni** u
traci dana (uz prvi upit slotova stiže `days` iz `computeOpenDays` —
pravilo+izuzeci, bez rezervacija; neradan preselektovan dan sam preskoči
na prvi radni); dugme sa **native date pickerom** za skok na datum;
"Danas" u traci = **datum salona** (`todayISO` prop iz zakazi/page);
ekran uspeha UVEK nudi **link za otkazivanje** (kopiranje; klijent bez
emaila ranije nije mogao da otkaže) + telefon salona. PAŽNJA: server
akcije se sa klijenta dispatchuju SEKVENCIJALNO (Next docs) — zato days
ide kroz `getAvailableSlots({includeDays})`, ne kroz posebnu akciju.
(2) **Slotovi**: `generateAvailableSlots` nudi i početke TAČNO NA KRAJU
zauzeća (20-min usluga u 12:00 → nudi se i 12:20, ne samo 12:30) — mrtvo
vreme nestalo; testovi prošireni (41 ukupno).
(3) **Otkazivanje** traži potvrdu ("Da, otkaži") umesto jednog klika.
(4) **Auth**: registracija hvata Supabase anti-enumeration odgovor za
postojeći potvrđen email (`data.user.identities.length === 0` → "Nalog
već postoji" umesto večnog "Proveri sanduče"); `PasswordInput`
(prikaži/sakrij) na prijavi/registraciji/novoj lozinki; onboarding kaže
da je adresa sajta trajna; odjava vodi na /prijava.
(5) **Kalendar**: klik na PRAZNO mesto u koloni otvara "Ručno
zakazivanje" sa tim zaposlenim i vremenom (snap 15 min; dijalog je sada
kontrolisan, remount kroz nonce); `DateJump` (native picker) u zaglavlju;
dijalog prikazuje zauzetost izabranog zaposlenog (`getStaffDayBusy`) i
ima polje Napomena; 23P01 na "Vrati na Potvrđeno" daje jasnu poruku.
(6) **Rezervacije**: pretraga kroz URL (?q=) i BAZU (ilike ime +
normalizovan telefon, PostgREST or() sa sanitizovanim vrednostima) — 
nalazi i istoriju stariju od 200; polje ostaje vidljivo kad nema
rezultata (debounce 350ms + useTransition spinner).
(7) **Raspored**: prošli dani tekuće nedelje prigušeni/neklikabilni.
(8) **Zaposleni**: kartica "Ime i opis" (ime/bio/aktivan) na detalju;
upsertStaff revalidira i javni sajt.
(9) **Fakture**: markInvoicePaid auto-stornira ostale neplaćene fakture
ISTOG perioda (duplikati od menjanja plana u modalu; ide u audit log);
istorija vlasniku krije pregažene duplikate (samo najskorija izdata po
period_from), superadmin vidi sve.
(10) **Optimizacije**: moveRow = 2 update-a (swap) kad su sort_order
raznoliki; createBooking limiti telefon+IP paralelno, getWorkWindow
izuzetak+pravilo paralelno; normalizePhone hvata "381..." bez plusa;
mejl klijentu pri admin otkazivanju kroz `after()` iz next/server.
SVESNO ODLOŽENO: ISR/keširanje javnog sajta salona (nalaz 6.4 izveštaja)
— zahteva odvajanje anon čitanja od owner-preview toka (cookies forsira
dinamiku); prvo izmeriti na produkciji da li je uopšte usko grlo.

**Novo od 8.7 (1) — HORIZONT ZAKAZIVANJA PO ZAPOSLENOM (migracija primenjena
8.7, E2E VERIFIKOVAN: Đorđe na 3 → traka 3 dana, Marko default 60, vraćeno
na null; na produkciji od 8.7):** `staff.booking_horizon_days` (migracija
`20260707000001`). Semantika: horizont N = klijenti vide narednih N dana
RAČUNAJUĆI danas (poslednji dozvoljen datum = danas+N-1); null = default 60
(`DEFAULT_HORIZON_DAYS`), clamp 1-90 (`bookingHorizonDays` u
[schedule.ts](src/lib/booking/schedule.ts), unit testovi). Sprovođenje:
`computeSlots` u booking akcijama koristi per-staff granicu umesto stare
konstante MAX_DAYS_AHEAD=60 (obrisana); admin ručno zakazivanje NAMERNO ne
primenjuje horizont; postojeće rezervacije preživljavaju skraćenje. UI:
kartica "Zakazivanje unapred" na strani zaposlenog (select 3/7/14/30/60/90,
čuva odmah, `updateStaffHorizon` u admin/actions.ts sa whitelist proverom);
wizard `DayStrip` prima `count` = horizont izabrane osobe (default se
promenio: traka sada nudi 60 dana umesto starih hardkodovanih 14 — Mihajlova
odluka). VERIFIKOVANO kroz preview: traka 60 dana (Danas 8.7 → Sub 5.9),
kartica u adminu, graceful greška čuvanja pre migracije; POSLE push-a
proveriti E2E: Đorđe na 3 dana → traka 3 dana → vratiti na 60.

**Novo od 7.7 (4) — FAVICON SALONA ([slug]/icon.tsx, verifikovano):** logo
salona postaje favicon njegovog sajta čim je salon objavljen i ima logo.
Next konvencija `app/[slug]/icon.tsx` (dublji segment GAZI root icon.svg —
provereno u head-u: /demo ima samo salonski link, landing zadržava
Terminerov). Tri putanje: (1) objavljen + logo → 302 redirect na
`/_next/image?w=64` (NE sirovi bytes — demo logo je 3.6MB PNG, kroz
optimizator 535B; satori ionako ne ume WebP u koji lib/image.ts konvertuje
upload-e); (2) objavljen bez logoa → monogram prvog slova na boji brenda
(ImageResponse); (3) neobjavljen/suspendovan/nepostojeći → Terminer znak
(ista vidljivost kao getTenantSite, bez curenja podataka). PAZI:
ImageResponse default šalje `immutable, max-age=31536000` — eksplicitno
spušteno na max-age=300 + revalidate 300, da se favicon prevrne ubrzo posle
objave/promene logoa. Bez size/contentType exporta (format zavisi od putanje).

**Novo od 7.7 (3) — WIZARD WOW + QUICK FIX PAKET (analiza stvarnog stanja pa
ispravke; verifikovano kroz preview desktop+mobil, probni booking obrisan):**
Wizard: (1) živi rezime kao ČIPOVI (SummaryChip u booking-wizard.tsx) — usluga/
osoba/termin/CENA uskaču spring animacijom, cena vidljiva od 1. koraka;
(2) današnji dan PRESELEKTOVAN (useEffect, ne useState init — SSR/klijent
oko ponoći); (3) stagger ulazak slotova (key={date} ponavlja pri promeni
dana); (4) smerne tranzicije koraka (direction state + go() helper,
custom prop kroz AnimatePresence — napred zdesna, nazad sleva); (5) mobilni
sticky CTA na dnu ekrana, full-width, sa cenom na dugmetu ("Potvrdi termin
· 900 RSD"); (6) ekran uspeha = "ULAZNICA" (spring drop-in, perforacija sa
notch krugovima, detalji usluga/kod koga/termin/cena; ConfettiBurst OSTAJE
VAN motion wrappera — fixed pozicija bi se vezala za transform!);
(7) beli scrollbar trake dana sakriven (.scrollbar-none utility u globals).
Ostalo: focus-visible prsten `currentColor` u @layer base (prilagođava se
svakoj podlozi); [slug]/zakazi/loading.tsx skeleton (tema salona važi —
renderuje se unutar [slug]/layout-a); hero-demo datum dinamičan (sledeći
petak, suppressHydrationWarning); scroll cue chevron na hero sekciji sajta
salona (motion-safe:animate-bounce → #cenovnik); swipe u lightbox galeriji
(touch handleri, prag 48px da se ne meša sa tap-za-zatvaranje); labela
"Pil" → "Pilula" u Podešavanjima. Nalazi analize koji NISU rađeni (svesno):
email slanje blokira booking odgovor (~0.5s, prihvatljivo), [slug]/loading
ne pomaže (layout fetch blokira pre Suspense granice), animacija upisa u
admin kalendaru (server-render, nema "new" signala).

**Novo od 7.7 (2) — SIGURNOSNA MREŽA (unit testovi + Sentry, verifikovano):**
(1) Vitest uveden (`npm test`, config u [vitest.config.ts](vitest.config.ts)
sa `@` aliasom; testovi kolocirani `src/**/*.test.ts`, ne diraju bazu ni
browser). 35 testova za čistu logiku: [slots.test.ts](src/lib/booking/slots.test.ts)
(preklapanja, generisanje slotova, zauzeća, "danas" filter, step),
[schedule.test.ts](src/lib/booking/schedule.test.ts) (dayOfWeek/mondayOf/
addDaysISO, parnost A/B nedelja i pre sidra, resolveWindow: pravilo/izuzetak/
is_off/rotacija), [phone.test.ts](src/lib/phone.test.ts) (kanonski +381),
[plural.test.ts](src/lib/plural.test.ts) (21 dan / 11 dana). Pre commita
ubuduće: `npm test` uz build. (2) Sentry error monitoring (@sentry/nextjs),
POTPUNO GATED na `NEXT_PUBLIC_SENTRY_DSN` — bez env varijable je no-op i app
radi identično. Kačenje po Next 16 konvencijama:
[src/instrumentation.ts](src/instrumentation.ts) (server init +
`onRequestError = Sentry.captureRequestError` za render/akcije/route
handlere) i [src/instrumentation-client.ts](src/instrumentation-client.ts)
(browser init + `onRouterTransitionStart` breadcrumb); error.tsx i
global-error.tsx ručno zovu `Sentry.captureException` (boundary greške ne
stižu do window.onerror). Samo greške (tracesSampleRate 0, bez replaya) —
čuva besplatnu kvotu. NAMERNO bez `withSentryConfig` omotača (source-map
upload traži auth token i komplikuje Turbopack build) — server stack je
čitljiv i bez toga. MIHAJLO za aktivaciju: nalog na sentry.io (free) →
Next.js projekat → DSN u `NEXT_PUBLIC_SENTRY_DSN` na Vercelu (i .env.local);
primer u .env.example.

**Novo od 7.7 (1) — PRE-LAUNCH POLIRANJE (verifikovano kroz preview + build):**
(1) Brendirana 404 ([src/app/not-found.tsx](src/app/not-found.tsx)) — hvata
`notFound()` sa svih mesta (pogrešan slug, nevažeći link otkazivanja, tuđa
faktura...) i sve nepostojeće adrese; ranije je izlazio default engleski Next
ekran. (2) [error.tsx](src/app/error.tsx) + [global-error.tsx](src/app/global-error.tsx)
— "Nešto je pošlo naopako" + "Pokušaj ponovo" + šifra greške (digest, za
traženje u server logovima). PAZI: u ovom Next-u je prop `unstable_retry`, ne
`reset`; global-error je namerno bez globals.css/next-font (inline stilovi)
jer menja ceo root layout. (3) OG slike kroz next/og:
[src/lib/og.tsx](src/lib/og.tsx) (fontovi + Terminer kartica),
root `opengraph-image.tsx` (ink kartica, mint pill) i
`[slug]/opengraph-image.tsx` (gradijent boje brenda salona +
gradientForeground kontrast, ime salona, terminer.rs/{slug}; fallback =
Terminer kartica za nepostojeći/neobjavljen/suspendovan; revalidate 1h;
service-role upit BEZ cookies da slika sme u keš). GOTCHAS: satori traži TTF
— statični Plus Jakarta Sans u `src/assets/fonts/` (latin-ext glifovi
provereni skriptom), readFile putanje moraju biti literale zbog Vercel file
tracinga; satori NE podržava WebP pa logo salona namerno nije na kartici
(logoi su WebP posle lib/image.ts). (4) `metadataBase` + openGraph/twitter
defaults u root layoutu; [slug] generateMetadata dobio openGraph blok
(openGraph se ne nasleđuje po poljima — ceo objekat se zamenjuje).
(5) [sitemap.ts](src/app/sitemap.ts): landing + pravne + objavljeni
nesuspendovani saloni (+ /zakazi), revalidate 1h; robots.ts sada navodi
sitemap. U sitemap trenutno ulaze i objavljeni test saloni (studio-test,
ivona-studio, studio-ragazzi) — rešava se čišćenjem test podataka pre
launcha. (6) Vercel Web Analytics (`@vercel/analytics/next`, `<Analytics/>`
u root layoutu) — Mihajlo još treba da UKLJUČI Analytics na Vercel projektu
(Project → Analytics → Enable), bez toga skripta na produkciji vraća 404.
(7) "Kontakt" (mailto CONTACT_EMAIL) u footeru landinga — adresa se menja na
jednom mestu u legal-page.tsx.

**Novo od 6.7 (6) — MOBILNA APLIKACIJA (Faza 0 gotova, verifikovano kroz
preview):** nova Expo app (React Native, SDK 57, TypeScript) u `mobile/` —
admin za telefon, cilj Google Play + App Store, koegzistira sa webom (ista
Supabase baza i nalozi). ODLUKE: Expo + EAS Build (Capacitor odbačen — Apple
4.2 "minimum functionality" rizik; Flutter — nula reuse-a); čitanja idu
DIREKTNO na Supabase pod RLS-om, istim upitima kao web admin (`bookings` ima
denormalizovan `customer_name`, radi bez API-ja); pisanja sa poslovnom
logikom (konflikti, mejlovi, normalizacije) ići će kroz buduće `/api/mobile/*`
REST rute na Next.js sa Supabase JWT u Authorization headeru — logika se NE
duplira u appu. Faza 0 sadržaj: prijava (supabase-js + AsyncStorage sesija,
auth gate = `Stack.Protected` u [mobile/src/app/_layout.tsx](mobile/src/app/_layout.tsx)),
tabovi Početna/Kalendar/Rezervacije/Više; Početna = pozdrav po dobu dana +
tamna kartica (datum sr-Latn-RS, broj termina, srpska množina) + današnji
termini sa status bedževima ([mobile/src/lib/status.ts](mobile/src/lib/status.ts)
preslikan sa weba) + pull-to-refresh; Kalendar/Rezervacije = "uskoro" ekran
sa dugmetom ka web adminu; Više = salon/email/linkovi/odjava. DS tokeni u
[mobile/src/constants/theme.ts](mobile/src/constants/theme.ts) (canvas/ink/
mint/lavanda, Jakarta kroz @expo-google-fonts, radius 32/16/pill). Env:
`mobile/.env.local` (EXPO_PUBLIC_SUPABASE_URL/ANON_KEY — gitignorovan, vidi
.env.example). Pokretanje: `cd mobile && npx expo start` (Expo Go QR); web
provera kroz launch config `terminer-mobile-web` (port 8090). VERIFIKOVANO
kroz web preview: prijava test-adminom → Salon Aura + današnji termin
(privremeni booking service-rolom, obrisan), pogrešna lozinka → srpska
poruka, odjava → nazad na prijavu, konzola čista; native build JOŠ NIJE
rađen (čeka EAS + naloge). DALJE FAZE: F1 Kalendar + Rezervacije (promena
statusa kroz API rute); F2 upis termina/blokada + PUSH notifikacije
(expo-notifications, nova tabela `push_tokens` + slanje iz createBooking
kroz Expo Push API — glavni razlog appa); F3 store paket (ikonica, splash,
screenshots, EAS build, TestFlight/Play interno, submit). MIHAJLO pre F3
(kreni odmah, najduže traje): D-U-N-S broj za Čvorište → Apple Developer
$99/god (organizacija) + Google Play Console $25 (OBAVEZNO organizacioni
nalog — lični zahteva zatvoreni test 12 testera/14 dana) + Expo nalog.
Bundle ID `rs.terminer.app` već u app.json. Apple pre submita traži i
"brisanje naloga iz aplikacije" — dodati u Više.

**Novo od 6.7 (6) — TEKSTUALNI PAKET (analiza sadržine + ispravke):**
detaljna analiza svih korisničkih stringova pa ispravke. Gramatika:
"kod {ime}" (nominativ!) zamenjen sa "· {ime}" u wizardu/otkazivanju/mejlu
(imena se ne menjaju kroz padeže programski); centralni
[src/lib/plural.ts](src/lib/plural.ts) helper (1 dan / 21 dan / 11 dana...)
primenjen na dan/dana (baner+pretplata) i termin/termina (Početna) -
raniji `n===1?"dan":"dana"` je grešio za 21+; "Dobro došli u Terminer"
(rod); "Da i kod tebe ovako radi..." (rod uz ime salona); ćirilično 'е' u
opisu demo usluge Farbanje ispravljeno u bazi. Prikladnost: javni tok
zakazivanja više ne kaže "Frizer" (korak "Kod koga", greške "član tima" -
platforma služi i kozmetičkim/masažnim studijima; landing/FAQ zadržavaju
"frizera"); admin ujednačen na "Zaposleni" (bio i "Radnik"); mejl o
otkazivanju: "(ime)" umesto "kod ime" + "Izvinjavamo se zbog
neprijatnosti."; galerija: sekcija se zove „Izdvojeni radovi“ (pisalo
"Naši radovi"). Pravno (checklist stavke ZATVORENE): /privatnost sada
pominje čuvanje IP adrese pri rezervaciji; /uslovi dobili odredbu
"Pristup podrške nalogu" (impersonacija uz saglasnost) i ispravku naziva
sekcije Pretplata. Mihajlo NIJE hteo: crtice " - " → " — " i
"Nije došao" → "Nedolazak" (ostaje kako je). UZ TO: koreni tsconfig sada
exclude-uje mobile/ (Expo app ima svoj tsconfig; build je počeo da puca
na mobile aliasima).

**Novo od 6.7 (5) — DIZAJN/UX paketi (analiza + 3 paketa, verifikovano kroz
preview):** (1) Usaglašenost: datumi sa imenima dana/meseci na sr-Latn-RS
(sr-RS daje ćirilicu!); auth CTA dugmad mint pill + extrabold naslovi +
"30 dana besplatno" na registraciji; bogato prazno stanje Rezervacija;
kalendar opseg prati stvarna okna (sat pre/posle, ne fiksno 07-22);
brendirani sonner toastovi (globals, body:has selektor). (2) Admin wow:
crvena linija "sada" u Kalendaru (tick na minut + auto-scroll, samo danas);
avatari zaposlenih u zaglavljima kolona Kalendara i u Rasporedu; Početna:
pozdrav po dobu dana, mint traka "Sledeći termin za X min" (upit + relativna
labela), brze akcije (Upiši termin → /admin/kalendar?novo=1 otvara dijalog,
Blokiraj → ?blokada=1, Podeli sajt → [admin/share-site-button.tsx](src/app/admin/share-site-button.tsx)),
count-up animacija brojeva ([components/count-up.tsx](src/components/count-up.tsx)).
(3) Javni deo wow: wizard prikazuje fotke frizera, opise usluga i naziv
koraka na telefonu + konfete na uspehu (reuse ConfettiBurst); sajt salona
dobio plutajuće "Zakaži termin" na telefonu
([slug]/mobile-book-cta.tsx, footer pb-24 na mobilnom), bedž
Otvoreno/Zatvoreno uz radno vreme (računa se u getWeeklyHours) i lightbox
galeriju ([slug]/gallery-grid.tsx - tap/strelice/Escape, brojač).
UZ TO: (a) FAQ sekcija na landingu - accordion
([components/landing/faq.tsx](src/components/landing/faq.tsx), 8 pitanja u
[faq-items.ts](src/components/landing/faq-items.ts) - POUKA: podaci u
zasebnom modulu jer "use client" izvoz konstante u server komponentu daje
client-reference, ne niz) + FAQPage JSON-LD za Google; (b) redizajn
pregleda sajta u Podešavanjima
([podesavanja/phone-preview.tsx](src/app/admin/podesavanja/phone-preview.tsx)):
realističan telefon (bočna dugmad, odsjaj stakla, home indikator; dynamic
island uklonjen na Mihajlov zahtev), scrollbarovi unutar ekrana sakriveni
ubacivanjem stila u same-origin iframe pri onLoad (skrol radi), ambijentalni
blur sjaj u boji brenda salona (prati promenu boje posle čuvanja), fade-in
ekrana pri svakom osvežavanju + spinner "Učitavam sajt...", hover tilt
(motion-safe), "Uživo pregled" sa pulsirajućom mint tačkom.

**Novo od 6.7 (4) — VELIKI PAKET ISPRAVKI (bagovi + UX, verifikovano kroz
preview; bez migracija):** detaljna analiza cele app pa ispravke svega nađenog.
Bezbednost/podaci: (1) rezervisani slugovi u [src/lib/reserved-slugs.ts](src/lib/reserved-slugs.ts)
(deli ih proxy i onboarding - slug "admin"/"prijava" više ne može da se
registruje); (2) **telefon se normalizuje** u kanonski `+381...`
([src/lib/phone.ts](src/lib/phone.ts)) u gost i admin bookingu → nema
duplikata klijenata ni zaobilaženja limita razmacima; (3) customer upsert
više ne gazi email sa null; (4) cancelBooking (token) server-side odbija
prošle termine; (5) MIN_LEAD_MINUTES=30 buffer za današnje slotove.
Admin: adminCreateBooking brani termin preko ponoći (ranije neuhvaćen
izuzetak na "25:00"); updateBookingStatus revalidira i kalendar i početnu
i **šalje mejl klijentu kad salon otkaže** (sendCustomerCancelledNotice u
lib/email.ts); conflict-check rasporeda ignoriše već završene današnje
termine; createBlockedSlot vraća konflikte sa rezervacijama (isti
ScheduleConflictDialog + force); updateSettings validira email i
normalizuje instagram (URL → handle). Kalendar: "danas" u zoni salona
(nowInZone i u rezervacije/raspored stranicama), grid se širi van 07-22
prema podacima, completed/no_show prigušeni (ne nestaju), **klik na termin
= dijalog detalja** sa promenom statusa; dijalozi Nova rezervacija/Blokada
prate promenu dana (key={day}). Rezervacije: tabovi Predstojeće/Istorija +
pretraga po imenu/telefonu (normalizovano poređenje); labele statusa u
[src/lib/booking/status.ts](src/lib/booking/status.ts). Wizard: race guard
za slotove (zastareli odgovor se ignoriše), auto-skip koraka Frizer kad
uslugu radi jedan, izbor vremena auto-prelazi na Podatke, klik na pređeni
korak vraća nazad. Javni sajt: **sekcija Radno vreme** u Kontaktu
(unija okana aktivnog tima za tekuću nedelju, service-role u server
komponenti), instagram link podnosi i pun URL. Slike:
[src/lib/image.ts](src/lib/image.ts) - downscale + WebP pre uploada
(staff 800px, logo 512, hero 1920, galerija 1600), jasna poruka za
nedekodabilan HEIC; stari fajl se briše iz storage-a pri zameni
(removeStorageFile u admin/actions). Sitno: ConfirmDialog komponenta
([src/components/confirm-dialog.tsx](src/components/confirm-dialog.tsx))
umesto native confirm svuda; strelice za redosled usluga i galerije
(moveService/moveGalleryImage - PAZI: permisivni uuid regex zbog seed
ID-jeva); galerija kontrole vidljive na touch; srpska množina; "Očekivani
promet"; billing edge (proba važi i posle istekle uplate); addMonths klamp
na kraj meseca. Test podaci iz verifikacije obrisani (booking + customer).
UZ TO, dizajnersko usaglašavanje modala u adminu: Radix dijalozi/select/
dropdown se portaluju na <body> pa su ISKAKALI iz `.admin-scope` (Geist
font, sirovi shadcn izgled). Selektori u globals.css sada idu preko
`body:has(.admin-scope)` — modali dobijaju Jakarta font, ink boju, 2rem
radius (spoljna kartica), extrabold naslov, pill dugmad/stavke, 1rem
radius za padajuće menije. Iframe pregleda sajta netaknut (zaseban
dokument); sajt salona netaknut (nema .admin-scope).

**Novo od 6.7 (3) — VODIČ: korak za radno vreme/smene + zaštite (verifikovano
uživo end-to-end kroz svež nalog, test podaci obrisani):** vodič sada ima
**6 koraka** — korak 3 je samo "Dodaj tim", a novi korak 4 "Proveri radno
vreme i smene" adresira rupu gde se tim štiklirao a default pon–sub 09–20
niko nije video. Korak 4 se štiklira na DVA načina: automatski kad prođe
`updateStaffSchedule` (flag `schedule_confirmed` u `site_settings.onboarding`,
upis kroz helper `mergeOnboarding` u admin/actions.ts) ili ručno dugmetom
"Već je tačno" u vodiču (default može stvarno biti tačan pa automatska
provera ne postoji); CTA vodi pravo na jedinog zaposlenog ako je jedan.
Prateće izmene: (1) kreiranje zaposlenog sada REDIRECT-uje na njegovu
stranicu (upsertStaff vraća id) uz toast "proveri usluge i radno vreme";
(2) `setPublished` brani objavu praznog sajta — bez aktivnih usluga ili
aktivnog tima vraća `emptySite` pa dijalozi (publish-control i vodič) nude
"Dodaj usluge/tim" ili "Objavi svejedno" (force flag); (3) toast posle
ubacivanja primera usluga i posle čuvanja radnog vremena (dok je vodič
aktivan) nudi akciju "Sledeći korak/Nastavi vodič" nazad na Početnu;
(4) jednokratna kartica "Kako radi raspored" na /admin/raspored
([raspored/intro-card.tsx](src/app/admin/raspored/intro-card.tsx), flag
`raspored_seen`); (5) sakriven vodič se vraća linkom u Podešavanjima
([podesavanja/show-guide-link.tsx](src/app/admin/podesavanja/show-guide-link.tsx),
vidljiv samo dok sajt nije objavljen). Bez novih migracija — novi flagovi
idu u postojeći `onboarding` jsonb. POUKA iz verifikacije: preview browser
ume da nagomila zaostale tabove (6× "[HMR] connected") pa eval/screenshot
gađaju RAZLIČITE tabove i daju kontradiktorne nalaze — kad se to desi,
preview_stop + preview_start pa ispočetka.

**Novo od 6.7 (2) — VODIČ ZA POKRETANJE (onboarding tutorijal, verifikovano
uživo end-to-end kroz svež nalog):** posle registracije/onboardinga novog
korisnika na Početnoj dočeka (1) welcome dijalog sa umanjenim živim
HeroDemo telefonom (`HeroDemo compact` prop) i (2) kartica "Pokreni svoj
sajt" ([admin/onboarding-guide.tsx](src/app/admin/onboarding-guide.tsx)) —
5 koraka koji se SAMI štikliraju iz podataka: nalog / usluge>0 / aktivni
zaposleni>0 / dirnut izgled (heuristika: logo, hero slika, theme sa
ključevima — PAZI: `theme` ima default `'{}'` pa se proverava
`Object.keys().length`, telefon, adresa, ne-default boja) / is_published.
Korak 5 = "Pogledaj sajt" + objava sa SOPSTVENIM dijalogom i proslavom
(konfete [components/confetti.tsx](src/components/confetti.tsx) bez
zavisnosti + Viber/WhatsApp deljenje; ISTO dodato i u publish-control za
objavu iz sidebara). VAŽNA LEKCIJA: server akcija sa revalidatePath
osvežava tekuću rutu → komponenta vodiča mora ostati montirana i posle
objave (`published` prop krije samo karticu), inače proslava nestane usred
prikaza. Čuvaju se samo flagovi `site_settings.onboarding` jsonb
(welcome_seen, guide_hidden; migracija `20260706000002` primenjena 6.7),
sve ostalo se izvodi. Uz to: bogata prazna stanja (Usluge sa "Ubaci
primere (8 usluga)" — `insertSampleServices`, samo u prazan cenovnik;
Zaposleni; Galerija). Test nalog/salon obrisan posle verifikacije.

**Novo od 6.7 (1) — RASPORED (migracija primenjena, VERIFIKOVANO UŽIVO):**
kompletna prerada
radnog vremena i smena po modelu "pravilo + izuzeci" (Mihajlo tražio
intuitivnije rešenje). Pravilo po zaposlenom: "isto svake nedelje" ILI
"smene A/B" koje se same smenjuju (staff.schedule_mode + rotation_anchor =
ponedeljak A-nedelje; working_hours.week_parity 0/1, weekly čita samo 0).
Izuzetak po datumu: shift_assignments sada nosi SOPSTVENO vreme
(start_time/end_time) ili is_off — pojam "šablon smene" je UKINUT
(tabela shift_templates obrisana, vremena dodela prepisana u izuzetke).
Stranica /admin/smene → **/admin/raspored**: grid prikazuje IZRAČUNATA
vremena (boje: mint = smena A, lavanda = B, belo = fiksno, deblji okvir =
izuzetak, šrafura = ne radi), klik na ćeliju = dijalog izuzetka, dugme
"Odsustvo" upisuje opseg is_off dana (i za sve zaposlene). ZAŠTITA: svaka
izmena koja sužava dostupnost vraća listu rezervacija koje ispadaju iz
radnog vremena (ScheduleConflictDialog, "Sačuvaj svejedno" = force flag);
Kalendar šrafira vreme van radnog okna + "Ne radi" kolonu. Ključni fajlovi:
[src/lib/booking/schedule.ts](src/lib/booking/schedule.ts) (čista logika,
resolveWindow/parnost), akcije updateStaffSchedule/setScheduleException/
createAbsence u admin/actions.ts, migracija `20260706000001_raspored_
pravilo_izuzeci.sql`. Verifikovano uživo 6.7. kroz preview: grid +
izuzetak (custom vreme, vrati na uobičajeno), sukob sa rezervacijom
(izuzetak i odsustvo, force put), rotacija A/B end-to-end (staff strana →
grid ove/sledeće nedelje → javni booking nudi 14:00+ u B nedelji, 0
termina na is_off dan), kalendar šrafura + "Ne radi" kolona. Test podaci
očišćeni (rezervacija, klijent, izuzeci; Marko vraćen na weekly).
Izuzeci starih test salona (studio-test/ivona/ragazzi) migrirani sa
vremenima - namerno ostavljeni.

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
npm test               # unit testovi (vitest) — takođe pre commita
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

- `20260706000002_onboarding_vodic.sql` — primenjena 6.7.
  `site_settings.onboarding jsonb default '{}'` (welcome_seen,
  guide_hidden za vodič pokretanja).
- `20260706000001_raspored_pravilo_izuzeci.sql` — primenjena 6.7.
  staff.schedule_mode/rotation_anchor; working_hours.week_parity (unique
  postaje staff_id+dow+parity); shift_assignments.start_time/end_time +
  check (izuzetak nosi svoje vreme), drop shift_template_id; DROP TABLE
  shift_templates (podaci prepisani u izuzetke).

**Logika slobodnih termina** (server): okno = izuzetak za datum ILI pravilo
(working_hours uz A/B parnost — [src/lib/booking/schedule.ts](src/lib/booking/schedule.ts))
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
  po zaposlenima, ručno zakazivanje za telefonske klijente, blokade, šrafura
  van radnog okna), Rezervacije (statusi), Usluge (CRUD), Zaposleni (CRUD +
  po zaposlenom: fotografija/upload, usluge checkbox, radno vreme "isto svake
  nedelje" ili smene A/B), Raspored (nedeljni grid izračunatih vremena +
  izuzeci po datumu + odsustva), Galerija (multi-upload), Podešavanja
  (sadržaj + Izgled: boja/font/varijanta/logo/hero slika + live preview
  sajta u telefon okviru).
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
- [x] Supabase Auth mejlovi preko Resend SMTP-a sa srpskim šablonima —
      POTVRĐENO 7.7. živim testom: registracija šalje "Potvrdi svoj Terminer
      nalog" sa potvrda@terminer.rs (Mihajlo podesio ranije; checklist je
      kasnila za stvarnošću). Još proveriti: reset-password šablon i
      Auth rate limit za mejlove.
- [ ] `CONTACT_EMAIL` u [src/components/legal-page.tsx](src/components/legal-page.tsx)
      prebaciti sa gmail-a na kontakt@terminer.rs kad domen legne.
- [ ] Pravne strane pregledati očima vlasnika: `/privatnost` i `/uslovi`
      (nacrt pisao AI 3.7.2026 — proveriti PIB/MB i formulacije).
- [x] OG slika za deljenje linka — generisana kroz next/og 7.7 (Terminer
      kartica + kartica po salonu u boji brenda).
- [ ] Uključiti Web Analytics na Vercel projektu (Project → Analytics →
      Enable) — kod je na mestu od 7.7, bez ovoga se podaci ne skupljaju.
- [ ] Sentry (opciono ali preporučeno): nalog na sentry.io → Next.js
      projekat → `NEXT_PUBLIC_SENTRY_DSN` na Vercel + .env.local — kod je
      na mestu od 7.7, bez DSN-a je monitoring isključen.

## 11. Kako da nastaviš (uputstvo za AI)

1. Pročitaj ovaj fajl + `git log --oneline -15` + eventualno README.md.
2. Pokreni dev server (`.claude/launch.json` ima konfiguraciju `terminer-dev`).
3. Za admin testiranje uloguj se kao test-admin (kredencijali gore).
4. Drži se arhitektonskih odluka iz sekcije 3 i dizajn podele iz sekcije 5.
5. Za izmene baze: napravi migracioni fajl pa traži od Mihajla `supabase db push`.
6. Verifikuj → build → commit (poruka na srpskom, Co-Authored-By Claude) →
   ažuriraj ovaj fajl ako se stanje bitno promenilo.
