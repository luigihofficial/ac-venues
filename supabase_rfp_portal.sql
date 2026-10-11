-- ============================================================
--  AC-Venues · RFP de punta a punta
--  rfp_requests  (campaña por evento: requisitos + concesiones)
--  rfp_invites   (un hotel invitado, con token para el portal)
--  rfp_offers    (respuesta del hotel, estructurada + archivos)
--  RPCs públicas (token) para el portal del hotel. Storage para archivos.
--  RLS solo equipo en las tablas. Idempotente.
-- ============================================================

create table if not exists public.rfp_requests (
  id            uuid primary key default gen_random_uuid(),
  date_id       uuid references public.event_dates(id) on delete set null,
  city_slug     text default '',
  lang          text default 'en',
  requirements  jsonb not null default '{}'::jsonb,
  concessions   jsonb not null default '[]'::jsonb,   -- [{key,label}]
  created_by    text default '',
  created_at    timestamptz not null default now()
);

create table if not exists public.rfp_invites (
  id          uuid primary key default gen_random_uuid(),
  request_id  uuid references public.rfp_requests(id) on delete cascade,
  date_id     uuid,
  token       text unique not null,
  to_email    text not null,
  to_name     text default '',
  venue       text default '',
  status      text default 'sent',   -- sent | responded | won
  created_at  timestamptz not null default now()
);
create index if not exists rfp_invites_req_idx  on public.rfp_invites(request_id);
create index if not exists rfp_invites_date_idx on public.rfp_invites(date_id);

