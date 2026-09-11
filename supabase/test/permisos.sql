-- Verifica el modelo de dos roles: que la nutricionista vea lo que tiene que
-- ver, y nada mas. Es la parte critica del esquema, asi que se prueba.
\set ON_ERROR_STOP on
\pset tuples_only on

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'paciente@ejemplo.com'),
  ('22222222-2222-2222-2222-222222222222', 'nutri@ejemplo.com'),
  ('33333333-3333-3333-3333-333333333333', 'ajeno@ejemplo.com');

insert into public.profiles (id, display_name, email, is_professional) values
  ('11111111-1111-1111-1111-111111111111', 'Paciente', 'paciente@ejemplo.com', false),
  ('22222222-2222-2222-2222-222222222222', 'Nutricionista', 'nutri@ejemplo.com', true),
  ('33333333-3333-3333-3333-333333333333', 'Ajeno', 'ajeno@ejemplo.com', true);

insert into public.plans (id, patient_id, author_id, name) values
  ('aaaaaaaa-0000-0000-0000-000000000001',
   '11111111-1111-1111-1111-111111111111',
   '22222222-2222-2222-2222-222222222222', 'Plan');

insert into public.meal_logs (patient_id, local_date, slot_id, protein_grams) values
  ('11111111-1111-1111-1111-111111111111', current_date, 'almuerzo', 40);

insert into storage.objects (bucket_id, name) values
  ('meal-photos', '11111111-1111-1111-1111-111111111111/almuerzo.jpg');

insert into public.body_measurements (patient_id, local_date, weight_kg, waist_cm) values
  ('11111111-1111-1111-1111-111111111111', current_date, 81.4, 91.5);

create or replace function pruebas.check(descripcion text, obtenido boolean, esperado boolean)
returns void language plpgsql as $$
begin
  if obtenido is distinct from esperado then
    raise exception 'FALLO: % (esperado %, obtenido %)', descripcion, esperado, obtenido;
  end if;
  raise notice 'ok  %', descripcion;
end $$;

-- Actuamos como la nutricionista. Ojo: `set local` y el tercer parametro
-- `true` de set_config duran solo la transaccion, y psql abre una por
-- statement. Tienen que ser de sesion para atravesar toda la prueba.
set role authenticated;
select set_config('test.uid', '22222222-2222-2222-2222-222222222222', false);

-- 1. Sin vinculo: no ve nada.
select pruebas.check('sin vinculo no hay acceso',
  public.has_care_access('11111111-1111-1111-1111-111111111111'), false);

-- 2. Vinculo invitado pero no aceptado: sigue sin ver.
insert into public.care_relationships (professional_id, patient_id, patient_email, status)
values ('22222222-2222-2222-2222-222222222222',
        '11111111-1111-1111-1111-111111111111', 'paciente@ejemplo.com', 'pending');
select pruebas.check('vinculo pendiente no alcanza',
  public.has_care_access('11111111-1111-1111-1111-111111111111'), false);

-- 3. Activo pero SIN consentimiento: sigue sin ver. Son datos de salud.
update public.care_relationships set status = 'active', accepted_at = now()
where patient_id = '11111111-1111-1111-1111-111111111111';
select pruebas.check('activo sin consentimiento no alcanza',
  public.has_care_access('11111111-1111-1111-1111-111111111111'), false);

-- 4. Activo Y consentido: recien ahora ve.
update public.care_relationships set consent_granted_at = now(), consent_version = 'v1'
where patient_id = '11111111-1111-1111-1111-111111111111';
select pruebas.check('activo y consentido concede acceso',
  public.has_care_access('11111111-1111-1111-1111-111111111111'), true);

select pruebas.check('ve el plan del paciente',
  exists (select 1 from public.plans where patient_id = '11111111-1111-1111-1111-111111111111'), true);
select pruebas.check('ve el registro de comidas',
  exists (select 1 from public.meal_logs where patient_id = '11111111-1111-1111-1111-111111111111'), true);
select pruebas.check('ve la foto de la comida',
  exists (select 1 from storage.objects where bucket_id = 'meal-photos'), true);
select pruebas.check('ve el peso y la cintura',
  exists (select 1 from public.body_measurements where patient_id = '11111111-1111-1111-1111-111111111111'), true);

