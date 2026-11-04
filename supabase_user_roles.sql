-- ============================================================
--  AC-Venues · FASE 1 — Cuentas con accesos limitados (roles)
--  Admin (tú/Noris) = acceso total · Colaborador = ve todo,
--  edita SOLO sus eventos asignados (diagrama, notas, archivos,
--  disponibilidad, evaluación). Diseño ADITIVO y seguro:
--   • NO borra ninguna política existente (admins nunca pierden acceso).
--   • Las funciones tienen respaldo por correo de los 2 admins actuales.
--   • Los portales públicos (RFP/ficha/encuesta) usan RPCs SECURITY
--     DEFINER, así que no se ven afectados.
--  Idempotente: se puede correr varias veces sin problema.
-- ============================================================

-- ---------- 1) Tablas de roles y asignaciones ----------
create table if not exists public.app_users (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  email      text not null default '',
  role       text not null default 'collab',   -- 'admin' | 'collab'
  name       text default '',
  active     boolean not null default true,
  created_by text default '',
  created_at timestamptz not null default now()
);

create table if not exists public.event_assignments (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  date_id    uuid not null references public.event_dates(id) on delete cascade,
  created_by text default '',
  created_at timestamptz not null default now(),
  unique (user_id, date_id)
);
create index if not exists ea_user_idx on public.event_assignments(user_id);
create index if not exists ea_date_idx on public.event_assignments(date_id);

-- ---------- 2) Funciones de ayuda (SECURITY DEFINER) ----------
-- Respaldo por correo: los 2 admins actuales siempre pasan, aunque aún no estén
-- sembrados en app_users. Así es imposible quedarse sin acceso de admin.
create or replace function public.ac_is_admin() returns boolean
  language sql stable security definer set search_path = public as $$
  select coalesce((auth.jwt() ->> 'email'),'') in ('global@amorconsciente.com','noris@amorconsciente.com')
      or exists (select 1 from public.app_users u
                 where u.user_id = auth.uid() and u.role = 'admin' and u.active);
$$;

create or replace function public.ac_is_team() returns boolean
  language sql stable security definer set search_path = public as $$
  select coalesce((auth.jwt() ->> 'email'),'') in ('global@amorconsciente.com','noris@amorconsciente.com')
      or exists (select 1 from public.app_users u
                 where u.user_id = auth.uid() and u.active);
$$;

create or replace function public.ac_is_assigned(p_date uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select public.ac_is_admin()
      or exists (select 1 from public.event_assignments a
                 where a.user_id = auth.uid() and a.date_id = p_date);
$$;

-- ---------- 3) Sembrar a los 2 admins actuales ----------
insert into public.app_users (user_id, email, role, name, active)
select id, email, 'admin', coalesce(raw_user_meta_data->>'name',''), true
from auth.users
where lower(email) in ('global@amorconsciente.com','noris@amorconsciente.com')
on conflict (user_id) do update set role = 'admin', active = true;

-- ---------- 4) RLS de las tablas nuevas ----------
alter table public.app_users enable row level security;
drop policy if exists ac_sel_app_users on public.app_users;
drop policy if exists ac_wr_app_users  on public.app_users;
create policy ac_sel_app_users on public.app_users for select to authenticated using (public.ac_is_team());
create policy ac_wr_app_users  on public.app_users for all   to authenticated using (public.ac_is_admin()) with check (public.ac_is_admin());

alter table public.event_assignments enable row level security;
drop policy if exists ac_sel_event_assignments on public.event_assignments;
drop policy if exists ac_wr_event_assignments  on public.event_assignments;
-- cada quien puede ver sus asignaciones; el admin ve y edita todas
create policy ac_sel_event_assignments on public.event_assignments for select to authenticated
  using (public.ac_is_admin() or user_id = auth.uid());
create policy ac_wr_event_assignments on public.event_assignments for all to authenticated
  using (public.ac_is_admin()) with check (public.ac_is_admin());

