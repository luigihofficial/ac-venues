-- Registro de última llamada por contacto/venue (para no repetir llamadas)
alter table public.contacts add column if not exists last_call date;
