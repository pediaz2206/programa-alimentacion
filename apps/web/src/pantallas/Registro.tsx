import { useRef, useState } from 'react';
import type { NutritionPlan, ScheduledEvent } from '@pa/core';
import { balanceDe, nombresSlot, opcionPorId } from '../lib/datos.ts';
import { fechaISO, opcionesDe, type Registro as Fila } from '../lib/registro.ts';
import { achicar } from '../lib/imagen.ts';
import { Encabezado } from '../componentes/Encabezado.tsx';

interface Props {
  plan: NutritionPlan;
  eventos: ScheduledEvent[];
  registros: Fila[];
  onGuardar: (r: Fila) => void;
  onBorrar: (fecha: string, slotId: string) => void;
  guardando: boolean;
}

/**
 * Reemplaza el ida y vuelta de fotos por WhatsApp. Mientras no haya sesion, la
 * foto se guarda como DataURL en el navegador; con backend pasa a Storage y
 * aca queda la ruta.
 */
export function Registro({ plan, eventos, registros, onGuardar, onBorrar, guardando }: Props) {
  const hoy = fechaISO();
  const NOMBRE_SLOT = nombresSlot(plan);
  const [abierto, setAbierto] = useState<string | null>(null);
  const balance = balanceDe(plan, opcionesDe(plan, registros.filter((r) => r.fecha === hoy)));
  const comidasDeHoy = eventos.filter((e) => e.kind === 'meal');
  const deHoy = new Map(registros.filter((r) => r.fecha === hoy).map((r) => [r.slotId, r]));

  return (
    <>
      <Encabezado eyebrow="Lo que comiste" titulo="Registro" />

      {balance.protein && (
        <section className="tarjeta">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
            <h3 className="encabezado-seccion" style={{ margin: 0 }}>Proteína de hoy</h3>
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
          <p className="nota">
            {balance.protein.remaining > 0
              ? `Te faltan ${Math.round(balance.protein.remaining)} g.`
              : 'Objetivo cubierto.'}
          </p>
        </section>
      )}

      {comidasDeHoy.map((e) => {
        const fila = deHoy.get(e.slotId!);
        const nombre = NOMBRE_SLOT.get(e.slotId!) ?? e.slotId!;
        return (
          <section className="tarjeta" key={e.slotId}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
              <h3 style={{ fontSize: 17, fontWeight: 600 }}>{nombre}</h3>
              <span className="mono" style={{ fontSize: 13, color: 'var(--tenue)' }}>{e.time}</span>
            </div>

            {fila ? (
              <FilaRegistrada
                plan={plan}
                fila={fila}
                onBorrar={() => onBorrar(hoy, e.slotId!)}
              />
            ) : abierto === e.slotId ? (
              <Formulario
                plan={plan}
                evento={e}
                guardando={guardando}
                onCancelar={() => setAbierto(null)}
                onGuardar={(r) => { onGuardar(r); setAbierto(null); }}
              />
            ) : (
              <button className="boton boton-ancho" onClick={() => setAbierto(e.slotId!)}>
                Registrar {nombre.toLowerCase()}
              </button>
            )}
          </section>
        );
      })}

      {registros.filter((r) => r.fecha !== hoy).length > 0 && (
        <section className="tarjeta">
          <h3 className="encabezado-seccion" style={{ margin: 0 }}>Días anteriores</h3>
          <ul className="eq-lista">
            {registros.filter((r) => r.fecha !== hoy).slice(0, 20).map((r, n) => (
              <li key={n}>
                <span>
                  <span className="mono" style={{ color: 'var(--tenue)' }}>{r.fecha}</span>{' '}
                  {NOMBRE_SLOT.get(r.slotId) ?? r.slotId}
                  {r.esLibre && <span className="sello">20%</span>}
                </span>
                <span className="eq-prot mono">{r.proteinGrams ?? 0} g</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

function FilaRegistrada({ plan, fila, onBorrar }: { plan: NutritionPlan; fila: Fila; onBorrar: () => void }) {
  const opcion = opcionPorId(plan, fila.optionId);
  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline' }}>
        <span style={{ fontSize: 14 }}>
          {fila.esLibre ? 'Comida del 20%' : (opcion?.name ?? 'Registrada')}
        </span>
        <span className="eq-prot mono">{fila.proteinGrams ?? 0} g prot.</span>
      </div>
      {fila.nota && <p className="nota">{fila.nota}</p>}
      {fila.foto && <img className="foto-previa" src={fila.foto} alt="Foto de la comida" />}
      <button className="boton" onClick={onBorrar}>Borrar registro</button>
    </>
  );
}

function Formulario({ plan, evento, guardando, onGuardar, onCancelar }: {
  plan: NutritionPlan;
  evento: ScheduledEvent;
  guardando: boolean;
  onGuardar: (r: Fila) => void;
  onCancelar: () => void;
}) {
  const [optionId, setOptionId] = useState<string>(evento.suggestions?.[0]?.id ?? '');
  const [esLibre, setEsLibre] = useState<boolean>(evento.freeMeal ?? false);
  const [nota, setNota] = useState('');
  const [foto, setFoto] = useState<string | undefined>(undefined);
  const inputFoto = useRef<HTMLInputElement>(null);

  const candidatas = plan.options.filter((o) => o.slotIds.includes(evento.slotId!));
  const elegida = opcionPorId(plan, optionId);

  function leerFoto(archivo: File) {
    // Se achica antes de tocar disco: una foto de teléfono son 3 o 4 MB y no
    // entra en la cuota de localStorage si hay que encolarla sin conexión.
    achicar(archivo).then(setFoto).catch(() => setFoto(undefined));
  }

  return (
    <>
      {!esLibre && (
        <div className="campo">
          <label htmlFor={`op-${evento.slotId}`}>Qué comiste</label>
          <select
            id={`op-${evento.slotId}`}
            value={optionId}
            onChange={(ev) => setOptionId(ev.target.value)}
            style={{ maxWidth: 210 }}
          >
            <option value="">Otra cosa</option>
            {candidatas.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </div>
      )}

      <div className="campo">
        <label htmlFor={`libre-${evento.slotId}`}>Comida del 20%</label>
        <input
          id={`libre-${evento.slotId}`}
          type="checkbox"
          checked={esLibre}
          onChange={(ev) => setEsLibre(ev.target.checked)}
        />
      </div>

      <div className="campo">
        <label htmlFor={`nota-${evento.slotId}`}>Nota</label>
        <input
          id={`nota-${evento.slotId}`}
          type="text"
          value={nota}
          placeholder="opcional"
          onChange={(ev) => setNota(ev.target.value)}
          style={{
            font: 'inherit', fontSize: 14, padding: '6px 9px', borderRadius: 8,
            border: '1px solid var(--linea)', background: 'var(--superficie)',
            color: 'var(--tinta)', maxWidth: 210,
          }}
        />
      </div>

      <input
        ref={inputFoto}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(ev) => { const f = ev.target.files?.[0]; if (f) leerFoto(f); }}
      />
      {foto
        ? <img className="foto-previa" src={foto} alt="Vista previa de la comida" />
        : <button className="boton boton-ancho" onClick={() => inputFoto.current?.click()}>Sacar o elegir foto</button>}

      <div style={{ display: 'flex', gap: 8 }}>
        <button className="boton" onClick={onCancelar} style={{ flex: 1 }}>Cancelar</button>
        <button
          className="boton boton-lleno"
          style={{ flex: 2 }}
          disabled={guardando}
          onClick={() => onGuardar({
            fecha: fechaISO(),
            slotId: evento.slotId!,
            optionId: esLibre ? null : (optionId || null),
            proteinGrams: esLibre ? 0 : (elegida?.proteinGrams ?? null),
            esLibre,
            ...(nota ? { nota } : {}),
            ...(foto ? { foto } : {}),
          })}
        >
          {guardando ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </>
  );
}
