-- Eksplicitni GRANT-ovi za Data API role (anon, authenticated, service_role).
--
-- Supabase 30.10.2026. trajno gasi auto-expose: objekat u public šemi bez
-- eksplicitnog GRANT-a nije dostupan kroz Data API (PostgREST) — ni za
-- service_role. Produkcijski projekat (kreiran 1.7.2026.) se do sada oslanjao
-- na grantove koje je auto-expose delio pri kreiranju objekata; ova migracija
-- fiksira KOMPLETNU matricu privilegija da ništa ne zavisi od implicitnog
-- ponašanja. RLS ostaje brana po REDOVIMA; grantovi su brana po TABELAMA i
-- KOLONAMA (bez granta upit pada sa 42501 umesto da vrati prazan rezultat).
--
-- Matrica (kodifikovana i u tests/integration/rls.test.ts):
--   service_role  — ALL na svemu: server akcije (lib/booking/actions.ts,
--                   admin/actions.ts, onboarding, superadmin), audit log,
--                   sitemap/OG/otkazivanje, testni setup.
--   authenticated — CRUD na tenant tabelama (admin zona kroz sesijski
--                   klijent; RLS sužava na članstvo); invoices samo select
--                   (izdavanje ide service-rolom zbog globalne numeracije);
--                   tenants isključivo kolonski (vidi dole).
--   anon          — select SAMO na javnim tabelama koje čita keširana javna
--                   varijanta sajta (loadTenantSite u lib/tenant.ts) i proxy
--                   (custom domen → slug); lični podaci ni select.

-- Bez USAGE na šemi nijedan grant na tabelama ne znači ništa.
grant usage on schema public to anon, authenticated, service_role;

-- Čist start za javne role: skini sve što je auto-expose podelio, pa dodeli
-- tačno ono što aplikaciji treba. Ovim padaju i kolonski grantovi na tenants
-- iz 20260704000001/20260705000002/20260705000005 — ponovo se dodeljuju
-- IDENTIČNI odmah ispod, u istoj transakciji, pa ništa ne ostaje pregaženo.
revoke all on all tables in schema public from anon, authenticated;

-- service_role: server strana dira sve (uključujući superadmin_audit_log
-- koji je RLS-om bez policy zatvoren za ostale role).
grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

-- authenticated: admin zona kroz sesijski klijent (RLS ograničava redove na
-- članstvo u salonu; owner/admin politike važe za pisanje).
grant select, insert, update, delete on
  public.tenant_members,
  public.site_settings,
  public.services,
  public.staff,
  public.staff_services,
  public.working_hours,
  public.shift_assignments,
  public.customers,
  public.bookings,
  public.blocked_slots,
  public.gallery
to authenticated;

-- Fakture: član salona samo čita svoje (RLS select policy); kreiranje,
-- storno i naplata idu isključivo service-rolom.
grant select on public.invoices to authenticated;

-- tenants: kolonske privilegije, identične stanju posle migracija
-- 20260704000001 + 20260705000002 + 20260705000005. SELECT kolone su javni
-- profil salona (TENANT_PUBLIC_COLUMNS u lib/tenant.ts) + custom_domain za
-- proxy rezoluciju hosta; billing/suspenzija razlozi ne cure kroz REST.
grant select (id, slug, name, timezone, is_published, suspended_at, created_at, custom_domain)
  on table public.tenants to anon, authenticated;
-- UPDATE/INSERT kolone kao u 20260704000001: paid_until, trial_ends_at,
-- suspended_* i custom_domain menja isključivo service_role.
grant update (name, is_published, billing_note) on table public.tenants to authenticated;
grant insert (name, slug) on table public.tenants to authenticated;

-- anon: tačno tabele koje loadTenantSite čita anon klijentom za javni sajt.
grant select on
  public.site_settings,
  public.services,
  public.staff,
  public.staff_services,
  public.gallery
to anon;
-- NAMERNO bez ijednog granta za anon: bookings, customers, blocked_slots
-- (lični podaci — anon dobija 42501, ne prazan odgovor), tenant_members,
-- working_hours, shift_assignments (raspored čita samo član; slotove računa
-- server service-rolom), invoices, superadmin_audit_log.

-- RLS politike se izvršavaju u kontekstu pozivaoca, pa role moraju imati
-- EXECUTE na helper funkcijama ("Javno čitanje objavljenih salona" na
-- tenants zove is_member i za anon posetioce).
grant execute on function public.is_member(uuid) to anon, authenticated;
grant execute on function public.has_tenant_role(uuid, public.member_role[]) to anon, authenticated;

-- Budući objekti: migracije se izvršavaju kao postgres, pa default
-- privilegije vezujemo za tu rolu. service_role dobija sve automatski;
-- anon/authenticated NAMERNO ništa — svaka nova tabela mora da dobije
-- eksplicitan grant u sopstvenoj migraciji (novi Supabase model).
alter default privileges for role postgres in schema public
  grant all on tables to service_role;
alter default privileges for role postgres in schema public
  grant usage, select on sequences to service_role;
alter default privileges for role postgres in schema public
  grant execute on functions to service_role;
