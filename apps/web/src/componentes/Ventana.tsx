import { formatTime, humanizeMinutes, parseTime, type FastingConfig } from '@pa/core';

/**
 * El estado del ayuno, en una línea.
 *
 * Solo hay dos preguntas: ¿puedo comer ahora? y ¿cuánto me queda? Todo lo
 * demás —qué hora abre, cuántas horas dura, dónde caen las comidas— ya está
 * en la línea del día y en Ajustes, dicho en castellano.
 *
 * La barra es horizontal y no un aro: el tiempo se lee de izquierda a derecha.
 * Un círculo obliga a decodificar ángulos para saber lo mismo.
 */
export function Ventana({ ayuno, ahora, onTocar }: {
  ayuno: FastingConfig | undefined; ahora: number; onTocar?: () => void;
}) {
  if (!ayuno?.enabled) return null;

  const inicio = parseTime(ayuno.eatingWindowStart);
  const duracion = Math.round(ayuno.eatingWindowHours * 60);
  const cierre = (inicio + duracion) % 1440;
  const transcurrido = ((ahora - inicio) % 1440 + 1440) % 1440;
  const abierta = transcurrido < duracion;

  const restante = abierta ? duracion - transcurrido : ((inicio - ahora) % 1440 + 1440) % 1440;
  const total = abierta ? duracion : 1440 - duracion;
  const avance = Math.min(100, Math.max(0, ((total - restante) / total) * 100));

  const Elemento = onTocar ? 'button' : 'div';

  return (
    <Elemento
      className="ventana"
      {...(onTocar ? { onClick: onTocar, type: 'button' as const } : {})}
    >
      <div className="ventana-fila">
        <span className={`ventana-estado ${abierta ? 'abierta' : ''}`}>
          {abierta ? 'Podés comer' : 'En ayuno'}
        </span>
        <span className="ventana-detalle mono">
          {humanizeMinutes(restante)} · {abierta ? `cierra ${formatTime(cierre)}` : `abre ${formatTime(inicio)}`}
        </span>
      </div>
      <div className="ventana-barra">
        <i
          style={{ width: `${avance}%`, background: abierta ? 'var(--verde)' : 'var(--indigo)' }}
          aria-hidden="true"
        />
      </div>
    </Elemento>
  );
}
