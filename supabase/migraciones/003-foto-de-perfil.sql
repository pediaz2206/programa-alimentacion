-- Para proyectos que ya aplicaron el esquema anterior. Idempotente.
alter table public.profiles add column if not exists avatar_url text;
