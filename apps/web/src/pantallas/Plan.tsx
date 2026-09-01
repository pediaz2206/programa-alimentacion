import { describeFormula, type UserConfig } from '@pa/core';
import { comidasLibres, NOMBRE_SLOT, plan } from '../lib/datos.ts';
import { Aviso } from '../componentes/Aviso.tsx';

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

export function Plan({ config }: { config: UserConfig }) {
  const libres = comidasLibres(config);
  const activos = new Set(config.slots.filter((s) => s.enabled !== false).map((s) => s.slotId));
  const slots = plan.slots.filter((s) => activos.size === 0 || activos.has(s.id));

  return (
    <>
      <header>
        <div className="encabezado-seccion">{plan.name}</div>
        <h1 className="titulo-pantalla">Tu plan</h1>
      </header>

      <section className="tarjeta">
        <h3 className="encabezado-seccion" style={{ margin: 0 }}>Cómo se arma cada comida</h3>
        {slots.map((slot) => {
          const formula = describeFormula(plan, slot);
          if (!formula) return null;
          return (
            <div key={slot.id} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span className="encabezado-seccion" style={{ fontSize: 11 }}>{slot.name}</span>
              <span style={{ fontSize: 14, lineHeight: 1.45 }}>{formula}</span>
            </div>
          );
        })}
      </section>

      <section className="tarjeta">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
          <h3 className="encabezado-seccion" style={{ margin: 0 }}>Comidas del 20%</h3>
          <span className="chip chip-ambar">{libres.planned.length} de {libres.perWeek} usadas</span>
        </div>
        <p className="nota">
          {libres.perWeek} de las {libres.totalPerWeek ?? 21} comidas de la semana pueden salirse del plan.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {libres.planned.map((f, n) => (
            <span key={n} className="chip chip-ambar" style={{ textTransform: 'none', letterSpacing: 0, fontSize: 12.5 }}>
              {DIAS[f.weekday]} · {NOMBRE_SLOT.get(f.slotId) ?? f.slotId}
            </span>
          ))}
          {Array.from({ length: libres.unassigned }).map((_, n) => (
            <span key={`v${n}`} className="chip" style={{
              border: '1px dashed var(--linea)', color: 'var(--tenue)',
              textTransform: 'none', letterSpacing: 0, fontSize: 12.5, fontWeight: 400,
            }}>Sin ubicar</span>
          ))}
        </div>
        {libres.warnings.map((w, n) => <Aviso key={n} texto={w} />)}
      </section>

      <section className="tarjeta">
        <h3 className="encabezado-seccion" style={{ margin: 0 }}>Equivalencias</h3>
        <p className="nota">Dentro de cada grupo, las opciones son intercambiables entre sí.</p>
        {plan.foodGroups.filter((g) => g.exchanges?.length).map((g) => (
          <div className="eq-grupo" key={g.id}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <i className="punto" style={{ background: `var(--g-${g.id}, var(--tenue))` }} />
              <span style={{ fontSize: 13.5, fontWeight: 600 }}>{g.name}</span>
            </div>
            {g.notes && <p className="nota">{g.notes}</p>}
            <ul className="eq-lista">
              {g.exchanges!.map((ex, n) => {
                const cant = ex.qty != null ? `${ex.qty} ${ex.unit ?? ''}`.trim() : (ex.unit ?? '');
                return (
                  <li key={n}>
                    <span>{ex.label}{ex.proteinGrams != null && cant ? ` · ${cant}` : ''}</span>
                    {ex.proteinGrams != null
                      ? <span className="eq-prot mono">{ex.proteinGrams} g prot.</span>
                      : <span className="eq-cant mono">{cant}</span>}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </section>

      {plan.guidelines && plan.guidelines.length > 0 && (
        <section className="tarjeta">
          <h3 className="encabezado-seccion" style={{ margin: 0 }}>Reglas</h3>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {plan.guidelines.map((r, n) => (
              <li key={n} style={{ fontSize: 13, lineHeight: 1.45, paddingLeft: 15, position: 'relative', color: 'var(--tenue)' }}>
                <i style={{ position: 'absolute', left: 0, top: 7, width: 5, height: 5, borderRadius: '50%', background: 'var(--verde)' }} />
                {r}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
