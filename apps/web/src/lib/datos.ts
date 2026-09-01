import {
  buildDaySchedule,
  computeDailyBalance,
  freeMealSummary,
  type MealOption,
  type NutritionPlan,
  type ScheduledEvent,
  type UserConfig,
} from '@pa/core';
import planJson from '../../../../data/plan.pablo.json';
import configJson from '../../../../data/config.pablo.json';

/**
 * Por ahora el plan viaja dentro del bundle. Cuando exista el login pasa a
 * leerse de Supabase; el resto de la app no cambia, porque todo consume estas
 * funciones y no la fuente.
 */
export const plan = planJson as unknown as NutritionPlan;
export const configInicial = configJson as unknown as UserConfig;

export function agendaDe(config: UserConfig, fecha: Date): ScheduledEvent[] {
  return buildDaySchedule(plan, config, fecha);
}

export function minutosAhora(d = new Date()): number {
  return d.getHours() * 60 + d.getMinutes();
}

export function opcionPorId(id: string | null | undefined): MealOption | undefined {
  if (!id) return undefined;
  return plan.options.find((o) => o.id === id);
}

export function balanceDe(comidas: MealOption[]) {
  return computeDailyBalance(plan, comidas);
}

export function comidasLibres(config: UserConfig) {
  return freeMealSummary(plan, config);
}

export const NOMBRE_SLOT = new Map(plan.slots.map((s) => [s.id, s.name]));
