import {
  formatTime, humanizeMinutes, parseTime,
  type FastingConfig, type ScheduledEvent,
} from '@pa/core';

/**
 * El dia en una franja horizontal.
 *
 * Es lo que mostraba el dial de 24 h, girado: la ventana de alimentacion como
 * un tramo lleno, las comidas como marcas en su hora, y donde estas parado. En
 * horizontal no hay que decodificar angulos, y entra en un sexto del alto.
 *
 * No dibuja el dia entero sino el tramo que importa —desde un poco antes de la
 * primera cosa hasta un poco despues de la ultima—, porque las nueve horas que
 * dormis no aportan nada y comprimen todo lo demas.
 */
export function Franja({ eventos, ahora, ayuno, registrados = [] }: {
  eventos: ScheduledEvent[];
  ahora: number;
  ayuno: FastingConfig | undefined;
  registrados?: string[];
}) {
  const comidas = eventos.filter((e) => e.kind === 'meal');
  if (comidas.length === 0) return null;

  const ventana = ayuno?.enabled
    ? { inicio: parseTime(ayuno.eatingWindowStart), fin: parseTime(ayuno.eatingWindowStart) + Math.round(ayuno.eatingWindowHours * 60) }
    : null;

  const marcas = [...comidas.map((c) => c.minutes), ...(ventana ? [ventana.inicio, ventana.fin] : []), ahora];
  const desde = Math.max(0, Math.min(...marcas) - 45);
  const hasta = Math.min(1440, Math.max(...marcas) + 45);
  const largo = Math.max(1, hasta - desde);
  const pos = (minuto: number) => ((minuto - desde) / largo) * 100;

  const hechos = new Set(registrados);
  const dentro = ventana ? ahora >= ventana.inicio && ahora <= ventana.fin : true;

  return (
    <div className="franja-dia">
      <div className="franja-tope">
        <span className={`franja-estado ${dentro ? 'abierta' : ''}`}>
          {ventana ? (dentro ? 'Podés comer' : 'En ayuno') : 'Tu día'}
        </span>
        {ventana && (
          <span className="franja-cuenta mono">
            {dentro
              ? `${humanizeMinutes(ventana.fin - ahora)} · cierra ${formatTime(ventana.fin)}`
              : `abre ${formatTime(ventana.inicio)}`}
          </span>
        )}
      </div>

      <div className="franja-pista">
        {ventana && (
          <div
            className="franja-ventana"
            style={{ left: `${pos(ventana.inicio)}%`, width: `${pos(ventana.fin) - pos(ventana.inicio)}%` }}
          />
        )}

        {comidas.map((c) => {
          const hecho = c.slotId != null && hechos.has(c.slotId);
          return (
            <span
              key={c.slotId ?? c.time}
              className={[
                'franja-comida',
                hecho ? 'hecho' : '',
                c.freeMeal ? 'libre' : '',
                c.minutes <= ahora ? 'pasado' : '',
              ].join(' ')}
              style={{ left: `${pos(c.minutes)}%` }}
              title={`${c.title}${hecho ? ' · registrada' : ''}`}
            />
          );
        })}

        <span className="franja-ahora" style={{ left: `${pos(ahora)}%` }} aria-hidden="true" />
      </div>

      <div className="franja-pie mono">
        <span>{formatTime(desde)}</span>
        {ventana && <span className="franja-medio">{formatTime(ventana.inicio)}–{formatTime(ventana.fin)}</span>}
        <span>{formatTime(hasta)}</span>
      </div>
    </div>
  );
}
