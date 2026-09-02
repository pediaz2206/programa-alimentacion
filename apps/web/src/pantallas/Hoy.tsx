import { humanizeMinutes, type NutritionPlan, type ScheduledEvent, type UserConfig } from '@pa/core';
import { Dial } from '../componentes/Dial.tsx';
import { Aviso } from '../componentes/Aviso.tsx';
import { balanceDe } from '../lib/datos.ts';
import { opcionesDe, type Registro } from '../lib/registro.ts';

interface Props {
  plan: NutritionPlan;
  eventos: ScheduledEvent[];
  ahora: number;
  config: UserConfig;
  registros: Registro[];
  onIrARegistro: () => void;
}

const ETIQUETA: Record<string, string> = {
  'prep-check': 'Ingredientes',
  meal: 'Comida',
  'fast-start': 'Ayuno',
  'fast-end': 'Ventana',
  'fast-closing': 'Ventana',
};

export function Hoy({ plan, eventos, ahora, config, registros, onIrARegistro }: Props) {
  const proximo = eventos.find((e) => e.minutes > ahora);
  const balance = balanceDe(plan, opcionesDe(plan, registros));
  const hoy = new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <>
      <header>
        <div className="encabezado-seccion mono">{hoy}</div>
        <h1 className="titulo-pantalla">Hoy</h1>
      </header>

      <section className="tarjeta">
        <Dial eventos={eventos} ahora={ahora} ayuno={config.fasting} />
      </section>

      {proximo ? (
        <section className="tarjeta destacada">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
            <div>
              <span className="chip chip-verde">{ETIQUETA[proximo.kind] ?? 'Lo que sigue'}</span>
              <h2 style={{ fontSize: 19, fontWeight: 600, marginTop: 8 }}>{proximo.title}</h2>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="mono" style={{ fontSize: 14, color: 'var(--tenue)' }}>{proximo.time}</div>
              <div style={{ fontSize: 12.5, color: 'var(--verde)', fontWeight: 600 }}>
                en {humanizeMinutes(proximo.minutes - ahora)}
              </div>
            </div>
          </div>
          <p className="nota">{proximo.body}</p>
          {proximo.checklist && proximo.checklist.length > 0 && (
            <ul className="lista">
              {proximo.checklist.map((i, n) => (
                <li key={n} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13.5, padding: '4px 0' }}>
                  <span>{i.item}</span>
                  <span className="cant mono">{i.qty != null ? `${i.qty} ${i.unit ?? ''}`.trim() : ''}</span>
                </li>
              ))}
            </ul>
          )}
          {proximo.warnings?.map((w, n) => <Aviso key={n} texto={w} />)}
        </section>
      ) : (
        <section className="tarjeta">
          <p className="vacio">El día terminó. Mañana la ventana abre a las {config.fasting?.eatingWindowStart ?? '—'}.</p>
        </section>
      )}

      {balance.protein && (
        <section className="tarjeta">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
            <h3 className="encabezado-seccion" style={{ margin: 0 }}>Proteína del día</h3>
            <span className="mono" style={{ fontSize: 13, color: 'var(--tenue)' }}>
              {Math.round(balance.protein.consumed)} / {balance.protein.target} g
            </span>
          </div>
          <div className="barra-progreso">
            <i style={{
              width: `${Math.min(100, (balance.protein.consumed / balance.protein.target) * 100)}%`,
              background: 'var(--g-proteinas)',
            }} />
          </div>
          <button className="boton boton-ancho" onClick={onIrARegistro}>
            {registros.length === 0 ? 'Registrar lo que comiste' : 'Ver el registro'}
          </button>
        </section>
      )}

      <section>
        <h3 className="encabezado-seccion" style={{ marginBottom: 10 }}>La línea del día</h3>
        <div className="riel">
          {eventos.map((e, n) => {
            const clases = ['fila'];
            if (e.minutes <= ahora) clases.push('pasado');
            if (e === proximo) clases.push('actual');
            if (e.kind.startsWith('fast')) clases.push('ayuno');
            if (e.freeMeal) clases.push('libre');
            return (
              <div className={clases.join(' ')} key={n}>
                <div className="hora mono">{e.time}</div>
                <div className="eje"><span className="marca" /></div>
                <div className="cuerpo">
                  <div className="que">
                    {e.title}
                    {e.freeMeal && <span className="sello">20%</span>}
                  </div>
                  {e.kind === 'meal' && e.suggestions && e.suggestions.length > 0 ? (
                    <div className="opciones">
                      {e.suggestions.map((o) => <span className="opcion" key={o.id}>{o.name}</span>)}
                    </div>
                  ) : (
                    <div className="detalle">{e.body}</div>
                  )}
                  {e.warnings?.map((w, i) => <div style={{ marginTop: 7 }} key={i}><Aviso texto={w} /></div>)}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}
