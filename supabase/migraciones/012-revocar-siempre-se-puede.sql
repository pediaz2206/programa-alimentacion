-- Revocar un vinculo no puede estar bloqueado por el aislamiento de prueba.
--
-- La 006 le agrego a `care_rel_update` la condicion de que las dos puntas
-- coincidan en `es_prueba`. Correcta para crear o reforzar un vinculo, y
-- equivocada para terminarlo: un vinculo mixto —real con cuenta de prueba—
-- quedaba congelado. Ninguna de las dos partes podia revocarlo ni consentirlo,
-- porque toda escritura chocaba con la misma condicion.
--
-- Esos vinculos existen a proposito: `sembrar.mjs --profesional=vos@gmail.com`
-- los crea con `service_role`, que saltea RLS, para poder mirar la vista
-- profesional desde una cuenta de Google real. Una vez creados, nadie los
-- podia cortar desde la app.
--
-- El principio: el aislamiento impide CREAR o REFORZAR un vinculo entre una
-- cuenta real y una de prueba. Nunca impide TERMINARLO. Revocar solo quita
-- acceso, asi que dejarlo pasar no puede abrir nada.
--
-- Requiere: schema.sql, 006-aislar-cuentas-de-prueba.sql

drop policy if exists care_rel_update on public.care_relationships;
create policy care_rel_update on public.care_relationships
  for update using (patient_id = auth.uid() or professional_id = auth.uid())
  with check (
    (patient_id = auth.uid() or professional_id = auth.uid())
    and (patient_id is null
         -- Revocar siempre se puede: la fila que resulta no concede nada.
         or status = 'revoked'
         or public.es_cuenta_de_prueba(professional_id) = public.es_cuenta_de_prueba(patient_id))
  );
