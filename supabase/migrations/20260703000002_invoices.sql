-- Fakture za Terminer članarine. Izdavalac je Čvorište (podaci u kodu);
-- numeracija je globalna po godini (broj/godina), unique čuva od sudara.
create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  number int not null,
  year int not null,
  plan text not null check (plan in ('monthly', 'yearly')),
  amount numeric(10,2) not null,
  period_from date not null,
  period_to date not null,
  buyer_info text,
  created_at timestamptz not null default now(),
  unique (year, number)
);
create index invoices_tenant_idx on public.invoices(tenant_id);

alter table public.invoices enable row level security;

-- Članovi salona vide svoje fakture; kreiranje ide server-side (service role)
-- zbog globalne numeracije preko svih salona.
create policy "Članovi vide svoje fakture" on public.invoices
  for select to authenticated using (public.is_member(tenant_id));
