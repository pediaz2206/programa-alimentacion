/**
 * Genera la vista HTML a partir del plan y la configuracion actuales.
 *
 *   npm run vista
 *   npm run vista -- --hora 18:20 --fecha 2026-09-01
 *
 * Es un solo archivo autocontenido: se abre con doble clic, sin servidor.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { freeMealSummary } from '../packages/core/src/libres.ts';
import { buildDaySchedule } from '../packages/core/src/schedule.ts';
import { parseTime } from '../packages/core/src/time.ts';
import { validateConfig, validatePlan } from '../packages/core/src/validate.ts';
import type { NutritionPlan, UserConfig } from '../packages/core/src/types.ts';

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : fallback;
}

const planPath = arg('plan', 'data/plan.ejemplo.json');
const configPath = arg('config', 'data/config.ejemplo.json');
const plan = JSON.parse(readFileSync(planPath, 'utf8')) as NutritionPlan;
const config = JSON.parse(readFileSync(configPath, 'utf8')) as UserConfig;

const problemas = [...validatePlan(plan), ...validateConfig(plan, config)];
if (problemas.length > 0) {
  console.error('El plan tiene problemas y la vista puede salir incompleta:');
  for (const p of problemas) console.error(`  - ${p}`);
}

const fechaArg = arg('fecha', '');
const date = fechaArg ? new Date(`${fechaArg}T12:00:00`) : new Date();
const horaArg = arg('hora', '');
const ahora = horaArg ? parseTime(horaArg) : date.getHours() * 60 + date.getMinutes();

const datos = {
  plan: {
    name: plan.name,
    foodGroups: plan.foodGroups,
    dailyTargets: plan.dailyTargets ?? {},
    guidelines: plan.guidelines ?? [],
    proteinTargetGrams: plan.proteinTargetGrams,
    slots: plan.slots,
  },
  fasting: config.fasting,
  events: buildDaySchedule(plan, config, date),
  ahora,
  fecha: date.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' }),
  esEjemplo: planPath.includes('ejemplo'),
  freeMeals: freeMealSummary(plan, config),
};

const plantilla = readFileSync('apps/vista/plantilla.html', 'utf8');
if (!plantilla.includes('/*__DATOS__*/')) throw new Error('La plantilla perdio el marcador /*__DATOS__*/');

mkdirSync('apps/vista/salida', { recursive: true });
const destino = 'apps/vista/salida/index.html';
writeFileSync(
  destino,
  plantilla.replace('/*__DATOS__*/', JSON.stringify(datos).replace(/<\//g, '<\\/')),
);

console.log(`\nVista generada: ${destino}`);
console.log(`Plan: ${plan.name} · ${datos.events.length} eventos · hora ${String(Math.floor(ahora / 60)).padStart(2, '0')}:${String(ahora % 60).padStart(2, '0')}\n`);
