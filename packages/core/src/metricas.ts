import { resolveSlots } from './schedule.ts';
import type { MealSlot, NutritionPlan, UserConfig } from './types.ts';

/**
 * Metricas del seguimiento.
 *
 * Todas miden algo que se puede explicar en una frase. Deliberadamente no hay
 * "score nutricional" ni porcentajes de macros: dan sensacion de rigor sin
 * serlo, y nadie sabe que hacer con un 73.
 */

/** Una comida registrada, en la forma minima que necesitan las metricas. */
export interface ComidaRegistrada {
  /** Fecha local, "YYYY-MM-DD". */
  fecha: string;
  slotId: string;
  proteinGrams?: number | null;
  esLibre?: boolean;
}

/**
 * Los momentos que esta persona realmente tiene, no los que el plan trae.
 *
 * Pablo hace 16:8 sin desayuno: el plan declara el slot, su config lo apaga.
 * Contar el desayuno como esperado le baja la adherencia al 75% haga lo que
 * haga, y en el resumen de consulta le dice a la nutricionista que se saltea
 * una comida que nadie le indico. Es el mismo error contado de dos formas.
 */
export function slotsEsperados(plan: NutritionPlan, config: UserConfig, fecha: Date): MealSlot[] {
  return resolveSlots(plan, config, fecha)
    .map((r) => r.slot)
    .filter((s) => !s.isSnack);
}

/** Cuantas comidas se esperaban en todo el rango, dia por dia. */
export function comidasEsperadas(plan: NutritionPlan, config: UserConfig, dias: string[]): number {
  return dias.reduce((total, dia) => total + slotsEsperados(plan, config, fechaLocal(dia)).length, 0);
}

/** "2026-09-08" a Date local, sin que el huso lo corra un dia. */
export function fechaLocal(iso: string): Date {
  const [a, m, d] = iso.split('-').map(Number);
  return new Date(a!, m! - 1, d!);
}

export interface Adherencia {
  registradas: number;
  esperadas: number;
  /** 0 a 100. */
  porcentaje: number;
}

/**
 * Cuantas de las comidas esperadas quedaron registradas.
 *
 * Es la metrica honesta: mide lo unico que la app puede saber. No dice si
 * comiste bien, dice si quedo constancia.
 */
export function adherencia(
  registros: ComidaRegistrada[],
  comidasPorDia: number,
  dias: string[],
): Adherencia {
  const delRango = new Set(dias);
  const registradas = registros.filter((r) => delRango.has(r.fecha)).length;
  const esperadas = comidasPorDia * dias.length;
  return {
    registradas,
    esperadas,
    porcentaje: esperadas === 0 ? 0 : Math.round((registradas / esperadas) * 100),
  };
}

/**
 * Dias seguidos con al menos un registro, contando hacia atras desde `hasta`.
 *
 * Se corta en el primer dia sin nada, pero el dia de hoy no cuenta como corte:
 * a las nueve de la manana todavia no hay nada registrado y no tiene sentido
 * decirle a alguien que perdio la racha.
 */
export function racha(registros: ComidaRegistrada[], hasta: string): number {
  const conRegistro = new Set(registros.map((r) => r.fecha));
  let dias = 0;
  let cursor = new Date(`${hasta}T12:00:00`);

  if (!conRegistro.has(hasta)) cursor = restarDia(cursor);

  while (conRegistro.has(iso(cursor))) {
    dias++;
    cursor = restarDia(cursor);
  }
  return dias;
}

export interface ProteinaSemanal {
  promedio: number;
  objetivo: number | null;
  /** Dias del rango que tuvieron al menos un registro. */
  diasConRegistro: number;
}

/** Promedio de proteina por dia registrado. Los dias sin registro no diluyen. */
export function proteinaPromedio(
  plan: NutritionPlan,
  registros: ComidaRegistrada[],
  dias: string[],
): ProteinaSemanal {
  const delRango = new Set(dias);
  const porDia = new Map<string, number>();
  for (const r of registros) {
    if (!delRango.has(r.fecha)) continue;
    porDia.set(r.fecha, (porDia.get(r.fecha) ?? 0) + (r.proteinGrams ?? 0));
  }
  const totales = [...porDia.values()];
  const promedio = totales.length === 0
    ? 0
    : Math.round(totales.reduce((a, b) => a + b, 0) / totales.length);
  return {
    promedio,
    objetivo: plan.proteinTargetGrams ?? null,
    diasConRegistro: porDia.size,
  };
}

/** Comidas del 20% usadas en el rango, y en que dias se amontonaron. */
export function librasUsadas(
  registros: ComidaRegistrada[],
  dias: string[],
): { usadas: number; diasConMasDeUna: string[] } {
  const delRango = new Set(dias);
  const porDia = new Map<string, number>();
  let usadas = 0;
  for (const r of registros) {
    if (!r.esLibre || !delRango.has(r.fecha)) continue;
    usadas++;
    porDia.set(r.fecha, (porDia.get(r.fecha) ?? 0) + 1);
  }
  return {
    usadas,
    diasConMasDeUna: [...porDia.entries()].filter(([, n]) => n > 1).map(([d]) => d).sort(),
  };
}

/** Los ultimos `cantidad` dias hasta `hasta` inclusive, como "YYYY-MM-DD". */
export function ultimosDias(hasta: string, cantidad: number): string[] {
  const dias: string[] = [];
  let cursor = new Date(`${hasta}T12:00:00`);
  for (let i = 0; i < cantidad; i++) {
    dias.push(iso(cursor));
    cursor = restarDia(cursor);
  }
  return dias.reverse();
}

function restarDia(d: Date): Date {
  const otro = new Date(d);
  otro.setDate(otro.getDate() - 1);
  return otro;
}

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
