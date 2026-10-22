-- AC Venues / Ficha pública: exclusivamente layouts asociados al token de ficha.
-- Deploy in Supabase SQL Editor (same project as event_sheet).
-- No public SELECT granted on room_layouts; this restricted SECURITY DEFINER
-- function is the only anon read path for published event layouts.
create or replace function public.get_ficha_layouts(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  event_uuid uuid;
begin
  -- Accept only tokens that resolve to a current public event fiche.
  if p_token is null or length(p_token) < 20 then
    return '[]'::jsonb;
  end if;
  select es.date_id into event_uuid
  from public.event_sheet es
  where es.sheet_token = p_token
  limit 1;
  if event_uuid is null then
    return '[]'::jsonb;
  end if;

  -- Minimal, allowlisted snapshot: coordinates, models, physical room info.
  -- No internal metadata, staff emails, saved reports or unrelated events.
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', l.id,
      'venue', l.venue,
      'room_name', l.room_name,
      'layout_name', coalesce(l.data #>> '{params,layout}', l.layout_id),
      'updated_at', l.updated_at,
      'snapshot', jsonb_build_object(
        'room', l.data -> 'room',
        'objects', l.data -> 'objects',
        'params', jsonb_build_object('layout',l.data #>> '{params,layout}')
      )
    ) order by l.updated_at desc)
    from public.room_layouts l
    where l.data #>> '{params,eventDateId}' = event_uuid::text
  ), '[]'::jsonb);
end;
$$;
revoke all on function public.get_ficha_layouts(text) from public;
grant execute on function public.get_ficha_layouts(text) to anon, authenticated;