create table if not exists public.rfp_offers (
  id             uuid primary key default gen_random_uuid(),
  invite_id      uuid unique references public.rfp_invites(id) on delete cascade,
  request_id     uuid,
  date_id        uuid,
  venue          text default '',
  contact_name   text default '',
  contact_email  text default '',
  contact_phone  text default '',
  available      text default '',
  room_name      text default '',
  capacity       text default '',
  room_rental    numeric,
  fb_minimum     numeric,
  deposit        text default '',
  total_estimate numeric,
  concessions    jsonb not null default '[]'::jsonb,   -- [{key,label,status,amount,notes}]
  files          jsonb not null default '[]'::jsonb,   -- [{name,url}]
  notes          text default '',
  submitted_at   timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists rfp_offers_date_idx on public.rfp_offers(date_id);
create index if not exists rfp_offers_req_idx  on public.rfp_offers(request_id);

-- ---------- RLS (solo equipo) ----------
do $$ begin
  perform 1;
  execute 'alter table public.rfp_requests enable row level security';
  execute 'alter table public.rfp_invites  enable row level security';
  execute 'alter table public.rfp_offers   enable row level security';
end $$;

drop policy if exists "team_all_rfp_requests" on public.rfp_requests;
drop policy if exists "team_all_rfp_invites"  on public.rfp_invites;
drop policy if exists "team_all_rfp_offers"   on public.rfp_offers;
create policy "team_all_rfp_requests" on public.rfp_requests for all to authenticated
  using ( (auth.jwt() ->> 'email') in ('global@amorconsciente.com','noris@amorconsciente.com') )
  with check ( (auth.jwt() ->> 'email') in ('global@amorconsciente.com','noris@amorconsciente.com') );
create policy "team_all_rfp_invites" on public.rfp_invites for all to authenticated
  using ( (auth.jwt() ->> 'email') in ('global@amorconsciente.com','noris@amorconsciente.com') )
  with check ( (auth.jwt() ->> 'email') in ('global@amorconsciente.com','noris@amorconsciente.com') );
create policy "team_all_rfp_offers" on public.rfp_offers for all to authenticated
  using ( (auth.jwt() ->> 'email') in ('global@amorconsciente.com','noris@amorconsciente.com') )
  with check ( (auth.jwt() ->> 'email') in ('global@amorconsciente.com','noris@amorconsciente.com') );

do $$
begin
  begin execute 'alter publication supabase_realtime add table public.rfp_requests'; exception when duplicate_object then null; end;
  begin execute 'alter publication supabase_realtime add table public.rfp_invites';  exception when duplicate_object then null; end;
  begin execute 'alter publication supabase_realtime add table public.rfp_offers';   exception when duplicate_object then null; end;
end $$;

-- ---------- RPC pública: el portal lee lo que pedimos ----------
create or replace function public.get_rfp(p_token text)
returns json language plpgsql security definer set search_path=public as $$
declare inv public.rfp_invites; req public.rfp_requests; off public.rfp_offers;
begin
  select * into inv from public.rfp_invites where token = p_token;
  if not found then return json_build_object('ok', false, 'error', 'token_invalido'); end if;
  select * into req from public.rfp_requests where id = inv.request_id;
  select * into off from public.rfp_offers   where invite_id = inv.id;
  return json_build_object(
    'ok', true,
    'venue', inv.venue, 'to_name', inv.to_name, 'status', inv.status,
    'lang', coalesce(req.lang,'en'),
    'requirements', coalesce(req.requirements, '{}'::jsonb),
    'concessions',  coalesce(req.concessions,  '[]'::jsonb),
    'response', case when off.id is not null then to_jsonb(off) else null end
  );
end; $$;
revoke all on function public.get_rfp(text) from public;
grant execute on function public.get_rfp(text) to anon, authenticated;

-- ---------- RPC pública: el portal guarda la respuesta del hotel ----------
create or replace function public.submit_rfp(p_token text, p_payload jsonb)
returns json language plpgsql security definer set search_path=public as $$
declare inv public.rfp_invites; oid uuid;
begin
  select * into inv from public.rfp_invites where token = p_token;
  if not found then return json_build_object('ok', false, 'error', 'token_invalido'); end if;

  insert into public.rfp_offers as o
    (invite_id, request_id, date_id, venue, contact_name, contact_email, contact_phone,
     available, room_name, capacity, room_rental, fb_minimum, deposit, total_estimate,
     concessions, files, notes, submitted_at, updated_at)
  values
    (inv.id, inv.request_id, inv.date_id,
     coalesce(nullif(p_payload->>'venue',''), inv.venue),
     p_payload->>'contact_name', p_payload->>'contact_email', p_payload->>'contact_phone',
     p_payload->>'available', p_payload->>'room_name', p_payload->>'capacity',
     nullif(p_payload->>'room_rental','')::numeric, nullif(p_payload->>'fb_minimum','')::numeric,
     p_payload->>'deposit', nullif(p_payload->>'total_estimate','')::numeric,
     coalesce(p_payload->'concessions','[]'::jsonb), coalesce(p_payload->'files','[]'::jsonb),
     p_payload->>'notes', now(), now())
  on conflict (invite_id) do update set
     venue=excluded.venue, contact_name=excluded.contact_name, contact_email=excluded.contact_email,
     contact_phone=excluded.contact_phone, available=excluded.available, room_name=excluded.room_name,
     capacity=excluded.capacity, room_rental=excluded.room_rental, fb_minimum=excluded.fb_minimum,
     deposit=excluded.deposit, total_estimate=excluded.total_estimate, concessions=excluded.concessions,
     files=excluded.files, notes=excluded.notes, updated_at=now()
  returning o.id into oid;

  update public.rfp_invites set status='responded' where id = inv.id and status <> 'won';
  return json_build_object('ok', true, 'id', oid);
end; $$;
revoke all on function public.submit_rfp(text, jsonb) from public;
grant execute on function public.submit_rfp(text, jsonb) to anon, authenticated;

-- ---------- Storage: bucket público para archivos del hotel ----------
insert into storage.buckets (id, name, public) values ('rfp-uploads','rfp-uploads', true)
  on conflict (id) do update set public = true;
drop policy if exists "rfp_uploads_insert" on storage.objects;
drop policy if exists "rfp_uploads_read"   on storage.objects;
create policy "rfp_uploads_insert" on storage.objects for insert to anon, authenticated
  with check ( bucket_id = 'rfp-uploads' );
create policy "rfp_uploads_read" on storage.objects for select to anon, authenticated
  using ( bucket_id = 'rfp-uploads' );

-- ============================================================
--  Fin. El portal /rfp-portal.html?t=TOKEN usa get_rfp/submit_rfp
--  y sube archivos al bucket rfp-uploads.
-- ============================================================
