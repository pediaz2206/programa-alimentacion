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

Una cuenta de prueba inicia sesión sin Google con una sesión real, el sistema la
reconoce como entrenador vinculado a un paciente sembrado, y el entrenador abre una
ficha con adherencia, constancia de registro y proteína contra objetivo. Lo que todavía
no existe está dicho en la pantalla, no escondido.

**FR:** FR-28, FR-29, FR-30, FR-31 · parcial de FR-1, FR-6, FR-19, FR-21
**Arquitectura:** AD-4 (la bandera de compilación), y lo mínimo de AD-1
**UX:** UX-DR6 (cuatro estados por superficie), UX-DR10 (se entra siempre como paciente)

**Cómo vuelve el feedback:** por WhatsApp, y lo anota Pablo a mano. Decidido, no
olvidado: con un solo probador, una pantalla de sugerencias es trabajo que no rinde.
Si aparece un segundo entrenador, se revisa.

**Un agujero que esta épica vuelve alcanzable:** `has_care_access` no mira el rol, así
que la política de fotos concede a cualquier profesional con vínculo activo y
consentido. Existe hoy y no lo abre esta épica —lo vuelve alcanzable, porque hasta ahora
no había forma de entrar como entrenador—. Se cierra en la 1.5 por la vía barata: una
función chica al lado, no el corte completo de `has_care_access`, que sigue siendo de la
épica 2.

**El orden importa:** la 1.2 aísla a las cuentas de prueba y la 1.3 les da la puerta
para entrar. En ese orden y no al revés: si la puerta se abre primero, existe una
ventana con cuentas de prueba capaces de iniciar sesión y todavía capaces de vincularse
con cuentas reales.

### Story 1.1: Las cuentas sembradas tienen contraseña

Como quien prepara la demo,
quiero que la semilla genere una contraseña al azar por cuenta y me la entregue una sola
vez,
para poder darle credenciales a mi socio sin que queden guardadas en ningún lado.

**Acceptance Criteria:**

**Given** que corro `sembrar.mjs` sin `--borrar`
**When** el script crea cada cuenta de prueba
**Then** le asigna una contraseña generada con `crypto.randomBytes`, distinta por cuenta
**And** no la escribe en ningún archivo del repositorio ni en la base fuera de `auth.users`

**Given** que corro el script en una terminal interactiva
**When** termina de sembrar
**Then** imprime las credenciales una sola vez, junto al email

**Given** que corro el script sin TTY —en CI, o con la salida redirigida a un archivo—
**When** llega al momento de imprimir
**Then** no imprime ninguna contraseña y aborta con un mensaje que explica por qué
**And** si de verdad las necesito ahí, `--credenciales=RUTA` las escribe a un archivo
fuera del repositorio, con permisos 600
**And** el motivo es que el scrollback de una terminal y los logs de un job son dos
lugares distintos, y el segundo lo lee cualquiera con acceso al repositorio

**Given** que vuelvo a correr `sembrar.mjs` sobre cuentas que ya existen
**When** el script las encuentra
**Then** no cambia sus contraseñas y avisa que las anteriores siguen valiendo
**And** para rotarlas hay que borrar y volver a sembrar

### Story 1.2: Las cuentas de prueba solo se vinculan entre ellas

Como paciente real de la app,
quiero que una cuenta de prueba nunca pueda vincularse conmigo,
para que una demo no toque mis datos de salud.

**Acceptance Criteria:**

**Given** una cuenta con `profiles.es_prueba = true`
**When** intenta crear un vínculo de cuidado con una cuenta que no es de prueba
**Then** la política lo rechaza, y no por el cliente sino por RLS

**Given** una cuenta real
**When** intenta invitar a una cuenta de prueba
**Then** la política lo rechaza igual, en la dirección contraria

**Given** que la política necesita leer `profiles.es_prueba` de la otra punta, y
`profiles` tiene RLS
**When** se implementa
**Then** la comprobación vive en una función de lectura, del mismo tipo que
`has_care_access`, y no en un `exists` suelto que la RLS de `profiles` va a bloquear

**Given** las dos direcciones
**When** corro `supabase/test/correr.sh`
**Then** hay una aserción para cada una, y fallan si alguien afloja la política

**Given** las cuentas sembradas entre sí
**When** la semilla crea sus vínculos
**Then** los crea sin problema, porque las dos puntas están marcadas como prueba

**Given** que ésta es la contención real de una cuenta de prueba
**When** se documenta qué alcanza
**Then** queda escrito que impide **vincularse** con cuentas reales, y que no impide que
una cuenta de prueba escriba lo suyo —su plan, sus comidas, sus fotos—
**And** para la demo eso está bien, porque lo suyo es de mentira; lo que no puede pasar
es que toque lo de otro

### Story 1.3: Entrar con email y contraseña, solo donde está habilitado

Como socio que va a probar la app,
quiero entrar con un email y una contraseña que me pasaron,
para poder recorrerla sin que me den de alta una cuenta de Google.

