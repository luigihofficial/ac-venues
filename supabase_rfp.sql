-- ============================================================
--  AC-Venues · Registro de RFPs enviados a vendors
--  Historial de solicitudes de cotización enviadas por evento/zona.
--  RLS solo para el equipo. Realtime. Idempotente.
-- ============================================================

create table if not exists public.rfp_log (
  id          uuid primary key default gen_random_uuid(),
  date_id     uuid references public.event_dates(id) on delete set null,
  city_slug   text default '',
  to_email    text not null,
  to_name     text default '',
  venue       text default '',
  subject     text default '',
  lang        text default '',
  sent_by     text default '',
  sent_at     timestamptz not null default now(),
  created_at  timestamptz not null default now()
);
create index if not exists rfp_log_date_idx on public.rfp_log(date_id);
create index if not exists rfp_log_sent_idx on public.rfp_log(sent_at desc);

alter table public.rfp_log enable row level security;
drop policy if exists "team_read_rfp"  on public.rfp_log;
drop policy if exists "team_write_rfp" on public.rfp_log;
create policy "team_read_rfp" on public.rfp_log for select to authenticated
  using ( (auth.jwt() ->> 'email') in ('global@amorconsciente.com','noris@amorconsciente.com') );
create policy "team_write_rfp" on public.rfp_log for all to authenticated
  using ( (auth.jwt() ->> 'email') in ('global@amorconsciente.com','noris@amorconsciente.com') )
  with check ( (auth.jwt() ->> 'email') in ('global@amorconsciente.com','noris@amorconsciente.com') );

do $$
begin
  begin execute 'alter publication supabase_realtime add table public.rfp_log;';
  exception when duplicate_object then null; end;
end $$;

-- ============================================================
--  Fin. El envío de RFP escribe aquí con la llave de servicio
--  (service role) desde /api/rfp-send; la app lo lee para el historial.
-- ============================================================
