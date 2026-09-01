import type { MinuteOfDay, TimeString } from './types.ts';

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function parseTime(value: TimeString): MinuteOfDay {
  const match = TIME_RE.exec(value);
  if (!match) throw new Error(`Hora invalida: "${value}" (se espera "HH:MM")`);
  return Number(match[1]) * 60 + Number(match[2]);
}

export function isValidTime(value: string): boolean {
  return TIME_RE.test(value);
}

export function formatTime(minutes: MinuteOfDay): TimeString {
  const m = ((minutes % 1440) + 1440) % 1440;
  const hh = String(Math.floor(m / 60)).padStart(2, '0');
  const mm = String(m % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

/** Suma minutos manteniendo el resultado dentro del dia (envuelve en 24h). */
export function addMinutes(time: TimeString, delta: number): TimeString {
  return formatTime(parseTime(time) + delta);
}

/**
 * Indica si `minute` cae dentro de la ventana [start, start + durationMinutes).
 * Soporta ventanas que cruzan la medianoche (ej. 20:00 -> 04:00).
 */
export function isWithinWindow(
  minute: MinuteOfDay,
  start: MinuteOfDay,
  durationMinutes: number,
): boolean {
  if (durationMinutes >= 1440) return true;
  if (durationMinutes <= 0) return false;
  const offset = ((minute - start) % 1440 + 1440) % 1440;
  return offset < durationMinutes;
}

/** Diferencia en minutos desde `from` hasta `to` avanzando en el tiempo. */
export function minutesUntil(from: MinuteOfDay, to: MinuteOfDay): number {
  return ((to - from) % 1440 + 1440) % 1440;
}

export function humanizeMinutes(total: number): string {
  const abs = Math.abs(Math.round(total));
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return h === 1 ? '1 h' : `${h} h`;
  return `${h} h ${m} min`;
}
