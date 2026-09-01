import { useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { UserConfig } from '@pa/core';
import { agendaDe, configInicial, minutosAhora } from './lib/datos.ts';
import { leerRegistros, type Registro as Fila } from './lib/registro.ts';
import { supabase } from './lib/supabase.ts';
import { Hoy } from './pantallas/Hoy.tsx';
import { Plan } from './pantallas/Plan.tsx';
import { Registro } from './pantallas/Registro.tsx';
import { Ajustes } from './pantallas/Ajustes.tsx';

type Pestana = 'hoy' | 'plan' | 'registro' | 'ajustes';
type Tema = 'claro' | 'oscuro';

const CLAVE_TEMA = 'en-punto:tema';
const CLAVE_CONFIG = 'en-punto:config:v1';

const ICONOS: Record<Pestana, JSX.Element> = {
  hoy: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" /></>,
  plan: <><path d="M5 4h14v16H5z" /><path d="M8.5 9h7M8.5 13h7M8.5 17h4" /></>,
  registro: <><path d="M4 7h16v13H4z" /><path d="M8 7V5h8v2" /><circle cx="12" cy="13.5" r="3" /></>,
  ajustes: <><circle cx="12" cy="12" r="3" /><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M18.4 5.6l-1.8 1.8M7.4 16.6l-1.8 1.8" /></>,
};
const NOMBRES: Record<Pestana, string> = { hoy: 'Hoy', plan: 'Plan', registro: 'Registro', ajustes: 'Ajustes' };

export function App() {
  const [pestana, setPestana] = useState<Pestana>('hoy');
  const [tema, setTema] = useState<Tema>(() => leerTema());
  const [config, setConfig] = useState<UserConfig>(() => leerConfig());
  const [registros, setRegistros] = useState<Fila[]>(() => leerRegistros());
  const [sesion, setSesion] = useState<Session | null>(null);
  // Se recalcula solo cada minuto: la agenda depende de la hora y una app de
  // recordatorios que muestra una hora vieja no sirve para nada.
  const [ahora, setAhora] = useState(() => minutosAhora());

  useEffect(() => {
    document.documentElement.dataset['theme'] = tema === 'oscuro' ? 'dark' : 'light';
    try { localStorage.setItem(CLAVE_TEMA, tema); } catch { /* storage bloqueado */ }
  }, [tema]);

  useEffect(() => {
    try { localStorage.setItem(CLAVE_CONFIG, JSON.stringify(config)); } catch { /* idem */ }
  }, [config]);

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

  const eventos = useMemo(() => agendaDe(config, new Date()), [config]);

  return (
    <div className="app">
      <main className="contenido">
        {pestana === 'hoy' && (
          <Hoy
            eventos={eventos}
            ahora={ahora}
            config={config}
            registros={registros}
            onIrARegistro={() => setPestana('registro')}
          />
        )}
        {pestana === 'plan' && <Plan config={config} />}
        {pestana === 'registro' && (
          <Registro eventos={eventos} registros={registros} onCambio={setRegistros} />
        )}
        {pestana === 'ajustes' && (
          <Ajustes config={config} onConfig={setConfig} tema={tema} onTema={setTema} sesion={sesion} />
        )}
      </main>

      <nav className="barra" aria-label="Secciones">
        {(Object.keys(NOMBRES) as Pestana[]).map((p) => (
          <button
            key={p}
            onClick={() => setPestana(p)}
            aria-current={pestana === p ? 'page' : undefined}
          >
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

function leerConfig(): UserConfig {
  try {
    const crudo = localStorage.getItem(CLAVE_CONFIG);
    if (crudo) return JSON.parse(crudo) as UserConfig;
  } catch { /* storage bloqueado o JSON corrupto: se usa el de fabrica */ }
  return configInicial;
}
