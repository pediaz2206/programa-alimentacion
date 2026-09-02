import { useState } from 'react';
import { entrarConGoogle, hayBackend } from '../lib/supabase.ts';

/**
 * Puerta de entrada. Sin sesion no se carga nada: el plan, el registro y los
 * recordatorios son de una persona concreta, y son datos de salud.
 */
export function Bienvenida() {
  const [entrando, setEntrando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <main className="bienvenida">
      <div className="bienvenida-marco">
        <div className="bienvenida-marca">
          <Reloj />
          <span>En Punto</span>
        </div>

        <h1>Tu plan de alimentación, en el momento justo.</h1>
        <p className="bienvenida-bajada">
          Dejá de abrir el PDF y scrollear. En Punto te avisa a la hora de cada comida
          con las opciones de tu plan, te pasa la lista de ingredientes antes de cocinar
          y respeta tu ventana de ayuno.
        </p>

        <ul className="bienvenida-lista">
          <li><b>A la hora justa.</b> Un recordatorio por comida, con qué comer adentro.</li>
          <li><b>Antes de cocinar.</b> La lista de ingredientes, para chequear si tenés todo.</li>
          <li><b>Sin contar calorías.</b> Las porciones y equivalencias de tu propio plan.</li>
        </ul>

        {hayBackend ? (
          <>
            <button
              className="boton boton-lleno boton-ancho"
              disabled={entrando}
              onClick={() => {
                setEntrando(true);
                setError(null);
                entrarConGoogle().catch((e: unknown) => {
                  setError(e instanceof Error ? e.message : 'No se pudo iniciar sesión.');
                  setEntrando(false);
                });
              }}
            >
              {entrando ? 'Abriendo Google…' : 'Entrar con Google'}
            </button>
            <p className="bienvenida-legal">
              Tu plan y tu registro son privados. Solo se comparten con tu nutricionista
              si vos lo autorizás, y podés cortar ese acceso cuando quieras.
            </p>
          </>
        ) : (
          <p className="bienvenida-legal">
            Falta configurar el servidor: no están cargadas las variables de entorno de
            Supabase, así que no se puede iniciar sesión.
          </p>
        )}

        {error && <p className="bienvenida-legal" style={{ color: 'var(--ambar)' }}>{error}</p>}
      </div>
    </main>
  );
}

function Reloj() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"
         strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </svg>
  );
}
