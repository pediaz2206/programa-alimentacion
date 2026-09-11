# Usuarios de prueba

Ocho cuentas para poder recorrer la app entera, no para que haya muchas. Cada
una cubre algo que con una sola cuenta no se puede verificar; si sacás una,
queda una celda de la matriz de permisos sin probar. La matriz está en
[`docs/roles.md`](../../docs/roles.md).

## Correr

```bash
SUPABASE_URL=https://TU-PROYECTO.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=eyJ... \
node supabase/semillas/sembrar.mjs
```

Para deshacer, el mismo comando con `--borrar`.

## Verlo desde la vista profesional

Las cuentas de prueba no pueden iniciar sesión, así que para mirar la vista
profesional hace falta que una cuenta real sea la profesional de los pacientes
sembrados:

```bash
... node supabase/semillas/sembrar.mjs --profesional=vos@gmail.com
```

Desde que existe el acceso por contraseña esto ya casi no hace falta: se puede
entrar directamente como `nutri-1` o `entrenador-1`. Queda para el caso de
querer ver la vista profesional desde la propia cuenta de Google.

Esa cuenta tiene que haber entrado a la app con Google al menos una vez. Queda
marcada como nutricionista y vinculada a los cuatro pacientes, activa y
consentida. **Cruza a propósito el límite de más abajo** —una cuenta real con
cuentas de prueba—: funciona porque la semilla corre con `service_role`, que
saltea RLS. Es la única excepción y se hace a mano. Al borrar la semilla los vínculos se van con las cuentas; el
permiso de profesional queda —`profiles.is_professional = false` para sacarlo—,
porque es una cuenta real y borrarle permisos por las dudas es peor.

Antes hace falta haber corrido `supabase/migraciones/005-datos-de-prueba.sql`,
que agrega la marca `profiles.es_prueba`;
`006-aislar-cuentas-de-prueba.sql`, que la hace valer; y
`007-roles-profesionales.sql`, que crea `professional_roles` y la columna
`care_relationships.rol`. Y `008-quien-escribe-que.sql`, que fija qué
columna de un vínculo puede tocar cada parte: sin ella, el profesional se
concede el consentimiento solo y el entrenador se asciende a nutricionista.

## Entrar con esas cuentas

Al crear cada cuenta, la semilla le asigna una contraseña al azar —24 bytes de
`crypto.randomBytes`— y la entrega **una sola vez**:

- **Desde una terminal**, las imprime al final.
- **Sin terminal interactiva** —salida redirigida, un job de CI— no imprime
  nada y aborta. El scrollback lo ve quien corre el script; un log de job lo lee
  cualquiera con acceso al repositorio, y no son lo mismo. Para ese caso,
  `--credenciales=/ruta/fuera/del/repo.txt`, que escribe el archivo con
  permisos 600.

A una cuenta que ya existe **no** se le cambia la contraseña: la semilla se
corre seguido y rotar en silencio invalidaría lo que alguien ya tiene anotado.
Para rotarlas, `--borrar` y volver a sembrar.

No quedan guardadas en ningún lado fuera de `auth.users`, hasheadas.

El formulario de email y contraseña se compila solo donde la bandera lo
enciende:

```bash
VITE_LOGIN_PRUEBA=on npm run build
```

En Netlify va como variable de entorno del despliegue de vista previa. En
producción no se pone, y el formulario no queda ni en la pantalla ni en el
bundle.

**La bandera no es un control de seguridad.** El `grant_type=password` lo
atiende la API de Supabase, y producción y vista previa comparten una sola
base: esas credenciales sirven contra producción aunque ahí no haya
formulario. Lo que contiene a una cuenta de prueba es el aislamiento de acá
abajo, no la bandera. La bandera es para que nadie vea en producción una
puerta que no le corresponde.

## El aislamiento

Una cuenta de prueba y una real no se pueden vincular, en ninguna de las dos
direcciones. Son datos de salud con la misma forma en la misma base: lo único
que las separa es esa marca, así que la separación la aplica Postgres y no el
cliente.

Se cierran los tres caminos hacia un vínculo —invitar, aceptar y reclamar la
invitación al entrar con ese email—, el tercero adentro de
`reclamar_invitaciones()`, que es `security definer` y no pasa por ninguna
política. Hay una aserción por camino en `supabase/test/permisos.sql`.

Lo que **no** impide: que una cuenta de prueba escriba lo suyo —su plan, sus
comidas, sus fotos—. Para una demo está bien, porque lo suyo es de mentira. Lo
que no puede pasar es que toque lo de otro.

La semilla corre con `service_role`, que saltea RLS, así que crea sus vínculos
sin que estas políticas la molesten.

La clave `service_role` se lee del ambiente y no se guarda en ningún lado. No
va en un archivo del repo ni con prefijo `VITE_`: saltea RLS, y hay una
verificación en el build que aborta si aparece en el bundle.

## Qué crea

| Cuenta | Para probar |
|---|---|
| `paciente-a` | El caso feliz: 28 días con huecos, desvíos y mediciones |
| `paciente-b` | Invitado sin aceptar — que un vínculo pendiente no filtre nada |
| `paciente-c` | Plan **sin config** — hoy hace desaparecer el resumen de consulta |
| `paciente-d` | Vínculo revocado — que el corte sea inmediato |
| `nutri-1` | Sigue a a, b, c y a mixto-1 |
| `nutri-2` | Sigue a `paciente-a` también: dos profesionales, una persona |
| `entrenador-1` | Sigue a `paciente-a`; y a `paciente-c` **sin consentir** |
| `mixto-1` | Nutricionista y entrenador a la vez, y además paciente de nutri-1 |

## Dos cosas que conviene saber

**Entran por contraseña, no por Google.** El dominio `prueba.en-punto.local` no
existe, así que el botón de Google no sirve para ellas. Sí el formulario de
email y contraseña, en un despliegue compilado con `VITE_LOGIN_PRUEBA=on`: ahí
se recorre la app como paciente, como nutricionista o como entrenador.

**La historia es fea a propósito.** Tiene días sin registrar, comidas
salteadas, desvíos y reglas incumplidas. Una semilla prolija prueba la mitad de
la app: el resumen de consulta con datos perfectos no tiene nada que decir, y
los estados vacíos son los que peor se ven y los que menos se miran.

Es determinista: sembrar dos veces da exactamente lo mismo. Sin eso, un bug que
aparece con ciertos datos no se puede reproducir.
