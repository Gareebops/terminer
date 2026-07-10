-- Raspon cene usluge: salonu često cena zavisi od dužine/gustine kose i sl,
-- pa fiksna cifra laže klijenta. price ostaje POČETNA (donja) cena - sve
-- postojeće računice (očekivani promet na Početnoj) time ostaju konzervativne;
-- price_max je opciona gornja granica (null = fiksna cena, ponašanje kao do sada).
alter table public.services add column price_max numeric(10,2);

alter table public.services add constraint services_price_range
  check (price_max is null or price_max > price);
