import type {
  FreeMealSlot,
  FreeMealSummary,
  NutritionPlan,
  UserConfig,
  Weekday,
} from './types.ts';

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

export function nombreDia(weekday: Weekday): string {
  return DIAS[weekday] ?? String(weekday);
}

/** Si esta comida, en este dia, esta marcada como del 20%. */
export function isFreeMeal(config: UserConfig, weekday: Weekday, slotId: string): boolean {
  return (config.freeMeals ?? []).some((f) => f.weekday === weekday && f.slotId === slotId);
}

/**
 * Estado del presupuesto de comidas libres de la semana.
 *
 * El plan las define por cantidad, no por dia, asi que lo que importa es
 * cuantas quedan y si se estan amontonando en la misma jornada.
 */
export function freeMealSummary(plan: NutritionPlan, config: UserConfig): FreeMealSummary {
  const policy = plan.freeMeals;
  const planned = config.freeMeals ?? [];
  const warnings: string[] = [];

  if (!policy) {
    return { perWeek: 0, planned, unassigned: 0, overBudget: planned.length, warnings };
  }

  const overBudget = Math.max(0, planned.length - policy.perWeek);
  const unassigned = Math.max(0, policy.perWeek - planned.length);

  if (overBudget > 0) {
    warnings.push(
      `Hay ${planned.length} comidas del 20% asignadas y el plan permite ${policy.perWeek}.`,
    );
  }

  const maxPerDay = policy.maxPerDay;
  if (maxPerDay != null) {
    const porDia = new Map<Weekday, number>();
    for (const f of planned) porDia.set(f.weekday, (porDia.get(f.weekday) ?? 0) + 1);
    for (const [weekday, cuenta] of porDia) {
      if (cuenta > maxPerDay) {
        warnings.push(
          `El ${nombreDia(weekday)} concentra ${cuenta} comidas del 20%. ` +
            `El plan pide no juntar más de ${maxPerDay} en un mismo día.`,
        );
      }
    }
  }

  return {
    perWeek: policy.perWeek,
    ...(policy.totalPerWeek != null ? { totalPerWeek: policy.totalPerWeek } : {}),
    planned,
    unassigned,
    overBudget,
    warnings,
  };
}

/** Las comidas libres de un dia concreto. */
export function freeMealsOn(config: UserConfig, weekday: Weekday): FreeMealSlot[] {
  return (config.freeMeals ?? []).filter((f) => f.weekday === weekday);
}
