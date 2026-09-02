-- Esquema de En Punto. Aplicar con `supabase db push` o desde el SQL editor.
--
-- Hay dos roles: quien come y su nutricionista. Toda la seguridad cuelga de
-- `care_relationships`: la nutricionista no ve nada de nadie salvo que exista
-- un vinculo activo Y el paciente haya dado consentimiento. Son datos de
-- salud, asi que el modelo es "cerrado por defecto, se abre explicitamente".

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- perfiles --

create table if not exists public.profiles (
  id              uuid primary key references auth.users (id) on delete cascade,
  display_name    text,
  -- La zona horaria es critica: el cron calcula la agenda en el dia local de
  -- cada persona, no en UTC.
  timezone        text not null default 'America/Argentina/Buenos_Aires',
  -- Cualquiera es paciente de si mismo. Ser profesional es un permiso extra,
  -- no un rol excluyente: una nutricionista tambien puede seguir un plan.
  is_professional boolean not null default false,
  created_at      timestamptz not null default now()
);

-- ------------------------------------------------------------- el vinculo --

-- El unico lugar donde se decide quien puede ver los datos de quien.
create table if not exists public.care_relationships (
  id                 uuid primary key default gen_random_uuid(),
  professional_id    uuid not null references auth.users (id) on delete cascade,
  patient_id         uuid not null references auth.users (id) on delete cascade,
  -- 'pending': invitada pero sin aceptar. 'active': vigente. 'revoked': cortada.
  status             text not null default 'pending'
                     check (status in ('pending', 'active', 'revoked')),
  invited_at         timestamptz not null default now(),
  accepted_at        timestamptz,
  -- Cortar el vinculo es un derecho del paciente y tiene efecto inmediato:
  -- las policias dejan de conceder acceso, incluidas las fotos ya subidas.
  revoked_at         timestamptz,
  -- Consentimiento explicito para compartir registros de salud. Sin esto no
  -- hay acceso, aunque el vinculo figure activo.
  consent_granted_at timestamptz,
  consent_version    text,
  unique (professional_id, patient_id),
  constraint vinculo_no_es_uno_mismo check (professional_id <> patient_id)
);

create index if not exists care_rel_pro_idx on public.care_relationships (professional_id)
  where status = 'active';
create index if not exists care_rel_pat_idx on public.care_relationships (patient_id);

/**
 * Unica fuente de verdad del acceso profesional.
 *
 * Es SECURITY DEFINER a proposito: las policies de otras tablas la consultan,
 * y sin eso la lectura de care_relationships volveria a pasar por RLS y se
 * generaria una recursion.
 */
create or replace function public.has_care_access(patient uuid)
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
  );
$$;

revoke all on function public.has_care_access(uuid) from public;
grant execute on function public.has_care_access(uuid) to authenticated;

-- ----------------------------------------------------------------- planes --

