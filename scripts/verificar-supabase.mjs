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

const env = { ...leerEnv('apps/web/.env'), ...process.env };
const url = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error('Faltan VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY (apps/web/.env).');
  process.exit(1);
}

const TABLAS = [
  'profiles', 'care_relationships', 'plans', 'plan_versions',
  'configs', 'meal_logs', 'push_subscriptions', 'notification_log',
];

let fallos = 0;

const salud = await fetch(`${url}/auth/v1/health`, { headers: { apikey: key } })
  .then((r) => r.status).catch((e) => e.message);
console.log(`auth        ${salud === 200 ? 'ok' : `PROBLEMA (${salud})`}`);
if (salud !== 200) fallos++;

for (const tabla of TABLAS) {
  const r = await fetch(`${url}/rest/v1/${tabla}?select=*&limit=1`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  const cuerpo = await r.json().catch(() => null);

  if (r.status === 404 || (cuerpo && cuerpo.code === '42P01')) {
    console.log(`${tabla.padEnd(20)} FALTA — el schema no se aplicó`);
    fallos++;
  } else if (r.ok && Array.isArray(cuerpo) && cuerpo.length > 0) {
    console.log(`${tabla.padEnd(20)} ¡RLS ABIERTO! devuelve datos sin sesión`);
    fallos++;
  } else if (r.ok) {
    console.log(`${tabla.padEnd(20)} ok — existe y RLS la protege`);
  } else {
    console.log(`${tabla.padEnd(20)} ok — RLS la protege (${r.status})`);
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
} else {
  console.log('meal-photos          ok — privado');
}

console.log(fallos === 0 ? '\nTodo en orden.' : `\n${fallos} problema(s). Revisá supabase/schema.sql.`);
process.exit(fallos === 0 ? 0 : 1);
