-- Vodič za pokretanje (onboarding posle registracije).
--
-- Čuva se SAMO sitno UI stanje (welcome_seen, guide_hidden) - koraci vodiča
-- se ne čuvaju nigde jer se izvode iz stvarnih podataka (broj usluga, broj
-- zaposlenih, dirnut izgled, is_published). Kolona je na site_settings jer
-- vlasnik tamo već ima pravo upisa; javno čitanje ovih flagova je bezopasno.
alter table public.site_settings
  add column onboarding jsonb not null default '{}'::jsonb;
