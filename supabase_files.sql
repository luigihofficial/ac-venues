-- ============================================================
--  AC-Venues · Archivos por evento (contratos, blueprints, etc.)
--  Idempotente. Ejecuta TODO en Supabase → SQL Editor → New query → Run.
-- ============================================================

-- 1) Bucket de Storage público (descarga por enlace; subida/borrado sólo el equipo)
insert into storage.buckets (id, name, public) values ('event-files','event-files', true)
on conflict (id) do update set public = true;

drop policy if exists "eventfiles_team_insert"  on storage.objects;
drop policy if exists "eventfiles_team_update"  on storage.objects;
drop policy if exists "eventfiles_team_delete"  on storage.objects;
drop policy if exists "eventfiles_public_read"  on storage.objects;
create policy "eventfiles_team_insert" on storage.objects for insert to authenticated
  with check (bucket_id='event-files' and (auth.jwt()->>'email') in ('global@amorconsciente.com','noris@amorconsciente.com'));
create policy "eventfiles_team_update" on storage.objects for update to authenticated
  using (bucket_id='event-files' and (auth.jwt()->>'email') in ('global@amorconsciente.com','noris@amorconsciente.com'));
create policy "eventfiles_team_delete" on storage.objects for delete to authenticated
  using (bucket_id='event-files' and (auth.jwt()->>'email') in ('global@amorconsciente.com','noris@amorconsciente.com'));
create policy "eventfiles_public_read" on storage.objects for select to anon, authenticated
  using (bucket_id='event-files');

-- 2) Tabla índice de archivos por evento
create table if not exists public.event_files (
  id          uuid primary key default gen_random_uuid(),
  date_id     uuid not null references public.event_dates(id) on delete cascade,
  name        text default '',
  path        text default '',
  url         text default '',
  mime        text default '',
  size        bigint default 0,
  share       boolean not null default true,   -- incluir en la ficha (descarga para speakers)
  uploaded_by text default '',
  created_at  timestamptz not null default now()
);
create index if not exists event_files_date_idx on public.event_files(date_id);

alter table public.event_files enable row level security;
drop policy if exists "team_read_event_files"  on public.event_files;
drop policy if exists "team_write_event_files" on public.event_files;
create policy "team_read_event_files" on public.event_files for select to authenticated
  using ( (auth.jwt() ->> 'email') in ('global@amorconsciente.com','noris@amorconsciente.com') );
create policy "team_write_event_files" on public.event_files for all to authenticated
  using ( (auth.jwt() ->> 'email') in ('global@amorconsciente.com','noris@amorconsciente.com') )
  with check ( (auth.jwt() ->> 'email') in ('global@amorconsciente.com','noris@amorconsciente.com') );

do $$
begin
  begin execute 'alter publication supabase_realtime add table public.event_files;';
  exception when duplicate_object then null; end;
end $$;

-- ============================================================
--  Fin. Bucket 'event-files' + tabla event_files listos.
-- ============================================================
