---
title: "En Punto — comportamiento y arquitectura de información"
status: draft
created: 2026-09-09
updated: 2026-09-09
sources:
  - ../../prds/prd-programa-alimentacion-2026-09-09/prd.md
  - ./DESIGN.md
---

# En Punto — comportamiento

Identidad visual en `DESIGN.md`. Ante conflicto, mandan estas dos espinas por encima
de cualquier maqueta.

## Foundation

PWA en el teléfono, **iPhone primero**, agregada a la pantalla de inicio. Se usa
parada en una cocina, en la calle, o al final de una sesión de entrenamiento: **con
una mano y sin tiempo**. No hay sistema de UI de terceros; los componentes son propios
y viven en `apps/web/src/estilos.css`.

**Funciona sin señal.** Registrar una comida encola y sigue; la pantalla no espera al
servidor para dar por hecho lo que la persona ya hizo.

**Español rioplatense**, voseo. Sin internacionalización.

## Information Architecture

Cinco lugares para el paciente, dos más para quien tiene rol profesional.

| Superficie | Contesta | Quién |
|---|---|---|
| **Hoy** | ¿qué hago ahora? | paciente |
| **Plan** | ¿qué dice mi plan? | paciente |
| **Compras** | ¿qué me falta comprar? | paciente |
| **Registro** | ¿qué vengo comiendo y cómo vengo? | paciente |
| **Ajustes** | horarios, ayuno, quién me ve | paciente |
| **Pacientes** | ¿quién necesita mi atención? | profesional |
| **Ficha** | ¿qué pasa con esta persona? | profesional |

**Hoy es el default y es una sola cosa.** Elige un momento —comer ahora, preparar,
lo que viene— y lo muestra. El resto del día está abajo, plegado.

**Todo lo demás nace plegado**, con un resumen que se lee sin abrir. [Decisión de
Pablo, vigente.]

### Cambio de rol

Una cuenta puede ser paciente y profesional a la vez. **La app entra siempre como
paciente**: es lo que se usa todos los días, varias veces por día. El acceso
profesional es una pestaña más, no un modo aparte — no hay un selector de "entrar
como", porque obligaría a decidir antes de ver nada.

Requisito duro de esta etapa: **poder ingresar con un rol que no sea paciente** para
recorrer y mostrar las vistas profesionales.

## Voice and Tone

Dos frases, siempre en este orden: **qué hacer** y **por qué**. El porqué es la
indicación textual de la nutricionista, más chica y abajo.

- "Almuerzo ya trajo hidratos. Esta comida va sin hidratos."
- *"Si en el almuerzo predominó el carbohidrato, en la cena evitar agregarlo."*

Reglas de microcopy:

- **Menos texto.** Cada bloque dice una cosa. Si hay dos, son dos bloques o uno se va.
  [Molestia declarada: "mucho texto".]
- Segunda persona, voseo. "Te faltan dos frutas", no "El usuario debe consumir".
- Nunca culpa. "Comiste otra cosa" es un dato, no una falta.
- Un número siempre viene con su unidad y su referencia: "71 g sobre 110 g", no "71 g".
- Cuando no se sabe, se dice: "Con dos mediciones más ya se puede ver la tendencia."

## Component Patterns

- **Héroe de Hoy** — una sola cosa: el momento actual, su hora, y la acción principal.
- **Regla del plan** — consecuencia + cita. Aparece tanto en el aviso de ingredientes
  como en la comida: el aviso previo es cuando se decide qué cocinar.
