-- ============================================================
--  AC-Venues · Ofertas recibidas por evento (SECCIÓN INTERNA)
--  Página propia (no aparece en la ficha). Se elige una ganadora
--  y de ahí se llenan los datos del evento. Idempotente.
-- ============================================================

create table if not exists public.event_offers (
  id                 uuid primary key default gen_random_uuid(),
  date_id            uuid not null references public.event_dates(id) on delete cascade,
  venue              text default '',
  total_amount       numeric,
  deposit            text default '',
  room_name          text default '',
  address            text default '',
  map_url            text default '',
  contact_name       text default '',
  contact_phone      text default '',
  parking_cost       text default '',
  parking_reentry    text default '',   -- 'si' | 'no' | ''
  wifi_included      text default '',
  greenroom_included text default '',
  setup_time         text default '',
  notes              text default '',
  is_winner          boolean default false,
  created_at         timestamptz not null default now()
);
create index if not exists event_offers_date_idx on public.event_offers(date_id);

alter table public.event_offers enable row level security;
drop policy if exists "team_read_event_offers"  on public.event_offers;
drop policy if exists "team_write_event_offers" on public.event_offers;
create policy "team_read_event_offers" on public.event_offers for select to authenticated
  using ( (auth.jwt() ->> 'email') in ('global@amorconsciente.com','noris@amorconsciente.com') );
create policy "team_write_event_offers" on public.event_offers for all to authenticated
  using ( (auth.jwt() ->> 'email') in ('global@amorconsciente.com','noris@amorconsciente.com') )
  with check ( (auth.jwt() ->> 'email') in ('global@amorconsciente.com','noris@amorconsciente.com') );

do $$
begin
  begin execute 'alter publication supabase_realtime add table public.event_offers;';
  exception when duplicate_object then null; end;
end $$;

-- ============================================================
--  Fin. Las ofertas viven solo dentro de la app (equipo).
-- ============================================================
