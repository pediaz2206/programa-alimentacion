-- El rol profesional vive en su propia tabla, y el vinculo declara con cual se
-- creo.
--
-- Hasta ahora `profiles.is_professional` era un si o un no, y la app asumia
-- que ese si queria decir nutricionista. Con el entrenador esa suposicion se
-- rompe: son dos roles distintos, con vistas distintas y permisos distintos.
--
-- Alcance a proposito acotado: esta migracion NO borra is_professional ni
-- toca las policias que la exigen (care_rel_invite sigue pidiendola). Unificar
-- las dos fuentes y partir has_care_access en ver y prescribir es la epica 2.
--
-- Requiere: schema.sql

create table if not exists public.professional_roles (
  person_id  uuid not null references auth.users (id) on delete cascade,
  -- Enumerado como text con check, no como tipo enum: agregar un valor a un
  -- enum de Postgres no se puede revertir dentro de una transaccion.
  rol        text not null check (rol in ('nutricionista', 'entrenador')),
  created_at timestamptz not null default now(),
  primary key (person_id, rol)
);

alter table public.professional_roles enable row level security;

-- Cada uno ve sus propios roles. Sin esta policy RLS niega por defecto y la
-- pestana profesional no aparece para nadie.
drop policy if exists roles_propios_ver on public.professional_roles;
create policy roles_propios_ver on public.professional_roles
  for select using (person_id = auth.uid());

-- Y se declara a si mismo, que es lo que hace hoy la casilla "soy
-- nutricionista". Declararse sin matricula es lo que hay hasta la epica 3;
-- esto no lo empeora, solo lo muda de tabla.
drop policy if exists roles_propios_declarar on public.professional_roles;
create policy roles_propios_declarar on public.professional_roles
  for insert with check (person_id = auth.uid());

drop policy if exists roles_propios_borrar on public.professional_roles;
create policy roles_propios_borrar on public.professional_roles
  for delete using (person_id = auth.uid());

-- Las cuentas que ya se habian declarado profesionales pasan a la tabla nueva
-- como nutricionistas, que es lo que la casilla dice literalmente ("Soy
-- nutricionista") y lo que la pestana les mostraba.
--
-- Sin este relleno, la app deja de leer is_professional y las cuentas que hoy
-- son profesionales se quedan sin la pestana. Es la unica parte de la
-- migracion de datos que se adelanta de la epica 2, y se adelanta porque sin
-- ella esto es una regresion en vez de un cambio.
insert into public.professional_roles (person_id, rol)
select p.id, 'nutricionista' from public.profiles p where p.is_professional
on conflict do nothing;

-- Con que rol se creo el vinculo. Nulo en los que ya existen: nulo niega,
-- asi que donde se exija un rol, no tenerlo es no tenerlo.
alter table public.care_relationships
  add column if not exists rol text;

do $$
begin
  alter table public.care_relationships
    add constraint care_relationships_rol_check
    check (rol in ('nutricionista', 'entrenador'));
exception when duplicate_object then null;
end $$;

-- Los vinculos que ya existen son todos de nutricionista: hasta ahora
-- `is_professional` era el unico permiso y la casilla que lo enciende dice,
-- literal, "Soy nutricionista". No hay un solo vinculo de entrenador anterior
-- a esta migracion, asi que el relleno no adivina nada.
--
-- Sin el, esos vinculos quedan en nulo y pierden las fotos, que hoy si ven.
-- El default sigue siendo nulo para los que se creen sin declarar rol, y nulo
-- niega.
update public.care_relationships set rol = 'nutricionista' where rol is null;

comment on column public.care_relationships.rol is
  'Con que rol se creo el vinculo. La misma persona puede seguir a alguien como nutricionista y a otro como entrenador.';