-- 5. Revocado: el acceso se corta, incluidas las fotos ya subidas.
update public.care_relationships set status = 'revoked', revoked_at = now()
where patient_id = '11111111-1111-1111-1111-111111111111';
select pruebas.check('revocar corta el acceso',
  public.has_care_access('11111111-1111-1111-1111-111111111111'), false);
select pruebas.check('revocar oculta el registro',
  exists (select 1 from public.meal_logs where patient_id = '11111111-1111-1111-1111-111111111111'), false);
select pruebas.check('revocar oculta las fotos ya subidas',
  exists (select 1 from storage.objects where bucket_id = 'meal-photos'), false);
select pruebas.check('revocar oculta el peso y la cintura',
  exists (select 1 from public.body_measurements where patient_id = '11111111-1111-1111-1111-111111111111'), false);

-- 6. Un profesional ajeno nunca ve nada, aunque el vinculo del otro este vigente.
update public.care_relationships
set status = 'active', revoked_at = null, consent_granted_at = now()
where patient_id = '11111111-1111-1111-1111-111111111111';
select set_config('test.uid', '33333333-3333-3333-3333-333333333333', false);
select pruebas.check('un profesional ajeno no tiene acceso',
  public.has_care_access('11111111-1111-1111-1111-111111111111'), false);
select pruebas.check('un profesional ajeno no ve el registro',
  exists (select 1 from public.meal_logs where patient_id = '11111111-1111-1111-1111-111111111111'), false);
select pruebas.check('un profesional ajeno no ve las fotos',
  exists (select 1 from storage.objects where bucket_id = 'meal-photos'), false);
select pruebas.check('un profesional ajeno no ve el peso ni la cintura',
  exists (select 1 from public.body_measurements where patient_id = '11111111-1111-1111-1111-111111111111'), false);

-- 7. Las vistas de metricas respetan el mismo vinculo que las tablas.
--    Una vista sin security_invoker saltearia RLS y filtraria todo.
select pruebas.check('un profesional ajeno no ve el resumen diario',
  exists (select 1 from public.resumen_diario where patient_id = '11111111-1111-1111-1111-111111111111'), false);
select pruebas.check('un profesional ajeno no ve el resumen semanal',
  exists (select 1 from public.resumen_semanal where patient_id = '11111111-1111-1111-1111-111111111111'), false);

select set_config('test.uid', '22222222-2222-2222-2222-222222222222', false);
select pruebas.check('la nutricionista vinculada si ve el resumen diario',
  exists (select 1 from public.resumen_diario where patient_id = '11111111-1111-1111-1111-111111111111'), true);
select pruebas.check('el resumen diario suma la proteina del dia',
  (select proteina_g from public.resumen_diario
   where patient_id = '11111111-1111-1111-1111-111111111111') = 40, true);

-- 8. El paciente siempre ve lo suyo.
select set_config('test.uid', '11111111-1111-1111-1111-111111111111', false);
select pruebas.check('el paciente ve su registro',
  exists (select 1 from public.meal_logs where patient_id = '11111111-1111-1111-1111-111111111111'), true);
select pruebas.check('el paciente ve sus fotos',
  exists (select 1 from storage.objects where bucket_id = 'meal-photos'), true);
select pruebas.check('el paciente ve su peso',
  exists (select 1 from public.body_measurements where patient_id = '11111111-1111-1111-1111-111111111111'), true);

-- El peso lo reporta quien se pesa: la nutricionista lee, nunca escribe.
select set_config('test.uid', '22222222-2222-2222-2222-222222222222', false);
do $$
begin
  insert into public.body_measurements (patient_id, local_date, weight_kg)
  values ('11111111-1111-1111-1111-111111111111', current_date - 1, 99);
  perform pruebas.check('la nutricionista no puede cargar el peso del paciente', true, false);
exception when insufficient_privilege then
  perform pruebas.check('la nutricionista no puede cargar el peso del paciente', false, false);
end $$;
select set_config('test.uid', '11111111-1111-1111-1111-111111111111', false);

-- 9. Invitar por email a alguien que todavia no reclamo la invitacion.
set role authenticated;
select set_config('test.uid', '33333333-3333-3333-3333-333333333333', false);
insert into public.care_relationships (professional_id, patient_email, status)
values ('33333333-3333-3333-3333-333333333333', 'PACIENTE@ejemplo.com', 'pending');

