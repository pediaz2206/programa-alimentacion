import { formatTime, parseTime } from './time.ts';
import type { NutritionPlan, UserConfig, Weekday } from './types.ts';

/**
 * Cuando una comida queda fuera de la ventana de alimentacion, avisar no
 * alcanza: hay que ofrecer el arreglo. Un aviso sin accion es un freno.
 */

export type Ajuste =
  /** Todas las comidas entran en la ventana. */
  | { tipo: 'ok' }
  /** Alcanza con correr el inicio, manteniendo la duracion. */
  | { tipo: 'mover'; inicio: string; cierre: string; descripcion: string }
  /** Las comidas no entran en la duracion actual: hay que agrandarla. */
  | { tipo: 'ampliar'; inicio: string; cierre: string; horas: number; descripcion: string };

/** Cuanto dura una comida, para que la ultima no termine fuera de la ventana. */
const DURACION_COMIDA_MINUTOS = 30;

export function ajusteDeVentana(
  plan: NutritionPlan,
  config: UserConfig,
  weekday?: Weekday,
): Ajuste {
  const ayuno = config.fasting;
  if (!ayuno?.enabled) return { tipo: 'ok' };

  const horas = plan.slots
    .filter((slot) => {
      const cfg = config.slots.find((c) => c.slotId === slot.id);
      if (cfg?.enabled === false) return false;
      if (weekday != null && cfg?.weekdays && !cfg.weekdays.includes(weekday)) return false;
      return !slot.isSnack;
    })
    .map((slot) => {
      const cfg = config.slots.find((c) => c.slotId === slot.id);
      return parseTime(cfg?.time ?? slot.defaultTime);
    })
    .sort((a, b) => a - b);

  if (horas.length === 0) return { tipo: 'ok' };

  const primera = horas[0]!;
  const ultima = horas[horas.length - 1]!;
  const duracion = Math.round(ayuno.eatingWindowHours * 60);
  const inicioActual = parseTime(ayuno.eatingWindowStart);

  // La ultima comida tiene que terminar dentro, no solo empezar.
  const necesario = ultima - primera + DURACION_COMIDA_MINUTOS;

  const entranEnLaActual =
    primera >= inicioActual && ultima + DURACION_COMIDA_MINUTOS <= inicioActual + duracion;
  if (entranEnLaActual) return { tipo: 'ok' };

  if (necesario <= duracion) {
    const inicio = formatTime(primera);
    const cierre = formatTime(primera + duracion);
    return {
      tipo: 'mover',
      inicio,
      cierre,
      descripcion: `Mover la ventana a ${inicio}–${cierre}`,
    };
  }

  // Se redondea hacia arriba a la media hora: nadie piensa su ayuno en minutos.
  const horasNecesarias = Math.ceil((necesario / 60) * 2) / 2;
  const inicio = formatTime(primera);
  const cierre = formatTime(primera + horasNecesarias * 60);
  return {
    tipo: 'ampliar',
    inicio,
    cierre,
    horas: horasNecesarias,
    descripcion: `Ampliar la ventana a ${enHoras(horasNecesarias)} (${inicio}–${cierre}), `
      + `con ${enHoras(24 - horasNecesarias)} de ayuno`,
  };
}

/** En castellano el separador decimal es la coma, no el punto. */
function enHoras(horas: number): string {
  return `${String(horas).replace('.', ',')} h`;
}

/** Aplica el ajuste sobre la config, sin tocar nada mas. */
export function aplicarAjuste(config: UserConfig, ajuste: Ajuste): UserConfig {
  if (ajuste.tipo === 'ok' || !config.fasting) return config;
  return {
    ...config,
    fasting: {
      ...config.fasting,
      eatingWindowStart: ajuste.inicio,
      ...(ajuste.tipo === 'ampliar' ? { eatingWindowHours: ajuste.horas } : {}),
    },
  };
}
