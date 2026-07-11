-- Live chat podrške: vlasnik salona (widget u /admin) <-> Terminer podrška
-- (superadmin u /superadmin/poruke). Razgovor se otvara PRVOM porukom
-- vlasnika (tada superadminu ide mejl); superadmin ga zatvara kad je rešen,
-- pa sledeća poruka vlasnika otvara nov razgovor (i nov mejl).

create table public.support_conversations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  -- Dokle je koja strana pročitala (brojači nepročitanih poruka).
  -- Vlasnik otvara razgovor svojom porukom pa je za njega sve pročitano;
  -- podrška kreće od nule.
  owner_read_at timestamptz not null default now(),
  support_read_at timestamptz not null default 'epoch',
  -- Meta composite FK-a iz support_messages (konvencija iz 20260705000001)
  unique (tenant_id, id)
);

-- Najviše JEDAN otvoren razgovor po salonu - paralelna slanja ne smeju da
-- otvore dva razgovora (i pošalju dva mejla); insert koji padne na 23505
-- znači da je razgovor u međuvremenu otvoren, pa akcija piše u njega.
create unique index support_conversations_one_open
  on public.support_conversations (tenant_id) where status = 'open';

create index support_conversations_tenant_idx
  on public.support_conversations (tenant_id, last_message_at desc);
create index support_conversations_inbox_idx
  on public.support_conversations (last_message_at desc);

create table public.support_messages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  conversation_id uuid not null,
  sender text not null check (sender in ('owner', 'support')),
  -- auth.users id autora (samo za owner poruke; podrška piše service rolom)
  sender_user_id uuid,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now(),
  -- Composite FK: poruka ne može da pokazuje na razgovor tuđeg salona
  foreign key (tenant_id, conversation_id)
    references public.support_conversations (tenant_id, id) on delete cascade
);

create index support_messages_conversation_idx
  on public.support_messages (conversation_id, created_at);

alter table public.support_conversations enable row level security;
alter table public.support_messages enable row level security;

-- RLS: članovi salona vide i pišu isključivo svoje razgovore. Strana
-- podrške nema politike - superadmin ide kroz service role posle
-- assertSuperAdmin provere (kao ostatak /superadmin akcija).
create policy "Članovi čitaju svoje razgovore" on public.support_conversations
  for select to authenticated using (public.is_member(tenant_id));
create policy "Članovi otvaraju razgovor" on public.support_conversations
  for insert to authenticated with check (public.is_member(tenant_id) and status = 'open');
create policy "Članovi ažuriraju svoje razgovore" on public.support_conversations
  for update to authenticated
  using (public.is_member(tenant_id)) with check (public.is_member(tenant_id));

create policy "Članovi čitaju svoje poruke" on public.support_messages
  for select to authenticated using (public.is_member(tenant_id));
create policy "Članovi pišu kao owner" on public.support_messages
  for insert to authenticated
  with check (
    public.is_member(tenant_id)
    and sender = 'owner'
    and sender_user_id = (select auth.uid())
  );

-- Eksplicitni grantovi (konvencija iz 20260709000001: nova tabela mora
-- dobiti svoje grantove; anon NIŠTA - upit pada sa 42501). Update za
-- authenticated je KOLONSKI: vlasnik pomera samo svoj read marker i
-- last_message_at pri slanju - status/support_read_at ne sme da dira.
grant all on table public.support_conversations to service_role;
grant all on table public.support_messages to service_role;
grant select on table public.support_conversations to authenticated;
grant insert (tenant_id) on table public.support_conversations to authenticated;
grant update (last_message_at, owner_read_at)
  on table public.support_conversations to authenticated;
grant select on table public.support_messages to authenticated;
grant insert (tenant_id, conversation_id, sender, sender_user_id, body)
  on table public.support_messages to authenticated;
revoke all on table public.support_conversations from anon;
revoke all on table public.support_messages from anon;
