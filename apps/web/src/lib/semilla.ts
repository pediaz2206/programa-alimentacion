import type { NutritionPlan, UserConfig } from '@pa/core';
import planJson from '../../../../data/plan.pablo.json';
import configJson from '../../../../data/config.pablo.json';

/**
 * El plan transcrito de los PDF, empaquetado con la app. Es el contenido de
 * arranque: la primera vez que alguien entra se copia a su cuenta, y a partir
 * de ahi el plan vive en Supabase y lo edita la nutricionista.
 */
export const planEmpaquetado = planJson as unknown as NutritionPlan;
export const configEmpaquetada = configJson as unknown as UserConfig;
