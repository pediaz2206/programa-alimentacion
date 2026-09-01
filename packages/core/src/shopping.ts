import type { Ingredient, MealOption, ShoppingItem } from './types.ts';

function normalize(item: string): string {
  return item
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Consolida los ingredientes de varias comidas en una sola lista.
 * Los `staple` (sal, aceite, especias) quedan afuera: se asumen en la alacena.
 */
export function buildShoppingList(options: MealOption[]): ShoppingItem[] {
  const acc = new Map<string, ShoppingItem>();

  for (const option of options) {
    for (const ing of option.ingredients) {
      if (ing.staple) continue;
      const key = normalize(ing.item);
      const existing = acc.get(key);

      if (!existing) {
        acc.set(key, {
          item: ing.item,
          qty: ing.qty,
          unit: ing.unit,
          groupId: ing.groupId,
          usedIn: [option.name],
        });
        continue;
      }

      if (!existing.usedIn.includes(option.name)) existing.usedIn.push(option.name);

      if (existing.unit === ing.unit && existing.qty != null && ing.qty != null) {
        existing.qty += ing.qty;
      } else if (existing.unit !== ing.unit || existing.qty == null || ing.qty == null) {
        existing.mixedUnits = true;
        existing.qty = undefined;
        existing.unit = undefined;
      }
    }
  }

  return [...acc.values()].sort((a, b) => a.item.localeCompare(b.item, 'es'));
}

/** Lista de verificacion previa a cocinar: todo lo que hace falta para esa comida. */
export function checklistFor(option: MealOption): Ingredient[] {
  return option.ingredients.filter((i) => !i.staple);
}

export function formatIngredient(ing: Ingredient | ShoppingItem): string {
  const qty = 'qty' in ing ? ing.qty : undefined;
  const parts = [ing.item];
  if (qty != null) parts.push(ing.unit ? `${qty} ${ing.unit}` : String(qty));
  else if (ing.unit) parts.push(ing.unit);
  const suffix = parts.length > 1 ? ` (${parts.slice(1).join(' ')})` : '';
  return `${ing.item}${suffix}`;
}
