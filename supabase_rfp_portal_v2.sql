-- ============================================================
--  AC-Venues · RFP portal v2
--  (1) Validez de la propuesta (rfp_offers.valid_until)
--  (2) Rechazar invitación (rfp_invites.status='declined' + decline_notes)
--  Recrea get_rfp / submit_rfp e agrega decline_rfp. Idempotente.
-- ============================================================

alter table public.rfp_offers  add column if not exists valid_until   text default '';
alter table public.rfp_invites add column if not exists decline_notes text default '';

-- ---------- get_rfp: ahora devuelve decline_notes ----------
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
    'decline_notes', coalesce(inv.decline_notes,''),
    'lang', coalesce(req.lang,'en'),
    'requirements', coalesce(req.requirements, '{}'::jsonb),
    'concessions',  coalesce(req.concessions,  '[]'::jsonb),
    'response', case when off.id is not null then to_jsonb(off) else null end
  );
end; $$;
revoke all on function public.get_rfp(text) from public;
grant execute on function public.get_rfp(text) to anon, authenticated;

-- ---------- submit_rfp: guarda valid_until (y des-declina al enviar) ----------
create or replace function public.submit_rfp(p_token text, p_payload jsonb)
returns json language plpgsql security definer set search_path=public as $$
declare inv public.rfp_invites; oid uuid;
begin
  select * into inv from public.rfp_invites where token = p_token;
  if not found then return json_build_object('ok', false, 'error', 'token_invalido'); end if;

  insert into public.rfp_offers as o
    (invite_id, request_id, date_id, venue, contact_name, contact_email, contact_phone,
     available, room_name, capacity, room_rental, fb_minimum, deposit, total_estimate,
     valid_until, concessions, files, notes, submitted_at, updated_at)
  values
    (inv.id, inv.request_id, inv.date_id,
     coalesce(nullif(p_payload->>'venue',''), inv.venue),
     p_payload->>'contact_name', p_payload->>'contact_email', p_payload->>'contact_phone',
     p_payload->>'available', p_payload->>'room_name', p_payload->>'capacity',
     nullif(p_payload->>'room_rental','')::numeric, nullif(p_payload->>'fb_minimum','')::numeric,
     p_payload->>'deposit', nullif(p_payload->>'total_estimate','')::numeric,
     p_payload->>'valid_until',
     coalesce(p_payload->'concessions','[]'::jsonb), coalesce(p_payload->'files','[]'::jsonb),
     p_payload->>'notes', now(), now())
  on conflict (invite_id) do update set
     venue=excluded.venue, contact_name=excluded.contact_name, contact_email=excluded.contact_email,
     contact_phone=excluded.contact_phone, available=excluded.available, room_name=excluded.room_name,
     capacity=excluded.capacity, room_rental=excluded.room_rental, fb_minimum=excluded.fb_minimum,
     deposit=excluded.deposit, total_estimate=excluded.total_estimate, valid_until=excluded.valid_until,
     concessions=excluded.concessions, files=excluded.files, notes=excluded.notes, updated_at=now()
  returning o.id into oid;

  update public.rfp_invites set status='responded', decline_notes='' where id = inv.id and status <> 'won';
  return json_build_object('ok', true, 'id', oid);
end; $$;
revoke all on function public.submit_rfp(text, jsonb) from public;
grant execute on function public.submit_rfp(text, jsonb) to anon, authenticated;

-- ---------- decline_rfp: el hotel rechaza la invitación ----------
create or replace function public.decline_rfp(p_token text, p_notes text)
returns json language plpgsql security definer set search_path=public as $$
declare inv public.rfp_invites;
begin
  select * into inv from public.rfp_invites where token = p_token;
  if not found then return json_build_object('ok', false, 'error', 'token_invalido'); end if;
  update public.rfp_invites
     set status='declined', decline_notes=coalesce(p_notes,'')
   where id = inv.id and status <> 'won';
  return json_build_object('ok', true);
end; $$;
revoke all on function public.decline_rfp(text, text) from public;
grant execute on function public.decline_rfp(text, text) to anon, authenticated;

-- ============================================================
--  Fin v2.
-- ============================================================
