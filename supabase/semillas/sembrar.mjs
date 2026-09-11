/**
 * Siembra (y borra) los usuarios de prueba.
 *
 *   SUPABASE_URL=https://xxx.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=... \
 *   node supabase/semillas/sembrar.mjs
 *
 *   ... sembrar.mjs --borrar     # deja la base como estaba
 *
 * Usa la API de administracion porque crear filas en `auth.users` a mano es
 * fragil entre versiones de Supabase. La clave `service_role` se lee del
 * ambiente y no se escribe en ningun lado: vive en la maquina de quien siembra.
 *
 * Es idempotente: correrlo dos veces deja el mismo estado, no el doble.
 *
 * Toda cuenta que crea queda marcada con `profiles.es_prueba`, y `--borrar`
 * solo toca esas. Son datos de salud con la misma forma que los reales y viven
 * en la misma base: sin esa marca, distinguirlos despues se hace por email o
 * por fecha, que es exactamente como se borra de mas.
 */
import { readFileSync } from 'node:fs';

// Antes del import de supabase-js: en Node 20 su cliente falla al construirse
// porque no encuentra WebSocket, y el stack trace habla de realtime-js, que no
// tiene nada que ver con sembrar datos. El error util es este.
const [major, minor] = process.versions.node.split('.').map(Number);
if (!(major > 22 || (major === 22 && minor >= 6))) {
  console.error(`
  Node ${process.versions.node} es muy viejo para este proyecto.

  Hace falta Node >= 22.6, igual que el resto del repo.

    nvm use          # la version esperada esta en .nvmrc
`);
  process.exit(1);
}

