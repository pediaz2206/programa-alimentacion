import type { MealOption, NutritionPlan } from '@pa/core';
import { opcionPorId } from './datos.ts';

/** Una comida registrada. Refleja la fila de `meal_logs` en Supabase. */
export interface Registro {
  fecha: string;
  slotId: string;
  optionId: string | null;
  proteinGrams: number | null;
  esLibre: boolean;
  nota?: string;
  /** DataURL mientras no haya backend; despues, ruta en Storage. */
  foto?: string;
}

const CLAVE = 'en-punto:registros:v1';

/**
 * Persistencia local mientras no haya sesion. Cuando exista, esto pasa a ser
 * la cola de lo que todavia no se sincronizo: la app tiene que servir aunque
 * el telefono este sin datos en el medio de una comida.
 */
export function leerRegistros(): Registro[] {
  try {
    const crudo = localStorage.getItem(CLAVE);
    return crudo ? (JSON.parse(crudo) as Registro[]) : [];
  } catch {
    return [];
  }
}

export function guardarRegistro(r: Registro): Registro[] {
  const todos = leerRegistros().filter((x) => !(x.fecha === r.fecha && x.slotId === r.slotId));
  todos.push(r);
  todos.sort((a, b) => (a.fecha === b.fecha ? a.slotId.localeCompare(b.slotId) : b.fecha.localeCompare(a.fecha)));
  try {
    localStorage.setItem(CLAVE, JSON.stringify(todos));
  } catch {
    // Modo privado o cuota llena: se pierde la persistencia, no la sesion.
  }
  return todos;
}

export function borrarRegistro(fecha: string, slotId: string): Registro[] {
  const todos = leerRegistros().filter((x) => !(x.fecha === fecha && x.slotId === slotId));
  try {
    localStorage.setItem(CLAVE, JSON.stringify(todos));
  } catch { /* ver arriba */ }
  return todos;
}

export function fechaISO(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function opcionesDe(plan: NutritionPlan, registros: Registro[]): MealOption[] {
  return registros
    .map((r) => opcionPorId(plan, r.optionId))
    .filter((o): o is MealOption => o != null);
}
