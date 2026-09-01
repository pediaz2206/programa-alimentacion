# Arquitectura de En Punto

## Decision de fondo

El valor del producto es **una notificacion, en el momento justo, con contenido util adentro**.
Todo lo demas (pantallas, historial, estadisticas) es secundario. Por eso la arquitectura
se ordena alrededor de una sola pregunta: como garantizar que la notificacion llegue.

## Piezas

```
                 ┌──────────────────────────┐
                 │  packages/core (puro TS) │
                 │  plan + config -> agenda │
                 └────────────┬─────────────┘
                              │  misma funcion, dos lugares
              ┌───────────────┴───────────────┐
              │                               │
   ┌──────────▼──────────┐        ┌───────────▼────────────┐
   │  apps/web (PWA)     │        │  Netlify Function cron │
   │  Netlify            │        │  calcula lo que vence  │
   │  muestra la agenda  │        │  y manda Web Push      │
   └──────────┬──────────┘        └───────────┬────────────┘
              │                               │
              └───────────────┬───────────────┘
                              │
                    ┌─────────▼─────────┐
                    │     Supabase      │
                    │  auth + postgres  │
                    └───────────────────┘
```

`buildDaySchedule(plan, config, fecha)` es una funcion pura y deterministica. La corre el
cliente para pintar la pantalla y el cron para decidir que push mandar. Como es la misma
funcion con los mismos datos, la notificacion de las 11:45 dice exactamente lo mismo que
la pantalla. Si el calculo viviera duplicado, se desincronizarian.

## El punto delicado: las notificaciones en iOS

Esto condiciona el producto entero y conviene saberlo antes de invertir en UI.

- **No existen notificaciones locales programadas en una PWA.** No hay forma de decirle al
  navegador "avisame a las 12:30". La unica via confiable es Web Push desde un servidor.
- **En iOS, Web Push solo funciona si la app esta agregada a la pantalla de inicio**
  (iOS 16.4+, Safari → Compartir → Agregar a inicio). Una pestana abierta no recibe push,
  y Apple no implementa `beforeinstallprompt`, asi que la instalacion es manual y hay que
  guiarla con un onboarding explicito.
- En Android y desktop (Chrome, Firefox, Edge) Web Push funciona sin instalar.

Consecuencia de diseno: el onboarding tiene que tratar "agregar a inicio + permitir
notificaciones" como el paso 1, no como un extra. Y conviene un canal de respaldo
(email o Telegram) para quien no complete ese paso.

## El cron

Una Netlify Scheduled Function corre cada N minutos, y en cada corrida:

1. Lee los usuarios con push activo y su zona horaria.
2. Calcula `buildDaySchedule` para el dia local de cada uno.
3. Filtra los eventos que caen en la ventana `[ultima corrida, ahora]`.
4. Manda el push y registra el envio en `notification_log` para no duplicar.

La cadencia de las scheduled functions de Netlify depende del plan, y la granularidad
del cron define el error maximo del recordatorio: cada 5 minutos significa que un aviso
de las 12:30 puede llegar 12:34. Aceptable para comidas. Si hiciera falta precision al
minuto, la alternativa es `pg_cron` + `pg_net` dentro de Supabase, que no depende del
plan de Netlify.

Referencias: [Netlify Scheduled Functions](https://docs.netlify.com/build/functions/scheduled-functions/),
[requisitos de Web Push en iOS](https://pushpad.xyz/blog/ios-special-requirements-for-web-push-notifications).

## Por que el plan se guarda como JSONB

El `NutritionPlan` es un arbol (grupos → momentos → opciones → ingredientes) que se lee
siempre entero y se escribe cuando la nutricionista manda un PDF nuevo. Normalizarlo en
seis tablas duplicaria el modelo que ya vive en TypeScript y volveria cara cada iteracion.

Se guarda como JSONB validado por `validatePlan()` antes de escribir. Lo que si es
relacional es lo que se consulta y agrega: los registros de comidas (`meal_logs`).

Cuando el modelo se estabilice, las consultas frecuentes se pueden materializar en
columnas generadas sin cambiar la forma de escribir.

## Registro de comidas con foto

Reemplaza el ida y vuelta de fotos por WhatsApp. Cada comida registrada guarda
que se comio, cuanta proteina aporto, si fue del 20%, una nota y opcionalmente
una foto.

La foto va a Supabase Storage en un bucket privado, y en `meal_logs` queda solo
la ruta. Dos motivos: los binarios grandes en Postgres encarecen backups y
consultas, y el storage ya resuelve permisos, CDN y URLs firmadas que vencen.

Esto convierte la decision de los dos roles en urgente, no diferible: el sentido
de registrar la comida es que **alguien mas la mire**. Ver la seccion siguiente.

## Pendiente de definir: los dos tipos de usuario

El producto tiene dos roles, no uno: **quien come** y **la nutricionista**. Todavia no esta
disenado, pero conviene registrar por que no es un detalle que se agrega despues sin costo.

La decision que carga peso es **de quien es el plan**. Hoy `plans.owner_id` significa "es
mio" y las policies de RLS dicen "solo ves lo tuyo". Eso alcanza para un usuario solo. Si
la nutricionista escribe planes para varias personas, un plan pasa a tener dos partes
distintas: quien lo redacta y quien lo sigue. Eso no es una columna extra, es otro modelo
de permisos: hace falta una relacion profesional-paciente y policies que la consulten.
Migrar de un modelo al otro con datos adentro implica reescribir todas las policies.

Lo que hace falta saber antes de modelarlo, y que no conviene adivinar:

- La nutricionista, escribe el plan dentro de la app o sigue mandando PDF? Cambia si el
  editor de planes es una feature del producto o solo un importador.
- Un paciente puede tener planes de dos profesionales a la vez?

Y desde que existe el registro con foto, estas dejan de ser hipoteticas:

- La nutricionista ve las fotos de las comidas de sus pacientes? Es el motivo por el
  que existe la feature, asi que la respuesta condiciona el bucket, las policies del
  storage y el modelo de permisos entero.
- Como se otorga y se revoca ese acceso? Un paciente que deja de atenderse con ella
  tiene que poder cortarlo, y las fotos ya subidas no deberian quedar visibles.
- Hace falta consentimiento explicito? Son datos de salud: conviene registrar cuando
  se dio y poder mostrarlo.

Mientras no haya respuestas, el bucket es estrictamente privado: cada quien ve solo
sus fotos. Abrirlo despues es una migracion de policies; abrirlo de mas ahora es una
fuga de datos de salud.

Mientras no haya respuestas, el esquema queda como esta: un solo rol, RLS simple. Es
preferible una migracion consciente mas adelante a un modelo de permisos inventado ahora
sobre supuestos que pueden salir mal.

## Estado

- [x] `packages/core` — motor de reglas, validacion, balance diario, lista de compras
- [x] CLI de vista previa (`npm run hoy`)
- [x] Vista HTML autocontenida (`npm run vista`)
- [x] Esquema de Supabase con RLS
- [ ] Transcripcion de los PDF reales al formato `NutritionPlan`
- [ ] `apps/web` — PWA
- [ ] Netlify Function de push + registro de suscripciones
- [ ] Google SSO
- [ ] Modelo de dos roles (paciente / nutricionista) - ver seccion anterior
