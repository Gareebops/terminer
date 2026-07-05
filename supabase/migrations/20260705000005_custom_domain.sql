-- Custom domen salona (npr. mojsalon.rs umesto terminer.rs/mojsalon).
--
-- Kolonu upisuje ISKLJUČIVO server akcija (service role) posle povezivanja
-- domena na Vercel projekat - namerno NIJE u update privilegijama za
-- authenticated (kao ni billing kolone), da domen ne može da se upiše
-- REST-om mimo Vercel sinhronizacije.
--
-- Javno čitanje kolone treba proxy-ju: rezolucija hosta u slug pri svakom
-- zahtevu na custom domenu (RLS i dalje krije neobjavljene salone, pa
-- domen "proradi" tek kad se sajt objavi).
alter table public.tenants
  add column custom_domain text unique
  check (
    custom_domain ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$'
  );

grant select (custom_domain) on table public.tenants to anon, authenticated;
