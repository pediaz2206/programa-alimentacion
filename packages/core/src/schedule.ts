import { computeDailyBalance, remainingPortions, sumPortions } from './balance.ts';
import { describePlate, plateFor } from './plate.ts';
import { checklistFor, formatIngredient } from './shopping.ts';
import { isFreeMeal } from './libres.ts';
import { dayIndexOf, suggestOptions } from './selection.ts';
import { formatTime, humanizeMinutes, isWithinWindow, minutesUntil, parseTime } from './time.ts';
/**
 * Cuanto se asume que dura una comida. Sirve para avisar cuando una comida
 * arranca tan cerca del cierre de la ventana que se va a terminar afuera.
 */
const DURACION_COMIDA_MINUTOS = 30;

import type {
  MealOption,
  MealSlot,
  NutritionPlan,
  ScheduledEvent,
  SlotConfig,
  UserConfig,
  Weekday,
} from './types.ts';

interface ResolvedSlot {
  slot: MealSlot;
  minutes: number;
  prepLeadMinutes: number;
}

/** Aplica la config del usuario sobre los slots del plan para un dia concreto. */
export function resolveSlots(plan: NutritionPlan, config: UserConfig, date: Date): ResolvedSlot[] {
  const weekday = date.getDay() as Weekday;
  const overrides = new Map<string, SlotConfig>(config.slots.map((s) => [s.slotId, s]));

  return plan.slots
    .map((slot) => {
      const cfg = overrides.get(slot.id);
      if (cfg?.enabled === false) return null;
      if (cfg?.weekdays && !cfg.weekdays.includes(weekday)) return null;
      return {
        slot,
        minutes: parseTime(cfg?.time ?? slot.defaultTime),
        prepLeadMinutes:
          cfg?.prepLeadMinutes ?? slot.prepLeadMinutes ?? config.defaultPrepLeadMinutes,
      };
    })
    .filter((s): s is ResolvedSlot => s !== null)
    .sort((a, b) => a.minutes - b.minutes);
}

/**
 * Genera la agenda completa de un dia: avisos de ingredientes, recordatorios de
 * comida con sus opciones, y los limites de la ventana de ayuno.
 *
 * Es una funcion pura: el mismo plan + config + fecha siempre da la misma agenda.
 * Eso permite calcularla en el cliente para mostrarla y en el servidor para
 * programar las notificaciones, sin que se desincronicen.
 */
