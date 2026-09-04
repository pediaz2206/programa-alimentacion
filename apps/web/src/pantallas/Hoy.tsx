import { useState } from 'react';
import {
  ajusteDeVentana, aplicarAjuste, estadoActual, humanizeMinutes,
  type Desvio as DatosDesvio, type Ingredient, type Momento,
  type NutritionPlan, type ScheduledEvent, type UserConfig,
} from '@pa/core';
import { Franja } from '../componentes/Franja.tsx';
import { Desvio } from '../componentes/Desvio.tsx';
import { Reglas } from '../componentes/Regla.tsx';
import { Reemplazos } from '../componentes/Reemplazos.tsx';
import { Aviso } from '../componentes/Aviso.tsx';
import { Encabezado } from '../componentes/Encabezado.tsx';
import { balanceDe } from '../lib/datos.ts';
import { fechaISO, opcionesDe, type Registro } from '../lib/registro.ts';

interface Props {
  plan: NutritionPlan;
  eventos: ScheduledEvent[];
  ahora: number;
  config: UserConfig;
  registros: Registro[];
  onRegistrar: (evento: ScheduledEvent) => void;
  onRegistrarDesvio: (evento: ScheduledEvent, datos: DatosDesvio, proteina: number, resumen: string) => void;
  onIrARegistro: () => void;
  onIrAAjustes: () => void;
  onConfig: (c: UserConfig) => void;
}

