-- Pretplata po salonu: 30 dana probnog perioda, pa faktura + ručno
-- produženje kroz superadmin. paid_until = do kog datuma je plaćeno.
alter table public.tenants
  add column if not exists trial_ends_at timestamptz not null default (now() + interval '30 days'),
  add column if not exists paid_until date,
  add column if not exists billing_note text;
