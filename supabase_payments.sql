-- ============================================================
--  AC-Venues · Pagos por evento (SECCIÓN INTERNA)
--  Nunca se expone en la ficha ni por RPC pública: solo el equipo
--  autorizado la ve. Idempotente.
-- ============================================================

create table if not exists public.event_payments (
  date_id      uuid primary key references public.event_dates(id) on delete cascade,
  total_amount numeric,                       -- total del contrato (opcional)
  currency     text default 'USD',
  entries      jsonb not null default '[]'::jsonb,  -- [{date, concept, amount, method, ref}]
  notes        text default '',
  updated_at   timestamptz not null default now()
);

alter table public.event_payments enable row level security;

drop policy if exists "team_read_event_payments"  on public.event_payments;
drop policy if exists "team_write_event_payments" on public.event_payments;
create policy "team_read_event_payments" on public.event_payments for select to authenticated
  using ( (auth.jwt() ->> 'email') in ('global@amorconsciente.com','noris@amorconsciente.com') );
create policy "team_write_event_payments" on public.event_payments for all to authenticated
  using ( (auth.jwt() ->> 'email') in ('global@amorconsciente.com','noris@amorconsciente.com') )
  with check ( (auth.jwt() ->> 'email') in ('global@amorconsciente.com','noris@amorconsciente.com') );

do $$
begin
  begin execute 'alter publication supabase_realtime add table public.event_payments;';
  exception when duplicate_object then null; end;
end $$;

-- ============================================================
--  Fin. La sección de pagos vive solo dentro de la app (equipo).
-- ============================================================
