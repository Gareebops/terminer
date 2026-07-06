-- Raspored zaposlenih: model "pravilo + izuzeci" umesto šablona smena.
--
-- Dosadašnji model (working_hours + shift_templates + shift_assignments sa
-- referencom na šablon) tražio je tri pojma i pravilo prednosti. Novi model:
--   1. PRAVILO po zaposlenom: nedeljno radno vreme koje se ponavlja svake
--      nedelje (schedule_mode='weekly', čita se week_parity=0) ili dve
--      nedelje A/B koje se same smenjuju (schedule_mode='rotating',
--      parnost nedelje se računa od rotation_anchor = ponedeljak A-nedelje).
--   2. IZUZETAK po datumu: shift_assignments dobija sopstveno vreme
--      (start_time/end_time) ili is_off; izuzetak i dalje gazi pravilo.
-- Šabloni smena nestaju kao pojam - vremena postojećih dodela se prepisuju
-- u sam izuzetak pa se tabela shift_templates briše.

-- 1) staff: režim rasporeda i sidro rotacije
alter table public.staff
  add column schedule_mode text not null default 'weekly'
    check (schedule_mode in ('weekly', 'rotating')),
  add column rotation_anchor date;

-- 2) working_hours: nedelja A (parity 0) i B (parity 1);
--    weekly režim koristi samo parity 0, pa postojeći redovi ostaju važeći
alter table public.working_hours
  add column week_parity int not null default 0
    check (week_parity in (0, 1));
alter table public.working_hours
  drop constraint working_hours_staff_id_day_of_week_key;
alter table public.working_hours
  add constraint working_hours_staff_dow_parity_key
    unique (staff_id, day_of_week, week_parity);

-- 3) shift_assignments postaje tabela izuzetaka sa sopstvenim vremenom
alter table public.shift_assignments
  add column start_time time,
  add column end_time time;

-- vreme dodeljenog šablona postaje vreme izuzetka
update public.shift_assignments sa
set start_time = st.start_time,
    end_time = st.end_time
from public.shift_templates st
where sa.shift_template_id = st.id
  and sa.is_off = false;

-- red bez šablona i bez is_off nije značio ništa ni u starom modelu
delete from public.shift_assignments
where is_off = false and start_time is null;

-- drop kolone nosi i composite FK shift_assignments_template_isti_tenant
alter table public.shift_assignments
  drop column shift_template_id;

alter table public.shift_assignments
  add constraint shift_assignments_vreme_check
    check (
      (is_off and start_time is null and end_time is null)
      or (not is_off and start_time is not null and end_time is not null
          and start_time < end_time)
    );

-- 4) šabloni više ne postoje (RLS policy i unique parovi padaju sa tabelom)
drop table public.shift_templates;
