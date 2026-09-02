import { minutesUntil } from './time.ts';
import type { MinuteOfDay, ScheduledEvent } from './types.ts';

/**
 * Que eventos vencieron en la ventana (desde, hasta].
 *
 * El cron corre cada pocos minutos y pregunta "que paso desde la ultima
 * corrida". La ventana es semiabierta al inicio para no reenviar el evento que
 * ya se mando en la corrida anterior, y soporta cruzar la medianoche.
 */
export function eventsDue(
  events: ScheduledEvent[],
  desde: MinuteOfDay,
  hasta: MinuteOfDay,
): ScheduledEvent[] {
  const largo = minutesUntil(desde, hasta);
  if (largo === 0) return [];
  return events.filter((e) => {
    const offset = minutesUntil(desde, e.minutes);
    return offset > 0 && offset <= largo;
  });
}

export interface Notificacion {
  titulo: string;
  cuerpo: string;
  /** Reemplaza una notificacion previa del mismo momento en vez de apilarla. */
  tag: string;
  url: string;
}

/**
 * El texto que llega al telefono. Es lo unico que se lee la mayoria de las
 * veces, asi que lleva el contenido y no un "tenes una notificacion".
 */
export function notificacionDe(evento: ScheduledEvent): Notificacion {
  const tag = claveEvento(evento);
  const base = { tag, url: '/' };

  if (evento.kind === 'prep-check') {
    const items = (evento.checklist ?? [])
      .map((i) => (i.qty != null ? `${i.item} (${i.qty} ${i.unit ?? ''})`.replace(' )', ')') : i.item))
      .join(', ');
    return {
      ...base,
      titulo: evento.title,
      cuerpo: items ? `¿Tenés todo? ${items}` : evento.body,
    };
  }

  if (evento.kind === 'meal') {
    const opciones = (evento.suggestions ?? []).map((s) => s.name).slice(0, 3).join(' · ');
    return {
      ...base,
      titulo: evento.title,
      cuerpo: evento.freeMeal ? 'Comida del 20%: libre.' : (opciones || evento.body),
    };
  }

  return { ...base, titulo: evento.title, cuerpo: evento.body };
}

/**
 * Identificador estable de un evento dentro del dia. Es lo que impide que dos
 * corridas del cron que se solapan manden la misma notificacion dos veces.
 */
export function claveEvento(evento: ScheduledEvent): string {
  return `${evento.kind}:${evento.slotId ?? '-'}:${evento.time}`;
}
