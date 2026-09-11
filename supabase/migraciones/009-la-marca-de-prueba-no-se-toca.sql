-- `profiles.es_prueba` no la escribe su dueño.
--
-- Todo el aislamiento de las cuentas de prueba cuelga de esa marca:
-- `es_cuenta_de_prueba()` la lee, y las tres puertas hacia un vinculo —invitar,
-- aceptar y reclamar— la consultan. Pero `profiles_own` es
-- `for all using (id = auth.uid())`, sin restriccion de columnas, asi que la
-- propia cuenta podia apagarsela:
--
--   PATCH /rest/v1/profiles?id=eq.<yo>  {"es_prueba": false}
--
-- y con eso las tres guardas pasaban a permitir el cruce con cuentas reales.
-- Mientras esas cuentas no podian iniciar sesion el riesgo era teorico; el
-- acceso por contrasena les dio sesion y nadie cerro esto.
--
-- Va como trigger y no como `revoke update (es_prueba)`: los privilegios de
-- columna no se pueden revocar por encima de un grant de tabla sin revocar
-- primero el de tabla y volver a conceder columna por columna, y esa lista hay
-- que mantenerla cada vez que `profiles` gana una columna. Un trigger niega
-- una cosa y deja pasar el resto.
--
-- Requiere: schema.sql, 005-datos-de-prueba.sql

create or replace function public.es_prueba_solo_la_semilla()
returns trigger
language plpgsql
as $$
begin
  -- Sin sesion es la semilla, con service_role. Es la unica que la escribe.
  if auth.uid() is null then return new; end if;

  if tg_op = 'INSERT' then
    if new.es_prueba then
      raise exception 'La marca de cuenta de prueba la pone la semilla.' using errcode = '42501';
    end if;
    return new;
  end if;

  if new.es_prueba is distinct from old.es_prueba then
    raise exception 'La marca de cuenta de prueba no se cambia desde la app.' using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists profiles_marca_de_prueba on public.profiles;
create trigger profiles_marca_de_prueba
  before insert or update on public.profiles
  for each row execute function public.es_prueba_solo_la_semilla();