-- ---------- 5) Columna de evento para diagramas (aditiva) ----------
-- Vincula un montaje a una fecha, para permitir edición por colaborador asignado.
alter table public.room_layouts add column if not exists date_id uuid references public.event_dates(id) on delete set null;

-- ---------- 6) Abrir LECTURA a todo el equipo (aditivo) ----------
-- Agrega una política de SELECT amplia a cada tabla del equipo. NO borra las
-- políticas existentes (que ya permiten a los admins); solo sumа el acceso de
-- lectura para colaboradores activos. (Postgres combina políticas con OR.)
do $$
declare t text;
  tbls text[] := array[
    'event_dates','date_progress','date_meta','contacts','status_notes','deadlines',
    'global_tasks','documents','venue_evals','company_info','audit_log','venues',
    'event_recipients','date_venue_status','survey_tokens','event_sheet','event_files',
    'event_payments','event_offers','calendar_items','rfp_log','custom_cities',
    'rfp_requests','rfp_invites','rfp_offers','ac_people','room_layouts'];
begin
  foreach t in array tbls loop
    if to_regclass('public.'||t) is null then continue; end if;
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', 'ac_sel_'||t, t);
    execute format('create policy %I on public.%I for select to authenticated using (public.ac_is_team())', 'ac_sel_'||t, t);
  end loop;
end $$;

-- ---------- 7) ESCRITURA por asignación en los módulos del colaborador ----------
-- Aditivo: estas políticas permiten que un colaborador ASIGNADO a la fecha
-- escriba en esos módulos. Los admins siguen escribiendo por sus políticas
-- existentes (y por ac_is_admin dentro de ac_is_assigned).
drop policy if exists ac_wr_date_meta on public.date_meta;
create policy ac_wr_date_meta on public.date_meta for all to authenticated
  using (public.ac_is_assigned(date_id)) with check (public.ac_is_assigned(date_id));

drop policy if exists ac_wr_event_files on public.event_files;
create policy ac_wr_event_files on public.event_files for all to authenticated
  using (public.ac_is_assigned(date_id)) with check (public.ac_is_assigned(date_id));

drop policy if exists ac_wr_date_venue_status on public.date_venue_status;
create policy ac_wr_date_venue_status on public.date_venue_status for all to authenticated
  using (public.ac_is_assigned(date_id)) with check (public.ac_is_assigned(date_id));

drop policy if exists ac_wr_venue_evals on public.venue_evals;
create policy ac_wr_venue_evals on public.venue_evals for all to authenticated
  using (public.ac_is_assigned(date_id)) with check (public.ac_is_assigned(date_id));

-- Diagramas: admin, o colaborador asignado a la fecha vinculada (date_id).
drop policy if exists ac_wr_room_layouts on public.room_layouts;
create policy ac_wr_room_layouts on public.room_layouts for all to authenticated
  using (public.ac_is_admin() or (date_id is not null and public.ac_is_assigned(date_id)))
  with check (public.ac_is_admin() or (date_id is not null and public.ac_is_assigned(date_id)));

-- El registro de actividad debe aceptar inserciones de cualquier miembro del
-- equipo (al editar sus notas se registra la acción). Borrar/editar sigue solo-admin.
drop policy if exists ac_ins_audit_log on public.audit_log;
create policy ac_ins_audit_log on public.audit_log for insert to authenticated with check (public.ac_is_team());

-- ---------- 8) Realtime para las tablas nuevas ----------
do $$
begin
  begin execute 'alter publication supabase_realtime add table public.app_users;'; exception when duplicate_object then null; end;
  begin execute 'alter publication supabase_realtime add table public.event_assignments;'; exception when duplicate_object then null; end;
end $$;

-- ============================================================
--  Fin Fase 1. Tras correr esto: los admins trabajan igual que hoy;
--  los colaboradores (cuando el admin los cree y asigne en la Fase 3)
--  verán todo y editarán solo sus eventos asignados.
-- ============================================================