-- `patient_id` es de quien sigue el plan; `author_id`, de quien lo escribio.
-- Separarlos es lo que permite que la nutricionista edite un plan ajeno sin
-- volverse duena de los datos del paciente.
create table if not exists public.plans (
  id         uuid primary key default gen_random_uuid(),
  patient_id uuid not null references auth.users (id) on delete cascade,
  author_id  uuid references auth.users (id) on delete set null,
  name       text not null,
  source     text,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists plans_patient_idx on public.plans (patient_id) where is_active;

-- El plan cambia con el tiempo: etapa del entrenamiento, indicaciones medicas.
-- Guardar versiones no es prolijidad: sin esto no se puede saber que plan
-- estaba vigente cuando se registro una comida de hace tres meses.
create table if not exists public.plan_versions (
  id             uuid primary key default gen_random_uuid(),
  plan_id        uuid not null references public.plans (id) on delete cascade,
  version        integer not null,
  -- Valida contra el tipo NutritionPlan de packages/core.
  doc            jsonb not null,
  -- Por que cambio: "subida de volumen", "indicacion del medico".
  change_note    text,
  author_id      uuid references auth.users (id) on delete set null,
  effective_from date not null default current_date,
  created_at     timestamptz not null default now(),
  unique (plan_id, version)
);
create index if not exists plan_versions_plan_idx
  on public.plan_versions (plan_id, effective_from desc);

-- Horarios, ayuno y exclusiones. Son del paciente: la nutricionista los ve
-- para dar contexto, pero no decide a que hora almorzas.
create table if not exists public.configs (
  id         uuid primary key default gen_random_uuid(),
  patient_id uuid not null references auth.users (id) on delete cascade,
  plan_id    uuid not null references public.plans (id) on delete cascade,
  doc        jsonb not null,
  updated_at timestamptz not null default now(),
  unique (patient_id, plan_id)
);

-- ---------------------------------------------------------------- registro --

-- Que se comio realmente. La foto reemplaza el ida y vuelta por WhatsApp: se
-- guarda en Storage (bucket privado "meal-photos") y aca queda solo la ruta.
-- Los binarios no van en la base: encarecen backups y consultas, y el storage
-- ya resuelve permisos, CDN y URLs firmadas que vencen.
create table if not exists public.meal_logs (
  id               uuid primary key default gen_random_uuid(),
  patient_id       uuid not null references auth.users (id) on delete cascade,
  -- Que version del plan regia ese dia. Permite leer el historial sin que lo
  -- reescriban los cambios posteriores.
  plan_version_id  uuid references public.plan_versions (id) on delete set null,
  local_date       date not null,
  slot_id          text not null,
  option_id        text,
  portions         jsonb,
  protein_grams    numeric,
  is_free_meal     boolean not null default false,
  note             text,
  photo_path       text,
  logged_at        timestamptz not null default now(),
  unique (patient_id, local_date, slot_id)
);
create index if not exists meal_logs_patient_date_idx
  on public.meal_logs (patient_id, local_date desc);
create index if not exists meal_logs_free_idx
  on public.meal_logs (patient_id, local_date desc) where is_free_meal;

-- ---------------------------------------------------------- notificaciones --

create table if not exists public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references auth.users (id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_ok_at timestamptz,
  -- El endpoint puede morir. El cron lo desactiva ante un 404/410 en vez de
  -- reintentar para siempre.
  is_active  boolean not null default true
);
create index if not exists push_subs_owner_idx on public.push_subscriptions (owner_id)
  where is_active;

-- Idempotencia del cron: un evento se envia una sola vez aunque dos corridas
-- se solapen o una se reintente.
create table if not exists public.notification_log (
  owner_id  uuid not null references auth.users (id) on delete cascade,
  local_date date not null,
  event_key text not null,
  sent_at   timestamptz not null default now(),
  primary key (owner_id, local_date, event_key)
);

-- --------------------------------------------------------------------- RLS --

alter table public.profiles            enable row level security;
alter table public.care_relationships  enable row level security;
alter table public.plans               enable row level security;
alter table public.plan_versions       enable row level security;
alter table public.configs             enable row level security;
alter table public.meal_logs           enable row level security;
alter table public.push_subscriptions  enable row level security;
alter table public.notification_log    enable row level security;

drop policy if exists profiles_own on public.profiles;
create policy profiles_own on public.profiles
  for all using (id = auth.uid()) with check (id = auth.uid());

-- La profesional necesita ver el nombre de sus pacientes, nada mas.
drop policy if exists profiles_professional_read on public.profiles;
create policy profiles_professional_read on public.profiles
  for select using (public.has_care_access(id));

-- Ambas partes ven el vinculo. Cada una lo corta cuando quiere.
drop policy if exists care_rel_visible on public.care_relationships;
create policy care_rel_visible on public.care_relationships
  for select using (patient_id = auth.uid() or professional_id = auth.uid());

drop policy if exists care_rel_invite on public.care_relationships;
create policy care_rel_invite on public.care_relationships
  for insert with check (professional_id = auth.uid() or patient_id = auth.uid());

drop policy if exists care_rel_update on public.care_relationships;
create policy care_rel_update on public.care_relationships
  for update using (patient_id = auth.uid() or professional_id = auth.uid())
  with check (patient_id = auth.uid() or professional_id = auth.uid());

-- Planes: el paciente manda; la profesional con acceso lee y escribe, pero
-- no borra.
drop policy if exists plans_patient on public.plans;
create policy plans_patient on public.plans
  for all using (patient_id = auth.uid()) with check (patient_id = auth.uid());

drop policy if exists plans_professional_read on public.plans;
create policy plans_professional_read on public.plans
  for select using (public.has_care_access(patient_id));

drop policy if exists plans_professional_write on public.plans;
create policy plans_professional_write on public.plans
  for insert with check (public.has_care_access(patient_id) and author_id = auth.uid());

drop policy if exists plans_professional_edit on public.plans;
create policy plans_professional_edit on public.plans
  for update using (public.has_care_access(patient_id))
  with check (public.has_care_access(patient_id));

drop policy if exists plan_versions_patient on public.plan_versions;
create policy plan_versions_patient on public.plan_versions
  for all
  using (exists (select 1 from public.plans p where p.id = plan_id and p.patient_id = auth.uid()))
  with check (exists (select 1 from public.plans p where p.id = plan_id and p.patient_id = auth.uid()));

drop policy if exists plan_versions_professional_read on public.plan_versions;
create policy plan_versions_professional_read on public.plan_versions
  for select
  using (exists (select 1 from public.plans p where p.id = plan_id and public.has_care_access(p.patient_id)));

-- Una version publicada no se edita: se publica otra. El historial es el
-- registro de que se indico y cuando.
drop policy if exists plan_versions_professional_write on public.plan_versions;
create policy plan_versions_professional_write on public.plan_versions
  for insert
  with check (
    exists (select 1 from public.plans p where p.id = plan_id and public.has_care_access(p.patient_id))
    and author_id = auth.uid()
  );

-- Los horarios son del paciente. La profesional los ve, no los edita.
drop policy if exists configs_patient on public.configs;
create policy configs_patient on public.configs
  for all using (patient_id = auth.uid()) with check (patient_id = auth.uid());

drop policy if exists configs_professional_read on public.configs;
create policy configs_professional_read on public.configs
  for select using (public.has_care_access(patient_id));

-- El registro es del paciente. La profesional lo lee: es el punto de la
-- funcionalidad. No lo escribe ni lo corrige.
drop policy if exists meal_logs_patient on public.meal_logs;
create policy meal_logs_patient on public.meal_logs
  for all using (patient_id = auth.uid()) with check (patient_id = auth.uid());

drop policy if exists meal_logs_professional_read on public.meal_logs;
create policy meal_logs_professional_read on public.meal_logs
  for select using (public.has_care_access(patient_id));

drop policy if exists push_subs_own on public.push_subscriptions;
create policy push_subs_own on public.push_subscriptions
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists notif_log_own on public.notification_log;
create policy notif_log_own on public.notification_log
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- ----------------------------------------------------------- consultas --

-- El plan vive como JSONB, que en Postgres es consultable con operadores y no
-- una caja negra. El indice GIN habilita buscar dentro del documento sin
-- recorrer todas las versiones: por ejemplo, que planes incluyen determinado
-- alimento, o cuales fijan un objetivo proteico.
create index if not exists plan_versions_doc_idx on public.plan_versions using gin (doc);

/**
 * Vistas de lectura para las metricas.
 *
 * `security_invoker = true` NO es opcional: sin eso una vista se ejecuta con
 * los permisos de quien la creo y saltea el RLS de las tablas de abajo, que es
 * exactamente el agujero que este esquema existe para evitar.
 */

-- Un dia de una persona, resumido. Es la unidad que mira tanto quien come
-- como su nutricionista.
create or replace view public.resumen_diario
with (security_invoker = true) as
select
  l.patient_id,
  l.local_date,
  count(*)                                          as comidas_registradas,
  count(*) filter (where l.is_free_meal)            as comidas_libres,
  coalesce(sum(l.protein_grams), 0)                 as proteina_g,
  count(*) filter (where l.photo_path is not null)  as con_foto
from public.meal_logs l
group by l.patient_id, l.local_date;

-- Las comidas del 20% se presupuestan por semana, asi que la pregunta
-- "cuantas lleva" solo tiene sentido agrupada por semana.
create or replace view public.resumen_semanal
with (security_invoker = true) as
select
  l.patient_id,
  date_trunc('week', l.local_date)::date            as semana,
  count(*)                                          as comidas_registradas,
  count(*) filter (where l.is_free_meal)            as comidas_libres,
  round(avg(l.protein_grams) filter (where l.protein_grams is not null), 1) as proteina_promedio_g,
  count(distinct l.local_date)                      as dias_con_registro
from public.meal_logs l
group by l.patient_id, date_trunc('week', l.local_date);

-- ----------------------------------------------------------------- fotos --

-- Bucket privado: las fotos se leen con URLs firmadas de corta duracion.
insert into storage.buckets (id, name, public)
values ('meal-photos', 'meal-photos', false)
on conflict (id) do nothing;

-- Las fotos viven en <uid-del-paciente>/<archivo>. El primer segmento de la
-- ruta es lo que decide el acceso.
drop policy if exists meal_photos_own on storage.objects;
create policy meal_photos_own on storage.objects
  for all
  using (
    bucket_id = 'meal-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'meal-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- La profesional solo lee, y solo mientras el vinculo este activo y consentido.
-- Al revocar, esta policy deja de conceder: las fotos ya subidas se vuelven
-- inaccesibles sin necesidad de borrarlas ni migrarlas.
drop policy if exists meal_photos_professional_read on storage.objects;
create policy meal_photos_professional_read on storage.objects
  for select
  using (
    bucket_id = 'meal-photos'
    and (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
    and public.has_care_access(((storage.foldername(name))[1])::uuid)
  );
