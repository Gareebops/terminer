-- Superadmin kontrole runda 3: fakture prežive brisanje salona (finansijski
-- zapis se čuva), interna beleška po salonu i prisustvo admina u panelu.

-- 1) Fakture su finansijski zapis platforme (KPO) - brisanje salona ih NE
--    briše. tenant_id postaje nullable (set null pri brisanju), tenant_label
--    čuva čitljivo ime salona za prikaz i knjigovodstvo posle brisanja.
alter table public.invoices
  alter column tenant_id drop not null;
alter table public.invoices
  drop constraint invoices_tenant_id_fkey;
alter table public.invoices
  add constraint invoices_tenant_id_fkey
    foreign key (tenant_id) references public.tenants(id) on delete set null;
alter table public.invoices
  add column tenant_label text;

-- Postojeće fakture dobijaju labelu odmah (nove je dobijaju pri izdavanju)
update public.invoices i
  set tenant_label = t.name || ' (/' || t.slug || ')'
  from public.tenants t
  where i.tenant_id = t.id and i.tenant_label is null;

-- RLS napomena: politika "Članovi vide svoje fakture" koristi
-- is_member(tenant_id) - za tenant_id NULL (obrisan salon) fakturu vidi
-- samo service role (superadmin), što je i namera.

-- 2) Interna beleška superadmina po salonu (CRM-lite: "zvao 10.7, obećao
--    uplatu"). Namerno BEZ grant-a za anon/authenticated - kolonski grantovi
--    na tenants (20260709000001/20260704000001) je ne obuhvataju, pa je vidi
--    i menja isključivo service role posle assertSuperAdmin provere.
alter table public.tenants
  add column superadmin_note text;

-- 3) Prisustvo u admin panelu: heartbeat iz admina upisuje vreme poslednje
--    aktivnosti člana (service rolom posle provere sesije). Superadmin panel
--    iz ovoga računa "online" indikator po salonu.
alter table public.tenant_members
  add column last_seen_at timestamptz;
