-- ============================================================
--  AC-Venues · Candado anti-duplicados de contactos
--  Regla: es duplicado si coincide el NOMBRE y además el
--  TELÉFONO o la DIRECCIÓN; o si coinciden a la vez teléfono
--  y dirección. Los campos vacíos no cuentan como coincidencia.
--  Comparación normalizada (sin mayúsculas, espacios colapsados;
--  teléfono solo por dígitos). Idempotente.
-- ============================================================

create or replace function public.ac_contacts_no_dup()
returns trigger
language plpgsql
as $$
declare
  nn text;  -- nombre normalizado
  np text;  -- teléfono normalizado (solo dígitos)
  na text;  -- dirección normalizada
begin
  nn := lower(regexp_replace(trim(coalesce(NEW.name,'')),    '\s+', ' ', 'g'));
  np := regexp_replace(coalesce(NEW.phone,''),               '[^0-9]', '', 'g');
  na := lower(regexp_replace(trim(coalesce(NEW.address,'')), '\s+', ' ', 'g'));

  -- En UPDATE, si no cambiaron nombre/teléfono/dirección, no re-verificar
  if TG_OP = 'UPDATE'
     and lower(regexp_replace(trim(coalesce(OLD.name,'')),    '\s+',' ','g')) = nn
     and regexp_replace(coalesce(OLD.phone,''),               '[^0-9]','','g') = np
     and lower(regexp_replace(trim(coalesce(OLD.address,'')), '\s+',' ','g')) = na
  then
    return NEW;
  end if;

  if exists (
    select 1 from public.contacts c
    where c.id is distinct from NEW.id
      and (
        -- nombre + (teléfono o dirección)
        ( nn <> ''
          and lower(regexp_replace(trim(coalesce(c.name,'')),'\s+',' ','g')) = nn
          and (
            ( np <> '' and regexp_replace(coalesce(c.phone,''),'[^0-9]','','g') = np )
            or
            ( na <> '' and lower(regexp_replace(trim(coalesce(c.address,'')),'\s+',' ','g')) = na )
          )
        )
        or
        -- teléfono + dirección (aunque el nombre esté distinto/vacío)
        ( np <> '' and na <> ''
          and regexp_replace(coalesce(c.phone,''),'[^0-9]','','g') = np
          and lower(regexp_replace(trim(coalesce(c.address,'')),'\s+',' ','g')) = na
        )
      )
  ) then
    raise exception 'DUPLICADO: ya existe un contacto con ese nombre y (teléfono o dirección).'
      using errcode = '23505';
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_contacts_no_dup on public.contacts;
create trigger trg_contacts_no_dup
  before insert or update on public.contacts
  for each row execute function public.ac_contacts_no_dup();

-- ============================================================
--  Fin. El candado vive en la base de datos: aunque dos personas
--  intenten a la vez desde equipos distintos, se rechaza el duplicado.
-- ============================================================
