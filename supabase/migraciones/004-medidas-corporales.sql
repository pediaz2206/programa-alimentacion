-- Medidas corporales: la pregunta que ninguna metrica del plan contesta.
--
-- Adherencia, racha y proteina promedio miden si la persona siguio el plan.
-- Ninguna mide si el plan esta funcionando. En recomposicion corporal eso
-- importa el doble, porque la balanza sola miente: sube musculo, baja grasa,
-- el numero no se mueve, y quien lo mira concluye que no sirve. Por eso se
-- guardan dos series, no una, y la pantalla muestra tendencia y no el dato
-- suelto del dia.
--
-- Requiere: schema.sql (has_care_access, care_relationships).

create table if not exists public.body_measurements (
  id           uuid primary key default gen_random_uuid(),
  patient_id   uuid not null references auth.users (id) on delete cascade,
  local_date   date not null,
  -- Ambas opcionales: pesarse sin cinta es valido, y medirse sin balanza
  -- tambien. Exigir las dos garantiza que un dia no se registre ninguna.
  weight_kg    numeric(5,2) check (weight_kg > 0 and weight_kg < 400),
  waist_cm     numeric(5,1) check (waist_cm > 0 and waist_cm < 300),
  note         text,
  created_at   timestamptz not null default now(),
  -- Una medicion por dia: la segunda del dia corrige a la primera.
  unique (patient_id, local_date),
  -- Una fila sin ninguna medida no es un dato, es ruido.
  constraint body_measurements_algo_que_medir
    check (weight_kg is not null or waist_cm is not null)
);

create index if not exists body_measurements_patient_date_idx
  on public.body_measurements (patient_id, local_date desc);

alter table public.body_measurements enable row level security;

-- Estos son datos de salud: el dueno es quien los carga.
drop policy if exists body_measurements_patient on public.body_measurements;
create policy body_measurements_patient on public.body_measurements
  for all using (patient_id = auth.uid()) with check (patient_id = auth.uid());

-- La profesional los lee bajo la misma condicion que el resto: vinculo
-- activo, no revocado y consentido. Nunca escribe: el peso lo reporta quien
-- se pesa.
drop policy if exists body_measurements_professional_read on public.body_measurements;
create policy body_measurements_professional_read on public.body_measurements
  for select using (public.has_care_access(patient_id));
