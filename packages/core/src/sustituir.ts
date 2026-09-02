import type { ExchangeOption, MealSlot, NutritionPlan } from './types.ts';

/**
 * Salir del paso y reemplazar, con la tabla de equivalencias del propio plan.
 *
 * Todo plan se rompe en el mismo lugar: el asado del domingo, el almuerzo de
 * laburo, la milanesa que cocino otro. Aparece comida que no estaba prevista y
 * la app, en vez de ayudar, estorba: dice que deberias estar comiendo mientras
 * mirás otra cosa. Y como no hay nada que hacer, no se registra nada, y la
 * nutricionista tampoco se entera.
 *
 * Lo unico que puede contestar esas dos preguntas —"¿esto con que cuenta?" y
 * "¿con que lo reemplazo?"— es la tabla de intercambios de quien escribio el
 * plan. No una base generica de alimentos: sus equivalencias, sus gramajes.
 */

/** Las equivalencias de un grupo que aplican a un momento del dia. */
export function equivalenciasDe(
  plan: NutritionPlan,
  groupId: string,
  slotId?: string,
): ExchangeOption[] {
  const grupo = plan.foodGroups.find((g) => g.id === groupId);
  return (grupo?.exchanges ?? []).filter(
    (ex) => !ex.slotIds || slotId == null || ex.slotIds.includes(slotId),
  );
}

/**
 * Con que reemplazar un ingrediente que no hay.
 *
 * Se busca por el grupo del ingrediente, no por su nombre: lo que importa no
 * es que sea pollo sino que ocupa el lugar de la proteina.
 */
export function reemplazosDe(
  plan: NutritionPlan,
  groupId: string | undefined,
  slotId?: string,
): { grupo: string; opciones: ExchangeOption[] } | null {
  if (!groupId) return null;
  const grupo = plan.foodGroups.find((g) => g.id === groupId);
  if (!grupo) return null;
  const opciones = equivalenciasDe(plan, groupId, slotId);
  return opciones.length > 0 ? { grupo: grupo.name, opciones } : null;
}

/**
 * Lo que se comio cuando no fue lo previsto.
 *
 * Por cada grupo, la etiqueta de la equivalencia elegida, o null si ese grupo
 * no quedo cubierto. Se habla en las unidades del plan y no en calorias: son
 * las unicas que la nutricionista puede interpretar despues.
 */
export type Desvio = Record<string, string | null>;

/** Los grupos que un momento del dia espera cubrir. */
export function gruposDe(plan: NutritionPlan, slot: MealSlot): string[] {
  if (slot.formula && slot.formula.length > 0) return slot.formula.map((c) => c.groupId);
  if (slot.plateTarget) return Object.keys(slot.plateTarget);
  return plan.foodGroups.map((g) => g.id);
}

/** Proteina aportada por un desvio, segun las equivalencias elegidas. */
export function proteinaDeDesvio(plan: NutritionPlan, desvio: Desvio): number {
  let total = 0;
  for (const [groupId, etiqueta] of Object.entries(desvio)) {
    if (!etiqueta) continue;
    const ex = equivalenciasDe(plan, groupId).find((e) => e.label === etiqueta);
    total += ex?.proteinGrams ?? 0;
  }
  return total;
}

/**
 * El desvio en una frase, para que quede en el registro y lo lea la
 * nutricionista. Nombra lo que falto: es la parte accionable.
 */
export function resumenDeDesvio(
  plan: NutritionPlan,
  slot: MealSlot,
  desvio: Desvio,
): string {
  const nombres = new Map(plan.foodGroups.map((g) => [g.id, g.name.toLowerCase()]));
  const esperados = gruposDe(plan, slot);
  const cubiertos = esperados.filter((g) => desvio[g]);
  const faltaron = esperados.filter((g) => !desvio[g]);

  const partes: string[] = [];
  if (cubiertos.length > 0) {
    partes.push(`Cubrió ${listar(cubiertos.map((g) => nombres.get(g) ?? g))}`);
  }
  if (faltaron.length > 0) {
    partes.push(`${cubiertos.length > 0 ? 'faltó' : 'No cubrió'} ${listar(faltaron.map((g) => nombres.get(g) ?? g))}`);
  }
  return partes.length > 0 ? `${partes.join('; ')}.` : 'Sin datos de qué cubrió.';
}

/** "a, b y c" — como se enumera en castellano, no "a, b, c". */
function listar(items: string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0]!;
  return `${items.slice(0, -1).join(', ')} y ${items[items.length - 1]}`;
}

/** Cantidad y unidad de una equivalencia, para mostrarla junto a su nombre. */
export function detalleDe(ex: ExchangeOption): string {
  const partes: string[] = [];
  if (ex.qty != null) partes.push(`${String(ex.qty).replace('.', ',')} ${ex.unit ?? ''}`.trim());
  else if (ex.unit) partes.push(ex.unit);
  if (ex.proteinGrams != null) partes.push(`${ex.proteinGrams} g de proteína`);
  return partes.join(' · ');
}