export function buildDaySchedule(
  plan: NutritionPlan,
  config: UserConfig,
  date: Date,
): ScheduledEvent[] {
  const events: ScheduledEvent[] = [];
  const weekday = date.getDay() as Weekday;
  const slots = resolveSlots(plan, config, date);
  const dayIndex = dayIndexOf(date);

  const fasting = config.fasting?.enabled ? config.fasting : undefined;
  const windowStart = fasting ? parseTime(fasting.eatingWindowStart) : 0;
  const windowMinutes = fasting ? Math.round(fasting.eatingWindowHours * 60) : 1440;

  // Se proyecta lo que se va comiendo para que cada sugerencia tenga en cuenta
  // lo que ya aportaron las comidas anteriores del dia.
  const projected: Array<{ option: MealOption; minutes: number }> = [];

  for (const { slot, minutes, prepLeadMinutes } of slots) {
    const libre = isFreeMeal(config, weekday, slot.id);
    const balance = computeDailyBalance(plan, projected.map((p) => p.option));
    const suggestions = libre ? [] : suggestOptions(plan, config, slot.id, {
      dayIndex,
      remaining: remainingPortions(balance),
      avoidIds: projected.map((p) => p.option.id),
      remainingProtein: balance.protein?.remaining,
    });

    const time = formatTime(minutes);
    const cierre = (windowStart + windowMinutes) % 1440;
    const dentro = fasting
      ? isWithinWindow(minutes, windowStart, windowMinutes) || minutes === cierre
      : true;

    const avisos: string[] = [];
    if (fasting && !dentro) {
      avisos.push(
        `${slot.name} (${time}) cae fuera de la ventana de alimentación ` +
          `(${fasting.eatingWindowStart}-${formatTime(cierre)}).`,
      );
    } else if (fasting && !slot.isSnack) {
      // Empezar a comer justo antes del cierre significa terminar afuera.
      const margen = minutesUntil(minutes, cierre);
      if (margen < DURACION_COMIDA_MINUTOS) {
        avisos.push(
          `${slot.name} arranca a las ${time} y la ventana cierra a las ${formatTime(cierre)}: ` +
            `vas a terminar de comer fuera de la ventana. ` +
            `Adelantá la comida o corré el inicio de la ventana.`,
        );
      }
    }
    const warnings = avisos.length > 0 ? avisos : undefined;

    if (prepLeadMinutes > 0 && suggestions.length > 0) {
      const primary = suggestions[0]!;
      const checklist = checklistFor(primary);
      events.push({
        kind: 'prep-check',
        time: formatTime(Math.max(0, minutes - prepLeadMinutes)),
        minutes: Math.max(0, minutes - prepLeadMinutes),
        title: `${slot.name} en ${humanizeMinutes(prepLeadMinutes)}`,
        body:
          checklist.length > 0
            ? `Para "${primary.name}" necesitas: ${checklist.map(formatIngredient).join(', ')}.`
            : `Preparate para "${primary.name}".`,
        slotId: slot.id,
        suggestions,
        checklist,
        warnings,
      });
    }

    events.push({
      kind: 'meal',
      time,
      minutes,
      title: `${slot.name} - ${time}`,
      body: libre
        ? 'Comida del 20%: libre. Controlá igual las porciones.'
        : mealBody(plan, slot, suggestions),
      slotId: slot.id,
      suggestions,
      warnings,
      ...(libre ? { freeMeal: true } : {}),
    });

    if (suggestions.length > 0) projected.push({ option: suggestions[0]!, minutes });
  }

  if (fasting) {
    const closeMinutes = (windowStart + windowMinutes) % 1440;
    events.push({
      kind: 'fast-end',
      time: formatTime(windowStart),
      minutes: windowStart,
      title: 'Se abre la ventana de alimentacion',
      body: `Ayuno completo. Podes comer hasta las ${formatTime(closeMinutes)}.`,
    });

    const warn = fasting.closingWarningMinutes ?? 0;
    if (warn > 0) {
      const warnAt = ((closeMinutes - warn) % 1440 + 1440) % 1440;
      events.push({
        kind: 'fast-closing',
        time: formatTime(warnAt),
        minutes: warnAt,
        title: `La ventana cierra en ${humanizeMinutes(warn)}`,
        // Solo cuenta lo que se habria comido antes del aviso.
        body: pendingBody(plan, projected.filter((p) => p.minutes <= warnAt).map((p) => p.option)),
      });
    }

    events.push({
      kind: 'fast-start',
      time: formatTime(closeMinutes),
      minutes: closeMinutes,
      title: 'Empieza el ayuno',
      body: `Proxima comida a partir de las ${formatTime(windowStart)}. ${humanizeMinutes(1440 - windowMinutes)} de ayuno.`,
    });
  }

  return events.sort((a, b) => a.minutes - b.minutes || kindRank(a.kind) - kindRank(b.kind));
}

function mealBody(plan: NutritionPlan, slot: MealSlot, suggestions: MealOption[]): string {
  const plate = plateFor(plan, slot);
  const lines: string[] = [];
  const formula = describeFormula(plan, slot);
  if (formula) lines.push(`Armá: ${formula}`);
  else if (plate) lines.push(`Plato: ${describePlate(plate, plan.foodGroups)}`);
  if (suggestions.length > 0) {
    lines.push(`Opciones: ${suggestions.map((s) => s.name).join(' / ')}`);
  } else {
    lines.push('Sin opciones cargadas para este momento.');
  }
  return lines.join('. ');
}

/** "1 opción de Hidratos + 1 porción de Proteínas + 1/3 del plato de Vegetales" */
export function describeFormula(plan: NutritionPlan, slot: MealSlot): string | undefined {
  if (!slot.formula || slot.formula.length === 0) return undefined;
  const names = new Map(plan.foodGroups.map((g) => [g.id, g.name]));
  return slot.formula
    .map((c) => {
      const grupo = (names.get(c.groupId) ?? c.groupId).toLowerCase();
      // "1 fruta" ya nombra al grupo; "1 fruta de frutas" sobra.
      return c.cantidad.toLowerCase().includes(grupo.replace(/s$/, ''))
        ? c.cantidad
        : `${c.cantidad} de ${grupo}`;
    })
    .join(' + ');
}

function pendingBody(plan: NutritionPlan, projected: MealOption[]): string {
  const balance = computeDailyBalance(plan, projected);
  const pending = balance.advice.filter((a) => a.startsWith('Faltan'));
  return pending.length > 0 ? pending.join('. ') + '.' : 'Estas al dia con las porciones.';
}

const KIND_ORDER: Record<string, number> = {
  'fast-end': 0,
  'prep-check': 1,
  meal: 2,
  'fast-closing': 3,
  'fast-start': 4,
};

function kindRank(kind: string): number {
  return KIND_ORDER[kind] ?? 9;
}

/** Los eventos que todavia no ocurrieron, para el "que sigue" de la pantalla principal. */
export function upcomingEvents(events: ScheduledEvent[], nowMinutes: number): ScheduledEvent[] {
  return events.filter((e) => e.minutes >= nowMinutes);
}

export { sumPortions };
