-- ============================================================
--  AC-Venues · Enlace VIVO de la ficha técnica
--  Token estable por evento + RPC pública (sin login) que devuelve
--  la ficha ACTUAL. El correo lleva el enlace; los cambios se ven
--  al instante sin reenviar. Idempotente.
-- ============================================================

-- 1) Token estable por evento
alter table public.event_sheet add column if not exists sheet_token text;
update public.event_sheet
   set sheet_token = replace(gen_random_uuid()::text,'-','')
 where sheet_token is null or sheet_token = '';
alter table public.event_sheet alter column sheet_token set default replace(gen_random_uuid()::text,'-','');
create unique index if not exists event_sheet_token_idx on public.event_sheet(sheet_token);

-- 2) RPC pública (security definer): devuelve la ficha actual por token
create or replace function public.get_sheet(p_token text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  s      public.event_sheet;
  ed     public.event_dates;
  recips json;
  files  json;
begin
  select * into s from public.event_sheet where sheet_token = p_token;
  if not found then
    return json_build_object('ok', false, 'error', 'token_invalido');
  end if;
  select * into ed from public.event_dates where id = s.date_id;
  select json_agg(json_build_object('name', name, 'role', role) order by created_at)
    into recips from public.event_recipients where date_id = s.date_id;
  select json_agg(json_build_object('name', name, 'url', url) order by created_at)
    into files from public.event_files where date_id = s.date_id and share = true;
  return json_build_object(
    'ok', true,
    'event_label',        coalesce(ed.label,''),
    'start_date',         ed.start_date,
    'end_date',           ed.end_date,
    'hotel_name',         coalesce(s.hotel_name,''),
    'room_name',          coalesce(s.room_name,''),
    'address',            coalesce(s.address,''),
    'map_url',            coalesce(s.map_url,''),
    'contact_name',       coalesce(s.contact_name,''),
    'contact_phone',      coalesce(s.contact_phone,''),
    'parking_cost',       coalesce(s.parking_cost,''),
    'parking_reentry',    coalesce(s.parking_reentry,''),
    'wifi_included',      coalesce(s.wifi_included,''),
    'greenroom_included', coalesce(s.greenroom_included,''),
    'setup_time',         coalesce(s.setup_time,''),
    'contract_url',       coalesce(s.contract_url,''),
    'notes',              coalesce(s.notes,''),
    'updated_at',         s.updated_at,
    'recipients',         coalesce(recips, '[]'::json),
    'files',              coalesce(files,  '[]'::json)
  );
end;
$$;
revoke all on function public.get_sheet(text) from public;
grant execute on function public.get_sheet(text) to anon, authenticated;

-- ============================================================
--  Fin. La página /ficha.html?t=TOKEN ya puede leer la ficha en vivo.
-- ============================================================
