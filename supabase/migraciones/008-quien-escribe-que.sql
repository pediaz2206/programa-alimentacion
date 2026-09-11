-- Quien puede escribir que columna de un vinculo.
--
-- `care_rel_update` decide QUIEN toca la fila —el paciente o su profesional—
-- y nunca decidio QUE columna toca cada uno. Con eso:
--
--   1. El profesional se concedia el consentimiento solo. Un update sobre su
--      propia fila poniendo `consent_granted_at = now()` y has_care_access()
--      le devolvia true. El consentimiento es el eje de NFR-1 y lo podia
--      otorgar justamente la parte a la que restringe.
--   2. El entrenador se ascendia a nutricionista escribiendo su propio `rol`,
--      y con eso ve_fotos() le abria las fotos.
--   3. Cualquiera de los dos podia reapuntar `patient_id` a un uuid ajeno,
--      porque el `with check` se satisface con ser el profesional de la fila.
--
-- RLS decide por fila; las columnas las tiene que decidir un trigger. Los
-- privilegios de columna no sirven acá: son por rol de Postgres y todos los
-- usuarios de la app son el mismo rol `authenticated`.
--
-- Requiere: schema.sql, 007-roles-profesionales.sql

create or replace function public.care_rel_columnas_permitidas()
returns trigger
language plpgsql
as $$
declare
  soy_paciente    boolean := auth.uid() is not null and auth.uid() = coalesce(new.patient_id, old.patient_id);
  soy_profesional boolean := auth.uid() is not null and auth.uid() = old.professional_id;
begin
  -- Sin sesion no es una peticion de usuario: es la semilla o una tarea del
  -- servidor, las dos con service_role. RLS ya las deja pasar; el trigger no
  -- las contradice.
  if auth.uid() is null then return new; end if;

  -- Nadie reapunta un vinculo a otras personas. Vale para las dos partes.
  if new.professional_id is distinct from old.professional_id then
    raise exception 'No se puede cambiar el profesional de un vínculo.' using errcode = '42501';
  end if;
  if lower(new.patient_email) is distinct from lower(old.patient_email) then
    raise exception 'No se puede cambiar el email invitado.' using errcode = '42501';
  end if;

  -- `patient_id` solo se completa una vez, de nulo a quien reclama, y solo a
  -- si mismo. Es lo que hace reclamar_invitaciones(): es security definer, no
  -- pasa por ninguna policy, pero si por este trigger.
  if new.patient_id is distinct from old.patient_id then
    if old.patient_id is not null then
      raise exception 'Un vínculo ya reclamado no cambia de paciente.' using errcode = '42501';
    end if;
    if new.patient_id is distinct from auth.uid() then
      raise exception 'Solo se puede reclamar una invitación para uno mismo.' using errcode = '42501';
    end if;
    soy_paciente := true;
  end if;

  if soy_paciente then
    -- El paciente manda sobre lo suyo: acepta, consiente y revoca. Lo unico
    -- que no toca es el rol, que describe con que incumbencia lo sigue el
    -- profesional y no es suyo para cambiar.
    if new.rol is distinct from old.rol then
      raise exception 'El rol del vínculo no lo cambia el paciente.' using errcode = '42501';
    end if;
    return new;
  end if;

  if soy_profesional then
    -- El profesional solo puede terminar el vinculo. Ni consentir por el
    -- paciente, ni aceptar por el, ni cambiarse el rol a si mismo.
    if new.consent_granted_at is distinct from old.consent_granted_at
       or new.consent_version is distinct from old.consent_version then
      raise exception 'El consentimiento lo da el paciente, no el profesional.' using errcode = '42501';
    end if;
    if new.rol is distinct from old.rol then
      raise exception 'El rol del vínculo no se cambia a sí mismo.' using errcode = '42501';
    end if;
    if new.accepted_at is distinct from old.accepted_at then
      raise exception 'Aceptar es del paciente.' using errcode = '42501';
    end if;
    if new.status is distinct from old.status and new.status <> 'revoked' then
      raise exception 'El profesional solo puede cortar el vínculo.' using errcode = '42501';
    end if;
    return new;
  end if;

  raise exception 'No sos parte de este vínculo.' using errcode = '42501';
end $$;

drop trigger if exists care_rel_columnas on public.care_relationships;
create trigger care_rel_columnas
  before update on public.care_relationships
  for each row execute function public.care_rel_columnas_permitidas();
