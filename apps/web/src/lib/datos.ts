import {
  buildDaySchedule,
  computeDailyBalance,
  freeMealSummary,
  type MealOption,
  type NutritionPlan,
  type ScheduledEvent,
  type UserConfig,
} from '@pa/core';

/**
 * El plan ya no es una constante del modulo: la nutricionista publica
 * versiones nuevas, asi que viaja como dato y estas funciones lo reciben.
 */

export function agendaDe(plan: NutritionPlan, config: UserConfig, fecha: Date): ScheduledEvent[] {
  return buildDaySchedule(plan, config, fecha);
}

export function minutosAhora(d = new Date()): number {
  return d.getHours() * 60 + d.getMinutes();
}

export function opcionPorId(plan: NutritionPlan, id: string | null | undefined): MealOption | undefined {
  return id ? plan.options.find((o) => o.id === id) : undefined;
}

export function balanceDe(plan: NutritionPlan, comidas: MealOption[]) {
  return computeDailyBalance(plan, comidas);
}

export function comidasLibres(plan: NutritionPlan, config: UserConfig) {
  return freeMealSummary(plan, config);
}

export function nombresSlot(plan: NutritionPlan): Map<string, string> {
  return new Map(plan.slots.map((s) => [s.id, s.name]));
}