export function Hoy({ plan, eventos, ahora, config, registros, onRegistrar, onRegistrarDesvio, onIrARegistro, onIrAAjustes, onConfig }: Props) {
  const hoy = fechaISO();
  const deHoy = registros.filter((r) => r.fecha === hoy);
  const slotsRegistrados = deHoy.map((r) => r.slotId);
  const momento = estadoActual(eventos, ahora, slotsRegistrados);
  const balance = balanceDe(plan, opcionesDe(plan, deHoy));
  const comidas = eventos.filter((e) => e.kind === 'meal');
  const ajuste = ajusteDeVentana(plan, config);

  return (
    <>
      <Encabezado
        eyebrow={new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
        titulo="Hoy"
      />

      <button className="franja-boton" onClick={onIrAAjustes} type="button">
        <Franja
          eventos={eventos}
          ahora={ahora}
          ayuno={config.fasting}
          registrados={slotsRegistrados}
        />
      </button>

      {ajuste.tipo !== 'ok' && (
        <section className="arreglo">
          <p>
            {ajuste.tipo === 'mover'
              ? 'Alguna comida quedó fuera de tu ventana de alimentación.'
              : 'Tus comidas ya no entran en la ventana que tenías.'}
          </p>
          <button className="boton boton-lleno boton-ancho"
                  onClick={() => onConfig(aplicarAjuste(config, ajuste))}>
            {ajuste.descripcion}
          </button>
        </section>
      )}

      <Ahora
        plan={plan}
        momento={momento}
        eventos={eventos}
        ahora={ahora}
        onRegistrar={onRegistrar}
        onRegistrarDesvio={onRegistrarDesvio}
      />

      <div className="tira">
        <div className="tira-datos">
          {balance.protein && (
            <>
              <div className="tira-fila">
                <span className="tira-nombre">Proteína</span>
                <span className="tira-cifra mono">
                  {Math.round(balance.protein.consumed)} / {balance.protein.target} g
                </span>
              </div>
              <div className="barra-progreso">
                <i style={{
                  width: `${Math.min(100, (balance.protein.consumed / balance.protein.target) * 100)}%`,
                  background: 'var(--g-proteinas)',
                }} />
              </div>
            </>
          )}
          <div className="tira-fila">
            <span className="tira-cifra">
              {deHoy.length} de {comidas.length} comidas registradas
            </span>
            <button
              className="tira-cifra"
              onClick={onIrARegistro}
              style={{ background: 'none', border: 0, padding: 0, color: 'var(--verde)', fontWeight: 600, cursor: 'pointer', font: 'inherit' }}
            >
              Ver registro
            </button>
          </div>
        </div>
      </div>

      <LoQueViene eventos={eventos} ahora={ahora} momento={momento} />

    </>
  );
}

const TITULO: Record<string, string> = {
  'comer-ahora': 'Es hora de comer',
  preparar: 'Preparate',
  proximo: 'Lo que sigue',
  'fin-del-dia': 'Terminaste el día',
};

interface AhoraProps {
  plan: NutritionPlan;
  momento: Momento;
  eventos: ScheduledEvent[];
  ahora: number;
  onRegistrar: (e: ScheduledEvent) => void;
  onRegistrarDesvio: (e: ScheduledEvent, datos: DatosDesvio, proteina: number, resumen: string) => void;
}

function Ahora({ plan, momento, eventos, ahora, onRegistrar, onRegistrarDesvio }: AhoraProps) {
  const { tipo, evento, faltan } = momento;
  const [desviando, setDesviando] = useState(false);
  const [sinIngrediente, setSinIngrediente] = useState<number | null>(null);

  if (tipo === 'fin-del-dia' || !evento) {
    return (
      <section className="hero">
        <h2>Terminaste el día</h2>
        <p className="hero-detalle">Nos vemos mañana.</p>
      </section>
    );
  }

  const urgente = tipo === 'comer-ahora';
  const opciones = evento.suggestions ?? [];

  // Un aviso de ingredientes trae dos horas distintas: la del chequeo y la de
  // la comida. Mostrar las dos sin decir cuál es cuál se lee como un error.
  const comida = evento.kind === 'prep-check'
    ? eventos.find((c) => c.kind === 'meal' && c.slotId === evento.slotId)
    : undefined;
  const titulo = comida ? sinHora(comida.title) : tituloDe(evento, tipo);
  const hora = comida?.time ?? evento.time;
  const cuenta = comida && tipo === 'proximo'
    ? `chequeo en ${humanizeMinutes(evento.minutes - ahora)}`
    : faltan != null && faltan > 0
      ? `en ${humanizeMinutes(faltan)}`
      : null;

  return (
    <section className={`hero ${urgente ? 'urgente' : ''}`}>
      <div className="hero-tope">
        <div>
          <span className={`chip ${urgente ? 'chip-ambar' : 'chip-verde'}`}>{TITULO[tipo]}</span>
          <h2 style={{ marginTop: 8 }}>{titulo}</h2>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="hero-hora mono">{hora}</div>
          {cuenta && <div className="hero-cuando">{cuenta}</div>}
        </div>
      </div>

      {comida && (
        <p className="hero-detalle">
          {tipo === 'preparar'
            ? `Chequeá que tengas todo para "${opciones[0]?.name ?? 'la comida'}".`
            : `Aviso de ingredientes a las ${evento.time}.`}
        </p>
      )}

      {/*
        * Antes esto vivia solo en la rama 'meal'. Pero el aviso de ingredientes
        * es cuando se decide que cocinar: es el momento en que la regla sirve
        * mas, no menos.
        */}
      <Reglas plan={plan} evento={evento} />

      {tipo === 'preparar' && evento.checklist && evento.checklist.length > 0 && (
        <ul className="lista">
          {evento.checklist.map((i: Ingredient, n: number) => (
            <li key={n}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13.5, padding: '4px 0' }}>
                <span style={{ flex: 1 }}>{i.item}</span>
                <span className="cant mono">{i.qty != null ? `${i.qty} ${i.unit ?? ''}`.trim() : ''}</span>
                <button
                  type="button"
                  className="item-accion"
                  onClick={() => setSinIngrediente(sinIngrediente === n ? null : n)}
                >
                  {sinIngrediente === n ? 'cerrar' : 'no tengo'}
                </button>
              </div>
              {sinIngrediente === n && (
                <Reemplazos
                  plan={plan}
                  ingrediente={i}
                  slotId={evento.slotId}
                  onCerrar={() => setSinIngrediente(null)}
                />
              )}
            </li>
          ))}
        </ul>
      )}

      {evento.kind === 'meal' && (
        <>
          {evento.freeMeal
            ? <p className="hero-detalle">Comida del 20%: libre. Controlá igual las porciones.</p>
            : <p className="hero-detalle">{evento.body}</p>}
          {opciones.length > 0 && (
            <div className="opciones">
              {opciones.map((o) => <span className="opcion" key={o.id}>{o.name}</span>)}
            </div>
          )}
        </>
      )}

      {tipo === 'comer-ahora' && !desviando && (
        <>
          <button className="boton boton-lleno boton-ancho" onClick={() => onRegistrar(evento)}>
            Registrar {evento.freeMeal ? 'la comida del 20%' : `“${opciones[0]?.name ?? 'la comida'}”`}
          </button>
          <button className="boton boton-ancho" onClick={() => setDesviando(true)}>
            Comí otra cosa
          </button>
        </>
      )}

      {desviando && slotDe(plan, evento) && (
        <Desvio
          plan={plan}
          slot={slotDe(plan, evento)!}
          cerrados={evento.reglas?.cerrados ?? []}
          onCancelar={() => setDesviando(false)}
          onGuardar={(datos: DatosDesvio, proteina: number, resumen: string) => {
            setDesviando(false);
            onRegistrarDesvio(evento, datos, proteina, resumen);
          }}
        />
      )}

      {evento.warnings?.map((w, n) => <Aviso key={n} texto={w} />)}
    </section>
  );
}

