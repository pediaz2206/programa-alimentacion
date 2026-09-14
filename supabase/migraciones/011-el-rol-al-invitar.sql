-- El rol del vinculo tiene que ser uno que la persona de verdad tenga.
--
-- `care_rel_invite` verificaba quien invita y a quien, y nunca CON QUE ROL. La
-- columna `rol` la agrego la 007 sin restringirla al insertar, asi que un
-- entrenador podia crearse un vinculo declarandose `nutricionista` y con eso
-- `ve_fotos()` le abria el detalle y las fotos. El trigger de la 008 impide
-- cambiarlo despues; faltaba impedir nacer con el equivocado.
--
-- Y falta un default: `invitarPaciente` no escribia `rol`, asi que toda
-- invitacion nueva nacia en nulo. Nulo niega, asi que una nutricionista perdia
-- las fotos, el resumen de consulta y los controles de publicar sobre un
-- paciente que acababa de invitar. El relleno de la 007 solo alcanzo a las
-- filas que ya existian: el bug aparecia recien con la invitacion numero uno
-- despues de migrar.
--
-- Requiere: schema.sql, 007-roles-profesionales.sql

drop policy if exists care_rel_invite on public.care_relationships;
create policy care_rel_invite on public.care_relationships
  for insert with check (
    professional_id = auth.uid()
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_professional)
    and public.es_cuenta_de_prueba(auth.uid()) = public.es_email_de_prueba(patient_email)
    -- El rol declarado tiene que ser uno que la persona tenga. Nulo tambien
    -- se rechaza: un vinculo sin rol es un vinculo que despues nadie puede
    -- arreglar, porque la 008 lo vuelve inmutable.
    and exists (select 1 from public.professional_roles pr
                where pr.person_id = auth.uid() and pr.rol = care_relationships.rol)
  );

-- Los vinculos en nulo que hayan quedado entre la 007 y esta migracion. Van a
-- 'nutricionista' por la misma razon que el relleno de la 007: antes del rol
-- de entrenador, todo profesional era nutricionista.
update public.care_relationships set rol = 'nutricionista' where rol is null;