**Acceptance Criteria:**

**Given** un despliegue compilado con `VITE_LOGIN_PRUEBA` encendida
**When** abro la pantalla de bienvenida
**Then** además del botón de Google veo un formulario de email y contraseña
**And** al enviarlo con credenciales válidas obtengo una sesión real de Supabase, con las
mismas políticas de RLS que cualquier otra

**Given** un despliegue sin la bandera —producción—
**When** abro la pantalla de bienvenida
**Then** el formulario no está en la pantalla ni en el bundle
**And** una búsqueda del texto del formulario en `dist/` no lo encuentra

**Given** que la bandera saca el formulario pero no la capacidad
**When** se documenta qué es y qué no
**Then** queda escrito que **no es un control de seguridad**: el `grant_type=password`
lo atiende la API de Supabase, y AD-6 dice que producción y vista previa comparten una
sola base, así que esas credenciales sirven contra producción aunque ahí no haya
formulario
**And** la bandera es ergonomía —que nadie vea en producción una puerta que no le
corresponde—, y lo que de verdad contiene a una cuenta de prueba es la historia 1.2
**And** queda dicho acá para que nadie afloje la 1.2 creyendo que la bandera la cubre

**Given** que envío credenciales incorrectas
**When** el servidor responde
**Then** veo un mensaje que no distingue entre email inexistente y contraseña equivocada
**And** el formulario conserva el email escrito
**And** el motivo es el mismo por el que se invita por email sin resolverlo a un id: un
mensaje que confirma qué emails existen convierte la pantalla en un enumerador de
usuarios

**Given** que estoy con la sesión de prueba iniciada
**When** toco salir
**Then** la sesión se cierra igual que la de Google y vuelvo a la bienvenida

### Story 1.4: El rol de entrenador existe como fila, y abre la pestaña

Como entrenador,
quiero que la app sepa que soy entrenador y no nutricionista,
para ver la pestaña de seguimiento con la vista que me corresponde.

**Acceptance Criteria:**

**Given** la tabla nueva `professional_roles (person_id, rol)`, con `rol` en
`('nutricionista', 'entrenador')` y única por persona y rol
**When** se crea con su migración
**Then** nace con RLS activa y su política en el mismo archivo
**And** las políticas son dos y están nombradas: una de `select` sobre las filas propias
—`person_id = auth.uid()`— y ninguna de escritura desde el cliente, porque en esta épica
los roles los pone la semilla
**And** sin la de lectura, RLS niega por defecto y la pestaña no aparece para **nadie**,
lo que parece un error de esta historia y es una línea que faltó
**And** no trae columnas de matrícula ni de verificación: eso es la épica 3

**Given** que `care_relationships` gana la columna `rol`, con el mismo `check`
**When** la semilla crea sus vínculos
**Then** cada uno declara con qué rol se creó, que es lo que `personajes.mjs` ya
describe y hoy se pierde al sembrar

**Given** una sesión de una persona con una fila de rol
**When** abro la app
**Then** entro como paciente, y la pestaña de seguimiento aparece además de las demás
**And** si no tengo ninguna fila de rol, la pestaña no aparece

**Given** que `profiles.is_professional` sigue existiendo
**When** esta historia termina
**Then** la app lee el rol de `professional_roles` y ya no de esa columna
**And** la columna queda y la política `care_rel_invite` la sigue exigiendo: **esta
historia no la toca**. Consecuencia conocida y aceptada: un entrenador con fila de rol y
sin esa marca no puede invitar pacientes. En la épica 1 no molesta porque los vínculos
los crea la semilla, y unificar las dos fuentes es el trabajo de la épica 2
**And** queda dicho acá para que quien implemente encuentre esa política y sepa que no
es un descuido

### Story 1.5: La ficha del entrenador contesta si el trabajo rinde

Como entrenador,
quiero abrir la ficha de un paciente y ver si viene cumpliendo,
para saber con qué me encuentro antes de la sesión.

**Acceptance Criteria:**

**Given** que soy entrenador con un vínculo activo y consentido
**When** abro la ficha de ese paciente
**Then** veo adherencia sobre las comidas que esa persona tiene habilitadas, no sobre las
del plan
**And** veo la constancia de registro de los últimos días
**And** veo proteína promedio contra el objetivo en gramos
**And** los tres los calcula `packages/core`, sin cálculo nuevo en la pantalla

**Given** que FR-21 dice que el entrenador no ve el detalle plato por plato
**When** la ficha pide los datos
**Then** los pide a una vista con `security_invoker = true` que proyecta solo las
columnas que el entrenador puede ver —fecha, comida, porciones, proteína— y **no**
`note` ni `photo_path`
**And** la restricción es de columnas y no de filas porque RLS no restringe columnas:
esconderlas en el cliente dejaría los datos a un `curl` de distancia
**And** la vista devuelve filas, no agregados, para que el cálculo siga viviendo en
`packages/core` y la pantalla no se separe de la notificación (NFR-4)

