-- Simula localmente lo que Supabase provee, para poder aplicar y probar
-- schema.sql sin un proyecto real. No forma parte del esquema desplegado.
create schema auth;
create schema storage;
create extension if not exists pgcrypto;
create role authenticated;
create role anon;

create table auth.users (id uuid primary key, email text);

-- En Supabase auth.uid() sale del JWT. Aca sale de una variable de sesion,
-- para poder actuar como distintos usuarios dentro de la misma prueba.
create function auth.uid() returns uuid language sql stable as
$$ select nullif(current_setting('test.uid', true), '')::uuid $$;

create function auth.email() returns text language sql stable as
$$ select u.email from auth.users u where u.id = auth.uid() $$;

create table storage.buckets (id text primary key, name text, public boolean);
create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text, name text
);
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql immutable as
$$ select string_to_array(name, '/') $$;

-- En Supabase el rol `authenticated` ya viene con permisos sobre public y
-- storage. Aca hay que concederlos para que RLS sea lo unico que decide.
grant usage on schema public, storage to authenticated;
alter default privileges in schema public grant all on tables to authenticated;
