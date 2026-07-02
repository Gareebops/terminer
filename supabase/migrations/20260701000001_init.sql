-- =============================================================
-- Terminer — multi-tenant šema za zakazivanje termina
-- Jedna baza, tenant_id na svemu, RLS izolacija po salonu.
-- Javni booking ide isključivo kroz server (service role),
-- pa NEMA javnih write politika ni javnog čitanja rezervacija.
-- =============================================================

create extension if not exists btree_gist;

-- ---------- Tipovi ----------
create type public.member_role as enum ('owner', 'admin', 'staff');
create type public.booking_status as enum ('pending', 'confirmed', 'cancelled', 'completed', 'no_show');

-- ---------- Tenants (saloni) ----------
create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9](?:-?[a-z0-9])*$' and char_length(slug) between 2 and 40),
  name text not null,
  timezone text not null default 'Europe/Belgrade',
  is_published boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.tenant_members (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.member_role not null default 'staff',
  created_at timestamptz not null default now(),
  primary key (tenant_id, user_id)
);

-- Helper funkcije (security definer da se RLS ne rekurzira preko tenant_members)
create or replace function public.is_member(t uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.tenant_members
    where tenant_id = t and user_id = auth.uid()
  );
$$;

create or replace function public.has_tenant_role(t uuid, roles public.member_role[])
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.tenant_members
    where tenant_id = t and user_id = auth.uid() and role = any(roles)
  );
$$;

-- ---------- Podešavanja sajta (tema, kontakt, sekcije) ----------
create table public.site_settings (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  logo_url text,
  hero_title text,
  hero_subtitle text,
  hero_image_url text,
  primary_color text not null default '#18181b',
  phone text,
  email text,
  address text,
  city text,
  instagram text,
  facebook text,
  show_team boolean not null default true,
  show_gallery boolean not null default true,
  show_prices boolean not null default true,
  updated_at timestamptz not null default now()
);

-- ---------- Usluge ----------
create table public.services (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  description text,
  duration_minutes int not null check (duration_minutes > 0 and duration_minutes <= 480),
  price numeric(10,2) not null default 0,
  currency text not null default 'RSD',
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index services_tenant_idx on public.services(tenant_id);

-- ---------- Zaposleni ----------
create table public.staff (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  name text not null,
  photo_url text,
  bio text,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index staff_tenant_idx on public.staff(tenant_id);

create table public.staff_services (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  staff_id uuid not null references public.staff(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete cascade,
  primary key (staff_id, service_id)
);
create index staff_services_tenant_idx on public.staff_services(tenant_id);

-- ---------- Radno vreme (nedeljni podrazumevani raspored) ----------
create table public.working_hours (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  staff_id uuid not null references public.staff(id) on delete cascade,
  day_of_week int not null check (day_of_week between 0 and 6), -- 0 = nedelja
  start_time time not null,
  end_time time not null,
  is_working boolean not null default true,
  unique (staff_id, day_of_week),
  check (start_time < end_time)
);
create index working_hours_tenant_idx on public.working_hours(tenant_id);

-- ---------- Smene: šabloni + dodela po datumu (override radnog vremena) ----------
create table public.shift_templates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  staff_id uuid not null references public.staff(id) on delete cascade,
  name text not null,
  start_time time not null,
  end_time time not null,
  color text,
  sort_order int not null default 0,
  check (start_time < end_time)
);
create index shift_templates_tenant_idx on public.shift_templates(tenant_id);

create table public.shift_assignments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  staff_id uuid not null references public.staff(id) on delete cascade,
  date date not null,
  shift_template_id uuid references public.shift_templates(id) on delete cascade,
  is_off boolean not null default false,
  unique (staff_id, date)
);
create index shift_assignments_tenant_idx on public.shift_assignments(tenant_id);
create index shift_assignments_date_idx on public.shift_assignments(staff_id, date);

-- ---------- Klijenti (evidencija po salonu, puni se iz rezervacija) ----------
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  phone text not null,
  email text,
  note text,
  created_at timestamptz not null default now(),
  unique (tenant_id, phone)
);

