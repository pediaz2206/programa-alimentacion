import type { FoodGroup, MealSlot, NutritionPlan, PlateTarget } from './types.ts';

/**
 * El reparto de plato que aplica a un momento del dia.
 *
 * El metodo del plato solo aplica donde el plan lo indica: desayunos, meriendas
 * y colaciones se arman por porciones, no por fracciones de plato.
 */
export function plateFor(plan: NutritionPlan, slot: MealSlot): PlateTarget | undefined {
  if (slot.plateTarget) return slot.plateTarget;
  return slot.usesPlateMethod ? plan.plateDefault : undefined;
}

/** "1/2 vegetales - 1/4 proteinas - 1/4 carbohidratos" */
export function describePlate(target: PlateTarget, groups: FoodGroup[]): string {
  const byId = new Map(groups.map((g) => [g.id, g.name]));
  return Object.entries(target)
    .filter(([, fraction]) => fraction > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([id, fraction]) => `${asFraction(fraction)} ${byId.get(id) ?? id}`)
    .join(' · ');
}

const KNOWN_FRACTIONS: Array<[number, string]> = [
  [1, '1 plato'],
  [0.75, '3/4'],
  [0.5, '1/2'],
  [1 / 3, '1/3'],
  [0.25, '1/4'],
  [1 / 6, '1/6'],
  [0.125, '1/8'],
];

function asFraction(value: number): string {
  for (const [n, label] of KNOWN_FRACTIONS) {
    if (Math.abs(value - n) < 0.02) return label;
  }
  return `${Math.round(value * 100)}%`;
}