select pruebas.check('una invitacion sin reclamar no concede acceso',
  public.has_care_access('11111111-1111-1111-1111-111111111111'), false);

select set_config('test.uid', '11111111-1111-1111-1111-111111111111', false);
select pruebas.check('el paciente reclama la invitacion por email, sin importar mayusculas',
  public.reclamar_invitaciones() = 1, true);
select pruebas.check('reclamar no concede acceso por si solo',
  (select status from public.care_relationships
   where professional_id = '33333333-3333-3333-3333-333333333333') = 'pending', true);

select set_config('test.uid', '33333333-3333-3333-3333-333333333333', false);
select pruebas.check('reclamada pero sin aceptar, sigue sin ver nada',
  public.has_care_access('11111111-1111-1111-1111-111111111111'), false);

-- 10. Con varias nutricionistas hay que poder distinguirlas: el paciente ve el
--     nombre de quien le pide acceso ANTES de concederlo.
set role authenticated;
select set_config('test.uid', '11111111-1111-1111-1111-111111111111', false);
select pruebas.check('el paciente ve el nombre de quien lo invito, aun sin aceptar',
  (select display_name from public.profiles
   where id = '33333333-3333-3333-3333-333333333333') = 'Ajeno', true);

select pruebas.check('pero no ve el perfil de un desconocido',
  exists (select 1 from public.profiles p
          where p.id not in ('11111111-1111-1111-1111-111111111111',
                             '22222222-2222-2222-2222-222222222222',
                             '33333333-3333-3333-3333-333333333333')), false);

-- Un profesional NO puede ver el perfil de otro solo por existir.
select set_config('test.uid', '22222222-2222-2222-2222-222222222222', false);
select pruebas.check('una profesional no ve el perfil de otra',
  exists (select 1 from public.profiles
          where id = '33333333-3333-3333-3333-333333333333'), false);

-- 11. Aislamiento de las cuentas de prueba: solo se vinculan entre ellas.
--     Van dos cuentas nuevas, una profesional de prueba y una paciente de
--     prueba, para poder cruzar las cuatro combinaciones.
set role postgres;
insert into auth.users (id, email) values
  ('44444444-4444-4444-4444-444444444444', 'nutri@prueba.en-punto.local'),
  ('55555555-5555-5555-5555-555555555555', 'pac@prueba.en-punto.local');
insert into public.profiles (id, display_name, email, is_professional, es_prueba) values
  ('44444444-4444-4444-4444-444444444444', 'Nutri de prueba',
   'nutri@prueba.en-punto.local', true, true),
  ('55555555-5555-5555-5555-555555555555', 'Paciente de prueba',
   'pac@prueba.en-punto.local', false, true);
set role authenticated;

-- La funcion contesta bien aunque quien pregunta no pueda leer ese perfil.
select set_config('test.uid', '22222222-2222-2222-2222-222222222222', false);
select pruebas.check('una cuenta de prueba se reconoce como tal',
  public.es_cuenta_de_prueba('55555555-5555-5555-5555-555555555555'), true);
select pruebas.check('una cuenta real no',
  public.es_cuenta_de_prueba('11111111-1111-1111-1111-111111111111'), false);
select pruebas.check('un email que no existe no es de prueba',
  public.es_email_de_prueba('nadie@ejemplo.com'), false);

-- Intentar un insert y contestar si la policy lo dejo, en vez de abortar la
-- prueba entera. Corre como quien llama, asi que RLS la alcanza igual.
set role postgres;
create or replace function pruebas.puede_invitar(prof uuid, correo text)
returns boolean language plpgsql as $$
begin
  insert into public.care_relationships (professional_id, patient_id, patient_email, status)
  values (prof, null, correo, 'pending');
  return true;
exception when insufficient_privilege then
  return false;
end $$;
grant execute on function pruebas.puede_invitar(uuid, text) to authenticated;
set role authenticated;

-- a) Profesional de prueba -> paciente real: NO.
select set_config('test.uid', '44444444-4444-4444-4444-444444444444', false);
select pruebas.check('una profesional de prueba no invita a una cuenta real',
  pruebas.puede_invitar('44444444-4444-4444-4444-444444444444', 'paciente@ejemplo.com'), false);

