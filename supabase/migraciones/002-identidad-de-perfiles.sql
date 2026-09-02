-- Para proyectos que ya aplicaron el esquema anterior. Idempotente.
--
-- Sin esto, con mas de una nutricionista el paciente ve "Tu nutricionista" en
-- todas las invitaciones: no hay forma de saber quien pide acceso a sus datos.

alter table public.profiles add column if not exists email text;

create or replace function public.es_mi_profesional(profesional uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.care_relationships r
    where r.professional_id = profesional
      and r.patient_id = auth.uid()
      and r.status <> 'revoked'
  );
$$;

revoke all on function public.es_mi_profesional(uuid) from public;
grant execute on function public.es_mi_profesional(uuid) to authenticated;

drop policy if exists profiles_patient_read on public.profiles;
create policy profiles_patient_read on public.profiles
  for select using (public.es_mi_profesional(id));
