-- Sužavanje javnog čitanja.
--
-- 1) tenants: RLS pušta ceo red objavljenog salona svakome, pa je javni
--    REST (anon key) otkrivao paid_until, trial_ends_at, billing_note
--    (naziv firme/adresa/PIB kupca) i suspended_reason. Kolonske SELECT
--    privilegije puštaju samo ono što javni sajt stvarno koristi.
--    Admin/superadmin čitaju tenant red service-role klijentom, a
--    autorizacija je prethodna provera članstva kroz RLS (lib/admin.ts).
revoke select on table public.tenants from anon, authenticated;
grant select (id, slug, name, timezone, is_published, suspended_at, created_at)
  on table public.tenants to anon, authenticated;

-- 2) Rasporedi radnika ne trebaju javnom sajtu (slotove računa server
--    service-role klijentom), a otkrivali su kad je koji radnik sam u
--    salonu. Čitanje samo za članove salona; "Članovi upravljaju"
--    (for all, owner/admin) ostaje netaknuto.
drop policy "Javno čitanje" on public.working_hours;
create policy "Članovi čitaju" on public.working_hours
  for select to authenticated using (public.is_member(tenant_id));

drop policy "Javno čitanje" on public.shift_templates;
create policy "Članovi čitaju" on public.shift_templates
  for select to authenticated using (public.is_member(tenant_id));

drop policy "Javno čitanje" on public.shift_assignments;
create policy "Članovi čitaju" on public.shift_assignments
  for select to authenticated using (public.is_member(tenant_id));
