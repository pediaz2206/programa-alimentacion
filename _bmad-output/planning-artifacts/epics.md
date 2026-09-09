---
stepsCompleted: [1]
inputDocuments:
  - _bmad-output/planning-artifacts/prds/prd-programa-alimentacion-2026-09-09/prd.md
  - _bmad-output/planning-artifacts/architecture/architecture-programa-alimentacion-2026-09-09/ARCHITECTURE-SPINE.md
  - _bmad-output/planning-artifacts/ux-designs/ux-programa-alimentacion-2026-09-09/DESIGN.md
  - _bmad-output/planning-artifacts/ux-designs/ux-programa-alimentacion-2026-09-09/EXPERIENCE.md
  - docs/roles.md
  - supabase/semillas/README.md
---

# En Punto — Desglose en épicas

## Resumen

Desglose completo del épico de roles profesionales, desde los requisitos del PRD, las
dos espinas de UX y la espina de arquitectura, hasta historias implementables.

## Inventario de requisitos

### Requisitos funcionales

**A. Roles y matrícula**

- **FR-1** Un perfil puede tener cero, uno o varios roles profesionales (`nutricionista`, `entrenador`). Ser profesional no impide ser paciente.
- **FR-2** Al declararse profesional, la persona registra número de matrícula y jurisdicción. Obligatorio para el rol, no para la cuenta.
- **FR-3** Cada matrícula tiene estado de verificación (`sin verificar`, `verificada`, `rechazada`), con quién y cuándo la verificó.
- **FR-4** El estado de verificación es visible para los pacientes vinculados a ese profesional.
- **FR-5** La verificación inicial es manual, hecha por el equipo.

**B. Vínculos y consentimiento**

- **FR-6** Un vínculo declara con qué rol se creó.
- **FR-7** El consentimiento es por vínculo, no por persona.
- **FR-8** El paciente puede revocar cualquier vínculo cuando quiera, con efecto inmediato sobre todo lo compartido, fotos incluidas.
- **FR-9** El paciente ve en un solo lugar quién tiene acceso, con qué rol, desde cuándo y con qué estado de matrícula.

**C. Qué puede hacer cada rol**

- **FR-10** Solo `nutricionista` puede publicar una versión del plan.
- **FR-11** `entrenador` puede crear una propuesta de cambio: plan completo más nota.
- **FR-12** Una propuesta no rige: no la ve la app del paciente ni la agenda ni las notificaciones.
- **FR-13** La nutricionista aprueba o descarta, con respuesta opcional. Al aprobar se publica una versión firmada por ella.
- **FR-14** Ambos roles pueden invitar pacientes y registrar mediciones corporales.
- **FR-15** Ningún rol profesional registra comidas por el paciente.
- **FR-33** Una propuesta la leen su autor y quien puede prescribir para ese paciente. Nadie más, el paciente incluido.

**D. Vista de la nutricionista**

- **FR-16** Su ficha responde si la persona está siguiendo el plan y dónde se le complica: adherencia, proteína, comidas del 20%, reglas incumplidas, desvíos, días sin registro.
- **FR-17** Los indicadores se ordenan por cuánto cambian la conversación. Lo que no llama la atención no aparece.
- **FR-18** Puede publicar, versionar y comparar versiones del plan.

**E. Vista del entrenador**

- **FR-19** Su ficha responde si el trabajo está produciendo un cambio: tendencia de composición, de peso, y el cruce adherencia × cambio.
- **FR-20** El cruce se presenta como una lectura de cuatro casos, no como dos números sueltos.
- **FR-21** Ve adherencia, constancia de registro y proteína contra objetivo. No ve el detalle plato por plato.
- **FR-22** Puede registrar mediciones corporales y dejar propuestas. No carga rutinas.

**F. Composición corporal**

- **FR-23** Tres fuentes aceptadas, guardando cuál se usó: pliegues, bioimpedancia, circunferencias.
- **FR-24** Ninguna obligatoria. La pantalla muestra lo que haya y dice qué falta.
- **FR-25** Nunca se compara una medición contra la anterior: promedios contra promedios.
- **FR-26** Cuando no alcanza para una tendencia, se dice cuántas mediciones faltan.
- **FR-27** Se guarda de dónde salió cada número y quién lo cargó.
- **FR-32** Dos mediciones del mismo día y tipo pero distinto origen conviven; ninguna pisa a la otra.

**G. Acceso de prueba**

- **FR-28** Acceso por email y contraseña, adicional a Google, que emite una sesión real.
- **FR-29** Se muestra solo cuando el despliegue lo habilita. Por defecto apagado.
- **FR-30** Las cuentas de prueba están marcadas y solo se vinculan entre ellas.
- **FR-31** Las credenciales se generan al azar y se muestran una sola vez.

**H. Fricción del uso diario**

- **FR-34** Las opciones sugeridas son elegibles: tocar una la convierte en la comida de ese momento y el checklist se rearma.
- **FR-35** La app recuerda los reemplazos que esa persona ya usó y los ofrece primero.
- **FR-36** Se reconoce la constancia de registrar; nunca se puntúa lo que se comió.

