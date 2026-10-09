-- ============================================================
--  AC-Venues · Ciudades personalizadas (creadas desde la app)
--  Se suman a las 8 ciudades base del código. RLS equipo. Realtime.
--  Idempotente.
-- ============================================================

create table if not exists public.custom_cities (
  slug        text primary key,
  name        text not null,
  created_by  text default '',
  created_at  timestamptz not null default now()
);

alter table public.custom_cities enable row level security;
drop policy if exists "team_read_cities"  on public.custom_cities;
drop policy if exists "team_write_cities" on public.custom_cities;
create policy "team_read_cities" on public.custom_cities for select to authenticated
  using ( (auth.jwt() ->> 'email') in ('global@amorconsciente.com','noris@amorconsciente.com') );
create policy "team_write_cities" on public.custom_cities for all to authenticated
  using ( (auth.jwt() ->> 'email') in ('global@amorconsciente.com','noris@amorconsciente.com') )
  with check ( (auth.jwt() ->> 'email') in ('global@amorconsciente.com','noris@amorconsciente.com') );

do $$
begin
  begin execute 'alter publication supabase_realtime add table public.custom_cities;';
  exception when duplicate_object then null; end;
end $$;

-- ============================================================
--  Fin. La app lee esta tabla y agrega las ciudades a la lista.
-- ============================================================
