# Roles: paciente, nutricionista, entrenador

Decisiones tomadas el 2026-09-09, antes de escribir código. Este documento es
el insumo del PRD: fija qué puede hacer cada uno y qué cambia en el esquema.

## Por qué hay un rol nuevo

Hasta acá había un solo permiso profesional (`profiles.is_professional`) que
habilitaba todo: ver el seguimiento y publicar versiones del plan de
alimentación. Con un entrenador en el equipo eso deja de alcanzar, y no por una
razón de producto sino de incumbencia: **prescribir alimentación es del
nutricionista**. Un entrenador que publica planes de comida pone el riesgo
profesional del lado de quien opera la app.

## Las tres decisiones

### 1. El entrenador lee y sugiere, no publica

Ve el seguimiento bajo las mismas condiciones que hoy —vínculo activo, no
revocado y consentido— pero **no todo**: adherencia, constancia de registro,
proteína contra objetivo, peso y cintura.

> **Corregido el 2026-09-11.** Este párrafo decía "todo el seguimiento […]
> registros, fotos, resumen de consulta". El PRD lo acotó después: FR-21 le
> niega al entrenador el detalle plato por plato. Sin fotos y sin el resumen de
> consulta, que reconstruye el desvío con fechas concretas. La pregunta del
> entrenador es si el trabajo está produciendo un cambio, y para eso no hace
> falta saber qué comió el martes.
>
> Lo aplica el servidor: la vista `registro_sin_detalle` no tiene esas
> columnas, y `ve_fotos()` exige que el vínculo declare `nutricionista`.

Sobre el plan **puede dejar una propuesta**, no un cambio. La propuesta llega a
la nutricionista, que la aprueba o la descarta. Si la aprueba, se publica una
versión nueva firmada por ella.

Esto vale la pena aunque cueste más que "solo lectura": el entrenador es quien
ve el rendimiento en la sesión, y "este tipo entrena en ayunas y se descompone"
es información que hoy se pierde en un WhatsApp. Lo que no puede es convertir
esa observación en una indicación sin que ella la firme.

### 2. Por ahora el entrenador no carga entrenamientos

Rutinas, ejercicios, series y registro de sesiones son un producto entero
adentro de este. Primero validamos el rol, el vínculo y el circuito de
propuestas con usuarios reales; el módulo de entrenamiento va a su propio
épico, si el uso lo justifica.

### 3. Los roles se acumulan

Una misma persona puede ser nutricionista, entrenador, las dos cosas, o
ninguna. Modela la realidad —hay profesionales con las dos formaciones— y evita
cuentas duplicadas y vínculos duplicados con el mismo paciente.

Además, **paciente no es un rol**: cualquiera es paciente de sí mismo. Una
nutricionista puede seguir su propio plan, y eso ya funciona así.

## Qué cambia en el esquema

### `profiles`: de un booleano a un conjunto

`is_professional boolean` no puede representar "nutricionista y entrenador".
Pasa a un conjunto de roles, conservando el booleano mientras haya código que
lo lea, para poder migrar sin romper.

    roles text[] not null default '{}'   -- 'nutricionista' | 'entrenador'

Migración: `is_professional = true` → `roles = '{nutricionista}'`, que es lo
que esas cuentas son hoy.

### `care_relationships`: el vínculo dice con qué rol

Un paciente puede tener a la vez nutricionista y entrenador, y son dos vínculos
distintos con permisos distintos. El vínculo gana una columna:

    rol text not null check (rol in ('nutricionista', 'entrenador'))

El consentimiento sigue siendo por vínculo: aceptar a la nutricionista no
acepta al entrenador. Eso ya es lo correcto y no cambia.

### `has_care_access` se parte en dos

Hoy contesta una sola pregunta: "¿puede ver?". Ahora hacen falta dos, porque
ver y prescribir dejaron de ser lo mismo.

- `has_care_access(patient)` — sigue igual, cualquier rol vinculado y consentido.
  Lo usan las políticas de lectura: `meal_logs`, `body_measurements`, las fotos,
  las vistas de resumen.
- `puede_prescribir(patient)` — solo `rol = 'nutricionista'`. Lo usa la escritura
  de `plans` y `plan_versions`.

### Tabla nueva: `plan_proposals`

El circuito de propuesta y aprobación. Una propuesta no es una versión: no la
lee la app del paciente ni la agenda, solo espera decisión.

    plan_proposals
      id, patient_id, author_id, plan_id
      doc jsonb            -- el plan propuesto, completo
      nota text            -- por qué
      estado               -- 'pendiente' | 'aprobada' | 'descartada'
      resuelta_por, resuelta_en, respuesta text

Al aprobarse se inserta una `plan_versions` con `author_id` = quien aprueba,
citando la propuesta. La autoría queda de la nutricionista, que es quien firma.

## Qué ve cada uno

| | Paciente | Nutricionista | Entrenador |
|---|---|---|---|
| Su plan y su agenda | sí | del paciente | del paciente |
| Registrar comidas | sí | — | — |
| Peso y cintura | carga y ve | ve | ve |
| Fotos de comidas | sí | ve | ve |
| Resumen de consulta | — | sí | sí |
| Publicar versión del plan | — | **sí** | no |
| Proponer un cambio | — | (no hace falta) | **sí** |
| Aprobar una propuesta | — | **sí** | no |
| Invitar pacientes | — | sí | sí |
| Cortar el vínculo | **sí, siempre** | — | — |

Lo que no cambia: el consentimiento es explícito y por vínculo, revocar tiene
efecto inmediato sobre todo —fotos ya subidas incluidas—, y el paciente puede
cortar cuando quiera sin pedir permiso.

## Preguntas abiertas

Para resolver en la fase de PRD, no antes:

1. **Dos nutricionistas sobre el mismo paciente.** Hoy gana la última
   publicación, queda auditado pero nada lo impide. ¿Se bloquea, se avisa, o se
   acepta y se muestra quién publicó qué?
2. **Alta de profesionales.** ¿Cualquiera puede marcarse como nutricionista, o
   hace falta verificación de matrícula? Es una decisión de confianza y de
   riesgo, no técnica.
3. **Qué ve el entrenador del plan de comidas.** Ver el plan completo es
   razonable para proponer sobre él, pero es información de salud. ¿Todo, o solo
   los grupos y horarios?
4. **Baja de un profesional.** Si una nutricionista deja el equipo, sus planes
   publicados siguen rigiendo. ¿Quién los hereda?

## Usuarios de prueba

Para probar el 100% de la app hace falta cubrir cada celda de la tabla y cada
transición de estado del vínculo. El set mínimo:

- **paciente-a** — plan activo, un mes de registros, mediciones. El caso feliz.
- **paciente-b** — invitado y sin aceptar todavía. Prueba que no se filtra nada.
- **paciente-c** — plan activo pero **sin config**, que hoy hace que el resumen
  de consulta no aparezca. Es el primer bug que van a encontrar.
- **paciente-d** — vínculo revocado. Prueba que el corte es inmediato.
- **nutri-1** — sigue a a, b, c.
- **nutri-2** — sigue solo a **paciente-a**, para el caso de dos profesionales.
- **entrenador-1** — sigue a **paciente-a**, con propuestas en los tres estados.
- **mixto-1** — nutricionista y entrenador a la vez, y además paciente de nutri-1.

Los datos de prueba son datos de salud igual que los reales: van marcados como
tales desde el arranque, no después.
