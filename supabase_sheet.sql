-- ============================================================
--  AC-Venues · Ficha técnica del evento (correo el día ANTES)
--  Idempotente. Ejecuta TODO en Supabase → SQL Editor → New query → Run.
-- ============================================================

create table if not exists public.event_sheet (
  date_id            uuid primary key references public.event_dates(id) on delete cascade,
  hotel_name         text default '',
  address            text default '',
  map_url            text default '',
  room_name          text default '',
  contact_name       text default '',
  contact_phone      text default '',
  parking_cost       text default '',
  parking_reentry    text default '',   -- 'si' | 'no' | ''
  wifi_included      text default '',   -- 'si' | 'no' | ''
  setup_time         text default '',
  greenroom_included text default '',   -- 'si' | 'no' | ''
  contract_url       text default '',
  notes              text default '',
  sheet_sent_at      timestamptz,
  updated_at         timestamptz not null default now()
);

alter table public.event_sheet enable row level security;

drop policy if exists "team_read_event_sheet"  on public.event_sheet;
drop policy if exists "team_write_event_sheet" on public.event_sheet;
create policy "team_read_event_sheet" on public.event_sheet for select to authenticated
  using ( (auth.jwt() ->> 'email') in ('global@amorconsciente.com','noris@amorconsciente.com') );
create policy "team_write_event_sheet" on public.event_sheet for all to authenticated
  using ( (auth.jwt() ->> 'email') in ('global@amorconsciente.com','noris@amorconsciente.com') )
  with check ( (auth.jwt() ->> 'email') in ('global@amorconsciente.com','noris@amorconsciente.com') );

do $$
begin
  begin execute 'alter publication supabase_realtime add table public.event_sheet;';
  exception when duplicate_object then null; end;
end $$;

-- ============================================================
--  Fin. Tabla event_sheet lista para la ficha técnica.
-- ============================================================
