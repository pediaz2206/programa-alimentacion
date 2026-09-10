---
stepsCompleted: [1, 2]
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

| FR | Épica | Qué entrega |
|---|---|---|
| FR-28..FR-31 | 1 | Acceso de prueba y una vista de entrenador real pero incompleta |
| FR-19, FR-21 | 1 | (parcial: adherencia, constancia y proteína, que ya están calculadas) |
| FR-1, FR-6 | 1 | (parcial: el rol mínimo para que Silvestre entre como entrenador) |
| FR-1, FR-6, FR-10, FR-14, FR-15 | 2 | Roles y quién puede prescribir, en la base |
| FR-2, FR-3, FR-4, FR-5 | 3 | Matrícula y verificación |
| FR-7, FR-8, FR-9 | 4 | Consentimiento y revocación vistos por el paciente |
| FR-23..FR-27, FR-32 | 5 | Composición corporal desde donde se pueda |
| FR-16, FR-17, FR-18, FR-19, FR-20, FR-21, FR-22 | 6 | Las dos fichas completas |
| FR-11..FR-13, FR-33 | 7 | Circuito de propuestas |
| FR-34..FR-36 | 8 | Fricción del uso diario |

Los 36 FR quedan cubiertos. Tres aparecen dos veces a propósito —FR-1, FR-6, FR-19 y
FR-21—: la épica 1 entrega la parte que se puede mostrar, la épica que corresponda
entrega el resto. En cada caso la épica 1 dice explícitamente qué deja afuera.

**Requisitos de UX por épica:** UX-DR6 → 1 · UX-DR10 → 2 · UX-DR4 → 6 · UX-DR2, DR3, DR7, DR9, DR11 → 8.

**Ya construidos, sin historia**: UX-DR1 (Regla del plan), UX-DR5 (fila de dos
columnas), UX-DR12 (voz) y UX-DR13 (tokens) documentan lo que ya existe en el código.
Entran como criterio de aceptación de otras historias, no como trabajo propio.

## Cómo está partido esto, y por qué

Este desglose se rehízo después de una mesa redonda. La primera versión agrupaba por
capa —primero todos los roles, después toda la composición corporal, después las dos
vistas—, y la objeción que la tumbó fue del propio documento: la definición de terminado
del épico dice que el socio entra y recorre **las tres vistas**, y esa estructura
entregaba una sola vista recién en la quinta épica.

La estructura de ahora es una **tajada vertical primero**: la épica 1 atraviesa las tres
capas —acceso, roles y pantalla— con lo mínimo de cada una para que Silvestre entre como
entrenador y vea algo real. Es deliberadamente incompleta, y la pantalla lo dice: cada
indicador está rotulado con lo que ya funciona y lo que todavía no, igual que la pieza
que ya se le mandó. Una vista incompleta que se anuncia es una demo honesta; una que
disimula es una mentira que después hay que desarmar.

Las otras dos correcciones de la mesa:

- **La épica de roles se partió en tres.** Migrar `is_professional` a
  `professional_roles` (dato), partir `has_care_access` en ver y prescribir (política de
  acceso) y la pantalla de "quién me ve" no tienen el mismo perfil de riesgo. Un error de
  migración se revierte; un error de política filtra datos clínicos; un error de pantalla
  se corrige el martes. No van en el mismo canasto.
- **La composición corporal cambió de fuente principal.** No hay balanza de
  bioimpedancia. Los pliegues los mide Silvestre, así que la fuente primaria es
  profesional y no del paciente, y las circunferencias —que el paciente sí puede
  medirse— pasan a ser el camino que funciona sin nadie más. La bioimpedancia queda
  aceptada por el modelo pero sin pantalla propia hasta que exista un equipo.

## Lista de épicas

### Épica 1: Silvestre entra como entrenador y ve algo que es cierto

La tajada vertical. Una cuenta de prueba inicia sesión sin Google con una sesión real,
el sistema la reconoce como entrenador vinculado a un paciente sembrado, y el entrenador
abre una ficha que muestra adherencia, constancia de registro y proteína contra
objetivo —los tres indicadores que `packages/core` ya calcula—. Cada bloque que todavía
no existe aparece rotulado como pendiente, no oculto.

Es lo más chico que produce feedback real de un entrenador, y no depende de ninguna otra
épica.

**FR cubiertos:** FR-28, FR-29, FR-30, FR-31 · parcial de FR-1, FR-6, FR-19, FR-21
**Deja afuera, a propósito:** composición corporal, propuestas de cambio, matrícula,
verificación, y la vista de la nutricionista. Todo eso está rotulado en pantalla.
**Notas:** AD-4 manda: el formulario de email y contraseña se compila solo con
`VITE_LOGIN_PRUEBA`, encendido únicamente en vista previa. La semilla ya existe; hay que
sumarle contraseñas al azar mostradas una sola vez. El rol se resuelve con lo mínimo de
`professional_roles` —una fila, sin matrícula ni verificación— para no adelantar la
épica 2. UX-DR6: los cuatro estados por superficie valen desde esta pantalla.

