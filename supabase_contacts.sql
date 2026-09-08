-- Dirección del hotel/salón en el directorio de contactos
alter table public.contacts add column if not exists address text default '';
