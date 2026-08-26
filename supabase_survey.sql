-- ============================================================
--  AC-Venues · Encuestas de evaluación de hoteles a líderes/speakers
--  Idempotente. Ejecuta TODO en Supabase → SQL Editor → New query → Run.
-- ============================================================

-- ---------- 1) Fechas reales por evento ----------
alter table public.event_dates add column if not exists start_date     date;
alter table public.event_dates add column if not exists end_date       date;
alter table public.event_dates add column if not exists survey_sent_at timestamptz;   -- marca de envío (auto/manual) para no duplicar

-- Backfill (año 2026) a partir de las etiquetas actuales. Sólo rellena si está vacío.
update public.event_dates set start_date='2026-09-09', end_date='2026-09-13' where id='6a33b2f7-789c-438f-ac6c-2e555c9ce1bc' and end_date is null;
update public.event_dates set start_date='2026-10-07', end_date='2026-10-11' where id='fe963c77-c852-4118-a894-ec463b0bf082' and end_date is null;
update public.event_dates set start_date='2026-11-04', end_date='2026-11-08' where id='e0d3a9f1-abe8-43e8-ab36-23ae24f2d428' and end_date is null;
update public.event_dates set start_date='2026-09-23', end_date='2026-09-27' where id='532a7e72-7f59-4617-a86a-7bee05b404ba' and end_date is null;
update public.event_dates set start_date='2026-10-21', end_date='2026-10-25' where id='61984200-c841-4d51-9dc9-71a125144e9d' and end_date is null;
update public.event_dates set start_date='2026-09-09', end_date='2026-09-13' where id='abee8b1d-30de-46be-9035-f09049babc18' and end_date is null;
update public.event_dates set start_date='2026-10-07', end_date='2026-10-11' where id='4c101e9a-5c3f-4ee6-9035-65cf1081096b' and end_date is null;
update public.event_dates set start_date='2026-11-04', end_date='2026-11-08' where id='5571ef89-8115-4e0a-8ecc-275cbafac7f7' and end_date is null;
update public.event_dates set start_date='2026-09-16', end_date='2026-09-20' where id='c42947f1-55a5-49d7-a476-d53fb1eaa299' and end_date is null;
update public.event_dates set start_date='2026-10-14', end_date='2026-10-18' where id='f5af4aed-7ceb-4446-a38f-20be197f8746' and end_date is null;
update public.event_dates set start_date='2026-09-02', end_date='2026-09-06' where id='59662282-f055-4113-a061-865a50f9719b' and end_date is null;
update public.event_dates set start_date='2026-09-30', end_date='2026-10-04' where id='60413b92-2e2b-4692-983b-a06d05f938eb' and end_date is null;
update public.event_dates set start_date='2026-10-28', end_date='2026-11-01' where id='8f546dab-8b2c-4ca3-a416-1e3f14646ea3' and end_date is null;
update public.event_dates set start_date='2026-09-16', end_date='2026-09-20' where id='dd9927b1-e0fe-4212-8981-9595925095e8' and end_date is null;
update public.event_dates set start_date='2026-10-14', end_date='2026-10-18' where id='07ab7562-abff-4007-9d52-ed54dcf09cdf' and end_date is null;
update public.event_dates set start_date='2026-09-23', end_date='2026-09-27' where id='04594e6d-fdba-42a9-b0e8-c6a6c5b00a10' and end_date is null;
update public.event_dates set start_date='2026-10-21', end_date='2026-10-25' where id='dd1f11c1-fa7f-4efd-ab6a-eef97508c03a' and end_date is null;
update public.event_dates set start_date='2026-08-26', end_date='2026-08-30' where id='c311a7fb-d9ac-4eef-8a61-ea05410f5242' and end_date is null;
update public.event_dates set start_date='2026-09-02', end_date='2026-09-06' where id='5b49d4fb-275f-4ee9-ab03-76301b5a4502' and end_date is null;
update public.event_dates set start_date='2026-09-30', end_date='2026-10-04' where id='392a5ff1-b8f4-40dd-8449-c3fc10e91cbc' and end_date is null;
update public.event_dates set start_date='2026-10-28', end_date='2026-11-01' where id='24cd1cd5-89d7-49aa-9a66-f1e6016bc306' and end_date is null;

-- ---------- 2) venue_evals: soportar reviews de encuesta ----------
alter table public.venue_evals add column if not exists respondent_name  text default '';
alter table public.venue_evals add column if not exists respondent_email text default '';
alter table public.venue_evals add column if not exists source           text default 'equipo';   -- 'equipo' | 'encuesta'
alter table public.venue_evals add column if not exists survey_token     text;                     -- vincula la respuesta a su token

