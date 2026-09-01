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

## Los dos roles

Hay dos personas: **quien come** y **su nutricionista**. Ella ve el registro, y
edita el plan segun la etapa del entrenamiento o indicaciones medicas.

Todo el acceso cuelga de una sola tabla, `care_relationships`, y de una sola
funcion, `has_care_access()`. Que sea un unico punto es deliberado: un modelo de
permisos disperso en veinte policies es un modelo que nadie puede auditar.

Se conceden datos solo si se cumplen **las tres**: vinculo activo, no revocado,
y consentimiento explicito del paciente. Que el vinculo este activo no alcanza:
son datos de salud, y el consentimiento se registra con fecha y version.

Quien escribe que:

| | Paciente | Nutricionista |
|---|---|---|
| Plan y versiones | todo | lee y publica versiones nuevas |
| Horarios, ayuno, exclusiones | todo | solo lee |
| Registro de comidas y fotos | todo | solo lee |
| Vinculo | acepta y revoca | invita y revoca |

Tres decisiones que sostienen esto:

- **`patient_id` y `author_id` separados.** Quien sigue el plan y quien lo
  escribio son distintos. Sin esa separacion, dejar que ella edite un plan la
  volveria duena de los datos del paciente.
- **Las versiones no se editan, se publican.** Una version publicada es el
  registro de que se indico y cuando. `meal_logs` apunta a la version vigente
  ese dia, asi que el historial no se reescribe cuando el plan cambia.
- **Revocar no borra nada, corta el acceso.** Las fotos ya subidas dejan de ser
  visibles sin migrar ni eliminar archivos, porque la policy del bucket consulta
  la misma funcion.

`supabase/test/permisos.sql` verifica esto contra un Postgres real: que el
vinculo pendiente no alcance, que activo sin consentimiento no alcance, que
revocar oculte tambien las fotos, y que un profesional ajeno nunca vea nada.

    npm run test:db

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
