-- Cross-tenant integritet referenci.
--
-- RLS proverava samo da tenant_id reda pripada korisniku - ništa nije
-- garantovalo da staff_id/service_id/shift_template_id pripadaju ISTOM
-- salonu. Autentifikovan vlasnik bilo kog salona je mogao REST pozivom
-- da ubaci npr. booking sa svojim tenant_id ali tuđim staff_id (ID-jevi
-- objavljenih salona su javno čitljivi) i time blokira tuđi kalendar
-- (bookings_no_overlap je po staff_id, bez obzira na tenant), ili
-- shift_assignment sa is_off=true koji tuđeg radnika "oslobodi" smene.
--
-- Rešenje: composite FK (tenant_id, X) -> roditelj(tenant_id, id), pa
-- referenca sa pogrešnim tenantom ne može ni da se upiše.

-- Unique parovi kao meta composite FK-ova (id je već PK, par je trivijalno
-- jedinstven - constraint postoji samo da bi FK imao šta da referencira)
alter table public.staff add constraint staff_tenant_id_key unique (tenant_id, id);
alter table public.services add constraint services_tenant_id_key unique (tenant_id, id);
alter table public.shift_templates add constraint shift_templates_tenant_id_key unique (tenant_id, id);
alter table public.customers add constraint customers_tenant_id_key unique (tenant_id, id);

-- Svi composite FK-ovi su deferrable initially deferred: kaskadno brisanje
-- tenanta briše roditelje i decu u istom iskazu, pa se provera mora odložiti
-- do kraja transakcije. Ponašanje pri direktnom brisanju roditelja i dalje
-- određuju postojeći jednokolonski FK-ovi (restrict/cascade).

alter table public.bookings
  add constraint bookings_staff_isti_tenant
    foreign key (tenant_id, staff_id) references public.staff (tenant_id, id)
    deferrable initially deferred,
  add constraint bookings_service_isti_tenant
    foreign key (tenant_id, service_id) references public.services (tenant_id, id)
    deferrable initially deferred,
  -- customer_id je nullable - FK se ne proverava kad je null
  add constraint bookings_customer_isti_tenant
    foreign key (tenant_id, customer_id) references public.customers (tenant_id, id)
    deferrable initially deferred;

alter table public.staff_services
  add constraint staff_services_staff_isti_tenant
    foreign key (tenant_id, staff_id) references public.staff (tenant_id, id)
    deferrable initially deferred,
  add constraint staff_services_service_isti_tenant
    foreign key (tenant_id, service_id) references public.services (tenant_id, id)
    deferrable initially deferred;

alter table public.working_hours
  add constraint working_hours_staff_isti_tenant
    foreign key (tenant_id, staff_id) references public.staff (tenant_id, id)
    deferrable initially deferred;

alter table public.shift_templates
  add constraint shift_templates_staff_isti_tenant
    foreign key (tenant_id, staff_id) references public.staff (tenant_id, id)
    deferrable initially deferred;

alter table public.shift_assignments
  add constraint shift_assignments_staff_isti_tenant
    foreign key (tenant_id, staff_id) references public.staff (tenant_id, id)
    deferrable initially deferred,
  -- shift_template_id je nullable (is_off dodela nema šablon)
  add constraint shift_assignments_template_isti_tenant
    foreign key (tenant_id, shift_template_id) references public.shift_templates (tenant_id, id)
    deferrable initially deferred;

-- staff_id null = blokada za ceo salon - FK se tada ne proverava
alter table public.blocked_slots
  add constraint blocked_slots_staff_isti_tenant
    foreign key (tenant_id, staff_id) references public.staff (tenant_id, id)
    deferrable initially deferred;
