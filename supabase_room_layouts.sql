-- ============================================================
--  AC-Venues · Meeting Room Layout & Capacity Engine · persistencia
--  Guarda la geometría de sala + el layout generado/editado, por
--  venue/room/evento. RLS solo-equipo (igual que el resto). Idempotente.
--  Un layout es reutilizable y versionable: cada guardado hace upsert
--  por (venue, room_name, layout_id). Para versiones separadas, usar
--  distinto layout_id o room_name.
-- ============================================================

create table if not exists public.room_layouts (
  id          uuid primary key default gen_random_uuid(),
  venue       text not null default '',
  room_name   text not null default '',
  event_name  text default '',
  layout_id   text not null default '',
  unit        text default 'ft',
  width       numeric,
  length      numeric,
  published   integer,          -- capacidad publicada por el hotel (opcional)
  data        jsonb not null default '{}'::jsonb,   -- serialización completa (room, params, objects)
  capacities  jsonb not null default '{}'::jsonb,   -- {published, estimated, validated, feasible,...}
  created_by  text default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (venue, room_name, layout_id)
);
create index if not exists room_layouts_venue_idx on public.room_layouts(venue, room_name);
create index if not exists room_layouts_upd_idx   on public.room_layouts(updated_at desc);

alter table public.room_layouts enable row level security;
drop policy if exists "team_read_room_layouts"  on public.room_layouts;
drop policy if exists "team_write_room_layouts" on public.room_layouts;
create policy "team_read_room_layouts" on public.room_layouts for select to authenticated
  using ( (auth.jwt() ->> 'email') in ('global@amorconsciente.com','noris@amorconsciente.com') );
create policy "team_write_room_layouts" on public.room_layouts for all to authenticated
  using ( (auth.jwt() ->> 'email') in ('global@amorconsciente.com','noris@amorconsciente.com') )
  with check ( (auth.jwt() ->> 'email') in ('global@amorconsciente.com','noris@amorconsciente.com') );

do $$
begin
  begin execute 'alter publication supabase_realtime add table public.room_layouts;';
  exception when duplicate_object then null; end;
end $$;

-- ============================================================
--  Fin. La app (vista #layout) hace upsert por (venue, room_name,
--  layout_id) al Guardar y lee el más reciente del mismo venue/sala
--  al Cargar.
-- ============================================================
