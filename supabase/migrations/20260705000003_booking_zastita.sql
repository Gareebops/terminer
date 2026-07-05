-- Anti-spam zaštita gost-bookinga: IP adresa sa koje je rezervacija
-- napravljena. Upisuje je isključivo server akcija (service role) i
-- koristi se samo za rate limit (max N rezervacija po IP-u na sat po
-- salonu). RLS za članove je ne izlaže ničim novim - kolona je vidljiva
-- samo članovima salona kao i ostatak reda.
--
-- NAPOMENA (checklist): pomenuti čuvanje IP adrese u /privatnost.
alter table public.bookings add column created_ip inet;

create index bookings_ip_rate_idx
  on public.bookings (tenant_id, created_ip, created_at)
  where created_ip is not null;
