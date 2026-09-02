-- Migracion para proyectos que ya aplicaron la version anterior del esquema.
--
-- `create table if not exists` no altera una tabla existente, asi que
-- re-correr schema.sql no agrega estas columnas. Esto si.
--
-- Es idempotente: se puede correr dos veces sin romper nada.

alter table public.care_relationships
  add column if not exists patient_email text;

-- Los vinculos que ya existian tienen paciente pero no email: se completa
-- desde auth.users para poder poner la columna en not null.
update public.care_relationships r
set patient_email = u.email
from auth.users u
where u.id = r.patient_id and r.patient_email is null;

alter table public.care_relationships
  alter column patient_email set not null,
  alter column patient_id drop not null;

-- La restriccion vieja fallaba con patient_id nulo.
alter table public.care_relationships
  drop constraint if exists vinculo_no_es_uno_mismo;
alter table public.care_relationships
  add constraint vinculo_no_es_uno_mismo check (professional_id is distinct from patient_id);

-- El unique viejo no contemplaba invitaciones sin reclamar.
alter table public.care_relationships
  drop constraint if exists care_relationships_professional_id_patient_id_key;

create unique index if not exists care_rel_unico_email
  on public.care_relationships (professional_id, lower(patient_email));
create unique index if not exists care_rel_unico_paciente
  on public.care_relationships (professional_id, patient_id) where patient_id is not null;
