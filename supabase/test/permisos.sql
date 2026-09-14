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

-- Invitar exige declarar un rol que la persona tenga, asi que las dos
-- profesionales del archivo lo tienen.
insert into public.professional_roles (person_id, rol) values
  ('22222222-2222-2222-2222-222222222222', 'nutricionista'),
  ('33333333-3333-3333-3333-333333333333', 'nutricionista');

insert into public.plans (id, patient_id, author_id, name) values
  ('aaaaaaaa-0000-0000-0000-000000000001',
   '11111111-1111-1111-1111-111111111111',
   '22222222-2222-2222-2222-222222222222', 'Plan');

insert into public.meal_logs (id, patient_id, local_date, slot_id, protein_grams) values
  ('dddddddd-0000-0000-0000-000000000001',
   '11111111-1111-1111-1111-111111111111', current_date, 'almuerzo', 40);

-- El detalle de esa comida: lo que la persona escribio y la foto que saco. Es
-- lo que FR-21 le niega al entrenador.
insert into public.meal_logs_detalle (meal_log_id, nota, foto_path) values
  ('dddddddd-0000-0000-0000-000000000001', 'me senti pesado despues',
   '11111111-1111-1111-1111-111111111111/almuerzo.jpg');

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
insert into public.care_relationships (professional_id, patient_id, patient_email, status, rol)
values ('22222222-2222-2222-2222-222222222222',
        '11111111-1111-1111-1111-111111111111', 'paciente@ejemplo.com', 'pending', 'nutricionista');
select pruebas.check('vinculo pendiente no alcanza',
  public.has_care_access('11111111-1111-1111-1111-111111111111'), false);

-- 3. Activo pero SIN consentimiento: sigue sin ver. Son datos de salud.
-- Aceptar es del paciente: la preparacion actua como el, no como ella.
select set_config('test.uid', '11111111-1111-1111-1111-111111111111', false);
update public.care_relationships set status = 'active', accepted_at = now()
where patient_id = '11111111-1111-1111-1111-111111111111';
select set_config('test.uid', '22222222-2222-2222-2222-222222222222', false);
select pruebas.check('activo sin consentimiento no alcanza',
  public.has_care_access('11111111-1111-1111-1111-111111111111'), false);

-- 4. Activo Y consentido: recien ahora ve.
-- Consentir tambien.
select set_config('test.uid', '11111111-1111-1111-1111-111111111111', false);
update public.care_relationships set consent_granted_at = now(), consent_version = 'v1'
where patient_id = '11111111-1111-1111-1111-111111111111';
select set_config('test.uid', '22222222-2222-2222-2222-222222222222', false);
select pruebas.check('activo y consentido concede acceso',
  public.has_care_access('11111111-1111-1111-1111-111111111111'), true);

select pruebas.check('ve el plan del paciente',
  exists (select 1 from public.plans where patient_id = '11111111-1111-1111-1111-111111111111'), true);
select pruebas.check('ve el registro de comidas',
  exists (select 1 from public.meal_logs where patient_id = '11111111-1111-1111-1111-111111111111'), true);
-- El vinculo se creo declarando `nutricionista`, asi que las fotos si.
set role authenticated;

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
--    Reactivar un vinculo revocado no es un acto de ninguna de las partes hoy:
--    la preparacion lo hace sin sesion.
set role postgres;
select set_config('test.uid', '', false);
update public.care_relationships
set status = 'active', revoked_at = null, consent_granted_at = now()
where patient_id = '11111111-1111-1111-1111-111111111111';
set role authenticated;
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
insert into public.care_relationships (professional_id, patient_email, status, rol)
values ('33333333-3333-3333-3333-333333333333', 'PACIENTE@ejemplo.com', 'pending', 'nutricionista');

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
--
--     Sin sesion: la marca `es_prueba` solo la pone la semilla, que corre con
--     service_role. Insertarlas actuando como alguien logueado seria simular
--     algo que no puede pasar.
set role postgres;
select set_config('test.uid', '', false);
insert into auth.users (id, email) values
  ('44444444-4444-4444-4444-444444444444', 'nutri@prueba.en-punto.local'),
  ('55555555-5555-5555-5555-555555555555', 'pac@prueba.en-punto.local');
