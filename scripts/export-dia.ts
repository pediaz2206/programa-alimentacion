/**
 * Exporta la agenda de un dia mas los datos del plan que la UI necesita para
 * recalcular el balance del lado del cliente.
 *
 *   node --experimental-strip-types scripts/export-dia.ts > salida.json
 */
import { readFileSync } from 'node:fs';
import { buildDaySchedule } from '../packages/core/src/schedule.ts';
import type { NutritionPlan, UserConfig } from '../packages/core/src/types.ts';

const plan = JSON.parse(readFileSync('data/plan.ejemplo.json', 'utf8')) as NutritionPlan;
const config = JSON.parse(readFileSync('data/config.ejemplo.json', 'utf8')) as UserConfig;
const date = new Date('2026-09-01T12:00:00');

process.stdout.write(JSON.stringify({
  plan: {
    name: plan.name,
    foodGroups: plan.foodGroups,
    dailyTargets: plan.dailyTargets,
    guidelines: plan.guidelines,
  },
  fasting: config.fasting,
  events: buildDaySchedule(plan, config, date),
}, null, 2));