-- b) Profesional de prueba -> paciente de prueba: SI.
select pruebas.check('entre cuentas de prueba el vinculo se crea',
  pruebas.puede_invitar('44444444-4444-4444-4444-444444444444', 'pac@prueba.en-punto.local'), true);

-- c) Profesional real -> paciente de prueba: NO, la direccion contraria.
select set_config('test.uid', '22222222-2222-2222-2222-222222222222', false);
select pruebas.check('una profesional real no invita a una cuenta de prueba',
  pruebas.puede_invitar('22222222-2222-2222-2222-222222222222', 'pac@prueba.en-punto.local'), false);

-- e) Ni por update: la profesional de prueba no puede atar su invitacion a una
--    cuenta real a mano. `using` la deja tocar su propia fila; `with check` es
--    lo que niega el destino.
set role postgres;
create or replace function pruebas.puede_atar(prof uuid, pac uuid)
returns boolean language plpgsql as $$
begin
  update public.care_relationships set patient_id = pac
  where professional_id = prof and patient_id is null;
  return found;
exception when insufficient_privilege then
  return false;
end $$;
grant execute on function pruebas.puede_atar(uuid, uuid) to authenticated;
set role authenticated;

select set_config('test.uid', '44444444-4444-4444-4444-444444444444', false);
select pruebas.check('una profesional de prueba no ata su invitacion a una cuenta real',
  pruebas.puede_atar('44444444-4444-4444-4444-444444444444',
                     '11111111-1111-1111-1111-111111111111'), false);
select pruebas.check('pero si a una cuenta de prueba',
  pruebas.puede_atar('44444444-4444-4444-4444-444444444444',
                     '55555555-5555-5555-5555-555555555555'), true);

-- d) Reclamar: una cuenta real no se ata a una invitacion de prueba aunque el
--    email coincida. Es el camino que no pasa por ninguna policy.
set role postgres;
update public.profiles set email = 'pac@prueba.en-punto.local'
where id = '11111111-1111-1111-1111-111111111111';
update auth.users set email = 'pac@prueba.en-punto.local'
where id = '11111111-1111-1111-1111-111111111111';
set role authenticated;
select set_config('test.uid', '11111111-1111-1111-1111-111111111111', false);
select pruebas.check('una cuenta real no reclama una invitacion de prueba',
  public.reclamar_invitaciones() = 0, true);

-- 12. Roles profesionales: cada uno ve y declara los suyos, y ninguno los de
--     otro. Sin la policy de select, RLS niega por defecto y la pestana
--     profesional no aparece para nadie: por eso se prueba que SI se ven.
set role postgres;
insert into public.professional_roles (person_id, rol) values
  ('22222222-2222-2222-2222-222222222222', 'nutricionista'),
  ('44444444-4444-4444-4444-444444444444', 'entrenador');
set role authenticated;

select set_config('test.uid', '22222222-2222-2222-2222-222222222222', false);
select pruebas.check('cada uno ve sus propios roles',
  exists (select 1 from public.professional_roles where rol = 'nutricionista'), true);
select pruebas.check('pero no ve los de otro',
  exists (select 1 from public.professional_roles
          where person_id = '44444444-4444-4444-4444-444444444444'), false);

-- Declararse a si mismo es lo que hace hoy la casilla "soy nutricionista".
set role postgres;
create or replace function pruebas.puede_declarar(persona uuid, r text)
returns boolean language plpgsql as $$
begin
  insert into public.professional_roles (person_id, rol) values (persona, r)
  on conflict do nothing;
  return true;
exception when insufficient_privilege then
  return false;
end $$;
grant execute on function pruebas.puede_declarar(uuid, text) to authenticated;
set role authenticated;

select set_config('test.uid', '22222222-2222-2222-2222-222222222222', false);
select pruebas.check('uno se declara un rol propio',
  pruebas.puede_declarar('22222222-2222-2222-2222-222222222222', 'entrenador'), true);
select pruebas.check('pero no le declara un rol a otro',
  pruebas.puede_declarar('11111111-1111-1111-1111-111111111111', 'nutricionista'), false);

-- Un paciente sin ningun rol no ve ninguna fila: es lo que apaga la pestana.
select set_config('test.uid', '11111111-1111-1111-1111-111111111111', false);
select pruebas.check('sin rol declarado no hay ninguna fila que ver',
  exists (select 1 from public.professional_roles), false);
