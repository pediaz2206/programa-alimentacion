-- La nota y la foto se mudan a su propia tabla.
--
-- FR-21 dice que el entrenador no ve el detalle plato por plato. La historia
-- 1.5 intento cumplirlo con una vista que no proyectaba `note` ni
-- `photo_path`, y eso no aplicaba nada: `meal_logs_professional_read` concede
-- por `has_care_access`, que no mira el rol, asi que un
--
--   GET /rest/v1/meal_logs?select=note,photo_path&patient_id=eq.<x>
--
-- devolvia todo. La vista era una convencion del cliente al lado de una puerta
-- abierta.
--
-- RLS concede o niega FILAS, nunca columnas: mientras esas dos vivan en
-- `meal_logs`, no hay policy que las separe del resto. Por eso se mudan. La
-- pregunta "quien lee el detalle" pasa a ser una policy sobre una tabla, que
-- es donde este esquema contesta todas las demas.
--
-- Tambien se va `registro_sin_detalle`: existia para tapar dos columnas que ya
-- no estan. `meal_logs` ES el registro sin detalle.
--
-- Requiere: schema.sql, 007-roles-profesionales.sql (la columna `rol`)

/**
 * Si quien llama puede ver el detalle y las fotos de esa persona.
 *
 * Va aca y no en una migracion anterior porque no estaba en ninguna: la
 * historia 1.5 la escribio solo en `schema.sql`, y en una base ya desplegada
 * no existia. Lo encontro `supabase/test/deriva.sh`.
 *
 * has_care_access mira vinculo activo, no revocado y consentido, pero NO mira
 * el rol. La condicion es del vinculo y no de la persona: alguien que es
 * entrenador de uno y nutricionista de otro ve el detalle del segundo y no el
 * del primero. Nulo niega.
 */
create or replace function public.ve_fotos(patient uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.care_relationships r
    where r.patient_id = patient
      and r.professional_id = auth.uid()
      and r.status = 'active'
      and r.revoked_at is null
      and r.consent_granted_at is not null
      and r.rol = 'nutricionista'
  );
$$;

revoke all on function public.ve_fotos(uuid) from public;
grant execute on function public.ve_fotos(uuid) to authenticated;

-- La policy de las fotos en storage pasa a usarla. Antes concedia con
-- has_care_access, asi que el entrenador las veia igual.
drop policy if exists meal_photos_professional_read on storage.objects;
create policy meal_photos_professional_read on storage.objects
  for select
  using (
    bucket_id = 'meal-photos'
    and (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
    and public.ve_fotos(((storage.foldername(name))[1])::uuid)
  );

create table if not exists public.meal_logs_detalle (
  meal_log_id uuid primary key references public.meal_logs (id) on delete cascade,
  nota        text,
  foto_path   text
);

alter table public.meal_logs_detalle enable row level security;

-- El paciente manda sobre lo suyo. Se llega al detalle por `meal_log_id`, asi
-- que la policy pregunta por la comida de la que cuelga.
drop policy if exists meal_detalle_patient on public.meal_logs_detalle;
create policy meal_detalle_patient on public.meal_logs_detalle
  for all
  using (exists (select 1 from public.meal_logs l
                 where l.id = meal_log_id and l.patient_id = auth.uid()))
  with check (exists (select 1 from public.meal_logs l
                      where l.id = meal_log_id and l.patient_id = auth.uid()));

-- Y solo lee quien tiene el vinculo de nutricionista: la misma condicion que
-- gobierna las fotos en storage. El detalle y la foto son lo mismo visto de
-- dos lados; si se separaran, una diria una cosa y la otra otra.
drop policy if exists meal_detalle_professional_read on public.meal_logs_detalle;
create policy meal_detalle_professional_read on public.meal_logs_detalle
  for select
  using (exists (select 1 from public.meal_logs l
                 where l.id = meal_log_id and public.ve_fotos(l.patient_id)));

-- Mudanza de lo que ya hay. Solo las filas que tienen algo: una comida sin
-- nota ni foto no necesita fila de detalle.
insert into public.meal_logs_detalle (meal_log_id, nota, foto_path)
select l.id, l.note, l.photo_path
from public.meal_logs l
where l.note is not null or l.photo_path is not null
on conflict (meal_log_id) do nothing;

-- Las vistas se bajan antes de soltar las columnas: `resumen_diario` lee
-- `photo_path` y Postgres no deja dejar una vista colgada.
--
-- `registro_sin_detalle` no vuelve: existia para tapar dos columnas que a
-- partir de acá no estan. `meal_logs` ES el registro sin detalle.
drop view if exists public.registro_sin_detalle;
drop view if exists public.resumen_diario;

-- Recien ahora se sueltan las columnas. Si algo de arriba fallo, esta
-- migracion aborta con los datos intactos: todo corre en una transaccion.
alter table public.meal_logs drop column if exists note;
alter table public.meal_logs drop column if exists photo_path;

-- Y la vista vuelve contando por el join. `security_invoker` hace que la
-- policy de arriba decida si esas filas se ven: al entrenador le da cero, que
-- es lo correcto.
create or replace view public.resumen_diario
with (security_invoker = true) as
select
  l.patient_id,
  l.local_date,
  count(*)                                          as comidas_registradas,
  count(*) filter (where l.is_free_meal)            as comidas_libres,
  coalesce(sum(l.protein_grams), 0)                 as proteina_g,
  count(d.meal_log_id)                              as con_foto
from public.meal_logs l
left join public.meal_logs_detalle d
  on d.meal_log_id = l.id and d.foto_path is not null
group by l.patient_id, l.local_date;
