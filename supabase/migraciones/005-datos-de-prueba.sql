-- Marcar los datos de prueba como lo que son.
--
-- Los usuarios dummy tienen registros de comidas, fotos y mediciones: son
-- datos de salud con la misma forma que los reales, y viven en la misma base.
-- Sin una marca explicita, la unica forma de distinguirlos despues es por el
-- email o por la fecha, que es exactamente como se borra de mas.
--
-- Va en `profiles` y no en cada tabla porque la condicion es de la persona,
-- no del dato: si la cuenta es de prueba, todo lo suyo lo es.
--
-- Requiere: schema.sql

alter table public.profiles
  add column if not exists es_prueba boolean not null default false;

-- Para poder listarlos y borrarlos sin recorrer toda la tabla.
create index if not exists profiles_prueba_idx
  on public.profiles (id) where es_prueba;

comment on column public.profiles.es_prueba is
  'Cuenta creada por la semilla de pruebas. Nunca la pone la app: solo el script de siembra.';
