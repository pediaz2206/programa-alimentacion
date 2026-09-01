import type { DailyBalance, GroupBalance, MealOption, NutritionPlan, Portions } from './types.ts';

/** Suma las porciones aportadas por las comidas ya consumidas. */
export function sumPortions(options: MealOption[]): Portions {
  const total: Portions = {};
  for (const option of options) {
    for (const [groupId, amount] of Object.entries(option.portions ?? {})) {
      total[groupId] = (total[groupId] ?? 0) + amount;
    }
  }
  return total;
}

/**
 * El "complementar entre comidas" del plan: cuanto falta de cada grupo
 * para cerrar el dia, dado lo que ya se comio.
 */
export function sumProtein(options: MealOption[]): number {
  return options.reduce((total, o) => total + (o.proteinGrams ?? 0), 0);
}

export function computeDailyBalance(plan: NutritionPlan, consumed: MealOption[]): DailyBalance {
  const targets = plan.dailyTargets ?? {};
  const eaten = sumPortions(consumed);
  const names = new Map(plan.foodGroups.map((g) => [g.id, g.name]));

  const groups: GroupBalance[] = Object.keys(targets).map((groupId) => {
    const target = targets[groupId] ?? 0;
    const got = eaten[groupId] ?? 0;
    return {
      groupId,
      groupName: names.get(groupId) ?? groupId,
      target,
      consumed: round(got),
      remaining: round(Math.max(0, target - got)),
    };
  });

  const advice: string[] = [];

  let protein;
  if (plan.proteinTargetGrams != null) {
    const got = sumProtein(consumed);
    protein = {
      target: plan.proteinTargetGrams,
      consumed: round(got),
      remaining: round(Math.max(0, plan.proteinTargetGrams - got)),
    };
    if (protein.remaining > 0) {
      advice.push(`Faltan ${protein.remaining} g de proteína`);
    }
  }

  for (const g of groups) {
    if (g.remaining > 0) {
      advice.push(`Faltan ${fmt(g.remaining)} de ${g.groupName.toLowerCase()}`);
    } else if (g.consumed > g.target) {
      advice.push(`${g.groupName} ya supera el objetivo (${fmt(g.consumed)} de ${fmt(g.target)})`);
    }
  }
  if (advice.length === 0 && (groups.length > 0 || protein)) {
    advice.push('Dia completo: todos los objetivos cubiertos.');
  }

  return protein ? { groups, protein, advice } : { groups, advice };
}

/** Lo que falta, en el formato que consume el selector de sugerencias. */
export function remainingPortions(balance: DailyBalance): Portions {
  const out: Portions = {};
  for (const g of balance.groups) out[g.groupId] = g.remaining;
  return out;
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

function fmt(n: number): string {
  const rounded = round(n);
  const label = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(/0$/, '');
  return `${label} ${rounded === 1 ? 'porcion' : 'porciones'}`;
}
