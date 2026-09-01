/**
 * Vista previa de la agenda de un dia por consola.
 *
 *   npm run hoy
 *   npm run hoy -- --fecha 2026-09-05
 *   npm run hoy -- --plan data/otro-plan.json --config data/mi-config.json
 *
 * Sirve para validar el plan transcrito antes de conectar cualquier UI.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildDaySchedule } from './schedule.ts';
import { validateConfig, validatePlan } from './validate.ts';
import { formatTime } from './time.ts';
import type { NutritionPlan, UserConfig } from './types.ts';

function arg(name: string, fallback: string): string {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1]! : fallback;
}

const planPath = resolve(process.cwd(), arg('plan', 'data/plan.ejemplo.json'));
const configPath = resolve(process.cwd(), arg('config', 'data/config.ejemplo.json'));
const dateArg = arg('fecha', '');
const date = dateArg ? new Date(`${dateArg}T12:00:00`) : new Date();

const plan = JSON.parse(readFileSync(planPath, 'utf8')) as NutritionPlan;
const config = JSON.parse(readFileSync(configPath, 'utf8')) as UserConfig;

const problems = [...validatePlan(plan), ...validateConfig(plan, config)];
if (problems.length > 0) {
  console.error('Problemas detectados:');
  for (const p of problems) console.error(`  - ${p}`);
  process.exitCode = 1;
}

const events = buildDaySchedule(plan, config, date);
const ICON: Record<string, string> = {
  'prep-check': '[ingredientes]',
  meal: '[comida]     ',
  'fast-start': '[ayuno]      ',
  'fast-closing': '[ventana]    ',
  'fast-end': '[ventana]    ',
};

console.log(`\n${plan.name} - ${date.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}\n`);
for (const e of events) {
  console.log(`${e.time}  ${ICON[e.kind] ?? ''}  ${e.title}`);
  console.log(`               ${e.body}`);
  if (e.checklist?.length) {
    for (const item of e.checklist) {
      console.log(`               [ ] ${item.item}${item.qty != null ? ` - ${item.qty} ${item.unit ?? ''}`.trimEnd() : ''}`);
    }
  }
  for (const w of e.warnings ?? []) console.log(`               (!) ${w}`);
  console.log();
}
console.log(`${events.length} eventos. Ultimo a las ${formatTime(events.at(-1)?.minutes ?? 0)}.\n`);
