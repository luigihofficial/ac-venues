-- ============================================================
--  AC-Venues · Disponibilidad de hoteles por fecha/evento
--  Permite que el equipo marque, para CADA fecha, qué hoteles
--  NO tienen disponibilidad (o sí, o "dejé mensaje"), con quién
--  lo marcó y cuándo — para que varios usuarios hagan llamadas
--  sin repetir gestiones. RLS solo-equipo. Realtime. Idempotente.
-- ============================================================

create table if not exists public.date_venue_status (
  id          uuid primary key default gen_random_uuid(),
  date_id     uuid not null references public.event_dates(id) on delete cascade,
  venue_key   text not null,                 -- nombre del hotel normalizado (clave)
  venue_name  text not null default '',       -- nombre visible del hotel
  status      text not null default 'unavail',-- 'unavail' | 'avail' | 'msg'
  note        text default '',
  updated_by  text default '',
  updated_at  timestamptz not null default now(),
  unique (date_id, venue_key)
);
create index if not exists dvs_date_idx on public.date_venue_status(date_id);

alter table public.date_venue_status enable row level security;
drop policy if exists "team_read_dvs"  on public.date_venue_status;
drop policy if exists "team_write_dvs" on public.date_venue_status;
create policy "team_read_dvs" on public.date_venue_status for select to authenticated
  using ( (auth.jwt() ->> 'email') in ('global@amorconsciente.com','noris@amorconsciente.com') );
create policy "team_write_dvs" on public.date_venue_status for all to authenticated
  using ( (auth.jwt() ->> 'email') in ('global@amorconsciente.com','noris@amorconsciente.com') )
  with check ( (auth.jwt() ->> 'email') in ('global@amorconsciente.com','noris@amorconsciente.com') );

do $$
begin
  begin execute 'alter publication supabase_realtime add table public.date_venue_status;';
  exception when duplicate_object then null; end;
end $$;

-- ============================================================
--  Fin. La app lee/escribe aquí desde la sección "Disponibilidad
--  de hoteles" dentro de cada fecha/evento.
-- ============================================================
