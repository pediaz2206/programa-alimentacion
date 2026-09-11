<!-- bmad:context -->
<!-- Verified 2026-09-09 against fb0fbf5. Managed by bmad-project-context; edits inside this block are replaced on refresh. Keep anything you want preserved outside the markers. -->

## En Punto

Asistente de alimentación por reglas: convierte el plan de una nutricionista en
recordatorios accionables. Monorepo TypeScript con workspaces npm — `packages/core`
(motor puro) y `apps/web` (PWA React + Vite). Supabase para datos, auth y Storage;
Netlify para hosting y el cron de notificaciones. Decisiones de producto y modelo de
roles en `docs/`.

## Policy

- Nunca escribas una `service_role` key en un archivo del repo — va solo en variables
  de entorno de Netlify. El build aborta si aparece con prefijo `VITE_`, pero eso no
  alcanza a una clave pegada en el código.

## Where things are

- Motor de dominio: `packages/core/src/` — lo importan la PWA y el cron de Netlify
  (`apps/web/netlify/functions/recordatorios.mts`) por ruta relativa.
- Esquema y políticas de Supabase: `supabase/schema.sql`; los cambios sobre una base
  ya creada van además como archivo nuevo en `supabase/migraciones/`.
- Modelo de roles y decisiones abiertas: `docs/roles.md`
- Usuarios de prueba: `supabase/semillas/README.md`

## Running and verifying

- Node >= 22.6 (`.nvmrc`, `engines`). El proyecto corre TypeScript sin compilar con
  `--experimental-strip-types`, que no existe antes.
- `npm run check` corre typecheck y los tests de `packages/core`. No incluye
  `npm run test:db`, que son las 40 aserciones de RLS sobre un Postgres efímero:
  corrélo aparte cuando toques `supabase/`.
- No hay CI. Nada corre solo: lo que no se verifique acá llega a producción.

## Conventions that differ from defaults

- Comentarios, tests y documentación en español.
- `packages/core` es puro y determinista: mismo plan, config y fecha dan la misma
  agenda. Es lo que evita que la pantalla y las notificaciones digan cosas distintas;
  no le agregues acceso a red, reloj ni azar.
- Toda vista nueva en `schema.sql` lleva `with (security_invoker = true)`, si no
  saltea RLS y filtra los datos de todos.
- Una cuenta nueva se siembra con `data/plan.ejemplo.json`, nunca con un plan real:
  `data/plan.pablo.json` es de una persona.

## Known pitfalls

- Una negación de RLS devuelve 200 y una lista vacía. Un 401 o 403 significa que no
  llegaste autenticado o no llegaste; no lo leas como "RLS funcionando".
- Una escritura que sale sin escribir es el bug más caro de acá: pasó dos veces.
  Verificá que el upsert tocó una fila y lanzá error si no, en vez de retornar.
- El objetivo es iPhone. `color-mix` y `backdrop-filter` necesitan Safari 16.2+; se
  metieron y hubo que sacarlos dos veces. Desde el contenedor no se pueden verificar.
- Los datos sembrados son datos de salud con la misma forma que los reales y viven en
  la misma base. La marca es `profiles.es_prueba`; `--borrar` se niega a tocar lo que
  no la tenga.

<!-- /bmad:context -->
