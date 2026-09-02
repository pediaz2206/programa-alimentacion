import { useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { ScheduledEvent } from '@pa/core';
import { agendaDe, minutosAhora } from './lib/datos.ts';
import { configEmpaquetada, planEmpaquetado } from './lib/semilla.ts';
import {
  borrarRegistro, cargarDatos, guardarConfig, guardarRegistro, listarRegistros, type Datos,
} from './lib/repositorio.ts';
import { fechaISO, type Registro as Fila } from './lib/registro.ts';
import { supabase } from './lib/supabase.ts';
import { Hoy } from './pantallas/Hoy.tsx';
import { Plan } from './pantallas/Plan.tsx';
import { Registro } from './pantallas/Registro.tsx';
import { Ajustes } from './pantallas/Ajustes.tsx';

type Pestana = 'hoy' | 'plan' | 'registro' | 'ajustes';
type Tema = 'claro' | 'oscuro';

const CLAVE_TEMA = 'en-punto:tema';

const ICONOS: Record<Pestana, JSX.Element> = {
  hoy: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" /></>,
  plan: <><path d="M5 4h14v16H5z" /><path d="M8.5 9h7M8.5 13h7M8.5 17h4" /></>,
  registro: <><path d="M4 7h16v13H4z" /><path d="M8 7V5h8v2" /><circle cx="12" cy="13.5" r="3" /></>,
  ajustes: <><circle cx="12" cy="12" r="3" /><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M18.4 5.6l-1.8 1.8M7.4 16.6l-1.8 1.8" /></>,
};
const NOMBRES: Record<Pestana, string> = { hoy: 'Hoy', plan: 'Plan', registro: 'Registro', ajustes: 'Ajustes' };

export function App() {
  const [pestana, setPestana] = useState<Pestana>('hoy');
  const [tema, setTema] = useState<Tema>(leerTema);
  const [sesion, setSesion] = useState<Session | null>(null);
  const [datos, setDatos] = useState<Datos>({
    plan: planEmpaquetado, config: configEmpaquetada, planVersionId: null,
  });
  const [registros, setRegistros] = useState<Fila[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ahora, setAhora] = useState(minutosAhora);

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

  useEffect(() => {
    if (!supabase) return;
    void supabase.auth.getSession().then(({ data }) => setSesion(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSesion(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  // Al entrar o salir cambia la fuente de datos; el resto de la app no cambia.
  useEffect(() => {
    let vigente = true;
    void (async () => {
      try {
        const [d, rs] = await Promise.all([cargarDatos(sesion), listarRegistros(sesion)]);
        if (!vigente) return;
        setDatos(d);
        setRegistros(rs);
        setError(null);
      } catch (e) {
        if (vigente) setError(mensaje(e));
      }
    })();
    return () => { vigente = false; };
  }, [sesion]);

  const eventos = useMemo(
    () => agendaDe(datos.plan, datos.config, new Date()),
    [datos.plan, datos.config],
  );

  async function alGuardar(r: Fila) {
    setGuardando(true);
    try {
      setRegistros(await guardarRegistro(sesion, r, datos.planVersionId));
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
    } catch (e) {
      setError(mensaje(e));
    }
  }

  return (
    <div className="app">
      <main className="contenido">
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
            onIrARegistro={() => setPestana('registro')}
          />
        )}
        {pestana === 'plan' && <Plan plan={datos.plan} config={datos.config} />}
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
        {pestana === 'ajustes' && (
          <Ajustes
            plan={datos.plan}
            config={datos.config}
            onConfig={(c) => {
              setDatos((d) => ({ ...d, config: c }));
              void guardarConfig(sesion, c).catch((e) => setError(mensaje(e)));
            }}
            tema={tema}
            onTema={setTema}
            sesion={sesion}
          />
        )}
      </main>

      <nav className="barra" aria-label="Secciones">
        {(Object.keys(NOMBRES) as Pestana[]).map((p) => (
          <button key={p} onClick={() => setPestana(p)} aria-current={pestana === p ? 'page' : undefined}>
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
