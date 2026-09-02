/**
 * Chequea contra tu proyecto que el esquema este aplicado y que RLS este
 * protegiendo los datos. Usa la anon key: si alguna tabla devuelve filas sin
 * sesion, RLS no esta haciendo su trabajo.
 *
 *   node scripts/verificar-supabase.mjs
 */
import { readFileSync } from 'node:fs';

function leerEnv(ruta) {
  try {
    return Object.fromEntries(
      readFileSync(ruta, 'utf8')
        .split('\n')
        .filter((l) => l.trim() && !l.startsWith('#'))
        .map((l) => {
          const i = l.indexOf('=');
          return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
        }),
    );
  } catch {
    return {};
  }
}

// `.env` esta gitignoreado, asi que un clon nuevo no lo tiene. `.env.example`
// si esta versionado y trae la URL y la anon key, que son publicas por diseno:
// viajan dentro del bundle de cualquier cliente. Sirve de respaldo, y se avisa
// cual se uso para no tapar una configuracion incompleta.
const propio = leerEnv('apps/web/.env');
const ejemplo = leerEnv('apps/web/.env.example');
const usado = propio.VITE_SUPABASE_URL ? 'apps/web/.env' : 'apps/web/.env.example';
const env = { ...ejemplo, ...propio, ...process.env };

const url = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error(`
No encontré la configuración de Supabase.

  cp apps/web/.env.example apps/web/.env

Ese archivo está gitignoreado a propósito, así que un clon nuevo no lo trae.
`);
  process.exit(1);
}

console.log(`Configuración: ${usado}`);
console.log(`Proyecto:      ${url}\n`);

const TABLAS = [
  'profiles', 'care_relationships', 'plans', 'plan_versions',
  'configs', 'meal_logs', 'push_subscriptions', 'notification_log',
];

let fallos = 0;

// Si no se llega al proyecto, todo lo que siga no significa nada: un 403 de un
// proxy es indistinguible de un 403 de permisos si uno no mira primero.
const salud = await fetch(`${url}/auth/v1/health`, { headers: { apikey: key } })
  .then((r) => r.status)
  .catch((e) => e.message);

if (salud !== 200) {
  console.error(`No llegué a ${url} (auth/v1/health devolvió ${salud}).

Puede ser que el proyecto esté pausado, que la URL esté mal, o que haya un
proxy o firewall en el medio. No sigo: cualquier otro chequeo daría un
resultado sin sentido.`);
  process.exit(1);
}
console.log('auth                 ok — el proyecto responde');

for (const tabla of TABLAS) {
  const r = await fetch(`${url}/rest/v1/${tabla}?select=*&limit=1`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  const cuerpo = await r.json().catch(() => null);

  // Con RLS activo y sin sesión, PostgREST devuelve 200 y un arreglo vacío.
  // Un 401 o 403 NO es "RLS funcionando": es que la petición no se autenticó o
  // no llegó. Confundir las dos cosas convierte una falla en un falso verde.
  if (r.status === 404 || (cuerpo && cuerpo.code === '42P01')) {
    console.log(`${tabla.padEnd(20)} FALTA — el schema no se aplicó`);
    fallos++;
  } else if (r.status === 401 || r.status === 403) {
    console.log(`${tabla.padEnd(20)} NO VERIFICADA — ${r.status}, la anon key no fue aceptada`);
    fallos++;
  } else if (r.ok && Array.isArray(cuerpo) && cuerpo.length === 0) {
    console.log(`${tabla.padEnd(20)} ok — existe y RLS la protege`);
  } else if (r.ok && Array.isArray(cuerpo)) {
    console.log(`${tabla.padEnd(20)} ¡RLS ABIERTO! devuelve ${cuerpo.length} fila(s) sin sesión`);
    fallos++;
  } else {
    console.log(`${tabla.padEnd(20)} INESPERADO — HTTP ${r.status} ${JSON.stringify(cuerpo)?.slice(0, 60)}`);
    fallos++;
  }
}

const bucket = await fetch(`${url}/storage/v1/object/list/meal-photos`, {
  method: 'POST',
  headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ prefix: '', limit: 1 }),
});
const fotos = await bucket.json().catch(() => null);
if (Array.isArray(fotos) && fotos.length > 0) {
  console.log('meal-photos          ¡BUCKET ABIERTO! lista archivos sin sesión');
  fallos++;
} else if (bucket.status === 404) {
  console.log('meal-photos          FALTA — el bucket no se creó');
  fallos++;
} else {
  console.log('meal-photos          ok — privado');
}

console.log(fallos === 0 ? '\nTodo en orden.' : `\n${fallos} problema(s). Revisá supabase/schema.sql.`);
process.exit(fallos === 0 ? 0 : 1);
