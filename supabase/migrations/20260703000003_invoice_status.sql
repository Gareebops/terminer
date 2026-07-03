-- Životni ciklus fakture: izdata → plaćena (produžava pretplatu) ili stornirana.
alter table public.invoices
  add column if not exists status text not null default 'issued'
    check (status in ('issued', 'paid', 'cancelled')),
  add column if not exists paid_at timestamptz;
