import type { NutritionPlan, UserConfig } from '@pa/core';
import planEjemplo from '../../../../data/plan.ejemplo.json';
import configEjemplo from '../../../../data/config.ejemplo.json';

/**
 * Lo que ve una cuenta recien creada.
 *
 * Es un plan de EJEMPLO a proposito. Antes se sembraba un plan real
 * transcrito de PDF, lo que significaba que cualquier persona que entrara se
 * llevaba el objetivo proteico y las listas de otra: en una app de salud eso
 * no es un detalle.
 *
 * El plan y la config van juntos: la config referencia los momentos del plan
 * por id, y mezclarlos produce una config invalida.
 */
export const planEmpaquetado = planEjemplo as unknown as NutritionPlan;
export const configEmpaquetada = configEjemplo as unknown as UserConfig;

/** Si el plan que se esta viendo es el de ejemplo y no uno propio. */
export function esPlanDeEjemplo(plan: NutritionPlan): boolean {
  return plan.id === planEmpaquetado.id;
}
