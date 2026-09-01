import { isValidTime } from './time.ts';
import type { NutritionPlan, UserConfig } from './types.ts';

/**
 * Valida un plan transcrito desde el PDF. La transcripcion es manual o asistida,
 * asi que conviene detectar temprano los errores tipicos: un grupo inexistente,
 * un plato que no suma 1, opciones huerfanas.
 */
export function validatePlan(plan: NutritionPlan): string[] {
  const errors: string[] = [];
  const groupIds = new Set(plan.foodGroups.map((g) => g.id));
  const slotIds = new Set(plan.slots.map((s) => s.id));

  if (plan.foodGroups.length === 0) errors.push('El plan no tiene grupos de alimentos.');
  if (plan.slots.length === 0) errors.push('El plan no tiene momentos de comida.');

  for (const slot of plan.slots) {
    if (!isValidTime(slot.defaultTime)) {
      errors.push(`Slot "${slot.id}": hora invalida "${slot.defaultTime}".`);
    }
    if (slot.plateTarget) errors.push(...checkPlate(`slot "${slot.id}"`, slot.plateTarget, groupIds));
  }

  if (plan.plateDefault) errors.push(...checkPlate('plateDefault', plan.plateDefault, groupIds));

  for (const option of plan.options) {
    if (option.slotIds.length === 0) {
      errors.push(`Opcion "${option.id}": no esta asignada a ningun momento.`);
    }
    for (const slotId of option.slotIds) {
      if (!slotIds.has(slotId)) {
        errors.push(`Opcion "${option.id}": referencia el momento inexistente "${slotId}".`);
      }
    }
    for (const groupId of Object.keys(option.portions ?? {})) {
      if (!groupIds.has(groupId)) {
        errors.push(`Opcion "${option.id}": porciones del grupo inexistente "${groupId}".`);
      }
    }
    for (const ing of option.ingredients) {
      if (ing.groupId && !groupIds.has(ing.groupId)) {
        errors.push(`Opcion "${option.id}": ingrediente "${ing.item}" con grupo inexistente "${ing.groupId}".`);
      }
    }
  }

  for (const group of plan.foodGroups) {
    for (const ex of group.exchanges ?? []) {
      for (const slotId of ex.slotIds ?? []) {
        if (!slotIds.has(slotId)) {
          errors.push(`Grupo "${group.id}": la equivalencia "${ex.label}" referencia el momento inexistente "${slotId}".`);
        }
      }
    }
  }

  for (const slot of plan.slots) {
    for (const comp of slot.formula ?? []) {
      if (!groupIds.has(comp.groupId)) {
        errors.push(`Slot "${slot.id}": la fórmula referencia el grupo inexistente "${comp.groupId}".`);
      }
    }
  }

  if (plan.proteinTargetGrams != null && plan.proteinTargetGrams <= 0) {
    errors.push(`proteinTargetGrams debe ser mayor a 0 (se pasó ${plan.proteinTargetGrams}).`);
  }

  for (const groupId of Object.keys(plan.dailyTargets ?? {})) {
    if (!groupIds.has(groupId)) {
      errors.push(`dailyTargets: grupo inexistente "${groupId}".`);
    }
  }

  for (const slot of plan.slots) {
    const hasOptions = plan.options.some((o) => o.slotIds.includes(slot.id));
    if (!hasOptions) errors.push(`Slot "${slot.id}" (${slot.name}) no tiene ninguna opcion cargada.`);
  }

  return errors;
}

export function validateConfig(plan: NutritionPlan, config: UserConfig): string[] {
  const errors: string[] = [];
  const slotIds = new Set(plan.slots.map((s) => s.id));

  if (config.planId !== plan.id) {
    errors.push(`La config apunta al plan "${config.planId}" pero se paso "${plan.id}".`);
  }
  for (const slot of config.slots) {
    if (!slotIds.has(slot.slotId)) errors.push(`Config: momento inexistente "${slot.slotId}".`);
    if (slot.time && !isValidTime(slot.time)) {
      errors.push(`Config "${slot.slotId}": hora invalida "${slot.time}".`);
    }
  }
  const fasting = config.fasting;
  if (fasting?.enabled) {
    if (!isValidTime(fasting.eatingWindowStart)) {
      errors.push(`Ayuno: hora de inicio invalida "${fasting.eatingWindowStart}".`);
    }
    if (fasting.eatingWindowHours <= 0 || fasting.eatingWindowHours >= 24) {
      errors.push(`Ayuno: la ventana debe estar entre 0 y 24 horas (se paso ${fasting.eatingWindowHours}).`);
    }
  }
  if (config.optionsPerSuggestion < 1) errors.push('optionsPerSuggestion debe ser >= 1.');

  for (const libre of config.freeMeals ?? []) {
    if (!slotIds.has(libre.slotId)) {
      errors.push(`Comidas del 20%: momento inexistente "${libre.slotId}".`);
    }
    if (libre.weekday < 0 || libre.weekday > 6) {
      errors.push(`Comidas del 20%: día de semana inválido "${libre.weekday}".`);
    }
  }
  if (config.freeMeals && !plan.freeMeals) {
    errors.push('La config asigna comidas del 20% pero el plan no las contempla.');
  }

  return errors;
}

function checkPlate(where: string, plate: Record<string, number>, groupIds: Set<string>): string[] {
  const errors: string[] = [];
  let total = 0;
  for (const [groupId, fraction] of Object.entries(plate)) {
    if (!groupIds.has(groupId)) errors.push(`${where}: grupo inexistente "${groupId}".`);
    if (fraction < 0) errors.push(`${where}: fraccion negativa en "${groupId}".`);
    total += fraction;
  }
  if (Math.abs(total - 1) > 0.01) {
    errors.push(`${where}: las fracciones del plato suman ${total.toFixed(2)}, deberian sumar 1.`);
  }
  return errors;
}
