import type { NutritionPlan, ScheduledEvent } from '@pa/core';
import { frase } from '@pa/core';

/**
 * Lo que el plan tiene para decir sobre esta comida, dado lo que ya se comio hoy.
 *
 * Dos partes, siempre en el mismo orden: que hacer ahora, y por que. El "por
 * que" es la indicacion textual de la nutricionista. La diferencia entre un
 * aviso que ayuda y uno que molesta es exactamente esa cita: no es la app la
 * que opina, es su plan el que sigue hablando cuando ella no esta.
 */
export function Reglas({ plan, evento }: { plan: NutritionPlan; evento: ScheduledEvent }) {
  const reglas = evento.reglas;
  if (!reglas) return null;

  const items = [
    ...reglas.cerrados.map((c) => ({
      clave: `c-${c.reglaId}`,
      tono: 'cierra' as const,
      dice: frase(plan, c),
      texto: c.texto,
    })),
    ...reglas.pendientes.map((p) => ({
      clave: `p-${p.reglaId}`,
      tono: 'falta' as const,
      dice: `${p.motivo} ${p.faltan === 1 ? 'Te falta una.' : `Te faltan ${p.faltan}.`}`,
      texto: p.texto,
    })),
    ...reglas.avisos.map((a) => ({
      clave: `a-${a.reglaId}`,
      tono: 'ojo' as const,
      dice: a.motivo,
      texto: a.texto,
    })),
  ];
  if (items.length === 0) return null;

  return (
    <ul className="reglas">
      {items.map((i) => (
        <li key={i.clave} className={`regla regla-${i.tono}`}>
          <span className="regla-dice">{i.dice}</span>
          <span className="regla-texto">{i.texto}</span>
        </li>
      ))}
    </ul>
  );
}
