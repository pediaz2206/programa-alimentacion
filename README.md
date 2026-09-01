# En Punto

> **En punto**: a la hora exacta ("las 12 en punto") y en el punto justo de coccion
> ("en su punto"). El producto hace las dos cosas: te avisa en el momento preciso y
> te dice si tenes todo listo para cocinar.

Asistente basado en reglas que convierte el plan de la nutricionista en recordatorios
accionables: te avisa a la hora de cada comida con las opciones concretas de ese momento,
te pasa la lista de ingredientes un rato antes para que chequees si tenes todo, y respeta
tu ventana de ayuno intermitente.

La idea es dejar de abrir el PDF y scrollear.

## Que hace hoy

El motor (`packages/core`) esta completo y probado. Dado un plan y tu configuracion de
horarios, genera la agenda del dia:

```
$ npm run hoy

11:45  [ingredientes]  Almuerzo en 45 min
               Para "Guiso de lentejas con verduras" necesitas: Lentejas (100 g),
               Zanahoria (1 unidad), Cebolla (1 unidad), Morron (1 unidad), Papa (100 g).
               [ ] Lentejas - 100 g
               ...

12:00  [ventana]      Se abre la ventana de alimentacion
               Ayuno completo. Podes comer hasta las 20:00.

12:30  [comida]       Almuerzo - 12:30
               Plato: 1/2 Vegetales · 1/4 Proteinas · 1/4 Carbohidratos.
               Opciones: Guiso de lentejas / Wok de carne / Pollo grille

19:00  [ventana]      La ventana cierra en 1 h
               Faltan 2 porciones de proteinas. Faltan 1 porcion de lacteos.

20:00  [ayuno]        Empieza el ayuno
               Proxima comida a partir de las 12:00. 16 h de ayuno.
```

Reglas que ya aplica:

- **Metodo del plato** solo donde el plan lo declara (almuerzo y cena), no en meriendas.
- **No repite** el mismo plato entre almuerzo y cena del mismo dia.
- **Rota** las sugerencias entre dias, de forma deterministica: el aviso de ingredientes
  y el recordatorio de la comida siempre coinciden.
- **Prioriza** las opciones que ayudan a cerrar las porciones que faltan del dia. Eso es
  el "complementar entre comidas" del plan.
- **Detecta conflictos**: avisa si una comida cae fuera de la ventana de ayuno.
- **Lista de compras** consolidada, que suma cantidades y no mezcla unidades incompatibles.

## Requisitos

**Node >= 22.6** (version en `.nvmrc`). El codigo corre TypeScript sin compilar usando
`--experimental-strip-types`, que existe desde esa version. Node 20 quedo sin soporte el
30 de abril de 2026.

```bash
nvm install 22 && nvm use 22
```

## Comandos

```bash
npm run hoy                          # agenda de hoy
npm run hoy -- --fecha 2026-09-05    # agenda de otro dia
npm run check                        # typecheck + tests
```

## Estructura

```
packages/core/src/
  types.ts       modelo de dominio (plan, config, eventos)
  schedule.ts    el motor: plan + config + fecha -> agenda del dia
  selection.ts   que sugerir en cada momento y por que
  balance.ts     porciones consumidas vs objetivo diario
  shopping.ts    checklist previo y lista de compras consolidada
  plate.ts       metodo del plato
  validate.ts    valida un plan transcrito del PDF
  cli.ts         vista previa por consola
data/            plan y config de ejemplo (a reemplazar por los reales)
supabase/        esquema con RLS
docs/            arquitectura y decisiones
```

## Proximos pasos

Ver [docs/arquitectura.md](docs/arquitectura.md). El plan es PWA en Netlify + Supabase,
con Web Push disparado por una scheduled function. El punto delicado esta documentado ahi:
en iOS las notificaciones solo llegan si la app se agrega a la pantalla de inicio.

Para cargar tus PDF reales, ver [docs/transcribir-pdf.md](docs/transcribir-pdf.md).