-- ---------- 3) Destinatarios (líderes / speakers) por evento ----------
create table if not exists public.event_recipients (
  id         uuid primary key default gen_random_uuid(),
  date_id    uuid not null references public.event_dates(id) on delete cascade,
  name       text default '',
  email      text default '',
  role       text default '',
  created_at timestamptz not null default now()
);
create index if not exists event_recipients_date_idx on public.event_recipients(date_id);

-- ---------- 4) Tokens de encuesta (enlace único por destinatario/evento/hotel) ----------
create table if not exists public.survey_tokens (
  token           text primary key,
  date_id         uuid not null references public.event_dates(id) on delete cascade,
  city_slug       text default '',
  event_label     text default '',
  venue_name      text default '',
  recipient_name  text default '',
  recipient_email text default '',
  sent_at         timestamptz,
  responded_at    timestamptz,
  created_at      timestamptz not null default now()
);
create index if not exists survey_tokens_date_idx on public.survey_tokens(date_id);

-- ---------- 5) Row Level Security (sólo el equipo autorizado) ----------
alter table public.event_recipients enable row level security;
alter table public.survey_tokens    enable row level security;

do $$
declare t text;
begin
  foreach t in array array['event_recipients','survey_tokens']
  loop
    execute format('drop policy if exists "team_read_%1$s"  on public.%1$s;', t);
    execute format('drop policy if exists "team_write_%1$s" on public.%1$s;', t);
    execute format($f$create policy "team_read_%1$s" on public.%1$s for select to authenticated
                     using ( (auth.jwt() ->> 'email') in ('global@amorconsciente.com','noris@amorconsciente.com') );$f$, t);
    execute format($f$create policy "team_write_%1$s" on public.%1$s for all to authenticated
                     using ( (auth.jwt() ->> 'email') in ('global@amorconsciente.com','noris@amorconsciente.com') )
                     with check ( (auth.jwt() ->> 'email') in ('global@amorconsciente.com','noris@amorconsciente.com') );$f$, t);
  end loop;
end $$;

-- ---------- 6) Realtime ----------
do $$
declare t text;
begin
  foreach t in array array['event_recipients','survey_tokens']
  loop
    begin execute format('alter publication supabase_realtime add table public.%I;', t);
    exception when duplicate_object then null; end;
  end loop;
end $$;

-- ---------- 7) RPCs públicas (security definer) para la página de encuesta ----------
-- La página pública NO tiene login: usa estas funciones por token. Corren como owner (saltan RLS).

create or replace function public.get_survey(p_token text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare r public.survey_tokens;
begin
  select * into r from public.survey_tokens where token = p_token;
  if not found then
    return json_build_object('ok', false, 'error', 'token_invalido');
  end if;
  return json_build_object(
    'ok', true,
    'event_label', r.event_label,
    'city_slug', r.city_slug,
    'venue_name', r.venue_name,
    'recipient_name', r.recipient_name,
    'responded', (r.responded_at is not null)
  );
end;
$$;

create or replace function public.submit_survey(p_token text, p_scores jsonb, p_notes text, p_name text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  r   public.survey_tokens;
  nm  text;
  eid uuid;
begin
  select * into r from public.survey_tokens where token = p_token;
  if not found then
    return json_build_object('ok', false, 'error', 'token_invalido');
  end if;

  nm := coalesce(nullif(trim(p_name), ''), r.recipient_name, '');

  -- ¿Ya existe la respuesta de este token? -> actualizar. Si no -> insertar.
  select id into eid from public.venue_evals where survey_token = p_token limit 1;

  if eid is not null then
    update public.venue_evals
      set scores = p_scores, notes = coalesce(p_notes,''), respondent_name = nm, updated_at = now()
      where id = eid;
  else
    insert into public.venue_evals (date_id, city_slug, venue_name, scores, notes,
                                    respondent_name, respondent_email, source, survey_token)
    values (r.date_id, r.city_slug, r.venue_name, p_scores, coalesce(p_notes,''),
            nm, r.recipient_email, 'encuesta', p_token);
  end if;

  update public.survey_tokens set responded_at = now() where token = p_token;
  return json_build_object('ok', true);
end;
$$;

-- Permitir que el rol anónimo (página pública) ejecute SÓLO estas dos funciones.
revoke all on function public.get_survey(text) from public;
revoke all on function public.submit_survey(text, jsonb, text, text) from public;
grant execute on function public.get_survey(text) to anon, authenticated;
grant execute on function public.submit_survey(text, jsonb, text, text) to anon, authenticated;

-- ============================================================
--  Fin. Tablas, columnas y RPCs listas para las encuestas.
-- ============================================================
