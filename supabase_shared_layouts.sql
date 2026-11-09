-- ============================================================
--  AC-Venues · Enlaces CORTOS para la revisión de diagramas
--  Guarda el diagrama (solo lectura) en una tabla con un token
--  aleatorio y corto. El portal público layout-review.html lo lee
--  por token mediante un RPC SECURITY DEFINER (sin login).
--  Idempotente: se puede correr varias veces.
-- ============================================================

create table if not exists public.shared_layouts (
  token      text primary key,
  payload    jsonb not null,
  created_by text default '',
  created_at timestamptz not null default now()
);

alter table public.shared_layouts enable row level security;

-- El equipo (admins/colaboradores) crea y ve los enlaces. La lectura
-- pública NO pasa por aquí: va por el RPC de abajo (SECURITY DEFINER).
drop policy if exists sl_team_all on public.shared_layouts;
create policy sl_team_all on public.shared_layouts for all to authenticated
  using (public.ac_is_team()) with check (public.ac_is_team());

-- Lectura pública por token (vendors sin cuenta). Devuelve solo el diagrama.
create or replace function public.get_shared_layout(p_token text)
  returns jsonb
  language sql stable security definer set search_path = public as $$
  select payload from public.shared_layouts where token = p_token limit 1;
$$;

grant execute on function public.get_shared_layout(text) to anon, authenticated;

-- ============================================================
--  Tras correr esto, los enlaces nuevos quedan cortos, por ejemplo:
--  https://ac-venues.luigihernandez.com/layout-review.html#t=ab3k9m2xqp
--  Los enlaces largos antiguos siguen funcionando igual.
-- ============================================================
