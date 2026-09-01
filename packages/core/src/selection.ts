import type { MealOption, NutritionPlan, Portions, UserConfig } from './types.ts';

export interface SelectionContext {
  /** Indice de dia estable (ej. dias desde epoch) para rotar sugerencias. */
  dayIndex: number;
  /** Porciones que faltan cubrir en el dia. Si se pasa, prioriza lo que cierra huecos. */
  remaining?: Portions;
  /** Opciones ya sugeridas hoy: se mandan al final para no repetir plato. */
  avoidIds?: string[];
}

function hash(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** Cuanto ayuda esta opcion a cubrir lo que falta del dia. */
export function gapScore(option: MealOption, remaining: Portions | undefined): number {
  if (!remaining || !option.portions) return 0;
  let score = 0;
  for (const [groupId, amount] of Object.entries(option.portions)) {
    const missing = remaining[groupId] ?? 0;
    if (missing > 0) score += Math.min(amount, missing);
  }
  return score;
}

export function optionsForSlot(plan: NutritionPlan, config: UserConfig, slotId: string): MealOption[] {
  const excluded = new Set(config.excludeTags ?? []);
  return plan.options.filter(
    (o) => o.slotIds.includes(slotId) && !(o.tags ?? []).some((t) => excluded.has(t)),
  );
}

/**
 * Elige que sugerir para un momento del dia.
 *
 * Es deterministico a proposito: mismo dia + mismo plan = misma sugerencia,
 * asi el recordatorio de las 12:30 dice lo mismo que el aviso de ingredientes
 * de las 11:45. La rotacion por `dayIndex` evita comer lo mismo todos los dias,
 * y `remaining` empuja hacia arriba lo que ayuda a cerrar las porciones del dia.
 * `avoidIds` evita que el almuerzo y la cena propongan el mismo plato.
 */
export function suggestOptions(
  plan: NutritionPlan,
  config: UserConfig,
  slotId: string,
  ctx: SelectionContext,
): MealOption[] {
  const pool = optionsForSlot(plan, config, slotId);
  if (pool.length === 0) return [];

  const offset = (ctx.dayIndex + hash(slotId)) % pool.length;
  const rotated = [...pool.slice(offset), ...pool.slice(0, offset)];

  const avoid = new Set(ctx.avoidIds ?? []);
  const ranked = rotated
    .map((option, position) => ({
      option,
      position,
      repeated: avoid.has(option.id) ? 1 : 0,
      score: gapScore(option, ctx.remaining),
    }))
    .sort(
      (a, b) => a.repeated - b.repeated || b.score - a.score || a.position - b.position,
    );

  return ranked.slice(0, Math.max(1, config.optionsPerSuggestion)).map((r) => r.option);
}

/** Dias transcurridos desde epoch: indice estable para rotar. */
export function dayIndexOf(date: Date): number {
  return Math.floor(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000,
  );
}
