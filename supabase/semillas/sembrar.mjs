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
import { historiaDe } from './historia.mjs';

const url = process.env['SUPABASE_URL'];
const clave = process.env['SUPABASE_SERVICE_ROLE_KEY'];
const borrar = process.argv.includes('--borrar');

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

async function cuentaDe(correo, nombre, ya) {
  if (ya.has(correo)) return ya.get(correo);
  const { data, error } = await db.auth.admin.createUser({
    email: correo,
    email_confirm: true,
    user_metadata: { full_name: nombre },
  });
  if (error) throw error;
  return data.user.id;
}

async function sembrar() {
  const ya = await existentes();
  const ids = new Map();

  console.log('Cuentas');
  for (const p of [...PACIENTES, ...PROFESIONALES]) {
    const correo = email(p.slug);
    const id = await cuentaDe(correo, p.nombre, ya);
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
    console.log(`  ${v.profesional} → ${v.paciente}  [${v.estado}${v.consentido ? '' : ', sin consentir'}]`);
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

  console.log(`
Listo. Las cuentas de prueba no pueden iniciar sesión con Google —el dominio
${DOMINIO} no existe—, así que sirven para ver la app desde la vista
profesional, no para entrar como ellas. Para probar el ingreso hacen falta
cuentas de Google reales.

Para deshacer:  node supabase/semillas/sembrar.mjs --borrar
`);
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
