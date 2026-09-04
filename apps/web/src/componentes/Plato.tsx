import { useState } from 'react';
import {
  porcionesDe, proteinaDe, reconocer,
  type IngredienteSuelto, type NutritionPlan,
} from '@pa/core';

/**
 * "Comi tarta de verdura."
 *
 * Nadie piensa la comida por grupos: piensa por platos. Esta pantalla acepta el
 * plato tal como se dice y hace la traduccion sola, usando como diccionario el
 * propio plan.
 *
 * No pregunta cantidades a proposito. Pedirlas convierte un registro de veinte
 * segundos en un formulario, y el dato que importa para el seguimiento es que
 * grupo se cubrio, no si fueron 180 o 200 gramos. Lo que la app no puede
 * deducir se pregunta una sola vez y con un toque.
 */
export function Plato({ plan, onCambio }: {
  plan: NutritionPlan;
  onCambio: (datos: {
    nombre: string;
    ingredientes: IngredienteSuelto[];
    porciones: Record<string, string | null>;
    proteina: number;
  }) => void;
}) {
  const [nombre, setNombre] = useState('');
  const [texto, setTexto] = useState('');
  const [ingredientes, setIngredientes] = useState<IngredienteSuelto[]>([]);

  const nombres = new Map(plan.foodGroups.map((g) => [g.id, g.name]));

  function avisar(ns: string, is: IngredienteSuelto[]) {
    onCambio({ nombre: ns, ingredientes: is, porciones: porcionesDe(is), proteina: proteinaDe(is) });
  }

  function agregar() {
    const limpio = texto.trim();
    if (!limpio) return;
    const r = reconocer(plan, limpio);
    const nuevo: IngredienteSuelto = {
      texto: limpio,
      groupId: r?.groupId ?? null,
      ...(r?.ex ? { ex: r.ex } : {}),
      ...(r ? { conocido: true } : {}),
      ...(r?.nota ? { nota: r.nota } : {}),
    };
    const siguientes = [...ingredientes, nuevo];
    setIngredientes(siguientes);
    setTexto('');
    avisar(nombre, siguientes);
  }

  function cambiarGrupo(indice: number, groupId: string | null) {
    const siguientes = ingredientes.map((i, n) => {
      if (n !== indice) return i;
      // Al corregir el grupo a mano, la equivalencia adivinada deja de valer:
      // su proteina era la del alimento que la app creyo, no la del real.
      // Al corregir a mano deja de ser una adivinanza de la app: la nota que
      // explicaba su criterio ya no viene al caso.
      const { ex: _descartada, nota: _tampoco, ...resto } = i;
      return { ...resto, groupId, conocido: true };
    });
    setIngredientes(siguientes);
    avisar(nombre, siguientes);
  }

  function quitar(indice: number) {
    const siguientes = ingredientes.filter((_, n) => n !== indice);
    setIngredientes(siguientes);
    avisar(nombre, siguientes);
  }

  const sinGrupo = ingredientes.filter((i) => i.groupId == null && !i.conocido).length;

  return (
    <div className="plato">
      <label className="plato-campo">
        <span>¿Qué comiste?</span>
        <input
          type="text" placeholder="Tarta de verdura"
          value={nombre}
          onChange={(e) => { setNombre(e.target.value); avisar(e.target.value, ingredientes); }}
        />
      </label>

      <label className="plato-campo">
        <span>Ingredientes</span>
        <div className="plato-agregar">
          <input
            type="text" placeholder="espinaca"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); agregar(); } }}
          />
          <button className="boton" onClick={agregar} disabled={!texto.trim()}>Agregar</button>
        </div>
      </label>

      {ingredientes.length > 0 && (
        <ul className="plato-lista">
          {ingredientes.map((i, n) => (
            <li key={n} className={i.groupId || i.conocido ? '' : 'sin-grupo'}>
              <div className="plato-fila">
                <i className="punto" style={{ background: `var(--g-${i.groupId}, var(--linea))` }} />
                <span className="plato-nombre">{i.texto}</span>
                <button className="item-accion" onClick={() => quitar(n)} aria-label={`Quitar ${i.texto}`}>
                  quitar
                </button>
              </div>
              {i.groupId == null && i.conocido && (
                <span className="plato-nocuenta">
                  No ocupa lugar en el plan.{i.nota ? ` ${i.nota}` : ''}
                </span>
              )}
              {i.groupId && i.nota && <span className="plato-nocuenta">{i.nota}</span>}
              {/*
                * Los grupos siempre visibles, no escondidos detras de un menu:
                * asi corregir una adivinanza cuesta un toque, y ver que la app
                * entendio bien no cuesta ninguno.
                */}
              <div className="plato-grupos">
                {plan.foodGroups.map((g) => (
                  <button
                    key={g.id}
                    className={`plato-grupo ${i.groupId === g.id ? 'elegido' : ''}`}
                    onClick={() => cambiarGrupo(n, i.groupId === g.id ? null : g.id)}
                  >
                    {g.name}
                  </button>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}

      {sinGrupo > 0 && (
        <p className="nota">
          {sinGrupo === 1
            ? 'Marcá de qué grupo es el ingrediente sin marcar.'
            : `Marcá de qué grupo son los ${sinGrupo} ingredientes sin marcar.`}
          {' '}Si no cuenta para el plan (sal, especias), dejalo así.
        </p>
      )}

      {ingredientes.some((i) => i.groupId) && (
        <p className="plato-resumen">
          Cuenta como{' '}
          {[...new Set(ingredientes.filter((i) => i.groupId).map((i) => i.groupId!))]
            .map((g) => (nombres.get(g) ?? g).toLowerCase())
            .join(' + ')}
          .
        </p>
      )}
    </div>
  );
}