insert into public.profiles (id, display_name, email, is_professional, es_prueba) values
  ('44444444-4444-4444-4444-444444444444', 'Nutri de prueba',
   'nutri@prueba.en-punto.local', true, true),
  ('55555555-5555-5555-5555-555555555555', 'Paciente de prueba',
   'pac@prueba.en-punto.local', false, true);
insert into public.professional_roles (person_id, rol) values
  ('44444444-4444-4444-4444-444444444444', 'nutricionista');
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
  -- Con el rol que la persona tenga: invitar sin uno valido ahora se rechaza,
  -- y esta funcion existe para probar OTRA cosa (el aislamiento de prueba).
  insert into public.care_relationships (professional_id, patient_id, patient_email, status, rol)
  values (prof, null, correo, 'pending',
          (select pr.rol from public.professional_roles pr where pr.person_id = prof limit 1));
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

-- e) Ni por update: atar un vinculo es del paciente que reclama, nunca del
--    profesional. Antes `using` lo dejaba tocar su propia fila y solo el
--    `with check` de la 1.2 negaba el destino real, asi que a una cuenta de
--    prueba si podia. Ahora el trigger de 008 lo niega en las dos
--    direcciones: `patient_id` solo va de nulo a quien reclama, y solo a si
--    mismo.
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
select pruebas.check('ni siquiera a una cuenta de prueba',
  pruebas.puede_atar('44444444-4444-4444-4444-444444444444',
                     '55555555-5555-5555-5555-555555555555'), false);

-- El camino legitimo: el propio paciente reclama la invitacion dirigida a su
-- email. Es el unico que el trigger deja pasar.
select set_config('test.uid', '55555555-5555-5555-5555-555555555555', false);
select pruebas.check('el paciente de prueba si reclama la suya',
  public.reclamar_invitaciones() = 1, true);

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
-- `on conflict` porque el bloque base ya le dio su rol a la nutricionista:
-- invitar lo exige desde la 011.
insert into public.professional_roles (person_id, rol) values
  ('22222222-2222-2222-2222-222222222222', 'nutricionista'),
  ('44444444-4444-4444-4444-444444444444', 'entrenador')
on conflict do nothing;
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

-- 13. El entrenador ve el registro pero no el detalle. Vinculo activo,
--     consentido y con rol 'entrenador': cumple las tres condiciones de
--     has_care_access, que es justo por lo que hacia falta mirar el rol.
set role postgres;
insert into auth.users (id, email) values
  ('66666666-6666-6666-6666-666666666666', 'entrena@ejemplo.com');
insert into public.profiles (id, display_name, email, is_professional) values
  ('66666666-6666-6666-6666-666666666666', 'Entrenador', 'entrena@ejemplo.com', true);
insert into public.professional_roles (person_id, rol) values
  ('66666666-6666-6666-6666-666666666666', 'entrenador');
insert into public.care_relationships
  (professional_id, patient_id, patient_email, status, rol, accepted_at, consent_granted_at, consent_version)
values
  ('66666666-6666-6666-6666-666666666666', '11111111-1111-1111-1111-111111111111',
   'paciente@ejemplo.com', 'active', 'entrenador', now(), now(), 'v1');
set role authenticated;

select set_config('test.uid', '66666666-6666-6666-6666-666666666666', false);
select pruebas.check('el entrenador tiene acceso de cuidado',
  public.has_care_access('11111111-1111-1111-1111-111111111111'), true);
select pruebas.check('y ve el registro: adherencia, proteina y constancia',
  exists (select 1 from public.meal_logs
          where patient_id = '11111111-1111-1111-1111-111111111111'), true);
select pruebas.check('pero NO ve las fotos, aunque el vinculo este consentido',
  exists (select 1 from storage.objects where bucket_id = 'meal-photos'), false);
select pruebas.check('ve_fotos le dice que no',
  public.ve_fotos('11111111-1111-1111-1111-111111111111'), false);

-- Lo que importa: la nota y la foto no estan en `meal_logs`. Antes la unica
-- barrera era que el cliente pidiera otras columnas, y eso no es una barrera.
select pruebas.check('meal_logs ya no tiene la nota',
  exists (select 1 from information_schema.columns
          where table_name = 'meal_logs' and column_name = 'note'), false);
