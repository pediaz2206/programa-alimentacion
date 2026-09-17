-- Que migraciones ya estan aplicadas en esta base.
--
-- Solo lee: no cambia nada. Pegalo en el editor SQL de Supabase o corrÃ©lo con
-- psql antes de aplicar nada, para no adivinar por donde vas.
--
-- No hay tabla de migraciones aplicadas: cada fila pregunta por el objeto que
-- esa migracion crea. Es una inferencia, no un registro, pero no miente en la
-- direccion peligrosa —si el objeto esta, la migracion corrio—.
--
-- Las migraciones son idempotentes (`if not exists`, `create or replace`,
-- `drop policy if exists`), asi que volver a correr una que ya esta no rompe.
-- La unica que conviene no repetir es la 010, que mueve datos: ya tiene
-- `on conflict do nothing` y `drop column if exists`, pero es la que toca
-- filas y no solo definiciones.
select m.n as migracion, case when m.puesta then 'YA ESTÁ' else 'FALTA' end as estado
from (values
  ('001 invitaciones-por-email',   to_regclass('public.care_relationships') is not null and exists (select 1 from information_schema.columns where table_name='care_relationships' and column_name='patient_email')),
  ('002 identidad-de-perfiles',    exists (select 1 from information_schema.columns where table_name='profiles' and column_name='email')),
  ('003 foto-de-perfil',           exists (select 1 from information_schema.columns where table_name='profiles' and column_name='avatar_url')),
  ('004 medidas-corporales',       to_regclass('public.body_measurements') is not null),
  ('005 datos-de-prueba',          exists (select 1 from information_schema.columns where table_name='profiles' and column_name='es_prueba')),
  ('006 aislar-cuentas-de-prueba', to_regprocedure('public.es_cuenta_de_prueba(uuid)') is not null),
  ('007 roles-profesionales',      to_regclass('public.professional_roles') is not null),
  ('008 quien-escribe-que',        exists (select 1 from pg_trigger where tgname='care_rel_columnas')),
  ('009 marca-de-prueba',          exists (select 1 from pg_trigger where tgname='profiles_marca_de_prueba')),
  ('010 detalle-en-su-tabla',      to_regclass('public.meal_logs_detalle') is not null),
  ('011 el-rol-al-invitar',        exists (select 1 from pg_policies where policyname='care_rel_invite' and with_check like '%professional_roles%')),
  ('012 revocar-siempre',          exists (select 1 from pg_policies where policyname='care_rel_update' and with_check like '%revoked%'))
) as m(n, puesta)
order by 1;
