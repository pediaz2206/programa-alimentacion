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

/**
 * Unidades que no se pluralizan: son abreviaturas, no palabras.
 * "500 gs" no lo escribe nadie.
 */
const INVARIABLES = new Set(['g', 'kg', 'mg', 'ml', 'l', 'cda', 'cdas', 'cdta', 'cdtas', 'cc']);

/**
 * Cantidad y unidad, escritas como las diria una persona.
 *
 * "14 rebanada" y "14 unidad" se leen mal justo donde importa: parado en la
 * gondola con el telefono en la mano.
 */
export function formatCantidad(qty: number | undefined, unit: string | undefined): string {
  if (qty == null) return unit ?? '';
  const numero = String(Math.round(qty * 100) / 100).replace('.', ',');
  if (!unit) return numero;
  return `${numero} ${pluralizar(unit, qty)}`;
}

/** Reglas del castellano: vocal suma -s; d, l, n, r, j suman -es; z pasa a -ces. */
export function pluralizar(palabra: string, cantidad: number): string {
  if (cantidad === 1) return palabra;

  // Una unidad compuesta se pluraliza en su primera palabra: "2 rebanadas de
  // pan". Y la invariabilidad tambien se decide por esa primera palabra: en
  // "120 g en crudo" lo que no se pluraliza es la "g".
  const [primera, ...resto] = palabra.split(' ');
  if (!primera || INVARIABLES.has(primera.toLowerCase())) return palabra;
  return [pluralDe(primera), ...resto].join(' ');
}

function pluralDe(palabra: string): string {
  const ultima = palabra.slice(-1).toLowerCase();
  if ('aeiou'.includes(ultima)) return `${palabra}s`;
  if (ultima === 'z') return `${palabra.slice(0, -1)}ces`;
  if ('dlnrjsxy'.includes(ultima)) return ultima === 's' ? palabra : `${palabra}es`;
  return `${palabra}s`;
}

export function formatIngredient(ing: Ingredient | ShoppingItem): string {
  const qty = 'qty' in ing ? ing.qty : undefined;
  const cantidad = formatCantidad(qty, ing.unit);
  return cantidad ? `${ing.item} (${cantidad})` : ing.item;
}