select pruebas.check('ni la ruta de la foto',
  exists (select 1 from information_schema.columns
          where table_name = 'meal_logs' and column_name = 'photo_path'), false);

-- Y el detalle, que ahora es una tabla con su propia policy, no se lo da.
select pruebas.check('el entrenador NO lee el detalle',
  exists (select 1 from public.meal_logs_detalle), false);

-- El resumen diario le cuenta las comidas pero no cuantas tienen foto: el
-- join a `meal_logs_detalle` lo filtra la policy, no la consulta.
select pruebas.check('el resumen diario le da comidas',
  (select comidas_registradas from public.resumen_diario
   where patient_id = '11111111-1111-1111-1111-111111111111') > 0, true);
select pruebas.check('pero con_foto en cero',
  (select con_foto from public.resumen_diario
   where patient_id = '11111111-1111-1111-1111-111111111111') = 0, true);

-- Un profesional ajeno sigue sin ver nada de nada.
select set_config('test.uid', '33333333-3333-3333-3333-333333333333', false);
select pruebas.check('un profesional ajeno no ve el registro',
  exists (select 1 from public.meal_logs
          where patient_id = '11111111-1111-1111-1111-111111111111'), false);
select pruebas.check('ni el detalle',
  exists (select 1 from public.meal_logs_detalle), false);

-- Si ese mismo vinculo se hubiera creado como nutricionista, las fotos si.
--
-- OJO: no es "los dos roles a la vez". `care_rel_unico_paciente` prohibe dos
-- vinculos entre las mismas dos personas, asi que acumular nutricionista y
-- entrenador sobre el mismo paciente NO es representable. Esta asercion
-- compara dos vinculos posibles, no dos simultaneos.
set role postgres;
select set_config('test.uid', '', false);
update public.care_relationships set rol = 'nutricionista'
where professional_id = '66666666-6666-6666-6666-666666666666';
set role authenticated;
select set_config('test.uid', '66666666-6666-6666-6666-666666666666', false);
select pruebas.check('con un vinculo de nutricionista, las mismas fotos si',
  public.ve_fotos('11111111-1111-1111-1111-111111111111'), true);
select pruebas.check('y el detalle tambien',
  exists (select 1 from public.meal_logs_detalle), true);

-- 14. Quien escribe que columna de un vinculo.
--
--     Las 53 aserciones anteriores probaban que SIN consentimiento no se ve.
--     Ninguna probaba que el consentimiento no se lo pueda poner uno mismo, y
--     esa era la unica que importaba: la parte restringida abria su propia
--     compuerta con un update sobre su propia fila.
set role postgres;
create or replace function pruebas.intentar(sentencia text)
returns boolean language plpgsql as $$
begin
  execute sentencia;
  return true;
exception when insufficient_privilege then
  return false;
end $$;
grant execute on function pruebas.intentar(text) to authenticated;

-- Un vinculo nuevo entre el paciente principal y una nutricionista: activo,
-- aceptado, y todavia SIN consentir.
select set_config('test.uid', '', false);
update public.care_relationships set consent_granted_at = null, consent_version = null
where professional_id = '22222222-2222-2222-2222-222222222222'
  and patient_id = '11111111-1111-1111-1111-111111111111';
set role authenticated;

select set_config('test.uid', '22222222-2222-2222-2222-222222222222', false);
select pruebas.check('sin consentimiento no ve (control)',
  public.has_care_access('11111111-1111-1111-1111-111111111111'), false);

select pruebas.check('la profesional NO se concede el consentimiento sola',
  pruebas.intentar($$update public.care_relationships
    set consent_granted_at = now(), consent_version = 'v1'
    where professional_id = '22222222-2222-2222-2222-222222222222'$$), false);
select pruebas.check('y sigue sin ver',
  public.has_care_access('11111111-1111-1111-1111-111111111111'), false);

select pruebas.check('tampoco acepta en nombre del paciente',
  pruebas.intentar($$update public.care_relationships set accepted_at = now()
    where professional_id = '22222222-2222-2222-2222-222222222222'$$), false);

