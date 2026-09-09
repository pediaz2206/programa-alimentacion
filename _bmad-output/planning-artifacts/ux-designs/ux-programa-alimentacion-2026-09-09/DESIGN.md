---
title: "En Punto — identidad visual"
status: draft
created: 2026-09-09
updated: 2026-09-09
sources:
  - ../../prds/prd-programa-alimentacion-2026-09-09/prd.md
  - ../../../../docs/roles.md
colors:
  papel: "#F5F7F1"
  superficie: "#FFFFFF"
  superficie-2: "#EEF1E9"
  tinta: "#131A15"
  tenue: "#5F6A61"
  linea: "#DDE3D7"
  verde: "#2E6B4A"
  verde-suave: "#E4EFE7"
  indigo: "#3E4E8F"
  indigo-suave: "#E5E8F4"
  ambar: "#9C6F17"
  ambar-suave: "#F6EDD8"
  g-proteinas: "#B0523B"
  g-hidratos: "#B4862F"
  g-vegetales: "#4A8B57"
  g-frutas: "#9E4479"
  g-grasas: "#7A7534"
typography:
  cuerpo: "Archivo, 'Helvetica Neue', Arial, sans-serif"
  titulos: "'Bricolage Grotesque', Archivo, sans-serif"
  cifras: "'IBM Plex Mono', ui-monospace, monospace"
  base: "14px"
  escala: "11.5 · 12.5 · 13.5 · 16 · 18 · 26"
rounded:
  chip: "7px"
  control: "9px"
  bloque: "10px"
  tarjeta: "14px"
spacing:
  fila: "4px"
  interno: "8px"
  bloque: "12px"
  tarjeta: "16px"
components:
  tarjeta: "superficie sobre papel, radio tarjeta, sombra suave"
  chip: "estado en una palabra, radio chip"
  regla: "franja de color a la izquierda, dos niveles de texto"
  barra: "navegación fija abajo, 62px"
---

# En Punto — identidad visual

## Brand & Style

**En punto** significa dos cosas y el producto hace las dos: a la hora exacta, y en
el punto justo de cocción. La identidad tiene que sonar a cocina de casa, no a
laboratorio ni a gimnasio.

El registro es el de alguien que sabe y no te lo restriega: dice qué hacer y por qué,
en ese orden, y cuando no sabe lo dice. Nada de tableros, medidores ni puntajes de
rigor fingido.

**Tema claro, siempre.** No sigue al sistema operativo. Existe un modo oscuro como
elección explícita, nunca automática. [Decisión de Pablo: el modo oscuro es incorrecto
para una app que se abre en una cocina a las ocho de la noche.]

## Colors

Base **papel verdoso** (`{colors.papel}`), no blanco: el blanco puro a pantalla llena
cansa y compite con las tarjetas.

**Tres colores de estado, y solo tres.** Cada uno tiene un trabajo fijo y no se usa
decorativamente:

| Color | Cuándo |
|---|---|
| `{colors.verde}` | está bien, se puede, se cumplió |
| `{colors.ambar}` | atención, falta algo, hay que decidir |
| `{colors.indigo}` | información que no es ni bueno ni malo |

**Cinco colores de grupo de alimento** (`{colors.g-proteinas}` … `{colors.g-grasas}`).
Identifican grupo, nunca estado. Aparecen como punto, franja lateral o borde — nunca
como fondo de un bloque de texto.

Rojo saturado solo para destrucción irreversible. Un desvío no es un error.

## Typography

- **Cuerpo**: `{typography.cuerpo}`. Base 14px; nunca por debajo de 11.5px.
- **Títulos**: `{typography.titulos}`, con `text-wrap: balance`.
- **Cifras**: `{typography.cifras}` con cifras tabulares. Todo número que se compare
  —gramos, porcentajes, horas, pesos— va en esta familia, para que las columnas
  alineen y un cambio de dígito no mueva el texto.
- Los campos de formulario van a **16px**: menos que eso hace que iOS haga zoom al
  enfocar y descoloque la pantalla.

## Layout & Spacing

Una columna, ancho de teléfono. **Tarjetas sobre papel**, apiladas: cada una es una
cosa que se puede entender sola.

Escala de espaciado en `{spacing}`. La navegación es una barra fija abajo de
`{components.barra}`, con el área segura del dispositivo respetada arriba y abajo.

**Nada de scroll horizontal en el cuerpo.** Lo que no entra —una tabla, una franja de
día— hace scroll dentro de su propia caja.

## Elevation & Depth

Un solo nivel de sombra (`0 1px 2px` + `0 8px 24px -12px`), suave, para separar
tarjeta de papel. No hay jerarquía de elevaciones: si algo necesita destacarse, se
destaca con color de estado o con posición, no con más sombra.

Sin `backdrop-filter` ni `color-mix`: necesitan Safari 16.2+ y el objetivo es iPhone.
Se metieron dos veces y hubo que sacarlos las dos.

## Shapes

Radios en `{rounded}`, de menor a mayor según el tamaño del elemento. Una franja de
3px a la izquierda marca categoría o severidad sin gastar un ícono.

Íconos: trazo, `1.5`–`1.6` de grosor, heredando `currentColor`. Solo cuando reemplazan
una palabra, nunca decorativos.

## Components

- **Tarjeta** — la unidad. Título, contenido, y a lo sumo una acción principal.
- **Chip** — un estado en una palabra. Toma un color de estado.
- **Regla** — lo que el plan dice sobre esta comida: franja de color, la consecuencia
  en negrita, y debajo, más chica, la indicación textual de la nutricionista. Los dos
  niveles tipográficos son el componente: sin la cita suena a reto.
- **Fila de dos columnas** — nombre a la izquierda, cantidad a la derecha en cifras.
  Si no entran juntas, **la cantidad baja de línea**; el nombre nunca se aplasta.
- **Sección plegable** — cerrada por defecto, con un resumen legible sin abrirla.

## Do's and Don'ts

- Un aviso siempre trae su arreglo. Si no hay acción posible, no es un aviso: es un dato.
- Una afirmación sobre el plan cita a la nutricionista. La app calcula; ella habla.
- Cuando no alcanza para afirmar algo, se dice qué falta. Nunca se dibuja una tendencia
  sobre tres puntos.
- Nunca `overflow-wrap: anywhere` en un elemento flexible: deja que su ancho mínimo sea
  un carácter y el texto termina escrito en vertical. `break-word`, y que la fila envuelva.
- Nunca un color de grupo para indicar estado, ni un color de estado para indicar grupo.
- Nunca un puntaje compuesto. Un 73 sobre 100 no le dice a nadie qué hacer mañana.
