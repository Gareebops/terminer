-- Horizont zakazivanja po zaposlenom: koliko dana unapred (računajući danas)
-- gosti vide slobodne termine. NULL = podrazumevano ponašanje (60 dana,
-- DEFAULT_HORIZON_DAYS u src/lib/booking/schedule.ts). Gornja granica 90
-- prati MAX_HORIZON_DAYS u kodu.
alter table staff add column booking_horizon_days integer
  check (booking_horizon_days between 1 and 90);
