-- Superadmin kontrola naloga: suspenzija salona + dnevnik akcija.

-- Suspenzija: postavlja/skida ISKLJUČIVO superadmin (service role);
-- pri suspenziji se salon i skida sa javnog interneta (is_published=false),
-- a admin akcije za objavu odbijaju dok suspenzija traje.
alter table public.tenants
  add column suspended_at timestamptz,
  add column suspended_reason text;

-- Dnevnik superadmin akcija - upis i čitanje samo service role klijentom
-- (RLS uključen bez ijedne policy = anon/authenticated nemaju pristup).
create table public.superadmin_audit_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  admin_email text not null,
  action text not null,
  tenant_id uuid references public.tenants(id) on delete set null,
  tenant_label text,
  details jsonb
);
alter table public.superadmin_audit_log enable row level security;

create index superadmin_audit_log_created_idx
  on public.superadmin_audit_log (created_at desc);

-- Kolonske privilegije na tenants: RLS dozvoljava owner/admin update reda,
-- ali biling i suspenzija smeju da se menjaju SAMO service role klijentom.
-- (Zatvara i postojeću rupu: vlasnik je mogao REST pozivom da menja
-- sopstveni paid_until/trial_ends_at.)
revoke update on table public.tenants from authenticated;
grant update (name, is_published, billing_note) on table public.tenants to authenticated;

revoke insert on table public.tenants from authenticated;
grant insert (name, slug) on table public.tenants to authenticated;
