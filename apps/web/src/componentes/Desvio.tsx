import { useState } from 'react';
import {
  detalleDe, equivalenciasDe, gruposDe, proteinaDeDesvio, resumenDeDesvio,
  type Desvio as Datos, type MealSlot, type NutritionPlan,
} from '@pa/core';
import { Plato } from './Plato.tsx';

/**
 * "Hoy comí otra cosa."
 *
 * No pregunta calorías ni pide una foto para adivinar: pregunta, en las
 * unidades del propio plan, qué lugar ocupó lo que se comió. Es lo único que
 * la nutricionista puede leer después, y lo único que la app puede calcular
 * sin inventar.
 */
export function Desvio({ plan, slot, cerrados = [], onGuardar, onCancelar }: {
  plan: NutritionPlan;
  slot: MealSlot;
  /** Grupos que las reglas del plan cerraron para esta comida. */
  cerrados?: { groupId: string; motivo: string; texto: string }[];
  onGuardar: (datos: Datos, proteina: number, resumen: string) => void;
  onCancelar: () => void;
}) {
  const grupos = gruposDe(plan, slot);
  const [elegido, setElegido] = useState<Datos>(
    Object.fromEntries(grupos.map((g) => [g, null])),
  );
  // Dos formas de contestar la misma pregunta. Los grupos son mas rapidos
  // cuando lo que comiste se parece al plan; describir el plato sirve cuando
  // no se parece en nada, que es justamente cuando este boton se toca.
  const [modo, setModo] = useState<'grupos' | 'plato'>('grupos');
  const [plato, setPlato] = useState<{
    nombre: string; porciones: Record<string, string | null>; proteina: number;
  } | null>(null);

  const nombres = new Map(plan.foodGroups.map((g) => [g.id, g.name]));
  const proteina = proteinaDeDesvio(plan, elegido);
  const resumen = resumenDeDesvio(plan, slot, elegido);
  const hayPlato = Boolean(plato && (plato.nombre.trim() || Object.keys(plato.porciones).length > 0));

  return (
    <>
      <p className="hero-detalle">
        {modo === 'grupos'
          ? 'Marcá qué lugar ocupó lo que comiste. No hace falta que sea exacto: sirve para saber cómo seguir el día.'
          : 'Escribí el plato y sus ingredientes. No hacen falta cantidades.'}
      </p>

      <div className="modos">
        <button
          className={`modo ${modo === 'grupos' ? 'elegido' : ''}`}
          onClick={() => setModo('grupos')}
        >
          Por grupos
        </button>
        <button
          className={`modo ${modo === 'plato' ? 'elegido' : ''}`}
          onClick={() => setModo('plato')}
        >
          Describir el plato
        </button>
      </div>

      {modo === 'plato' && <Plato plan={plan} onCambio={setPlato} />}

      {modo === 'grupos' && grupos.map((groupId) => {
        const opciones = equivalenciasDe(plan, groupId, slot.id);
        // Un grupo cerrado no se esconde: se registra lo que se comio, no lo
        // que se deberia haber comido. Solo se dice por que no correspondia.
        const cerrado = cerrados.find((c) => c.groupId === groupId);
        return (
          <div className="desvio-grupo" key={groupId}>
            <span className="desvio-titulo">
              <i className="punto" style={{ background: `var(--g-${groupId}, var(--tenue))` }} />
              {nombres.get(groupId) ?? groupId}
            </span>
            {cerrado && <span className="desvio-cerrado">{cerrado.motivo} {cerrado.texto}</span>}
            <div className="desvio-opciones">
              <button
                type="button"
                className={`desvio-chip ${elegido[groupId] == null ? 'elegido' : ''}`}
                onClick={() => setElegido((p) => ({ ...p, [groupId]: null }))}
              >
                No comí
              </button>
              {/*
                * Un plan puede no traer tabla de equivalencias. En ese caso la
                * pregunta se reduce a lo unico que se puede saber sin inventar:
                * si ese grupo estuvo o no. Vale mucho mas que una pantalla
                * vacia con un solo boton que dice "No comi".
                */}
              {opciones.length === 0 && (
                <button
                  type="button"
                  className={`desvio-chip ${elegido[groupId] === 'Sí' ? 'elegido' : ''}`}
                  onClick={() => setElegido((p) => ({ ...p, [groupId]: 'Sí' }))}
                >
                  Sí comí
                </button>
              )}
              {opciones.map((ex) => (
                <button
                  key={ex.label}
                  type="button"
                  className={`desvio-chip ${elegido[groupId] === ex.label ? 'elegido' : ''} ${cerrado ? 'cerrado' : ''}`}
                  onClick={() => setElegido((p) => ({ ...p, [groupId]: ex.label }))}
                  title={detalleDe(ex)}
                >
                  {ex.label}
                </button>
              ))}
            </div>
          </div>
        );
      })}

      <div className="desvio-resumen">
        <span>{modo === 'plato' ? (plato?.nombre || 'Sin describir todavía') : resumen}</span>
        {(modo === 'plato' ? plato?.proteina ?? 0 : proteina) > 0 && (
          <b className="mono">{modo === 'plato' ? plato!.proteina : proteina} g de proteína</b>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button className="boton" style={{ flex: 1 }} onClick={onCancelar}>Cancelar</button>
        <button
          className="boton boton-lleno"
          style={{ flex: 2 }}
          disabled={modo === 'plato' && !hayPlato}
          onClick={() => modo === 'plato'
            ? onGuardar(plato!.porciones, plato!.proteina, textoDelPlato(plato!))
            : onGuardar(elegido, proteina, resumen)}
        >
          Registrar
        </button>
      </div>
    </>
  );
}

/**
 * Como queda el plato en el historial que lee la nutricionista.
 *
 * El nombre primero, porque es lo que ella reconoce de un vistazo, y los
 * ingredientes entre parentesis para que pueda ver de que estaba hecho sin
 * tener que preguntar.
 */
function textoDelPlato(plato: { nombre: string; porciones: Record<string, string | null> }): string {
  const partes = Object.values(plato.porciones).filter((v): v is string => Boolean(v));
  const nombre = plato.nombre.trim();
  if (nombre && partes.length > 0) return `${nombre} (${partes.join(', ')})`;
  return nombre || partes.join(', ');
}
