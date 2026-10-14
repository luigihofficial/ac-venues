-- ============================================================
--  AC-Venues · Contactos adicionales por hotel/venue
--  Agrega la columna extra_contacts (jsonb) a la tabla contacts.
--  Guarda hasta 2 contactos extra: [{name, phone, email}, ...]
--  Se muestran solo en la ventana expandida del contacto;
--  el directorio (preview) sigue mostrando solo el principal.
--  Idempotente.
-- ============================================================

alter table public.contacts
  add column if not exists extra_contacts jsonb not null default '[]'::jsonb;

-- ============================================================
--  Fin. La app lee/escribe extra_contacts al abrir un contacto.
-- ============================================================