-- ---------- Rezervacije ----------
create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  staff_id uuid not null references public.staff(id) on delete restrict,
  service_id uuid not null references public.services(id) on delete restrict,
  customer_id uuid references public.customers(id) on delete set null,
  customer_name text not null,
  customer_phone text not null,
  customer_email text,
  date date not null,
  start_time time not null,
  end_time time not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status public.booking_status not null default 'confirmed',
  cancel_token uuid not null default gen_random_uuid(),
  note text,
  created_at timestamptz not null default now(),
  check (starts_at < ends_at)
);
create index bookings_tenant_date_idx on public.bookings(tenant_id, date);
create index bookings_staff_date_idx on public.bookings(staff_id, date);

-- Zaštita od duplog zakazivanja na nivou baze: dva aktivna termina
-- istog frizera ne mogu da se preklope, ma koliko klijenata kliknulo istovremeno.
alter table public.bookings add constraint bookings_no_overlap
  exclude using gist (
    staff_id with =,
    tstzrange(starts_at, ends_at) with &&
  ) where (status in ('pending', 'confirmed'));

-- ---------- Blokirani termini (odmor, pauza, privatno) ----------
create table public.blocked_slots (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  staff_id uuid references public.staff(id) on delete cascade, -- null = ceo salon
  date date not null,
  start_time time not null,
  end_time time not null,
  reason text,
  check (start_time < end_time)
);
create index blocked_slots_tenant_date_idx on public.blocked_slots(tenant_id, date);