- **Sugerencia de comida** — hoy muestra tres opciones como texto y solo la primera es
  accionable. Debe ser **elegible**: tocar una la vuelve la comida de este momento, y
  el checklist se rearma. [Molestia declarada: "las recomendaciones pueden ser
  dinámicas, algo que sea elegir otro plato".]
- **Reemplazo de ingrediente** — "no tengo" abre las equivalencias del grupo; tocar una
  cambia la línea y el botón pasa a "volver". El cambio queda en el registro con su
  nota. Falta: que la app **recuerde** los reemplazos frecuentes de esa persona y los
  ofrezca primero. [Molestia declarada: "que eso quede guardado en algún lugar".]
- **Sección plegable** — el resumen del encabezado dice qué hay adentro y cuánto.
- **Punto de atención** — en la ficha profesional: titular, dato que lo respalda, y
  fechas concretas donde mirar. Ordenados por cuánto cambian la conversación.

## State Patterns

Cada superficie define cuatro estados. **El vacío es el que más se ve y el que menos
se mira.**

| Estado | Regla |
|---|---|
| **Vacío** | Dice qué falta y cómo empezar, en una frase. Nunca una ilustración sola. |
| **Cargando** | Solo cuando no hay copia local. Si la hay, se pinta y se corrige en silencio. |
| **Error** | Qué pasó y qué se puede hacer. Lo que ya estaba sigue en pantalla. |
| **Sin señal** | Franja discreta. Registrar sigue funcionando; se avisa que está encolado. |

**Un estado no se anuncia hasta poder afirmarlo.** Pintar desde caché no es un error de
conexión: decirlo produjo una alerta que aparecía y se iba sola en cada recarga.

## Interaction Primitives

- **Un toque, un resultado.** Si algo necesita confirmación, es porque destruye.
- **Deshacer cuesta lo mismo que hacer.** El botón que cambió un ingrediente pasa a
  "volver" en el mismo lugar.
- **Optimista con reversa.** La pantalla aplica el cambio y lo revierte si el servidor
  lo rechaza, diciendo por qué. Nunca un éxito silencioso.
- **Área táctil mínima 44px.** Se usa con una mano y en movimiento.
- **El botón atrás del navegador funciona.** Cada pestaña es una ruta.
- Sin gestos ocultos: nada que solo se descubra deslizando.

## Accessibility Floor

- Contraste AA (4.5:1 en texto, 3:1 en elementos de interfaz).
- **El color nunca solo.** Cada color de estado va con palabra o ícono; los colores de
  grupo van con el nombre del grupo.
- Todo lo accionable es un `button` o un `a`, alcanzable por teclado, con foco visible.
- Las imágenes de comida llevan texto alternativo; las decorativas, `aria-hidden`.
- Se respeta `prefers-reduced-motion`.

## Densidad y reducción de texto

Sección propia porque es la molestia número uno declarada.

- Una pantalla, una pregunta. Si dos bloques contestan lo mismo, sobra uno.
- El detalle vive plegado o a un toque, nunca en el primer scroll.
- Las listas largas se cortan y ofrecen "ver todo", no se muestran enteras.
- Si un texto necesita más de dos líneas para decir algo accionable, no es accionable:
  es documentación, y va al Plan.

## Motivación y constancia

Se reconoce **constancia**, nunca se puntúa la comida.

- Se celebran: registrar varios días seguidos, completar el primer mes, cargar la
  primera medición, mantener una racha.
- **Nunca se pierde nada** por un desvío o una comida del 20%: son parte del plan.
- La racha no se corta por el día de hoy vacío, porque a las nueve de la mañana
  todavía no hay nada que registrar.
- Sin puntajes compuestos, sin rankings, sin comparación con otras personas.

Razón: gamificar el contenido del plato pone presión sobre comer, que es lo contrario
de lo que este producto quiere hacer.

## Responsive & Platform

- Diseñado a 320px de ancho; verificado a 320 y 390.
- Áreas seguras respetadas arriba y abajo; la barra fija no tapa contenido.
- Notificaciones push: en iOS requieren agregar a pantalla de inicio, y eso se explica
  donde se pide el permiso, no después de que falle.
- Cámara: se abre la trasera directamente para la foto de la comida.

## Key Flows

### KF-1 — Pablo resuelve el almuerzo sin arroz (climax: la comida cambia)

1. 12:45, llega el aviso: almuerzo en 45 minutos, con la lista.
2. Abre. El héroe muestra el momento y el checklist.
3. No tiene arroz. Toca **"no tengo"** en esa línea.
4. Se abren las equivalencias del grupo, con las cantidades de su plan.
5. **Toca "Lentejas".** La línea cambia a lentejas con su cantidad y el botón pasa a
   "volver". ← *climax*
6. Cocina, come, saca la foto, registra. El cambio queda guardado con su nota.

### KF-2 — Nadia prepara la consulta (climax: sabe por dónde empezar)

1. Entra a **Pacientes**. La lista prioriza a quien necesita atención.
2. Abre la ficha de Pablo.
3. **"Para la consulta"** dice cuántos puntos hay sin abrirla.
4. La despliega: cuatro días sin registro seguidos, proteína 20 g por debajo, una regla
   incumplida tres veces. Cada uno con las fechas. ← *climax*
5. Entra a la consulta sabiendo qué preguntar.

### KF-3 — Silvestre revisa si el trabajo rinde (climax: la lectura, no los números)

1. Martes, 20:00, terminó de entrenar a Pablo. Le midió pliegues.
2. Abre la ficha y **carga la medición** desde el teléfono, en la sesión.
3. Ve su vista: **está cumpliendo** (adherencia), **está registrando**, y **cómo viene
   la proteína** — lo que él necesita para saber si el músculo tiene con qué.
4. Debajo, la tendencia de composición y el cruce: *"el plan se siguió y la aguja no se
   movió: conviene revisarlo"*. ← *climax*
5. Cruza eso con lo que él sabe del entrenamiento, que vive fuera de la app.
6. Deja una **propuesta** para Nadia: mover la colación. Ella la aprueba y la versión
   sale firmada por ella.

### KF-4 — El socio recorre la app antes de opinar (climax: entra como otro rol)

1. Abre el enlace de prueba.
2. La pantalla de ingreso ofrece Google **y** email con contraseña.
3. Entra como `entrenador-1`. ← *climax*
4. Recorre la vista de entrenador con un mes de datos ya sembrados.
5. Sale, entra como `nutri-1`, compara.
6. Deja feedback sabiendo qué ve cada rol.

## Preguntas abiertas

1. **Cuánta proteína ve el entrenador.** Confirmado que la quiere. Falta decidir si ve
   el desglose por comida o solo el promedio contra objetivo.
2. **Reemplazos recordados.** ¿Se ofrecen primero los que esa persona ya usó, o se
   convierten en una preferencia explícita que ella edita?
3. **Elegir otro plato.** Al cambiar la sugerencia, ¿vale para hoy, o la app aprende
   que esa opción no le gusta y deja de proponerla?
4. **Dónde vive el reconocimiento de constancia** — ¿en Registro, en Hoy, o aparece
   solo cuando pasa algo?