**Given** que `Detalle` en `Pacientes.tsx` hoy renderiza `EditarPlan`, `CopiarPlan` y
`SubirPlan` sin mirar el rol
**When** entra un entrenador
**Then** esos tres controles no están: FR-10 dice que solo la nutricionista publica
**And** la política `plans_professional_write` sigue usando `has_care_access` y esta
historia **no la toca**: en el servidor un entrenador todavía podría insertar una
versión por API. Deuda conocida, la cierra `puede_prescribir()` en la épica 2
**And** se acepta para la épica 1 porque publicar es una escritura con autor y fecha
—queda registrada y se revierte—, no una lectura silenciosa de datos ajenos

**Given** que el componente `Consulta` ordena los puntos de atención por desvío, con
reglas incumplidas y fechas concretas
**When** entra un entrenador
**Then** ese componente no se renderiza: es el detalle plato por plato que FR-21 le niega
**And** no alcanza con sacarle columnas a la consulta si el resumen las reconstruye

**Given** que `meal_photos_professional_read` concede con `has_care_access`, que mira
vínculo activo, no revocado y consentido, pero **no mira el rol**
**When** un entrenador con vínculo activo y consentido le pide una foto al storage
**Then** la política se lo niega, porque pasa a exigir que el vínculo declare
`rol = 'nutricionista'`
**And** se implementa con una función nueva y chica al lado de `has_care_access` —misma
forma más la condición de rol—, sin partir `has_care_access`, que es trabajo de la
épica 2
**And** los vínculos existentes tienen `rol` nulo hasta que la épica 2 los migre, y nulo
niega: el default seguro es no ver la foto
**And** una persona con los dos roles sobre el mismo paciente ve las fotos por su vínculo
de nutricionista, porque la condición es del vínculo y no de la persona

**Given** que `misPacientes` filtra por `status = 'active'` y no por consentimiento
**When** tengo un vínculo activo con alguien que todavía no consintió —el caso
`entrenador-1 → paciente-c` de la semilla, puesto ahí para esto—
**Then** esa persona no aparece en mi lista
**And** el motivo no es cosmético: `patient_email` es columna de
`care_relationships` y la ve el profesional por `care_rel_visible`, así que sin este
filtro le estamos mostrando el email de alguien que no consintió nada (NFR-1)
**And** RLS no lo tapa, porque el email está una capa antes que los datos de salud

**Given** un vínculo pendiente, revocado o sin consentir
**When** intento abrir esa ficha
**Then** no aparece en mi lista, y pedirla directo por su id no devuelve datos
**And** hay una aserción por cada uno de los tres casos en `supabase/test`

**Given** el entrenador y las fotos
**When** corro `supabase/test/correr.sh`
**Then** hay una aserción que pide una foto como entrenador y espera que se la nieguen
**And** otra que la pide como nutricionista del mismo paciente y espera que se la den

**Given** una persona con los dos roles sobre el mismo paciente
**When** abre la ficha
**Then** ve la vista de nutricionista, que es la que incluye más

### Story 1.6: La pantalla dice qué es real y qué falta

Como socio que está evaluando el producto,
quiero que la app me diga qué está terminado y qué no,
para no confundir un hueco con un error y poder opinar sobre lo que hay.

**Acceptance Criteria:**

**Given** la ficha del entrenador
**When** la abro
**Then** lo que todavía no existe se dice **dentro** de lo que sí hay —una línea al pie
del bloque, "esto todavía no mira composición corporal"— y no como bloques vacíos con un
cartel de pendiente
**And** el motivo es que tres bloques anunciando ausencias hacen leer una lista de
faltantes en vez de un producto

**Given** un paciente sin mediciones cargadas
**When** abro su ficha
**Then** el bloque dice qué falta y cómo empezar, no muestra un cero
**And** eso se ve distinto de una función que no construimos: no hay datos y no existe
todavía no son lo mismo

**Given** que el servidor no responde
**When** ya tenía la ficha en pantalla
**Then** sigo viendo lo que había, con un aviso, y no una pantalla vacía

**Given** que la app está cargando y no hay copia local
**When** espero
**Then** veo un estado de carga; si hay copia local, no lo veo y se pinta lo que había

**Given** que `historia.mjs` genera los días hacia atrás desde la fecha de siembra
**When** la siembra tiene más de una semana
**Then** la pantalla lo dice —"esta siembra es del 10 de septiembre"— en vez de mostrar
adherencia cero, racha cero y proteína sin datos
**And** se arregla volviendo a sembrar, no corriendo las fechas al leer: esa base es la
misma que la de producción y no se le miente sobre cuándo pasaron las cosas
**And** sin el aviso, una semilla vencida se lee como un producto que no funciona

**Given** cualquiera de los cuatro estados
**When** los reviso
**Then** ninguno se apoya solo en el color para decir lo que dice
