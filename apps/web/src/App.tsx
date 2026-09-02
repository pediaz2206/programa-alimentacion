import { useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { ScheduledEvent, UserConfig } from '@pa/core';
import { agendaDe, minutosAhora } from './lib/datos.ts';
import { configEmpaquetada, planEmpaquetado } from './lib/semilla.ts';
import {
  borrarRegistro, cargarDatos, guardarConfig, guardarRegistro, listarRegistros,
  pendientes as contarPendientes, sincronizar, type Datos,
} from './lib/repositorio.ts';
import { fechaISO, type Registro as Fila } from './lib/registro.ts';
import { supabase } from './lib/supabase.ts';
import { Hoy } from './pantallas/Hoy.tsx';
import { Plan } from './pantallas/Plan.tsx';
import { Compras } from './pantallas/Compras.tsx';
import { Registro } from './pantallas/Registro.tsx';
import { Ajustes } from './pantallas/Ajustes.tsx';
import { Bienvenida } from './pantallas/Bienvenida.tsx';
import { Pacientes } from './pantallas/Pacientes.tsx';
import { esProfesional as consultarProfesional, registrarPerfil } from './lib/vinculos.ts';
import { escucharPlan } from './lib/envivo.ts';
import { useRuta, type Pestana } from './lib/ruta.ts';
import { hayBackend } from './lib/supabase.ts';

type Tema = 'claro' | 'oscuro';

const CLAVE_TEMA = 'en-punto:tema';

const ICONOS: Record<Pestana, JSX.Element> = {
  hoy: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" /></>,
  plan: <><path d="M5 4h14v16H5z" /><path d="M8.5 9h7M8.5 13h7M8.5 17h4" /></>,
  compras: <><path d="M4 7h13l-1.2 8H6.2z" /><path d="M4 7L3 4H1.6" /><circle cx="7" cy="19" r="1.3" /><circle cx="15" cy="19" r="1.3" /></>,
  registro: <><path d="M4 7h16v13H4z" /><path d="M8 7V5h8v2" /><circle cx="12" cy="13.5" r="3" /></>,
  pacientes: <><circle cx="9" cy="8" r="3.2" /><path d="M3.5 19a5.5 5.5 0 0111 0" /><path d="M16 6.2a3 3 0 010 5.6M17.5 19a5.6 5.6 0 00-1.6-3.9" /></>,
  ajustes: <><circle cx="12" cy="12" r="3" /><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M18.4 5.6l-1.8 1.8M7.4 16.6l-1.8 1.8" /></>,
};
const NOMBRES: Record<Pestana, string> = {
  hoy: 'Hoy', plan: 'Plan', compras: 'Compras', registro: 'Registro',
  pacientes: 'Pacientes', ajustes: 'Ajustes',
};

export function App() {
  const [ruta, navegar] = useRuta();
  const pestana = ruta.pestana;
  const irA = (p: Pestana) => navegar({ pestana: p });
  const [tema, setTema] = useState<Tema>(leerTema);
  const [sesion, setSesion] = useState<Session | null>(null);
  // Saber si hay sesion es asincronico. Sin este estado, quien ya entro ve un
  // parpadeo de la pantalla de login en cada carga.
  const [sesionResuelta, setSesionResuelta] = useState(!hayBackend);
  const [datos, setDatos] = useState<Datos>({
    plan: planEmpaquetado, config: configEmpaquetada,
    planId: null, planVersionId: null, desdeCache: false,
  });
  const [enLinea, setEnLinea] = useState(() => navigator.onLine);
  const [sinEnviar, setSinEnviar] = useState(0);
  const [registros, setRegistros] = useState<Fila[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ahora, setAhora] = useState(minutosAhora);
  // Ser profesional es un permiso extra, no un rol excluyente: la nutricionista
  // tambien puede seguir un plan propio.
  const [profesional, setProfesional] = useState(false);

  useEffect(() => {
    document.documentElement.dataset['theme'] = tema === 'oscuro' ? 'dark' : 'light';
    try { localStorage.setItem(CLAVE_TEMA, tema); } catch { /* storage bloqueado */ }
  }, [tema]);

  // La agenda depende de la hora: una app de recordatorios que muestra una
  // hora vieja no sirve para nada.
  useEffect(() => {
    const id = setInterval(() => setAhora(minutosAhora()), 60_000);
    return () => clearInterval(id);
  }, []);

  // Volver la conexión es la señal para vaciar la cola. Sin esto, lo que se
  // registró sin señal se queda en el teléfono hasta el próximo guardado.
  useEffect(() => {
    const conectado = () => {
      setEnLinea(true);
      void sincronizar(sesion)
        .then((rs) => { setRegistros(rs); setSinEnviar(contarPendientes(sesion)); })
        .catch(() => { /* sigue en cola: se reintenta en el próximo evento */ });
    };
    const desconectado = () => setEnLinea(false);
    window.addEventListener('online', conectado);
    window.addEventListener('offline', desconectado);
    return () => {
      window.removeEventListener('online', conectado);
      window.removeEventListener('offline', desconectado);
    };
  }, [sesion]);

  useEffect(() => {
    if (!supabase) return;
    void supabase.auth.getSession().then(({ data }) => {
      setSesion(data.session);
      setSesionResuelta(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSesion(s);
      setSesionResuelta(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Los datos son de una persona concreta: sin sesion no hay nada que cargar.
  useEffect(() => {
    if (!sesion) return;
    let vigente = true;
    void (async () => {
      try {
        const [d, rs] = await Promise.all([cargarDatos(sesion), listarRegistros(sesion)]);
        if (!vigente) return;
        setDatos(d);
        setRegistros(rs);
        setSinEnviar(contarPendientes(sesion));
        setError(null);
      } catch (e) {
        if (vigente) setError(mensaje(e));
      }
    })();
    return () => { vigente = false; };
  }, [sesion]);

  useEffect(() => {
    if (!sesion) return;
    void registrarPerfil(sesion).catch(() => { /* se reintenta en el próximo ingreso */ });
    void consultarProfesional(sesion).then(setProfesional).catch(() => setProfesional(false));
  }, [sesion]);

  // Lo que publica la nutricionista aparece sin recargar.
  useEffect(() => {
    if (!sesion) return;
    return escucharPlan(sesion, datos.planId, () => {
      void cargarDatos(sesion).then((d) => {
        setDatos((previo) => (d.planVersionId === previo.planVersionId ? previo : d));
      }).catch(() => { /* sin red: sigue la copia local */ });
    });
  }, [sesion, datos.planId]);

  const eventos = useMemo(
    () => agendaDe(datos.plan, datos.config, new Date()),
    [datos.plan, datos.config],
  );

  function guardarConfigLocal(c: UserConfig) {
    const anterior = datos.config;
    setDatos((d) => ({ ...d, config: c }));
    setError(null);
    void guardarConfig(sesion, c).catch((e) => {
      // Mostrar un cambio que el servidor rechazó es peor que no aplicarlo:
      // se ve aplicado hasta que alguien recarga y vuelve solo.
      setDatos((d) => ({ ...d, config: anterior }));
      setError(`No se pudo guardar el cambio. ${mensaje(e)}`);
    });
  }

  async function alGuardar(r: Fila) {
    setGuardando(true);
    try {
      setRegistros(await guardarRegistro(sesion, r, datos.planVersionId));
      setSinEnviar(contarPendientes(sesion));
      setError(null);
    } catch (e) {
      setError(mensaje(e));
    } finally {
      setGuardando(false);
    }
  }

  async function alBorrar(fecha: string, slotId: string) {
    try {
      setRegistros(await borrarRegistro(sesion, fecha, slotId));
      setSinEnviar(contarPendientes(sesion));
    } catch (e) {
      setError(mensaje(e));
    }
  }

  if (!sesionResuelta) return <div className="cargando">Cargando…</div>;
  if (!sesion) return <Bienvenida />;

  return (
    <div className="app">
      <main className="contenido">
        <EstadoConexion enLinea={enLinea} desdeCache={datos.desdeCache} sinEnviar={sinEnviar} />

        {error && (
          <div className="aviso">
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M8 1.5l6.5 12h-13z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
              <path d="M8 6.2v3.4M8 11.6v.1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {pestana === 'hoy' && (
          <Hoy
            plan={datos.plan}
            eventos={eventos}
            ahora={ahora}
            config={datos.config}
            registros={registros}
            onRegistrar={(e) => void alGuardar(desdeEvento(e))}
            onRegistrarDesvio={(e, proteina, resumen) => void alGuardar({
              fecha: fechaISO(),
              slotId: e.slotId!,
              // Sin optionId: no fue ninguna de las opciones del plan, y decir
              // que sí lo fue ensuciaría el historial que lee la nutricionista.
              optionId: null,
              proteinGrams: proteina,
              esLibre: false,
              nota: resumen,
            })}
            onIrARegistro={() => irA('registro')}
            onIrAAjustes={() => irA('ajustes')}
            onConfig={guardarConfigLocal}
          />
        )}
        {pestana === 'plan' && <Plan plan={datos.plan} config={datos.config} />}
        {pestana === 'compras' && <Compras plan={datos.plan} config={datos.config} />}
        {pestana === 'registro' && (
          <Registro
            plan={datos.plan}
            eventos={eventos}
            registros={registros}
            onGuardar={(r) => void alGuardar(r)}
            onBorrar={(f, s) => void alBorrar(f, s)}
            guardando={guardando}
          />
        )}
        {pestana === 'pacientes' && (
          <Pacientes
            sesion={sesion}
            pacienteAbierto={ruta.pacienteId}
            onAbrir={(id) => navegar({ pestana: 'pacientes', ...(id ? { pacienteId: id } : {}) })}
          />
        )}
        {pestana === 'ajustes' && (
          <Ajustes
            plan={datos.plan}
            config={datos.config}
            onConfig={guardarConfigLocal}
            tema={tema}
            onTema={setTema}
            sesion={sesion}
            esProfesional={profesional}
            onEsProfesional={setProfesional}
          />
        )}
      </main>

      <nav className={`barra barra-${profesional ? 6 : 5}`} aria-label="Secciones">
        {(Object.keys(NOMBRES) as Pestana[])
          .filter((p) => p !== 'pacientes' || profesional)
          .map((p) => (
          <button key={p} onClick={() => irA(p)} aria-current={pestana === p ? 'page' : undefined}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {ICONOS[p]}
            </svg>
            {NOMBRES[p]}
          </button>
        ))}
      </nav>
    </div>
  );
}

/**
 * Una sola línea que dice si lo que se está viendo es fresco y si quedó algo
 * sin mandar. Registrar una comida y no saber si se guardó es peor que no
 * poder registrarla.
 */
function EstadoConexion({ enLinea, desdeCache, sinEnviar }: {
  enLinea: boolean; desdeCache: boolean; sinEnviar: number;
}) {
  if (enLinea && !desdeCache && sinEnviar === 0) return null;

  const texto = sinEnviar > 0
    ? `${sinEnviar} ${sinEnviar === 1 ? 'registro guardado' : 'registros guardados'} en el teléfono. Se ${sinEnviar === 1 ? 'envía' : 'envían'} al volver la conexión.`
    : enLinea
      ? 'No se pudo contactar al servidor. Estás viendo la última versión guardada.'
      : 'Sin conexión. Estás viendo la última versión guardada y podés seguir registrando.';

  return (
    <div className="estado-conexion">
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M1.5 5.5a9 9 0 0113 0M4 8.3a5.5 5.5 0 018 0" fill="none" stroke="currentColor"
              strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="8" cy="12" r="1.1" fill="currentColor" />
      </svg>
      <span>{texto}</span>
    </div>
  );
}

function leerTema(): Tema {
  try {
    return localStorage.getItem(CLAVE_TEMA) === 'oscuro' ? 'oscuro' : 'claro';
  } catch {
    return 'claro';
  }
}

/**
 * Registrar desde la pantalla principal, sin navegar.
 *
 * Es la accion mas frecuente del dia y ocurre justo cuando la app se abre por
 * la notificacion: mandarla a otra pestaña para confirmar lo que ya dice la
 * pantalla es friccion pura. Los ajustes finos (foto, nota, otra opcion) viven
 * en la pestaña Registro.
 */
function desdeEvento(evento: ScheduledEvent): Fila {
  const opcion = evento.suggestions?.[0];
  return {
    fecha: fechaISO(),
    slotId: evento.slotId!,
    optionId: evento.freeMeal ? null : (opcion?.id ?? null),
    proteinGrams: evento.freeMeal ? 0 : (opcion?.proteinGrams ?? null),
    esLibre: evento.freeMeal ?? false,
  };
}

/** Los errores de red y de Supabase llegan con formas distintas. */
function mensaje(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === 'object' && e && 'message' in e) return String((e as { message: unknown }).message);
  return 'Algo falló al guardar. Los datos siguen en este dispositivo.';
}