function slotDe(plan: NutritionPlan, evento: ScheduledEvent) {
  return plan.slots.find((s) => s.id === evento.slotId);
}

function tituloDe(evento: ScheduledEvent, _tipo: string): string {
  return sinHora(evento.title);
}

/** "Almuerzo - 13:30" -> "Almuerzo". La hora ya va al costado; repetirla es ruido. */
function sinHora(titulo: string): string {
  return titulo.replace(/\s*[-–]\s*\d{2}:\d{2}\s*$/, '');
}

/**
 * Lo que queda del día, en una línea por evento.
 *
 * No va plegado: dejaba media pantalla vacía, y lo que sigue es justamente lo
 * que uno mira. Lo que ya pasó sí se esconde: no hay nada que hacer con eso.
 */
function LoQueViene({ eventos, ahora, momento }: {
  eventos: ScheduledEvent[]; ahora: number; momento: Momento;
}) {
  const [verPasado, setVerPasado] = useState(false);
  const pasados = eventos.filter((e) => e.minutes <= ahora);
  const futuros = eventos.filter((e) => e.minutes > ahora);
  const mostrados = verPasado ? eventos : futuros;

  if (eventos.length === 0) return null;

  return (
    <section className="agenda">
      <h3 className="encabezado-seccion">
        {futuros.length === 0 ? 'Nada más por hoy' : 'Lo que viene'}
      </h3>
      <ul className="agenda-lista">
        {mostrados.map((e, n) => (
          <li
            key={n}
            className={[
              'agenda-fila',
              e.minutes <= ahora ? 'pasado' : '',
              e === momento.evento ? 'actual' : '',
            ].join(' ')}
          >
            <span className="agenda-hora mono">{e.time}</span>
            <span className={`agenda-punto ${claseDe(e)}`} aria-hidden="true" />
            <span className="agenda-que">
              {e.title}
              {e.freeMeal && <span className="sello">20%</span>}
            </span>
          </li>
        ))}
      </ul>
      {pasados.length > 0 && (
        <button className="agenda-mas" onClick={() => setVerPasado((v) => !v)}>
          {verPasado
            ? 'Ocultar lo anterior'
            : `Ver lo que ya pasó (${pasados.length})`}
        </button>
      )}
    </section>
  );
}

function claseDe(e: ScheduledEvent): string {
  if (e.freeMeal) return 'libre';
  if (e.kind.startsWith('fast')) return 'ayuno';
  if (e.kind === 'prep-check') return 'preparar';
  return 'comida';
}

