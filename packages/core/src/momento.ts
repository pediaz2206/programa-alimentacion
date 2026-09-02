import { minutesUntil } from './time.ts';
import type { MinuteOfDay, ScheduledEvent } from './types.ts';

/**
 * Cuanto tiempo despues de la hora de una comida se sigue considerando que
 * "es ahora". Nadie come exactamente a la hora que dice la agenda.
 */
const VENTANA_COMIDA_MINUTOS = 90;

export type TipoMomento =
  /** Toca comer y todavia no se registro. Es la unica que pide una accion. */
  | 'comer-ahora'
  /**
   * Se esta DENTRO de la ventana de preparacion: el aviso de ingredientes ya
   * paso y la comida todavia no. Que falten cuatro horas para ese aviso no es
   * "preparar", es simplemente lo que viene.
   */
  | 'preparar'
  /** Lo proximo de la agenda, sin urgencia. */
  | 'proximo'
  /** No queda nada por hacer hoy. */
  | 'fin-del-dia';

export interface Momento {
  tipo: TipoMomento;
  evento?: ScheduledEvent;
  /** Minutos hasta el evento. Negativo si ya paso. */
  faltan?: number;
}

/**
 * Que mostrar arriba de todo.
 *
 * La app se abre en rafagas cortas y en momentos concretos: antes de cocinar,
 * a la hora de comer, despues de comer. La pantalla principal tiene que
 * contestar "que hago ahora" sin scrollear, y para eso hay que elegir UNA cosa
 * entre las nueve que pasan en el dia.
 *
 * El orden de prioridad es el del apuro: una comida sin registrar que ya
 * empezo gana sobre cualquier cosa futura.
 */
export function estadoActual(
  eventos: ScheduledEvent[],
  ahora: MinuteOfDay,
  slotsRegistrados: string[] = [],
): Momento {
  const registrados = new Set(slotsRegistrados);

  const comidaEnCurso = eventos.find(
    (e) =>
      e.kind === 'meal' &&
      e.slotId != null &&
      !registrados.has(e.slotId) &&
      e.minutes <= ahora &&
      ahora - e.minutes <= VENTANA_COMIDA_MINUTOS,
  );
  if (comidaEnCurso) {
    return { tipo: 'comer-ahora', evento: comidaEnCurso, faltan: comidaEnCurso.minutes - ahora };
  }

  // Entre el aviso de ingredientes y la comida, lo util es la lista de
  // ingredientes, no el siguiente evento de la agenda.
  const enPreparacion = eventos.find((e) => {
    if (e.kind !== 'prep-check' || e.slotId == null || e.minutes > ahora) return false;
    const comida = eventos.find((c) => c.kind === 'meal' && c.slotId === e.slotId);
    return comida != null && comida.minutes > ahora;
  });
  if (enPreparacion) {
    const comida = eventos.find((c) => c.kind === 'meal' && c.slotId === enPreparacion.slotId);
    return { tipo: 'preparar', evento: enPreparacion, faltan: (comida?.minutes ?? ahora) - ahora };
  }

  const siguiente = eventos.find((e) => e.minutes > ahora);
  if (!siguiente) return { tipo: 'fin-del-dia' };

  return { tipo: 'proximo', evento: siguiente, faltan: minutesUntil(ahora, siguiente.minutes) };
}

/** Las comidas del dia que todavia no se registraron. */
export function comidasPendientes(
  eventos: ScheduledEvent[],
  slotsRegistrados: string[],
): ScheduledEvent[] {
  const registrados = new Set(slotsRegistrados);
  return eventos.filter((e) => e.kind === 'meal' && e.slotId != null && !registrados.has(e.slotId));
}
