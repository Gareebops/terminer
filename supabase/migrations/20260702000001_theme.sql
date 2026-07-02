-- Tema sajta po salonu: font par, svetla/tamna varijanta, buduće opcije
-- (hero layout, redosled sekcija...) — sve u jednoj jsonb koloni.
alter table public.site_settings
  add column if not exists theme jsonb not null default '{}'::jsonb;