### Requisitos no funcionales

- **NFR-1** Privacidad por defecto: sin vínculo activo, no revocado y consentido no se comparte nada. Verificado con pruebas de permisos.
- **NFR-2** La revocación es inmediata, en la misma petición, fotos incluidas.
- **NFR-3** Sin autoridad inventada: la app aplica las reglas de la profesional y cita su texto.
- **NFR-4** Coherencia entre pantalla y notificación: motor puro y determinista compartido.
- **NFR-5** Funciona sin señal: registrar no depende de la conexión.
- **NFR-6** iPhone primero: uso en la calle, con una mano.
- **NFR-7** Trazabilidad clínica: toda versión publicada con autor y fecha; los registros apuntan a la versión vigente.

### Requisitos adicionales (Arquitectura)

Sin plantilla inicial: es brownfield sobre un repositorio existente.

- **AD-1** `professional_roles`, una fila por persona y rol, con matrícula, jurisdicción y estado. `profiles.is_professional` queda derivado y en desuso. Requiere migración de las cuentas existentes.
- **AD-2** RLS es el piso. Solo las transiciones multi-tabla se encapsulan en una función `SECURITY DEFINER`; la primera es `aprobar_propuesta(id, respuesta)`. Prohibido crear funciones para escrituras de una sola tabla.
- **AD-3** `body_metrics(patient_id, local_date, tipo, valor, unidad, origen, cargado_por)`. La lista blanca de `tipo` y `origen` se declara en `packages/core` y el `check` de SQL se genera desde ahí. La identidad incluye `origen`. Requiere migrar `body_measurements`.
- **AD-4** El formulario de email y contraseña se compila solo con `VITE_LOGIN_PRUEBA`; se enciende únicamente en despliegues de vista previa.
- **AD-5** `has_care_access()` gobierna lectura; `puede_prescribir()` es nueva y gobierna la escritura de `plans` y `plan_versions`. Toda tabla clínica nueva declara con cuál se lee y se escribe.
- **AD-6** Una propuesta la leen su autor y quien puede prescribir para ese paciente.
- Convención: toda tabla nueva nace con RLS y su política en el mismo archivo. Toda política nueva suma una aserción a `supabase/test`. Toda regla de dominio suma un test en `packages/core`.
- Convención: enumerados como `text` con `check`, no como tipo enum. Fechas locales como `date`.
- Entornos: producción sin la bandera; vista previa con la bandera y datos sembrados; una sola base para ambos.

### Requisitos de diseño de UX

- **UX-DR1** Componente **Regla del plan**: franja de color, consecuencia en negrita, indicación textual de la nutricionista debajo y más chica. Aparece en la comida y en el aviso de ingredientes.
- **UX-DR2** Componente **Sugerencia de comida elegible**: hoy es texto y solo la primera opción es accionable.
- **UX-DR3** Componente **Reemplazo de ingrediente** con memoria: los ya usados se ofrecen primero.
- **UX-DR4** Componente **Punto de atención** para la ficha profesional: titular, dato que lo respalda, fechas concretas.
- **UX-DR5** Componente **Fila de dos columnas**: si nombre y cantidad no entran juntos, la cantidad baja de línea; el nombre nunca se aplasta. Prohibido `overflow-wrap: anywhere` en un elemento flexible.
- **UX-DR6** Cuatro **estados por superficie** definidos: vacío con qué falta y cómo empezar, cargando solo sin copia local, error con lo que ya estaba en pantalla, sin señal con registro habilitado.
- **UX-DR7** **Densidad**: una pantalla, una pregunta. El detalle vive plegado. Si algo necesita más de dos líneas para ser accionable, va al Plan.
- **UX-DR8** **Primitivas de interacción**: un toque un resultado; deshacer cuesta lo mismo que hacer; optimista con reversa; área táctil mínima 44px; el botón atrás del navegador funciona.
- **UX-DR9** **Piso de accesibilidad**: contraste AA, el color nunca solo, todo accionable es `button` o `a` con foco visible, `prefers-reduced-motion` respetado.
- **UX-DR10** **Cambio de rol**: la app entra siempre como paciente; el acceso profesional es una pestaña, no un modo aparte.
- **UX-DR11** **Motivación**: se reconoce constancia, nunca se puntúa la comida. La racha no se corta por el día de hoy vacío.
- **UX-DR12** **Voz**: dos frases en orden fijo, qué hacer y por qué, donde el porqué es la cita textual de la profesional.
- **UX-DR13** **Tokens de diseño** ya existentes documentados en `DESIGN.md`: tres colores de estado con trabajo fijo, cinco de grupo que nunca indican estado, radios por tamaño, un solo nivel de sombra. Sin `color-mix` ni `backdrop-filter`.

### Mapa de cobertura de FR

Pendiente: se completa en el paso 2, al diseñar las épicas.

## Lista de épicas

Pendiente: se completa en el paso 2.
