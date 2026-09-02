import { useState } from 'react';
import {
  detalleDe, equivalenciasDe, gruposDe, proteinaDeDesvio, resumenDeDesvio,
  type Desvio as Datos, type MealSlot, type NutritionPlan,
} from '@pa/core';

/**
 * "Hoy comí otra cosa."
 *
 * No pregunta calorías ni pide una foto para adivinar: pregunta, en las
 * unidades del propio plan, qué lugar ocupó lo que se comió. Es lo único que
 * la nutricionista puede leer después, y lo único que la app puede calcular
 * sin inventar.
 */
export function Desvio({ plan, slot, onGuardar, onCancelar }: {
  plan: NutritionPlan;
  slot: MealSlot;
  onGuardar: (datos: Datos, proteina: number, resumen: string) => void;
  onCancelar: () => void;
}) {
  const grupos = gruposDe(plan, slot);
  const [elegido, setElegido] = useState<Datos>(
    Object.fromEntries(grupos.map((g) => [g, null])),
  );

  const nombres = new Map(plan.foodGroups.map((g) => [g.id, g.name]));
  const proteina = proteinaDeDesvio(plan, elegido);
  const resumen = resumenDeDesvio(plan, slot, elegido);

  return (
    <>
      <p className="hero-detalle">
        Marcá qué lugar ocupó lo que comiste. No hace falta que sea exacto: sirve
        para saber cómo seguir el día.
      </p>

      {grupos.map((groupId) => {
        const opciones = equivalenciasDe(plan, groupId, slot.id);
        return (
          <div className="desvio-grupo" key={groupId}>
            <span className="desvio-titulo">
              <i className="punto" style={{ background: `var(--g-${groupId}, var(--tenue))` }} />
              {nombres.get(groupId) ?? groupId}
            </span>
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
                  className={`desvio-chip ${elegido[groupId] === ex.label ? 'elegido' : ''}`}
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
        <span>{resumen}</span>
        {proteina > 0 && <b className="mono">{proteina} g de proteína</b>}
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button className="boton" style={{ flex: 1 }} onClick={onCancelar}>Cancelar</button>
        <button
          className="boton boton-lleno"
          style={{ flex: 2 }}
          onClick={() => onGuardar(elegido, proteina, resumen)}
        >
          Registrar
        </button>
      </div>
    </>
  );
}
