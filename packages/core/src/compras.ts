import { buildDaySchedule } from './schedule.ts';
import { buildShoppingList } from './shopping.ts';
import type { MealOption, NutritionPlan, ShoppingItem, UserConfig } from './types.ts';

/**
 * Lista de compras a partir del plan.
 *
 * La adherencia no se rompe en la mesa, se rompe en el supermercado: si el
 * jueves no hay pollo, no se come pollo. Toda la inteligencia del plan es
 * inutil contra una heladera vacia.
 */

export interface ComidaPlanificada {
  fecha: string;
  slotId: string;
  nombreSlot: string;
  option: MealOption;
}

export interface PlanDeCompras {
  items: ShoppingItem[];
  comidas: ComidaPlanificada[];
  /** Comidas del 20%: no se compra para ellas. */
  libres: number;
  dias: number;
}

export function planificarCompras(
  plan: NutritionPlan,
  config: UserConfig,
  desde: Date,
  dias: number,
): PlanDeCompras {
  const comidas: ComidaPlanificada[] = [];
  const nombres = new Map(plan.slots.map((s) => [s.id, s.name]));
  let libres = 0;

  for (let i = 0; i < dias; i++) {
    const fecha = new Date(desde);
    fecha.setDate(fecha.getDate() + i);

    for (const evento of buildDaySchedule(plan, config, fecha)) {
      if (evento.kind !== 'meal' || evento.slotId == null) continue;
      // Para una comida del 20% no hay nada que comprar: por definicion se sale
      // del plan, y meterla en la lista es comprar comida que no se va a usar.
      if (evento.freeMeal) { libres++; continue; }
      const option = evento.suggestions?.[0];
      if (!option) continue;
      comidas.push({
        fecha: iso(fecha),
        slotId: evento.slotId,
        nombreSlot: nombres.get(evento.slotId) ?? evento.slotId,
        option,
      });
    }
  }

  return {
    items: buildShoppingList(comidas.map((c) => c.option)),
    comidas,
    libres,
    dias,
  };
}

/** Agrupa la lista por grupo de alimento: asi se recorre la gondola. */
export function porGrupo(
  plan: NutritionPlan,
  items: ShoppingItem[],
): Array<{ groupId: string; nombre: string; items: ShoppingItem[] }> {
  const nombres = new Map(plan.foodGroups.map((g) => [g.id, g.name]));
  const grupos = new Map<string, ShoppingItem[]>();

  for (const item of items) {
    const id = item.groupId ?? 'otros';
    const lista = grupos.get(id) ?? [];
    lista.push(item);
    grupos.set(id, lista);
  }

  // El orden del plan, con lo suelto al final.
  const orden = [...plan.foodGroups.map((g) => g.id), 'otros'];
  return orden
    .filter((id) => grupos.has(id))
    .map((id) => ({
      groupId: id,
      nombre: nombres.get(id) ?? 'Otros',
      items: grupos.get(id)!,
    }));
}

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
