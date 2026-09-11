-- Que las cuentas de prueba solo se vinculen entre ellas.
--
-- La semilla crea gente con registros de comidas, fotos y mediciones: datos de
-- salud con la misma forma que los reales, en la misma base. Mientras no
-- pudieran iniciar sesion el riesgo era teorico. La historia 1.3 les da una
-- puerta, asi que esto va antes: primero se aisla, despues se abre.
--
-- Hay tres caminos hacia un vinculo y los tres se cierran acá:
--   1. la profesional invita            -> policy de insert
--   2. el paciente acepta o consiente   -> policy de update
--   3. la invitacion se reclama al      -> dentro de reclamar_invitaciones(),
--      entrar con ese email                que es security definer y no pasa
--                                           por ninguna policy
--
-- Requiere: schema.sql, 005-datos-de-prueba.sql (la marca `es_prueba`).

/**
 * Si esa cuenta es de la semilla de pruebas.
 *
 * Es security definer porque quien pregunta casi nunca puede leer el perfil
 * del otro: `profiles` tiene RLS y solo se ve el propio, el de un paciente
 * vinculado o el de quien te invito. Un `exists` suelto contra `profiles`
 * dentro de una policy devolveria falso por falta de permiso, no por ser
 * falso, y "no se" se leeria como "no es de prueba": el default inseguro.
 */
create or replace function public.es_cuenta_de_prueba(persona uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select p.es_prueba from public.profiles p where p.id = persona), false);
$$;

revoke all on function public.es_cuenta_de_prueba(uuid) from public;
grant execute on function public.es_cuenta_de_prueba(uuid) to authenticated;

/**
 * Lo mismo, por email: al invitar todavia no hay id.
 *
 * Un email que no existe da falso, que es lo correcto en las dos direcciones:
 * invitar a alguien que todavia no se registro tiene que seguir andando, y esa
 * persona no es de prueba. No filtra nada que el que pregunta no supiera: ya
 * escribio ese email.
 */
create or replace function public.es_email_de_prueba(correo text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.es_prueba from public.profiles p where lower(p.email) = lower(correo)),
    false);
$$;

revoke all on function public.es_email_de_prueba(text) from public;
grant execute on function public.es_email_de_prueba(text) to authenticated;

-- 1. Invitar: las dos puntas coinciden o no hay invitacion.
drop policy if exists care_rel_invite on public.care_relationships;
create policy care_rel_invite on public.care_relationships
  for insert with check (
    professional_id = auth.uid()
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_professional)
    and public.es_cuenta_de_prueba(auth.uid()) = public.es_email_de_prueba(patient_email)
  );

-- 2. Aceptar y consentir. Sin esto el aislamiento se saltea por el otro lado:
--    una fila con el email de una cuenta real, y despues un update que le pone
--    el patient_id.
drop policy if exists care_rel_update on public.care_relationships;
create policy care_rel_update on public.care_relationships
  for update using (patient_id = auth.uid() or professional_id = auth.uid())
  with check (
    (patient_id = auth.uid() or professional_id = auth.uid())
    and (patient_id is null
         or public.es_cuenta_de_prueba(professional_id) = public.es_cuenta_de_prueba(patient_id))
  );

-- 3. Reclamar. Es security definer: no pasa por ninguna policy, asi que la
--    condicion va adentro de la funcion o no existe.
create or replace function public.reclamar_invitaciones()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  atadas integer;
begin
  if auth.uid() is null then return 0; end if;

  update public.care_relationships r
  set patient_id = auth.uid()
  where r.patient_id is null
    and lower(r.patient_email) = lower(auth.email())
    and public.es_cuenta_de_prueba(r.professional_id) = public.es_cuenta_de_prueba(auth.uid())
    and not exists (
      select 1 from public.care_relationships otro
      where otro.professional_id = r.professional_id and otro.patient_id = auth.uid()
    );

  get diagnostics atadas = row_count;
  return atadas;
end $$;

-- Los vinculos que ya existen no se tocan: si hay alguno mezclado, es de antes
-- de que existieran las cuentas de prueba y no lo puede haber. Si aparece, es
-- un dato que hay que mirar a mano y no borrar desde una migracion.
