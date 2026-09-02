import { useEffect, useMemo, useState } from 'react';
import {
  formatCantidad, planificarCompras, porGrupo,
  type NutritionPlan, type UserConfig,
} from '@pa/core';
import { Encabezado } from '../componentes/Encabezado.tsx';
import { Seccion } from '../componentes/Seccion.tsx';
import { fechaISO } from '../lib/registro.ts';

const CLAVE = 'en-punto:compras:v1';
const OPCIONES_DIAS = [3, 7];

/**
 * La lista de compras de los proximos dias.
 *
 * Es el unico momento en que la app se abre lejos de una comida, y por eso es
 * la que le da una razon para existir el domingo a la mañana.
 */
export function Compras({ plan, config }: { plan: NutritionPlan; config: UserConfig }) {
  const [dias, setDias] = useState(7);
  const [tildados, setTildados] = useState<Set<string>>(new Set());

  const desde = new Date();
  const desdeISO = fechaISO(desde);
  const compras = useMemo(
    () => planificarCompras(plan, config, desde, dias),
    [plan, config, desdeISO, dias],
  );
  const grupos = useMemo(() => porGrupo(plan, compras.items), [plan, compras.items]);

  // Lo tildado se guarda contra el rango: si cambia la semana o los dias, la
  // lista es otra y arrastrar las tildes de la anterior seria mentir.
  useEffect(() => {
    try {
      const crudo = localStorage.getItem(CLAVE);
      if (!crudo) return setTildados(new Set());
      const guardado = JSON.parse(crudo) as { desde: string; dias: number; items: string[] };
      setTildados(guardado.desde === desdeISO && guardado.dias === dias
        ? new Set(guardado.items)
        : new Set());
    } catch {
      setTildados(new Set());
    }
  }, [desdeISO, dias]);

  function alternar(item: string) {
    setTildados((previo) => {
      const nuevo = new Set(previo);
      if (nuevo.has(item)) nuevo.delete(item); else nuevo.add(item);
      try {
        localStorage.setItem(CLAVE, JSON.stringify({ desde: desdeISO, dias, items: [...nuevo] }));
      } catch { /* modo privado: se pierde la tilde, no la lista */ }
      return nuevo;
    });
  }

  const faltan = compras.items.length - tildados.size;

  return (
    <>
      <Encabezado
        eyebrow="Para los próximos días"
        titulo="Compras"
        extra={
          <span className="chip chip-verde">
            {faltan === 0 ? 'Todo listo' : `Faltan ${faltan}`}
          </span>
        }
      />

      <div className="segmentado" role="group" aria-label="Cuántos días">
        {OPCIONES_DIAS.map((n) => (
          <button
            key={n}
            type="button"
            aria-pressed={dias === n}
            onClick={() => setDias(n)}
          >
            {n} días
          </button>
        ))}
      </div>

      <p className="nota">
        {compras.comidas.length} comidas planificadas
        {compras.libres > 0 && ` · ${compras.libres} del 20% quedan afuera`}.
        Se arma con la primera opción sugerida de cada comida.
      </p>

      {compras.items.length === 0 ? (
        <section className="tarjeta">
          <p className="vacio">No hay nada que comprar para estos días.</p>
        </section>
      ) : (
        grupos.map((g) => (
          <section className="tarjeta" key={g.groupId}>
            <div className="con-avatar" style={{ gap: 8 }}>
              <i className="punto" style={{ background: `var(--g-${g.groupId}, var(--tenue))` }} />
              <h3 className="encabezado-seccion" style={{ margin: 0 }}>{g.nombre}</h3>
            </div>
            <ul className="lista">
              {g.items.map((item) => {
                const listo = tildados.has(item.item);
                return (
                  <li key={item.item}>
                    <button
                      type="button"
                      className="item"
                      aria-pressed={listo}
                      onClick={() => alternar(item.item)}
                    >
                      <span className="caja">
                        <svg viewBox="0 0 12 12" aria-hidden="true">
                          <path d="M2 6.2l2.6 2.6L10 3.4" fill="none" stroke="var(--papel)"
                                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </span>
                      <span className="nombre">{item.item}</span>
                      <span className="cant mono">
                        {item.mixedUnits ? 'varias medidas' : formatCantidad(item.qty, item.unit)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}

      <Seccion titulo="De dónde sale" resumen={`${compras.comidas.length} comidas`}>
        <p className="nota">
          Si cambiás una comida el día que la cocinás, la lista no se entera: es una
          previsión, no una obligación.
        </p>
        <ul className="eq-lista">
          {compras.comidas.map((c, n) => (
            <li key={n}>
              <span>
                <span className="mono" style={{ color: 'var(--tenue)' }}>{c.fecha.slice(5)}</span>{' '}
                {c.nombreSlot}
              </span>
              <span className="eq-cant">{c.option.name}</span>
            </li>
          ))}
        </ul>
      </Seccion>
    </>
  );
}