-- ---------- Galerija ----------
create table public.gallery (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  image_url text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index gallery_tenant_idx on public.gallery(tenant_id);

-- =============================================================
-- RLS
-- Javno čitanje: samo ono što javni sajt salona sme da vidi,
-- i to samo za objavljene salone. Rezervacije i klijenti NIKAD javno.
-- Pisanje: samo članovi salona (admin/owner za upravljanje).
-- Javne rezervacije se prave server-side (service role zaobilazi RLS).
-- =============================================================

alter table public.tenants enable row level security;
alter table public.tenant_members enable row level security;
alter table public.site_settings enable row level security;
alter table public.services enable row level security;
alter table public.staff enable row level security;
alter table public.staff_services enable row level security;
alter table public.working_hours enable row level security;
alter table public.shift_templates enable row level security;
alter table public.shift_assignments enable row level security;
alter table public.customers enable row level security;
alter table public.bookings enable row level security;
alter table public.blocked_slots enable row level security;
alter table public.gallery enable row level security;

-- tenants
create policy "Javno čitanje objavljenih salona" on public.tenants
  for select using (is_published or public.is_member(id));
create policy "Owner/admin menja salon" on public.tenants
  for update to authenticated
  using (public.has_tenant_role(id, array['owner','admin']::public.member_role[]))
  with check (public.has_tenant_role(id, array['owner','admin']::public.member_role[]));

-- tenant_members
create policy "Član vidi članstva svog salona" on public.tenant_members
  for select to authenticated using (public.is_member(tenant_id));
create policy "Owner upravlja članstvima" on public.tenant_members
  for all to authenticated
  using (public.has_tenant_role(tenant_id, array['owner']::public.member_role[]))
  with check (public.has_tenant_role(tenant_id, array['owner']::public.member_role[]));

-- Šablon: javno čitanje za objavljene salone + pun pristup za članove
create policy "Javno čitanje" on public.site_settings for select
  using (exists (select 1 from public.tenants t where t.id = tenant_id and t.is_published) or public.is_member(tenant_id));
create policy "Članovi upravljaju" on public.site_settings for all to authenticated
  using (public.has_tenant_role(tenant_id, array['owner','admin']::public.member_role[]))
  with check (public.has_tenant_role(tenant_id, array['owner','admin']::public.member_role[]));

create policy "Javno čitanje" on public.services for select
  using (exists (select 1 from public.tenants t where t.id = tenant_id and t.is_published) or public.is_member(tenant_id));
create policy "Članovi upravljaju" on public.services for all to authenticated
  using (public.has_tenant_role(tenant_id, array['owner','admin']::public.member_role[]))
  with check (public.has_tenant_role(tenant_id, array['owner','admin']::public.member_role[]));

create policy "Javno čitanje" on public.staff for select
  using (exists (select 1 from public.tenants t where t.id = tenant_id and t.is_published) or public.is_member(tenant_id));
create policy "Članovi upravljaju" on public.staff for all to authenticated
  using (public.has_tenant_role(tenant_id, array['owner','admin']::public.member_role[]))
  with check (public.has_tenant_role(tenant_id, array['owner','admin']::public.member_role[]));

create policy "Javno čitanje" on public.staff_services for select
  using (exists (select 1 from public.tenants t where t.id = tenant_id and t.is_published) or public.is_member(tenant_id));
create policy "Članovi upravljaju" on public.staff_services for all to authenticated
  using (public.has_tenant_role(tenant_id, array['owner','admin']::public.member_role[]))
  with check (public.has_tenant_role(tenant_id, array['owner','admin']::public.member_role[]));

create policy "Javno čitanje" on public.working_hours for select
  using (exists (select 1 from public.tenants t where t.id = tenant_id and t.is_published) or public.is_member(tenant_id));
create policy "Članovi upravljaju" on public.working_hours for all to authenticated
  using (public.has_tenant_role(tenant_id, array['owner','admin']::public.member_role[]))
  with check (public.has_tenant_role(tenant_id, array['owner','admin']::public.member_role[]));

create policy "Javno čitanje" on public.shift_templates for select
  using (exists (select 1 from public.tenants t where t.id = tenant_id and t.is_published) or public.is_member(tenant_id));
create policy "Članovi upravljaju" on public.shift_templates for all to authenticated
  using (public.has_tenant_role(tenant_id, array['owner','admin']::public.member_role[]))
  with check (public.has_tenant_role(tenant_id, array['owner','admin']::public.member_role[]));

create policy "Javno čitanje" on public.shift_assignments for select
  using (exists (select 1 from public.tenants t where t.id = tenant_id and t.is_published) or public.is_member(tenant_id));
create policy "Članovi upravljaju" on public.shift_assignments for all to authenticated
  using (public.has_tenant_role(tenant_id, array['owner','admin']::public.member_role[]))
  with check (public.has_tenant_role(tenant_id, array['owner','admin']::public.member_role[]));

create policy "Javno čitanje" on public.gallery for select
  using (exists (select 1 from public.tenants t where t.id = tenant_id and t.is_published) or public.is_member(tenant_id));
create policy "Članovi upravljaju" on public.gallery for all to authenticated
  using (public.has_tenant_role(tenant_id, array['owner','admin']::public.member_role[]))
  with check (public.has_tenant_role(tenant_id, array['owner','admin']::public.member_role[]));

-- Privatni podaci: SAMO članovi salona, nikad javno
create policy "Članovi vide klijente" on public.customers for select to authenticated
  using (public.is_member(tenant_id));
create policy "Članovi upravljaju klijentima" on public.customers for all to authenticated
  using (public.has_tenant_role(tenant_id, array['owner','admin']::public.member_role[]))
  with check (public.has_tenant_role(tenant_id, array['owner','admin']::public.member_role[]));

create policy "Članovi vide rezervacije" on public.bookings for select to authenticated
  using (public.is_member(tenant_id));
create policy "Članovi upravljaju rezervacijama" on public.bookings for all to authenticated
  using (public.has_tenant_role(tenant_id, array['owner','admin']::public.member_role[]))
  with check (public.has_tenant_role(tenant_id, array['owner','admin']::public.member_role[]));

create policy "Članovi vide blokade" on public.blocked_slots for select to authenticated
  using (public.is_member(tenant_id));
create policy "Članovi upravljaju blokadama" on public.blocked_slots for all to authenticated
  using (public.has_tenant_role(tenant_id, array['owner','admin']::public.member_role[]))
  with check (public.has_tenant_role(tenant_id, array['owner','admin']::public.member_role[]));

-- ---------- Storage bucket za slike (logo, tim, galerija) ----------
insert into storage.buckets (id, name, public) values ('tenant-media', 'tenant-media', true)
on conflict (id) do nothing;

-- Putanja fajla mora da počinje tenant_id-jem: {tenant_id}/...
create policy "Javno čitanje tenant-media" on storage.objects
  for select using (bucket_id = 'tenant-media');
create policy "Članovi upload u svoj folder" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'tenant-media'
    and public.has_tenant_role(((string_to_array(name, '/'))[1])::uuid, array['owner','admin']::public.member_role[])
  );
create policy "Članovi menjaju svoj folder" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'tenant-media'
    and public.has_tenant_role(((string_to_array(name, '/'))[1])::uuid, array['owner','admin']::public.member_role[])
  );
create policy "Članovi brišu iz svog foldera" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'tenant-media'
    and public.has_tenant_role(((string_to_array(name, '/'))[1])::uuid, array['owner','admin']::public.member_role[])
  );
