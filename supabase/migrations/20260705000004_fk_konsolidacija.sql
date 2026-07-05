-- HITNO - popravka regresije iz 20260705000001_tenant_integritet.
--
-- Ta migracija je composite FK-ove DODALA pored postojećih jednokolonskih,
-- pa svaka veza (bookings→staff, bookings→services, shift_assignments→
-- shift_templates...) sada ima DVA FK-a. PostgREST embedding zbog toga
-- odbija upite kao dvosmislene (PGRST201: "more than one relationship"),
-- a kod grešku guta kroz "?? []" - posledice: admin kalendar/početna/
-- rezervacije prikazuju prazno, dodeljene smene se ignorišu pri računanju
-- slotova, stranica za otkazivanje ne nalazi rezervaciju.
--
-- Rešenje: jedna (composite) veza po paru tabela. Stari jednokolonski
-- FK-ovi se brišu; composite preuzimaju i njihovo on delete ponašanje:
--   - bookings.staff/service: bili restrict → NO ACTION deferrable daje
--     isto ponašanje pri direktnom brisanju (23503 na commit), a propušta
--     kaskadno brisanje tenanta u istoj transakciji (već tako od 000001);
--   - bookings.customer: bio set null → set null samo za customer_id
--     kolonu (PG 15+ sintaksa; tenant_id mora ostati);
--   - ostale veze: bile cascade → composite postaju cascade.

-- ---------- bookings ----------
alter table public.bookings
  drop constraint if exists bookings_staff_id_fkey,
  drop constraint if exists bookings_service_id_fkey,
  drop constraint if exists bookings_customer_id_fkey,
  drop constraint if exists bookings_customer_isti_tenant;

alter table public.bookings
  add constraint bookings_customer_isti_tenant
    foreign key (tenant_id, customer_id) references public.customers (tenant_id, id)
    on delete set null (customer_id)
    deferrable initially deferred;

-- ---------- staff_services (bili cascade) ----------
alter table public.staff_services
  drop constraint if exists staff_services_staff_id_fkey,
  drop constraint if exists staff_services_service_id_fkey,
  drop constraint if exists staff_services_staff_isti_tenant,
  drop constraint if exists staff_services_service_isti_tenant;

alter table public.staff_services
  add constraint staff_services_staff_isti_tenant
    foreign key (tenant_id, staff_id) references public.staff (tenant_id, id)
    on delete cascade deferrable initially deferred,
  add constraint staff_services_service_isti_tenant
    foreign key (tenant_id, service_id) references public.services (tenant_id, id)
    on delete cascade deferrable initially deferred;

-- ---------- working_hours (bio cascade) ----------
alter table public.working_hours
  drop constraint if exists working_hours_staff_id_fkey,
  drop constraint if exists working_hours_staff_isti_tenant;

alter table public.working_hours
  add constraint working_hours_staff_isti_tenant
    foreign key (tenant_id, staff_id) references public.staff (tenant_id, id)
    on delete cascade deferrable initially deferred;

-- ---------- shift_templates (bio cascade) ----------
alter table public.shift_templates
  drop constraint if exists shift_templates_staff_id_fkey,
  drop constraint if exists shift_templates_staff_isti_tenant;

alter table public.shift_templates
  add constraint shift_templates_staff_isti_tenant
    foreign key (tenant_id, staff_id) references public.staff (tenant_id, id)
    on delete cascade deferrable initially deferred;

-- ---------- shift_assignments (bili cascade) ----------
alter table public.shift_assignments
  drop constraint if exists shift_assignments_staff_id_fkey,
  drop constraint if exists shift_assignments_shift_template_id_fkey,
  drop constraint if exists shift_assignments_staff_isti_tenant,
  drop constraint if exists shift_assignments_template_isti_tenant;

alter table public.shift_assignments
  add constraint shift_assignments_staff_isti_tenant
    foreign key (tenant_id, staff_id) references public.staff (tenant_id, id)
    on delete cascade deferrable initially deferred,
  add constraint shift_assignments_template_isti_tenant
    foreign key (tenant_id, shift_template_id) references public.shift_templates (tenant_id, id)
    on delete cascade deferrable initially deferred;

-- ---------- blocked_slots (bio cascade) ----------
alter table public.blocked_slots
  drop constraint if exists blocked_slots_staff_id_fkey,
  drop constraint if exists blocked_slots_staff_isti_tenant;

alter table public.blocked_slots
  add constraint blocked_slots_staff_isti_tenant
    foreign key (tenant_id, staff_id) references public.staff (tenant_id, id)
    on delete cascade deferrable initially deferred;
