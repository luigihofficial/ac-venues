-- ============================================================
--  AC-Venues · Directorio de Speakers / Líderes (personas de AC)
--  Lista reutilizable de personas vinculadas a Amor Consciente
--  (líderes, speakers, coaches, músicos…). Desde aquí se agregan
--  a la encuesta de cualquier evento (event_recipients) sin re-escribir.
--  RLS solo-equipo (igual que el resto). Realtime. Idempotente.
-- ============================================================

create table if not exists public.ac_people (
  id          uuid primary key default gen_random_uuid(),
  name        text not null default '',
  email       text default '',
  role        text default '',          -- líder / speaker / coach / músico / …
  phone       text default '',
  notes       text default '',
  active      boolean not null default true,
  created_by  text default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists ac_people_name_idx  on public.ac_people(name);
create index if not exists ac_people_email_idx on public.ac_people(lower(email));

alter table public.ac_people enable row level security;
drop policy if exists "team_read_ac_people"  on public.ac_people;
drop policy if exists "team_write_ac_people" on public.ac_people;
create policy "team_read_ac_people" on public.ac_people for select to authenticated
  using ( (auth.jwt() ->> 'email') in ('global@amorconsciente.com','noris@amorconsciente.com') );
create policy "team_write_ac_people" on public.ac_people for all to authenticated
  using ( (auth.jwt() ->> 'email') in ('global@amorconsciente.com','noris@amorconsciente.com') )
  with check ( (auth.jwt() ->> 'email') in ('global@amorconsciente.com','noris@amorconsciente.com') );

do $$
begin
  begin execute 'alter publication supabase_realtime add table public.ac_people;';
  exception when duplicate_object then null; end;
end $$;

-- ============================================================
--  Fin. La vista "Speakers / Líderes" lee/escribe aquí; el botón
--  "Desde directorio" en cada evento copia nombre/email/rol a
--  public.event_recipients (sin duplicar por email).
-- ============================================================
