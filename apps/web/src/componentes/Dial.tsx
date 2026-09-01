import { formatTime, humanizeMinutes, parseTime, type FastingConfig, type ScheduledEvent } from '@pa/core';

/**
 * A catorce horas de distancia, el minuto exacto no le importa a nadie y
 * "14 h 14 min" no entra en el centro del anillo. Cerca del momento si importa.
 */
function cuentaCorta(minutos: number): string {
  return minutos >= 120 ? `${Math.floor(minutos / 60)} h` : humanizeMinutes(minutos);
}

const CX = 125, CY = 125, R = 97;

function punto(minuto: number, radio: number): [number, number] {
  const a = (minuto / 1440) * Math.PI * 2 - Math.PI / 2;
  return [CX + Math.cos(a) * radio, CY + Math.sin(a) * radio];
}

function arco(desde: number, hasta: number, radio: number): string {
  const [x1, y1] = punto(desde, radio);
  const [x2, y2] = punto(hasta, radio);
  const largo = ((hasta - desde + 1440) % 1440) > 720 ? 1 : 0;
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${radio} ${radio} 0 ${largo} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}

interface Props {
  eventos: ScheduledEvent[];
  ahora: number;
  ayuno?: FastingConfig | undefined;
}

/**
 * Reloj de 24 h: la ventana de alimentacion es un arco y las comidas son marcas
 * en su hora real. Es la forma natural de leer "cuanto me queda de ventana",
 * que en una lista se pierde.
 */
export function Dial({ eventos, ahora, ayuno }: Props) {
  const activo = ayuno?.enabled ?? false;
  const inicio = activo ? parseTime(ayuno!.eatingWindowStart) : 0;
  const duracion = activo ? Math.round(ayuno!.eatingWindowHours * 60) : 1440;
  const cierre = (inicio + duracion) % 1440;
  const faltaCierre = ((cierre - ahora) % 1440 + 1440) % 1440;
  const dentro = activo ? ((ahora - inicio) % 1440 + 1440) % 1440 < duracion : true;

  const comidas = eventos.filter((e) => e.kind === 'meal');
  const [nx, ny] = punto(ahora, R - 22);
  const [mx, my] = punto(ahora, R + 11);

  return (
    <div className="dial-envoltura">
      <svg viewBox="0 0 250 250" role="img" aria-label="Reloj de 24 horas con la ventana de alimentación y las comidas del día">
        <circle cx={CX} cy={CY} r={R} fill="none" stroke="var(--linea)" strokeWidth="13" strokeLinecap="round" />
        {activo && (
          <path d={arco(inicio, cierre, R)} fill="none" stroke="var(--indigo)" strokeWidth="13" strokeLinecap="round" opacity=".9" />
        )}
        {[0, 3, 6, 9, 12, 15, 18, 21].map((h) => {
          const [ax, ay] = punto(h * 60, R - 13);
          const [bx, by] = punto(h * 60, R - 18);
          const [tx, ty] = punto(h * 60, R - 27);
          return (
            <g key={h}>
              <line x1={ax} y1={ay} x2={bx} y2={by} stroke="var(--linea)" strokeWidth="1.5" />
              <text x={tx} y={ty + 3.5} textAnchor="middle" fontSize="9.5" fontFamily="IBM Plex Mono, monospace" fill="var(--tenue)">
                {String(h).padStart(2, '0')}
              </text>
            </g>
          );
        })}
        {comidas.map((e) => {
          const [x, y] = punto(e.minutes, R);
          const pasado = e.minutes <= ahora;
          const color = e.freeMeal ? 'var(--ambar)' : 'var(--verde)';
          return (
            <g key={`${e.slotId}-${e.minutes}`}>
              <circle cx={x} cy={y} r="6.5" fill="var(--superficie)" stroke={color} strokeWidth="2.5" opacity={pasado ? 1 : 0.55} />
              {pasado && <circle cx={x} cy={y} r="2.8" fill={color} />}
            </g>
          );
        })}
        <line x1={nx} y1={ny} x2={mx} y2={my} stroke="var(--tinta)" strokeWidth="2" strokeLinecap="round" />
        <circle cx={mx} cy={my} r="3.5" fill="var(--tinta)" />
      </svg>
      <div className="dial-centro">
        {activo ? (
          <>
            <div className="etiqueta">{dentro ? 'Cierra en' : 'Abre en'}</div>
            <div className="grande mono">
              {cuentaCorta(dentro ? faltaCierre : ((inicio - ahora) % 1440 + 1440) % 1440)}
            </div>
            <div className="chico">
              {dentro
                ? `${formatTime(cierre)} · ayuno de ${24 - ayuno!.eatingWindowHours} h`
                : `Podés comer desde las ${formatTime(inicio)}`}
            </div>
          </>
        ) : (
          <>
            <div className="etiqueta">Ahora</div>
            <div className="grande mono">{formatTime(ahora)}</div>
          </>
        )}
      </div>
    </div>
  );
}