### Épica 2: El rol vive en la base y decide quién prescribe

`professional_roles` reemplaza a `profiles.is_professional`, con las cuentas existentes
migradas, y `has_care_access` se parte en ver y prescribir. A partir de acá el sistema
sabe que solo la nutricionista publica una versión del plan y que ningún rol registra
comidas por el paciente.

**FR cubiertos:** FR-1, FR-6, FR-10, FR-14, FR-15
**Notas:** AD-1 y AD-5. Dos perfiles de riesgo distintos conviviendo acá, y la mesa
pidió que se traten como tales: la migración de datos se hace y se verifica antes de que
`puede_prescribir()` gobierne una sola escritura. Cada política nueva suma su aserción a
`supabase/test`. UX-DR10: se entra siempre como paciente; lo profesional es una pestaña.

### Épica 3: La matrícula, y que se note si está verificada

Quien se declara profesional registra matrícula y jurisdicción, el equipo las verifica a
mano, y el estado —sin verificar, verificada, rechazada— lo ve el paciente vinculado.

**FR cubiertos:** FR-2, FR-3, FR-4, FR-5
**Notas:** Es el requisito comercial que puso Pablo: quien entra a la plataforma como
profesional tiene matrícula. Va después de la épica 2 porque necesita que el rol exista
como fila, y antes de cualquier venta.

### Épica 4: El paciente ve quién lo ve, y lo corta cuando quiere

El consentimiento es por vínculo, no por persona. El paciente abre una pantalla y ve
quién tiene acceso, con qué rol, desde cuándo y con qué estado de matrícula, y puede
revocar cualquiera con efecto inmediato sobre todo lo compartido, fotos incluidas.

**FR cubiertos:** FR-7, FR-8, FR-9
**Notas:** NFR-1 y NFR-2 se verifican acá con pruebas de permisos: revocado significa
revocado en la misma petición, y el bucket privado deja de responder. Es la pantalla que
convierte la política en algo que el paciente puede ver.

### Épica 5: Medir el cuerpo desde donde se pueda

Circunferencias que el paciente se toma solo, pliegues que le mide Silvestre, y
bioimpedancia si alguna vez hay equipo: se registra lo que haya, se guarda de dónde salió
y quién lo cargó, y la tendencia se lee por promedios contra promedios, nunca punto
contra punto.

**FR cubiertos:** FR-23, FR-24, FR-25, FR-26, FR-27, FR-32
**Notas:** AD-3. Sin balanza en el equipo, la única fuente que un paciente solo puede
producir son las circunferencias: esa es la que tiene pantalla de carga propia. Los
pliegues los carga el profesional. La bioimpedancia queda en la lista blanca de
`packages/core` sin formulario dedicado. Incluye migrar `body_measurements`.

### Épica 6: Cada profesional ve su pregunta contestada

La nutricionista abre una ficha y sabe si la persona está asimilando el plan. El
entrenador abre la misma ficha y sabe si el trabajo está produciendo un cambio. Acá se
completa la vista que la épica 1 dejó rotulada como pendiente.

**FR cubiertos:** FR-16, FR-17, FR-18, FR-19, FR-20, FR-21, FR-22
**Notas:** Las dos vistas comparten la pantalla de ficha, así que van juntas para no
tocar los mismos archivos dos veces. El cruce adherencia × cambio (FR-20) es cálculo de
`packages/core`, no de pantalla. UX-DR4: cada indicador es un punto de atención con
titular, dato que lo respalda y fechas concretas. Los rótulos de "pendiente" de la
épica 1 se caen a medida que esta épica los reemplaza.

### Épica 7: El entrenador propone, la nutricionista firma

Un entrenador deja una propuesta de cambio de plan con su motivo; la nutricionista la
aprueba y sale una versión nueva firmada por ella, o la descarta con una respuesta. El
paciente nunca ve una propuesta que no rige.

**FR cubiertos:** FR-11, FR-12, FR-13, FR-33
**Notas:** AD-2 (la transición va en `aprobar_propuesta()`, en una transacción) y AD-6
(quién lee una propuesta). Necesita la épica 2 —`puede_prescribir()`— y la 6 —el
entrenador propone desde la ficha que ya lee—.

### Épica 8: Que deje de sentirse rebuscada

Las sugerencias se eligen tocándolas, los reemplazos frecuentes se recuerdan, se
reconoce la constancia sin puntuar la comida, y las pantallas dicen una cosa cada una.

**FR cubiertos:** FR-34, FR-35, FR-36
**Notas:** Sale del descubrimiento de UX. Incluye UX-DR7 (densidad, la molestia número
uno declarada) y UX-DR9 (piso de accesibilidad). Es la única épica que mejora lo que ya
existe en vez de agregar algo nuevo, y la única que se puede adelantar en cualquier
momento: no depende de ninguna otra.
