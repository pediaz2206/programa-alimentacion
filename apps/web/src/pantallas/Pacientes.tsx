import { useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { validatePlan, type NutritionPlan } from '@pa/core';
import {
  metricasDe, misPacientes, publicarVersion, type Metricas, type Paciente,
} from '../lib/profesional.ts';
import { invitarPaciente } from '../lib/vinculos.ts';
import { Seccion } from '../componentes/Seccion.tsx';
import { Aviso } from '../componentes/Aviso.tsx';
import { Encabezado } from '../componentes/Encabezado.tsx';

export function Pacientes({ sesion }: { sesion: Session | null }) {
  const [pacientes, setPacientes] = useState<Paciente[]>([]);
  const [abierto, setAbierto] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function recargar() {
    try {
      setPacientes(await misPacientes(sesion));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar.');
    } finally {
      setCargando(false);
    }
  }
  useEffect(() => { void recargar(); }, [sesion]);

  const elegido = pacientes.find((p) => p.id === abierto);
  if (elegido) {
    return <Detalle paciente={elegido} sesion={sesion} onVolver={() => { setAbierto(null); void recargar(); }} />;
  }

  return (
    <>
      <Encabezado eyebrow="Seguimiento" titulo="Pacientes" />

      {error && <Aviso texto={error} />}

      {cargando ? (
        <p className="vacio">Cargando…</p>
      ) : pacientes.length === 0 ? (
        <section className="tarjeta">
          <p className="vacio">
            Todavía no hay nadie. Invitá por email y, cuando esa persona acepte,
            vas a ver su seguimiento acá.
          </p>
        </section>
      ) : (
        pacientes.map((p) => (
          <FilaPaciente key={p.id} paciente={p} onAbrir={() => setAbierto(p.id)} />
        ))
      )}

      <Invitar sesion={sesion} onInvitado={() => void recargar()} />
    </>
  );
}

function FilaPaciente({ paciente, onAbrir }: { paciente: Paciente; onAbrir: () => void }) {
  const m = metricasDe(paciente);
  return (
    <button className="tarjeta paciente" onClick={onAbrir}>
      <div className="paciente-tope">
        <span className="paciente-nombre">{paciente.nombre}</span>
        {m && <Semaforo porcentaje={m.adherencia.porcentaje} />}
      </div>
      {m ? (
        <>
          <div className="barra-progreso">
            <i style={{ width: `${m.adherencia.porcentaje}%`, background: colorAdherencia(m.adherencia.porcentaje) }} />
          </div>
          <span className="paciente-detalle">
            {m.adherencia.registradas} de {m.adherencia.esperadas} comidas registradas esta semana
            {m.proteina.diasConRegistro > 0 && ` · ${m.proteina.promedio} g de proteína por día`}
          </span>
        </>
      ) : (
        <span className="paciente-detalle">Todavía no tiene un plan cargado.</span>
      )}
    </button>
  );
}

function Detalle({ paciente, sesion, onVolver }: {
  paciente: Paciente; sesion: Session | null; onVolver: () => void;
}) {
  const m = metricasDe(paciente);
  return (
    <>
      <button className="volver" onClick={onVolver}>
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path d="M12 5l-5 5 5 5" fill="none" stroke="currentColor" strokeWidth="1.8"
                strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Pacientes
      </button>

      <Encabezado eyebrow={paciente.email} titulo={paciente.nombre} />

      {m ? <Panel metricas={m} /> : (
        <section className="tarjeta"><p className="vacio">Sin plan activo.</p></section>
      )}

      <Seccion titulo="Últimos días" resumen={`${paciente.registros.length} comidas registradas`}>
        {paciente.registros.length === 0
          ? <p className="vacio">Nada registrado en la última semana.</p>
          : (
            <ul className="eq-lista">
              {[...paciente.registros]
                .sort((a, b) => (b.fecha.localeCompare(a.fecha)))
                .map((r, n) => (
                  <li key={n}>
                    <span>
                      <span className="mono" style={{ color: 'var(--tenue)' }}>{r.fecha}</span>{' '}
                      {r.slotId}
                      {r.esLibre && <span className="sello">20%</span>}
                    </span>
                    <span className="eq-prot mono">{r.proteinGrams ?? 0} g</span>
                  </li>
                ))}
            </ul>
          )}
      </Seccion>

      {paciente.plan && <EditarPlan paciente={paciente} sesion={sesion} />}
      <SubirPlan paciente={paciente} sesion={sesion} />
    </>
  );
}

function Panel({ metricas }: { metricas: Metricas }) {
  const { adherencia: a, proteina: p, racha: r, libres } = metricas;
  return (
    <>
      <section className="tarjeta">
        <div className="tira-fila">
          <span className="tira-nombre">Adherencia · últimos 7 días</span>
          <span className="tira-cifra mono">{a.registradas} / {a.esperadas}</span>
        </div>
        <div className="barra-progreso">
          <i style={{ width: `${a.porcentaje}%`, background: colorAdherencia(a.porcentaje) }} />
        </div>
        <p className="nota">
          Mide cuántas comidas quedaron registradas, no si estuvieron bien elegidas.
        </p>
      </section>

      {p.objetivo != null && (
        <section className="tarjeta">
          <div className="tira-fila">
            <span className="tira-nombre">Proteína por día</span>
            <span className="tira-cifra mono">{p.promedio} / {p.objetivo} g</span>
          </div>
          <div className="barra-progreso">
            <i style={{ width: `${Math.min(100, (p.promedio / p.objetivo) * 100)}%`, background: 'var(--g-proteinas)' }} />
          </div>
          <p className="nota">
            Promedio sobre los {p.diasConRegistro} {p.diasConRegistro === 1 ? 'día' : 'días'} con
            registro. Los días sin datos no bajan el promedio: no sabemos qué pasó, no que comió mal.
          </p>
        </section>
      )}

      <div className="duo">
        <div className="tarjeta">
          <span className="tira-nombre">Racha</span>
          <span className="cifra-grande mono">{r}</span>
          <span className="nota">{r === 1 ? 'día seguido' : 'días seguidos'} con registro</span>
        </div>
        <div className="tarjeta">
          <span className="tira-nombre">Comidas del 20%</span>
          <span className="cifra-grande mono">{libres.usadas}</span>
          <span className="nota">en la semana</span>
        </div>
      </div>

      {libres.diasConMasDeUna.length > 0 && (
        <Aviso texto={`Concentró más de una comida del 20% el ${libres.diasConMasDeUna.join(', ')}.`} />
      )}
    </>
  );
}

/**
 * Edicion acotada a lo que cambia con la etapa del entrenamiento o una
 * indicacion medica. Las listas de alimentos se transcriben del PDF y no se
 * tocan desde el telefono.
 */
function EditarPlan({ paciente, sesion }: { paciente: Paciente; sesion: Session | null }) {
  const plan = paciente.plan!;
  const [proteina, setProteina] = useState(String(plan.proteinTargetGrams ?? ''));
  const [libres, setLibres] = useState(String(plan.freeMeals?.perWeek ?? ''));
  const [nota, setNota] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [listo, setListo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cambio = Number(proteina) !== (plan.proteinTargetGrams ?? 0)
    || Number(libres) !== (plan.freeMeals?.perWeek ?? 0);

  async function publicar() {
    setGuardando(true);
    setError(null);
    try {
      const nuevo: NutritionPlan = {
        ...plan,
        proteinTargetGrams: Number(proteina),
        ...(plan.freeMeals ? { freeMeals: { ...plan.freeMeals, perWeek: Number(libres) } } : {}),
      };
      await publicarVersion(sesion, paciente.id, nuevo, nota);
      setListo(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo publicar.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Seccion titulo="Ajustar el plan" resumen="Publica una versión nueva">
      <p className="nota">
        Las versiones no se editan, se publican. La anterior queda como registro de qué
        se indicó y cuándo, y los registros de comidas siguen apuntando a la que regía ese día.
      </p>
      <div className="campo">
        <label htmlFor="prot">Proteína por día (g)</label>
        <input id="prot" type="number" min={40} max={300} value={proteina}
               onChange={(e) => setProteina(e.target.value)} style={{ width: 100 }} />
      </div>
      {plan.freeMeals && (
        <div className="campo">
          <label htmlFor="libres">Comidas del 20% por semana</label>
          <input id="libres" type="number" min={0} max={14} value={libres}
                 onChange={(e) => setLibres(e.target.value)} style={{ width: 100 }} />
        </div>
      )}
      <div className="campo">
        <label htmlFor="nota">Por qué cambia</label>
        <input id="nota" type="text" value={nota} placeholder="subida de volumen"
               onChange={(e) => setNota(e.target.value)}
               style={{ font: 'inherit', fontSize: 14, padding: '6px 9px', borderRadius: 8,
                        border: '1px solid var(--linea)', background: 'var(--superficie)',
                        color: 'var(--tinta)', maxWidth: 190 }} />
      </div>
      <button className="boton boton-lleno boton-ancho" disabled={!cambio || guardando}
              onClick={() => void publicar()}>
        {guardando ? 'Publicando…' : listo ? 'Publicada' : 'Publicar versión nueva'}
      </button>
      {error && <Aviso texto={error} />}
    </Seccion>
  );
}

/**
 * Reemplazar el plan entero por uno transcrito de un PDF nuevo.
 *
 * Se valida ANTES de publicar, con el mismo validador que usa el motor: un
 * plan con un momento sin opciones o un grupo inexistente no rompe al
 * publicarse, rompe despues, en el telefono de alguien y a la hora de comer.
 */
function SubirPlan({ paciente, sesion }: { paciente: Paciente; sesion: Session | null }) {
  const archivo = useRef<HTMLInputElement>(null);
  const [candidato, setCandidato] = useState<NutritionPlan | null>(null);
  const [problemas, setProblemas] = useState<string[]>([]);
  const [nota, setNota] = useState('');
  const [estado, setEstado] = useState<'listo' | 'publicando' | 'publicado'>('listo');
  const [error, setError] = useState<string | null>(null);

  function leer(f: File) {
    setError(null);
    setCandidato(null);
    setProblemas([]);
    f.text()
      .then((texto) => {
        const plan = JSON.parse(texto) as NutritionPlan;
        const errores = validatePlan(plan);
        setProblemas(errores);
        if (errores.length === 0) setCandidato(plan);
      })
      .catch(() => setError('Ese archivo no es un plan válido en formato JSON.'));
  }

  return (
    <Seccion titulo="Subir un plan nuevo" resumen="Reemplaza el plan completo">
      <p className="nota">
        Un archivo JSON con el plan transcrito. Se valida antes de publicarse: si algo
        está mal se avisa acá y no llega al teléfono de nadie.
      </p>

      <input ref={archivo} type="file" accept="application/json,.json" hidden
             onChange={(e) => { const f = e.target.files?.[0]; if (f) leer(f); }} />
      <button className="boton boton-ancho" onClick={() => archivo.current?.click()}>
        Elegir archivo
      </button>

      {problemas.length > 0 && (
        <>
          <Aviso texto={`El plan tiene ${problemas.length} ${problemas.length === 1 ? 'problema' : 'problemas'}. No se puede publicar así.`} />
          <ul className="eq-lista">
            {problemas.slice(0, 8).map((p, n) => (
              <li key={n}><span style={{ fontSize: 12.5 }}>{p}</span></li>
            ))}
          </ul>
        </>
      )}

      {candidato && (
        <>
          <p className="nota">
            <b>{candidato.name}</b> — {candidato.foodGroups.length} grupos,{' '}
            {candidato.options.length} opciones, {candidato.slots.length} momentos.
          </p>
          <div className="campo">
            <label htmlFor="nota-plan">Por qué cambia</label>
            <input id="nota-plan" type="text" value={nota} placeholder="plan de septiembre"
                   onChange={(e) => setNota(e.target.value)}
                   style={{ font: 'inherit', fontSize: 14, padding: '6px 9px', borderRadius: 8,
                            border: '1px solid var(--linea)', background: 'var(--superficie)',
                            color: 'var(--tinta)', maxWidth: 190 }} />
          </div>
          <button className="boton boton-lleno boton-ancho" disabled={estado !== 'listo'}
                  onClick={() => {
                    setEstado('publicando');
                    publicarVersion(sesion, paciente.id, candidato, nota)
                      .then(() => setEstado('publicado'))
                      .catch((e: unknown) => {
                        setError(e instanceof Error ? e.message : 'No se pudo publicar.');
                        setEstado('listo');
                      });
                  }}>
            {estado === 'publicando' ? 'Publicando…'
              : estado === 'publicado' ? 'Publicado — ya le aparece en la app'
              : 'Publicar este plan'}
          </button>
        </>
      )}

      {error && <Aviso texto={error} />}
    </Seccion>
  );
}

function Invitar({ sesion, onInvitado }: { sesion: Session | null; onInvitado: () => void }) {
  const [email, setEmail] = useState('');
  const [estado, setEstado] = useState<'listo' | 'enviando' | 'enviado'>('listo');
  const [error, setError] = useState<string | null>(null);

  return (
    <Seccion titulo="Invitar a alguien" resumen="Por email">
      <p className="nota">
        Le va a aparecer una invitación cuando entre. Vas a ver su seguimiento solo si la acepta.
      </p>
      <div className="campo">
        <label htmlFor="inv">Email</label>
        <input id="inv" type="email" value={email} placeholder="persona@mail.com"
               onChange={(e) => { setEmail(e.target.value); setEstado('listo'); }}
               style={{ font: 'inherit', fontSize: 14, padding: '6px 9px', borderRadius: 8,
                        border: '1px solid var(--linea)', background: 'var(--superficie)',
                        color: 'var(--tinta)', maxWidth: 200 }} />
      </div>
      <button className="boton boton-ancho" disabled={!email.includes('@') || estado !== 'listo'}
              onClick={() => {
                setEstado('enviando');
                setError(null);
                invitarPaciente(sesion, email)
                  .then(() => { setEstado('enviado'); setEmail(''); onInvitado(); })
                  .catch((e: unknown) => {
                    setError(e instanceof Error ? e.message : 'No se pudo invitar.');
                    setEstado('listo');
                  });
              }}>
        {estado === 'enviando' ? 'Invitando…' : estado === 'enviado' ? 'Invitación enviada' : 'Invitar'}
      </button>
      {error && <Aviso texto={error} />}
    </Seccion>
  );
}

function Semaforo({ porcentaje }: { porcentaje: number }) {
  const etiqueta = porcentaje >= 80 ? 'Al día' : porcentaje >= 50 ? 'Irregular' : 'Sin registrar';
  const clase = porcentaje >= 80 ? 'chip-verde' : porcentaje >= 50 ? 'chip-ambar' : 'chip-indigo';
  return <span className={`chip ${clase}`}>{etiqueta}</span>;
}

function colorAdherencia(p: number): string {
  return p >= 80 ? 'var(--verde)' : p >= 50 ? 'var(--ambar)' : 'var(--g-proteinas)';
}