const { createClient } = await import('@supabase/supabase-js');
import { DOMINIO, email, PACIENTES, PROFESIONALES, VINCULOS } from './personajes.mjs';
import { randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { historiaDe } from './historia.mjs';

const url = process.env['SUPABASE_URL'];
const clave = process.env['SUPABASE_SERVICE_ROLE_KEY'];
const borrar = process.argv.includes('--borrar');
// Las cuentas de prueba no entran por Google, asi que sin esto no hay forma de
// mirar la vista profesional: hace falta que una cuenta real sea la
// profesional de los pacientes sembrados.
const comoProfesional = (process.argv.find((a) => a.startsWith('--profesional=')) ?? '').split('=')[1];
// Donde escribir las credenciales cuando no hay terminal interactiva. Ver
// `entregar()`: sin TTY y sin esto, el script prefiere abortar a imprimirlas.
const archivoCredenciales = (process.argv.find((a) => a.startsWith('--credenciales=')) ?? '').split('=')[1];

if (!url || !clave) {
  console.error(`
Faltan las variables de entorno.

  SUPABASE_URL=https://TU-PROYECTO.supabase.co \\
  SUPABASE_SERVICE_ROLE_KEY=eyJ... \\
  node supabase/semillas/sembrar.mjs

La clave service_role está en Supabase → Project Settings → API.
No la pongas en ningún archivo del repo ni con prefijo VITE_: saltea RLS.
`);
  process.exit(1);
}

const db = createClient(url, clave, { auth: { persistSession: false } });
const hoy = new Date().toISOString().slice(0, 10);
const plan = JSON.parse(readFileSync('data/plan.ejemplo.json', 'utf8'));
const config = JSON.parse(readFileSync('data/config.ejemplo.json', 'utf8'));

/** Todas las cuentas de prueba que ya existen, por email. */
async function existentes() {
  const porEmail = new Map();
  for (let pagina = 1; ; pagina++) {
    const { data, error } = await db.auth.admin.listUsers({ page: pagina, perPage: 200 });
    if (error) throw error;
    for (const u of data.users) {
      if (u.email?.endsWith(`@${DOMINIO}`)) porEmail.set(u.email, u.id);
    }
    if (data.users.length < 200) break;
  }
  return porEmail;
}

async function limpiar() {
  const cuentas = await existentes();
  if (cuentas.size === 0) {
    console.log('No hay cuentas de prueba para borrar.');
    return;
  }
  // Se borra la cuenta y el resto cae por `on delete cascade`. Antes se
  // verifica la marca: borrar por dominio y nada mas seria confiar en que
  // nadie uso ese dominio para otra cosa.
  const ids = [...cuentas.values()];
  const { data: perfiles, error } = await db
    .from('profiles').select('id, es_prueba').in('id', ids);
  if (error) throw error;
  const noMarcadas = perfiles.filter((p) => !p.es_prueba);
  if (noMarcadas.length > 0) {
    console.error(`Hay ${noMarcadas.length} cuenta(s) del dominio de prueba sin marcar como es_prueba. No borro nada.`);
    process.exit(1);
  }
  for (const [correo, id] of cuentas) {
    const { error: e } = await db.auth.admin.deleteUser(id);
    if (e) throw e;
    console.log('  borrada', correo);
  }
  console.log(`\nListo: ${cuentas.size} cuentas de prueba borradas.`);
}

/**
 * Una contrasena al azar, distinta por cuenta.
 *
 * 24 bytes de `randomBytes` en base64url: no es una frase memorable y no tiene
 * por que serlo, se copia y se pega una vez. Sale del CSPRNG del sistema y no
 * de Math.random, que es predecible y no sirve para una credencial.
 */
function contrasenaAlAzar() {
  return randomBytes(24).toString('base64url');
}

/**
 * Crea la cuenta si no existe, con contrasena.
 *
 * A una cuenta que ya existe NO se le cambia: rotar en silencio invalidaria
 * las credenciales que alguien ya tiene anotadas, y la semilla se corre de
 * nuevo todo el tiempo. Para rotarlas, `--borrar` y volver a sembrar.
 */
async function cuentaDe(correo, nombre, ya, credenciales) {
  if (ya.has(correo)) return ya.get(correo);
  const contrasena = contrasenaAlAzar();
  const { data, error } = await db.auth.admin.createUser({
    email: correo,
    password: contrasena,
    email_confirm: true,
    user_metadata: { full_name: nombre },
  });
  if (error) throw error;
  credenciales.set(correo, contrasena);
  return data.user.id;
}

/**
 * Entrega las credenciales una sola vez, y solo donde corresponde.
 *
 * El scrollback de una terminal y los logs de un job de CI son dos lugares
 * distintos: el primero lo ve quien corre el script, el segundo cualquiera con
 * acceso al repositorio. Sin TTY, entonces, no se imprime nada: o se pasa
 * `--credenciales=RUTA` o el script aborta.
 *
 * No se guardan en la base ni en ningun archivo del repo: viven en auth.users
 * hasheadas, y en la cabeza de quien las copio.
 */
function entregar(credenciales) {
  if (credenciales.size === 0) {
    console.log('\nNo se crearon cuentas nuevas: las contraseñas anteriores siguen valiendo.');
    console.log('Para rotarlas: --borrar y volver a sembrar.');
    return;
  }

  const lineas = [...credenciales].map(([correo, clave]) => `${correo}  ${clave}`);

  if (archivoCredenciales) {
    writeFileSync(archivoCredenciales, lineas.join('\n') + '\n', { mode: 0o600 });
    console.log(`\nCredenciales escritas en ${archivoCredenciales} (permisos 600).`);
    console.log('Está fuera del repositorio a proposito. Borralo cuando termines.');
    return;
  }

  if (!process.stdout.isTTY) {
    console.error(`
No hay terminal interactiva y no se pasó --credenciales=RUTA.

  Se crearon ${credenciales.size} cuentas con contraseña y no se van a imprimir:
  la salida redirigida termina en un archivo o en los logs de un job, que los
  lee cualquiera con acceso al repositorio.

  Corré de nuevo con --credenciales=/ruta/fuera/del/repo.txt
  o desde una terminal.

  Las cuentas YA están creadas. Para rehacerlas: --borrar y volver a sembrar.`);
    process.exit(1);
  }

  console.log('\nCredenciales — se muestran una sola vez');
  for (const linea of lineas) console.log(`  ${linea}`);
  console.log(`
  No quedan guardadas en ningún lado: anotálas ahora.
  Sirven solo donde el despliegue compile con VITE_LOGIN_PRUEBA=on.
  Para rotarlas: --borrar y volver a sembrar.`);
}

async function sembrar() {
  const ya = await existentes();
  const ids = new Map();
  // Solo las cuentas creadas en esta corrida. A las que ya existían no se les
  // toca la contraseña, así que no hay nada nuevo que entregar sobre ellas.
  const credenciales = new Map();

  console.log('Cuentas');
  for (const p of [...PACIENTES, ...PROFESIONALES]) {
    const correo = email(p.slug);
    const id = await cuentaDe(correo, p.nombre, ya, credenciales);
    ids.set(p.slug, id);
    console.log(`  ${ya.has(correo) ? 'ya estaba' : 'creada  '}  ${p.slug}`);
  }

  const esProfesional = new Set(PROFESIONALES.map((p) => p.slug));
  await subir('profiles', [...ids].map(([slug, id]) => ({
    id,
    display_name: [...PACIENTES, ...PROFESIONALES].find((p) => p.slug === slug).nombre,
    email: email(slug),
    is_professional: esProfesional.has(slug),
    es_prueba: true,
  })));

  // Los roles van a su propia tabla. `personajes.mjs` los declara desde
  // siempre; hasta ahora se perdian, porque la unica marca era el booleano de
  // arriba y no distinguia nutricionista de entrenador.
  await subir('professional_roles',
    PROFESIONALES.flatMap((p) => p.roles.map((rol) => ({ person_id: ids.get(p.slug), rol }))),
    'person_id,rol');
  console.log(`  ${PROFESIONALES.flatMap((p) => p.roles).length} roles profesionales`);

  console.log('\nPlanes y configuración');
  for (const p of PACIENTES) {
    const id = ids.get(p.slug);
    // `plans` no tiene unique por paciente, asi que no se puede hacer upsert:
    // se busca el activo y solo se crea si no hay. Es lo que evita que correr
    // la semilla dos veces deje dos planes y que leer y escribir elijan uno
    // distinto, que ya nos costo un bug entero.
    const fila = await planActivo(id, ids.get('nutri-1'));

    const { data: versiones } = await db.from('plan_versions')
      .select('version').eq('plan_id', fila.id).order('version', { ascending: false }).limit(1);
    if (!versiones?.length) {
      await subir('plan_versions', [{ plan_id: fila.id, version: 1, doc: plan, author_id: ids.get('nutri-1') }]);
    }

    // paciente-c va sin config a proposito: hoy eso hace que el resumen de
    // consulta no aparezca, y es el primer bug que va a encontrar quien pruebe.
    if (p.config) {
      await subir('configs', [{ patient_id: id, plan_id: fila.id, doc: config }], 'patient_id,plan_id');
    }
    console.log(`  ${p.slug}${p.config ? '' : '  (sin config, a propósito)'}`);
  }

  console.log('\nVínculos');
  for (const v of VINCULOS) {
    // El unico de care_relationships es sobre lower(patient_email), un indice
    // por expresion: PostgREST no lo acepta como onConflict, asi que se busca
    // y se actualiza a mano.
    const fila = {
      professional_id: ids.get(v.profesional),
      patient_id: v.estado === 'pending' ? null : ids.get(v.paciente),
      patient_email: email(v.paciente),
      status: v.estado,
      rol: v.rol,
      accepted_at: v.estado === 'active' ? new Date().toISOString() : null,
      revoked_at: v.estado === 'revoked' ? new Date().toISOString() : null,
      consent_granted_at: v.consentido ? new Date().toISOString() : null,
      consent_version: v.consentido ? 'v1' : null,
    };
    const { data: existe } = await db.from('care_relationships')
      .select('id')
      .eq('professional_id', fila.professional_id)
      .ilike('patient_email', fila.patient_email)
      .limit(1);
    const { error: eV } = existe?.length
      ? await db.from('care_relationships').update(fila).eq('id', existe[0].id)
      : await db.from('care_relationships').insert(fila);
    if (eV) throw new Error(`care_relationships: ${eV.message}`);
    console.log(`  ${v.profesional} → ${v.paciente}  [${v.rol}, ${v.estado}${v.consentido ? '' : ', sin consentir'}]`);
  }

  console.log('\nHistoria');
  for (const p of PACIENTES) {
    const id = ids.get(p.slug);
    const { comidas, medidas } = historiaDe(plan, config, p, hoy);
    if (comidas.length > 0) {
      await subir('meal_logs', comidas.map((c) => ({
        patient_id: id, local_date: c.fecha, slot_id: c.slotId,
        option_id: c.optionId, portions: c.porciones,
        protein_grams: c.proteinGrams, is_free_meal: c.esLibre, note: c.nota,
      })), 'patient_id,local_date,slot_id');
    }
    if (medidas.length > 0) {
      await subir('body_measurements', medidas.map((m) => ({
        patient_id: id, local_date: m.fecha, weight_kg: m.pesoKg, waist_cm: m.cinturaCm,
      })), 'patient_id,local_date');
    }
    console.log(`  ${p.slug}: ${comidas.length} comidas, ${medidas.length} mediciones`);
  }

  if (comoProfesional) await sumarProfesionalReal(comoProfesional, ids);

  console.log(`
Listo. Estas cuentas no entran por Google —el dominio ${DOMINIO} no
existe— pero sí con email y contraseña, en un despliegue compilado con
VITE_LOGIN_PRUEBA=on. Ahí se puede recorrer la app como paciente, como
nutricionista o como entrenador.

Para deshacer:  node supabase/semillas/sembrar.mjs --borrar`);

  entregar(credenciales);
}

/**
 * Ata una cuenta real como profesional de los pacientes sembrados.
 *
 * Cruza a proposito el limite que las policias imponen: una cuenta real y una
 * de prueba no se vinculan entre si. Acá funciona porque la semilla corre con
 * `service_role`, que saltea RLS. Es la unica excepcion, y es a mano.
 *
 * Desde que existe el acceso por contrasena ya no hace falta para mirar la
 * vista profesional: se puede entrar como `nutri-1` o `entrenador-1`. Queda
 * para el caso de querer verla desde la propia cuenta de Google.
 */
async function sumarProfesionalReal(correo, ids) {
  console.log(`\nCuenta real como profesional: ${correo}`);
  const buscado = correo.toLowerCase();
  let uid = null;
  for (let pagina = 1; ; pagina++) {
    const { data, error } = await db.auth.admin.listUsers({ page: pagina, perPage: 200 });
    if (error) throw error;
    const encontrada = data.users.find((u) => u.email?.toLowerCase() === buscado);
    if (encontrada) { uid = encontrada.id; break; }
    if (data.users.length < 200) break;
  }
  if (!uid) {
    console.error(`  No existe esa cuenta. Tiene que haber entrado a la app con Google al menos una vez.`);
    return;
  }

  const { error: eP } = await db.from('profiles').update({ is_professional: true }).eq('id', uid);
  if (eP) throw eP;
  const { error: eR } = await db.from('professional_roles')
    .upsert({ person_id: uid, rol: 'nutricionista' }, { onConflict: 'person_id,rol' });
  if (eR) throw eR;
  console.log('  marcada como nutricionista');
  console.log('  ojo: esto vincula una cuenta real con cuentas de prueba, que es');
  console.log('  justo lo que las politicas impiden. Lo permite service_role.');

  for (const p of PACIENTES) {
    const fila = {
      professional_id: uid,
      patient_id: ids.get(p.slug),
      patient_email: email(p.slug),
      status: 'active',
      rol: 'nutricionista',
      accepted_at: new Date().toISOString(),
      consent_granted_at: new Date().toISOString(),
      consent_version: 'v1',
    };
    const { data: existe } = await db.from('care_relationships')
      .select('id').eq('professional_id', uid).ilike('patient_email', fila.patient_email).limit(1);
    const { error } = existe?.length
      ? await db.from('care_relationships').update(fila).eq('id', existe[0].id)
      : await db.from('care_relationships').insert(fila);
    if (error) throw new Error(`care_relationships: ${error.message}`);
    console.log(`  ${correo} → ${p.slug}`);
  }
  console.log(`
  Entrá con esa cuenta y vas a ver la pestaña Pacientes con los cuatro.
  Al borrar la semilla, los vínculos se van con las cuentas; el permiso de
  profesional queda, porque es una cuenta real y borrarle permisos por las
  dudas es peor. Para sacarlo: borrar su fila de professional_roles y poner
  profiles.is_professional = false.`);
}

/** El plan activo del paciente, creandolo la primera vez. */
async function planActivo(pacienteId, autorId) {
  const { data, error } = await db.from('plans')
    .select('id').eq('patient_id', pacienteId).eq('is_active', true)
    .order('created_at', { ascending: false }).limit(1);
  if (error) throw error;
  if (data?.length) return data[0];

  const { data: nuevo, error: e } = await db.from('plans')
    .insert({ patient_id: pacienteId, author_id: autorId, name: plan.name, source: plan.source, is_active: true })
    .select('id').single();
  if (e) throw e;
  return nuevo;
}

/** Inserta en lotes, ignorando lo que ya esta: correr dos veces no duplica. */
async function subir(tabla, filas, onConflict) {
  for (let i = 0; i < filas.length; i += 500) {
    const lote = filas.slice(i, i + 500);
    const { error } = onConflict
      ? await db.from(tabla).upsert(lote, { onConflict })
      : await db.from(tabla).upsert(lote);
    if (error) throw new Error(`${tabla}: ${error.message}`);
  }
}

try {
  await (borrar ? limpiar() : sembrar());
} catch (e) {
  console.error('\nFalló:', e.message);
  process.exit(1);
}