-- El consentimiento es del paciente y funciona.
select set_config('test.uid', '11111111-1111-1111-1111-111111111111', false);
select pruebas.check('el paciente si consiente',
  pruebas.intentar($$update public.care_relationships
    set consent_granted_at = now(), consent_version = 'v1'
    where patient_id = '11111111-1111-1111-1111-111111111111'
      and professional_id = '22222222-2222-2222-2222-222222222222'$$), true);
select set_config('test.uid', '22222222-2222-2222-2222-222222222222', false);
select pruebas.check('y recien ahi ve',
  public.has_care_access('11111111-1111-1111-1111-111111111111'), true);

-- El rol del vinculo no lo escribe ninguna de las dos partes: es lo que
-- sostiene a ve_fotos(), asi que si el entrenador se lo pudiera cambiar,
-- FR-21 no existiria.
-- El bloque 13 dejo ese vinculo en 'nutricionista'. Se vuelve a 'entrenador'
-- o el update de abajo es un no-op y la asercion pasa sin probar nada.
set role postgres;
select set_config('test.uid', '', false);
update public.care_relationships set rol = 'entrenador'
where professional_id = '66666666-6666-6666-6666-666666666666';
set role authenticated;

select set_config('test.uid', '66666666-6666-6666-6666-666666666666', false);
select pruebas.check('parte de entrenador (control)',
  (select rol from public.care_relationships
   where professional_id = '66666666-6666-6666-6666-666666666666') = 'entrenador', true);
select pruebas.check('el entrenador NO se asciende a nutricionista',
  pruebas.intentar($$update public.care_relationships set rol = 'nutricionista'
    where professional_id = '66666666-6666-6666-6666-666666666666'$$), false);

select set_config('test.uid', '11111111-1111-1111-1111-111111111111', false);
select pruebas.check('ni el paciente le cambia el rol a su profesional',
  pruebas.intentar($$update public.care_relationships set rol = 'entrenador'
    where patient_id = '11111111-1111-1111-1111-111111111111'$$), false);

-- Nadie reapunta un vinculo a otras personas.
select set_config('test.uid', '22222222-2222-2222-2222-222222222222', false);
select pruebas.check('una profesional no se lleva el vinculo a otro paciente',
  pruebas.intentar($$update public.care_relationships
    set patient_id = '33333333-3333-3333-3333-333333333333'
    where professional_id = '22222222-2222-2222-2222-222222222222'$$), false);
select pruebas.check('ni lo cede a otra profesional',
  pruebas.intentar($$update public.care_relationships
    set professional_id = '33333333-3333-3333-3333-333333333333'
    where professional_id = '22222222-2222-2222-2222-222222222222'$$), false);

-- Esa ultima la cubria RLS igual: al mover `professional_id` la fila nueva
-- deja de satisfacer el `with check`. Del lado del paciente NO: la fila sigue
-- siendo suya, asi que el `with check` pasa y lo unico que lo niega es el
-- trigger. Es la unica de las tres que el trigger sostiene solo.
select set_config('test.uid', '11111111-1111-1111-1111-111111111111', false);
select pruebas.check('el paciente tampoco se cambia de profesional',
  pruebas.intentar($$update public.care_relationships
    set professional_id = '33333333-3333-3333-3333-333333333333'
    where patient_id = '11111111-1111-1111-1111-111111111111'
      and professional_id = '22222222-2222-2222-2222-222222222222'$$), false);
select set_config('test.uid', '22222222-2222-2222-2222-222222222222', false);

-- Lo que el profesional SI puede: cortar el vinculo.
select pruebas.check('la profesional si puede cortar el vinculo',
  pruebas.intentar($$update public.care_relationships
    set status = 'revoked', revoked_at = now()
    where professional_id = '22222222-2222-2222-2222-222222222222'$$), true);

-- 15. La marca de cuenta de prueba no la escribe su dueño.
--
--     Es de lo que cuelga todo el aislamiento del bloque 11: si la cuenta
--     contenida puede apagarse la marca, las tres guardas de ahi arriba se
--     abren de una vez y ninguna de ellas lo nota.
set role authenticated;
select set_config('test.uid', '44444444-4444-4444-4444-444444444444', false);
select pruebas.check('arranca marcada como prueba (control)',
  public.es_cuenta_de_prueba('44444444-4444-4444-4444-444444444444'), true);

