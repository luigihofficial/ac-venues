-- ============================================================
--  AC-Venues · Agenda / Calendario
--  Citas, recordatorios y reuniones, opcionalmente ligadas a un
--  evento (event_dates) y/o a un contacto (contacts).
--  RLS solo para el equipo. Realtime. Idempotente.
-- ============================================================

create table if not exists public.calendar_items (
  id          uuid primary key default gen_random_uuid(),
  title       text not null default '',
  kind        text not null default 'recordatorio',  -- recordatorio | reunión | llamada | visita | tarea | otro
  starts_at   timestamptz not null,
  ends_at     timestamptz,
  all_day     boolean not null default false,
  location    text default '',
  notes       text default '',
  date_id     uuid references public.event_dates(id) on delete set null,
  contact_id  uuid references public.contacts(id)    on delete set null,
  done        boolean not null default false,
  created_by  text default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists calendar_items_starts_idx  on public.calendar_items(starts_at);
create index if not exists calendar_items_date_idx    on public.calendar_items(date_id);
create index if not exists calendar_items_contact_idx on public.calendar_items(contact_id);

alter table public.calendar_items enable row level security;
drop policy if exists "team_read_calendar"  on public.calendar_items;
drop policy if exists "team_write_calendar" on public.calendar_items;
create policy "team_read_calendar" on public.calendar_items for select to authenticated
  using ( (auth.jwt() ->> 'email') in ('global@amorconsciente.com','noris@amorconsciente.com') );
create policy "team_write_calendar" on public.calendar_items for all to authenticated
  using ( (auth.jwt() ->> 'email') in ('global@amorconsciente.com','noris@amorconsciente.com') )
  with check ( (auth.jwt() ->> 'email') in ('global@amorconsciente.com','noris@amorconsciente.com') );

do $$
begin
  begin execute 'alter publication supabase_realtime add table public.calendar_items;';
  exception when duplicate_object then null; end;
end $$;

-- ============================================================
--  Fin. La agenda vive dentro de la app (equipo). Los enlaces a
--  Google Calendar / Outlook (M365) y el .ics se generan en el cliente.
-- ============================================================
