-- Demo salon za lokalni razvoj (javni sajt radi bez naloga;
-- za admin pristup registruj se u aplikaciji pa se poveži preko onboardinga
-- ili ručno ubaci red u tenant_members).

insert into public.tenants (id, slug, name, is_published)
values ('00000000-0000-0000-0000-000000000001', 'demo', 'Salon Demo', true);

insert into public.site_settings (tenant_id, hero_title, hero_subtitle, phone, email, address, city, primary_color)
values (
  '00000000-0000-0000-0000-000000000001',
  'Salon Demo',
  'Frizerski salon u srcu grada — zakaži termin online za par klikova.',
  '+381 60 000 0000',
  'salon@demo.rs',
  'Obrenovićeva 10',
  'Niš',
  '#18181b'
);

insert into public.services (id, tenant_id, name, description, duration_minutes, price, sort_order) values
  ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000001', 'Muško šišanje', 'Šišanje mašinicom i makazama, stilizovanje', 30, 700, 1),
  ('00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000001', 'Šišanje + brada', 'Kompletno sređivanje kose i brade', 45, 1000, 2),
  ('00000000-0000-0000-0000-000000000103', '00000000-0000-0000-0000-000000000001', 'Fade', 'Precizan fade sa detaljima', 40, 900, 3);

insert into public.staff (id, tenant_id, name, bio, sort_order) values
  ('00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000001', 'Đorđe', 'Majstor za fade i klasične frizure', 1),
  ('00000000-0000-0000-0000-000000000202', '00000000-0000-0000-0000-000000000001', 'Marko', 'Specijalista za bradu', 2);

insert into public.staff_services (tenant_id, staff_id, service_id)
select '00000000-0000-0000-0000-000000000001', s.id, sv.id
from public.staff s cross join public.services sv
where s.tenant_id = '00000000-0000-0000-0000-000000000001'
  and sv.tenant_id = '00000000-0000-0000-0000-000000000001';

-- Radno vreme: pon–pet 09–20, sub 09–16, ned neradna
insert into public.working_hours (tenant_id, staff_id, day_of_week, start_time, end_time, is_working)
select '00000000-0000-0000-0000-000000000001', s.id, d.dow,
  '09:00'::time,
  case when d.dow = 6 then '16:00'::time else '20:00'::time end,
  d.dow <> 0
from public.staff s
cross join (select generate_series(0, 6) as dow) d
where s.tenant_id = '00000000-0000-0000-0000-000000000001';
