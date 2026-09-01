-- Esquema base. Aplicar con: supabase db push, o pegar en el SQL editor.
-- Todo cuelga de auth.users (Google SSO) y esta protegido por RLS.

create extension if not exists "pgcrypto";

-- Preferencias de la persona. La zona horaria es critica: el cron calcula la
-- agenda en el dia local de cada usuario, no en UTC.
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  timezone    text not null default 'America/Argentina/Buenos_Aires',
  created_at  timestamptz not null default now()
);

-- El plan transcrito del PDF. Ver docs/arquitectura.md sobre por que es JSONB.
-- `doc` valida contra el tipo NutritionPlan de packages/core.
create table if not exists public.plans (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references auth.users (id) on delete cascade,
  name       text not null,
  source     text,
  doc        jsonb not null,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists plans_owner_idx on public.plans (owner_id) where is_active;

-- Horarios, ayuno y exclusiones. Valida contra el tipo UserConfig.
create table if not exists public.configs (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references auth.users (id) on delete cascade,
  plan_id    uuid not null references public.plans (id) on delete cascade,
  doc        jsonb not null,
  updated_at timestamptz not null default now(),
  unique (owner_id, plan_id)
);

-- Que se comio realmente. Es lo unico verdaderamente relacional: se consulta,
-- se agrega y se grafica.
--
-- La foto es el reemplazo de mandar imagenes por WhatsApp: se guarda en
-- Supabase Storage (bucket privado "meal-photos") y aca queda solo la ruta.
-- Las fotos no van en la base: son binarios grandes y el storage ya resuelve
-- permisos, CDN y URLs firmadas.
create table if not exists public.meal_logs (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references auth.users (id) on delete cascade,
  local_date   date not null,
  slot_id      text not null,
  option_id    text,
  -- Snapshot de lo consumido al momento de registrar: si el plan cambia
  -- despues, el historial no se reescribe solo.
  portions     jsonb,
  protein_grams numeric,
  -- Comida del 20%: no sigue el plan, y cuenta contra el presupuesto semanal.
  is_free_meal boolean not null default false,
  note         text,
  -- Ruta dentro del bucket, no una URL: las URLs se firman al leer y vencen.
  photo_path   text,
  logged_at    timestamptz not null default now(),
  unique (owner_id, local_date, slot_id)
);
create index if not exists meal_logs_owner_date_idx on public.meal_logs (owner_id, local_date desc);
-- Para contar cuantas comidas del 20% se usaron en la semana.
create index if not exists meal_logs_free_idx
  on public.meal_logs (owner_id, local_date desc) where is_free_meal;

-- Suscripciones Web Push. Un usuario puede tener varias (celular, notebook).
create table if not exists public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references auth.users (id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_ok_at timestamptz,
  -- El endpoint puede morir (permiso revocado, app desinstalada). El cron lo
  -- desactiva ante un 404/410 en vez de reintentar para siempre.
  is_active  boolean not null default true
);
create index if not exists push_subs_owner_idx on public.push_subscriptions (owner_id) where is_active;

-- Idempotencia del cron: garantiza que un evento se envie una sola vez aunque
-- dos corridas se solapen o una se reintente.
create table if not exists public.notification_log (
  owner_id   uuid not null references auth.users (id) on delete cascade,
  local_date date not null,
  event_key  text not null,
  sent_at    timestamptz not null default now(),
  primary key (owner_id, local_date, event_key)
);

alter table public.profiles           enable row level security;
alter table public.plans              enable row level security;
alter table public.configs            enable row level security;
alter table public.meal_logs          enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.notification_log   enable row level security;

-- Cada quien ve y escribe solo lo suyo. El cron usa la service role key, que
-- pasa por encima de RLS.
do $$
declare
  t text;
  col text;
begin
  foreach t in array array['profiles','plans','configs','meal_logs','push_subscriptions','notification_log']
  loop
    col := case when t = 'profiles' then 'id' else 'owner_id' end;
    execute format('drop policy if exists %1$I on public.%1$I', t);
    execute format(
      'create policy %1$I on public.%1$I for all using (%2$I = auth.uid()) with check (%2$I = auth.uid())',
      t, col);
  end loop;
end $$;

-- Bucket privado para las fotos de las comidas. Sin acceso publico: se leen
-- con URLs firmadas de corta duracion.
insert into storage.buckets (id, name, public)
values ('meal-photos', 'meal-photos', false)
on conflict (id) do nothing;

-- Cada quien escribe y lee solo dentro de su propia carpeta (<uid>/...).
-- Que la nutricionista pueda ver estas fotos exige el modelo de dos roles que
-- todavia no esta definido; ver docs/arquitectura.md.
do $$
begin
  execute $p$
    drop policy if exists meal_photos_own on storage.objects;
    $p$;
exception when others then null;
end $$;

create policy meal_photos_own on storage.objects
  for all
  using (bucket_id = 'meal-photos' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'meal-photos' and (storage.foldername(name))[1] = auth.uid()::text);
