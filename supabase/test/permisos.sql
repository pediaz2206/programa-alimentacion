-- Verifica el modelo de dos roles: que la nutricionista vea lo que tiene que
-- ver, y nada mas. Es la parte critica del esquema, asi que se prueba.
\set ON_ERROR_STOP on
\pset tuples_only on

insert into auth.users (id) values
  ('11111111-1111-1111-1111-111111111111'),  -- paciente
  ('22222222-2222-2222-2222-222222222222'),  -- nutricionista
  ('33333333-3333-3333-3333-333333333333');  -- tercero sin vinculo

insert into public.profiles (id, display_name, is_professional) values
  ('11111111-1111-1111-1111-111111111111', 'Paciente', false),
  ('22222222-2222-2222-2222-222222222222', 'Nutricionista', true),
  ('33333333-3333-3333-3333-333333333333', 'Ajeno', true);

insert into public.plans (id, patient_id, author_id, name) values
  ('aaaaaaaa-0000-0000-0000-000000000001',
   '11111111-1111-1111-1111-111111111111',
   '22222222-2222-2222-2222-222222222222', 'Plan');

insert into public.meal_logs (patient_id, local_date, slot_id, protein_grams) values
  ('11111111-1111-1111-1111-111111111111', current_date, 'almuerzo', 40);

insert into storage.objects (bucket_id, name) values
  ('meal-photos', '11111111-1111-1111-1111-111111111111/almuerzo.jpg');

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
insert into public.care_relationships (professional_id, patient_id, status)
values ('22222222-2222-2222-2222-222222222222',
        '11111111-1111-1111-1111-111111111111', 'pending');
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

-- 5. Revocado: el acceso se corta, incluidas las fotos ya subidas.
update public.care_relationships set status = 'revoked', revoked_at = now()
where patient_id = '11111111-1111-1111-1111-111111111111';
select pruebas.check('revocar corta el acceso',
  public.has_care_access('11111111-1111-1111-1111-111111111111'), false);
select pruebas.check('revocar oculta el registro',
  exists (select 1 from public.meal_logs where patient_id = '11111111-1111-1111-1111-111111111111'), false);
select pruebas.check('revocar oculta las fotos ya subidas',
  exists (select 1 from storage.objects where bucket_id = 'meal-photos'), false);

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

-- 7. El paciente siempre ve lo suyo.
select set_config('test.uid', '11111111-1111-1111-1111-111111111111', false);
select pruebas.check('el paciente ve su registro',
  exists (select 1 from public.meal_logs where patient_id = '11111111-1111-1111-1111-111111111111'), true);
select pruebas.check('el paciente ve sus fotos',
  exists (select 1 from storage.objects where bucket_id = 'meal-photos'), true);
