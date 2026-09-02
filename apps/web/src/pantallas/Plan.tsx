import { describeFormula, type NutritionPlan, type UserConfig } from '@pa/core';
import { comidasLibres, nombresSlot } from '../lib/datos.ts';
import { Aviso } from '../componentes/Aviso.tsx';
import { Seccion } from '../componentes/Seccion.tsx';
import { Encabezado } from '../componentes/Encabezado.tsx';
import { esPlanDeEjemplo } from '../lib/semilla.ts';

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

/**
 * La referencia del plan. Se consulta puntualmente —"¿cuánto arroz va?"— y no
 * se lee de corrido, así que todo está plegado y cada sección muestra un
 * resumen que responde la pregunta frecuente sin abrirla.
 */
export function Plan({ plan, config }: { plan: NutritionPlan; config: UserConfig }) {
  const libres = comidasLibres(plan, config);
  const NOMBRE_SLOT = nombresSlot(plan);
  const activos = new Set(config.slots.filter((s) => s.enabled !== false).map((s) => s.slotId));
  const slots = plan.slots.filter((s) => activos.size === 0 || activos.has(s.id));
  const conFormula = slots.filter((s) => describeFormula(plan, s));
  const grupos = plan.foodGroups.filter((g) => g.exchanges?.length);

  return (
    <>
      <Encabezado eyebrow={plan.name} titulo="Tu plan" />

      {esPlanDeEjemplo(plan) && (
        <div className="arreglo">
          <p>
            Este es un <b>plan de ejemplo</b> para conocer la app. Cuando tu nutricionista
            publique el tuyo, aparece acá solo.
          </p>
        </div>
      )}

      <Seccion
        titulo="Cómo se arma cada comida"
        resumen={`${conFormula.length} momentos del día`}
      >
        {conFormula.map((slot) => (
          <div key={slot.id} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span className="encabezado-seccion" style={{ fontSize: 11 }}>{slot.name}</span>
            <span style={{ fontSize: 14, lineHeight: 1.45 }}>{describeFormula(plan, slot)}</span>
          </div>
        ))}
      </Seccion>

      {plan.proteinTargetGrams != null && (
        <Seccion
          titulo="Objetivo proteico"
          resumen={`${plan.proteinTargetGrams} g por día`}
        >
          <p className="nota">
            Las equivalencias de proteínas indican cuántos gramos aporta cada opción.
            Si un día queda un poco por debajo no pasa nada: el resto de los alimentos
            también aporta.
          </p>
        </Seccion>
      )}

      <Seccion
        titulo="Comidas del 20%"
        resumen={`${libres.planned.length} de ${libres.perWeek} usadas esta semana`}
        chip={libres.warnings.length > 0 ? <span className="chip chip-ambar">Revisar</span> : undefined}
      >
        <p className="nota">
          {libres.perWeek} de las {libres.totalPerWeek ?? 21} comidas de la semana pueden salirse
          del plan. Moverlas es parte del plan: elegí cuándo te sirven.
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
      </Seccion>

      {/* Cada grupo se pliega por separado: nadie busca "hidratos" y "lácteos"
          al mismo tiempo, y 27 equivalencias juntas son medio metro de scroll.
          El rótulo evita que se lean como cinco secciones sueltas más. */}
      <div className="rotulo">Equivalencias por grupo</div>
      {grupos.map((g) => (
        <Seccion
          key={g.id}
          titulo={g.name}
          resumen={`${g.exchanges!.length} opciones intercambiables`}
          chip={<i className="punto" style={{ background: `var(--g-${g.id}, var(--tenue))` }} />}
        >
          {g.notes && <p className="nota">{g.notes}</p>}
          <ul className="eq-lista">
            {g.exchanges!.map((ex, n) => {
              const cant = ex.qty != null ? `${ex.qty} ${ex.unit ?? ''}`.trim() : (ex.unit ?? '');
              return (
                <li key={n}>
                  <span>
                    {ex.label}
                    {ex.proteinGrams != null && cant ? ` · ${cant}` : ''}
                    {ex.note && <span className="eq-cant"> — {ex.note}</span>}
                  </span>
                  {ex.proteinGrams != null
                    ? <span className="eq-prot mono">{ex.proteinGrams} g prot.</span>
                    : <span className="eq-cant mono">{cant}</span>}
                </li>
              );
            })}
          </ul>
        </Seccion>
      ))}

      {plan.guidelines && plan.guidelines.length > 0 && (
        <Seccion titulo="Reglas del plan" resumen={`${plan.guidelines.length} indicaciones`}>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 9 }}>
            {plan.guidelines.map((r, n) => (
              <li key={n} style={{ fontSize: 13, lineHeight: 1.45, paddingLeft: 15, position: 'relative', color: 'var(--tenue)' }}>
                <i style={{ position: 'absolute', left: 0, top: 7, width: 5, height: 5, borderRadius: '50%', background: 'var(--verde)' }} />
                {r}
              </li>
            ))}
          </ul>
        </Seccion>
      )}
    </>
  );
}