select pruebas.check('la cuenta de prueba NO se apaga la marca',
  pruebas.intentar($$update public.profiles set es_prueba = false
    where id = '44444444-4444-4444-4444-444444444444'$$), false);
select pruebas.check('y sigue marcada',
  public.es_cuenta_de_prueba('44444444-4444-4444-4444-444444444444'), true);

select pruebas.check('y por lo tanto sigue sin poder invitar a una cuenta real',
  pruebas.puede_invitar('44444444-4444-4444-4444-444444444444', 'ajeno@ejemplo.com'), false);

-- Lo que si puede: todo lo demas de su perfil.
select pruebas.check('pero si cambia su propio nombre',
  pruebas.intentar($$update public.profiles set display_name = 'Otro nombre'
    where id = '44444444-4444-4444-4444-444444444444'$$), true);

-- Y al reves: una cuenta real no se marca como de prueba para colarse entre
-- las sembradas.
select set_config('test.uid', '11111111-1111-1111-1111-111111111111', false);
select pruebas.check('una cuenta real no se marca como de prueba',
  pruebas.intentar($$update public.profiles set es_prueba = true
    where id = '11111111-1111-1111-1111-111111111111'$$), false);

-- 16. Ninguna tabla de `public` sin RLS.
--
--     Esta asercion existe porque `meal_logs_detalle` nacio sin RLS: la linea
--     de `enable row level security` no entro, la tabla quedo abierta a
--     cualquier usuario autenticado, y lo unico que lo delato fue otra
--     asercion que esperaba una negacion. Sin esa, una tabla nueva con datos
--     de salud pasaba la corrida entera en verde.
--
--     No verifica que las policies sean correctas —eso es el resto del
--     archivo— sino que exista la puerta.
set role postgres;
select pruebas.check('toda tabla de public tiene RLS activa',
  exists (select 1 from pg_tables t
          where t.schemaname = 'public' and not t.rowsecurity), false);
set role authenticated;

-- 17. Al invitar, el rol declarado tiene que ser uno que la persona tenga.
--
--     La 007 agrego la columna `rol` sin restringirla al insertar, y de esa
--     columna cuelga `ve_fotos()`. Un entrenador podia crearse el vinculo
--     declarandose nutricionista y con eso abrirse el detalle y las fotos. El
--     trigger de la 008 le impide cambiarlo despues; esto le impide nacer con
--     el equivocado.
set role postgres;
create or replace function pruebas.puede_invitar_como(prof uuid, correo text, r text)
returns boolean language plpgsql as $$
begin
  insert into public.care_relationships (professional_id, patient_email, status, rol)
  values (prof, correo, 'pending', r);
  return true;
exception when insufficient_privilege then
  return false;
end $$;
grant execute on function pruebas.puede_invitar_como(uuid, text, text) to authenticated;
set role authenticated;

-- 66666666 es entrenador y solo entrenador.
select set_config('test.uid', '66666666-6666-6666-6666-666666666666', false);
select pruebas.check('el entrenador NO invita declarandose nutricionista',
  pruebas.puede_invitar_como('66666666-6666-6666-6666-666666666666',
                             'nuevo@ejemplo.com', 'nutricionista'), false);
select pruebas.check('ni sin declarar rol',
  pruebas.puede_invitar_como('66666666-6666-6666-6666-666666666666',
                             'nuevo@ejemplo.com', null), false);
select pruebas.check('pero si como entrenador, que es lo que es',
  pruebas.puede_invitar_como('66666666-6666-6666-6666-666666666666',
                             'nuevo@ejemplo.com', 'entrenador'), true);

-- Y el vinculo que acaba de crear no le da fotos, porque nacio de entrenador.
select pruebas.check('y ese vinculo nace sin acceso al detalle',
  (select rol from public.care_relationships
   where professional_id = '66666666-6666-6666-6666-666666666666'
     and patient_email = 'nuevo@ejemplo.com') = 'entrenador', true);
