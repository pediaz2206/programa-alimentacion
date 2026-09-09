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

Esa cuenta tiene que haber entrado a la app con Google al menos una vez. Queda
marcada como profesional y vinculada a los cuatro pacientes, activa y
consentida. Al borrar la semilla los vínculos se van con las cuentas; el
permiso de profesional queda —`profiles.is_professional = false` para sacarlo—,
porque es una cuenta real y borrarle permisos por las dudas es peor.

Antes hace falta haber corrido `supabase/migraciones/005-datos-de-prueba.sql`,
que agrega la marca `profiles.es_prueba`.

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

**No pueden iniciar sesión.** El dominio `prueba.en-punto.local` no existe y la
app entra por Google. Sirven para ver la app desde la vista profesional —que es
donde hay más para probar y menos para mirar hoy—, no para entrar como ellas.
Para probar el ingreso hacen falta cuentas de Google reales.

**La historia es fea a propósito.** Tiene días sin registrar, comidas
salteadas, desvíos y reglas incumplidas. Una semilla prolija prueba la mitad de
la app: el resumen de consulta con datos perfectos no tiene nada que decir, y
los estados vacíos son los que peor se ven y los que menos se miran.

Es determinista: sembrar dos veces da exactamente lo mismo. Sin eso, un bug que
aparece con ciertos datos no se puede reproducir.
