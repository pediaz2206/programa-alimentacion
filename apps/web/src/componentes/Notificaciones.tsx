import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import {
  activarNotificaciones, desactivarNotificaciones, enviarPrueba, esIOS, estadoPush,
  type EstadoPush,
} from '../lib/push.ts';

/**
 * El paso mas importante del onboarding y el mas facil de arruinar.
 *
 * En iOS el push solo funciona si la app esta agregada a la pantalla de inicio,
 * y Apple no permite un boton que lo haga: hay que explicarlo. Un usuario que
 * no completa esto no recibe ningun recordatorio, que es todo el producto.
 */
export function Notificaciones({ sesion }: { sesion: Session | null }) {
  const [estado, setEstado] = useState<EstadoPush>('sin-soporte');
  const [error, setError] = useState<string | null>(null);
  const [pidiendo, setPidiendo] = useState(false);
  const [probando, setProbando] = useState(false);
  const [probada, setProbada] = useState(false);

  useEffect(() => { setEstado(estadoPush()); }, []);

  async function activar() {
    setPidiendo(true);
    setError(null);
    try {
      setEstado(await activarNotificaciones(sesion));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron activar.');
    } finally {
      setPidiendo(false);
    }
  }

  return (
    <section className="tarjeta">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
        <h3 className="encabezado-seccion" style={{ margin: 0 }}>Recordatorios</h3>
        {estado === 'activo' && <span className="chip chip-verde">Activos</span>}
      </div>

      {estado === 'requiere-instalar' && (
        <>
          <p className="nota">
            En iPhone los recordatorios solo llegan si agregás En Punto a la pantalla de inicio.
            Una pestaña de Safari no recibe notificaciones — es una restricción de Apple, no algo
            que podamos resolver desde acá.
          </p>
          <ol style={{ margin: 0, paddingLeft: 18, fontSize: 13.5, lineHeight: 1.7, color: 'var(--tenue)' }}>
            <li>Tocá <b>Compartir</b> en la barra de Safari</li>
            <li>Elegí <b>Agregar a inicio</b></li>
            <li>Abrí En Punto desde el ícono nuevo y volvé acá</li>
          </ol>
        </>
      )}

      {estado === 'sin-soporte' && (
        <p className="nota">
          Este navegador no soporta notificaciones push.
          {esIOS() ? ' Probá desde Safari.' : ' Probá desde Chrome, Firefox o Edge.'}
        </p>
      )}

      {estado === 'bloqueado' && (
        <p className="nota">
          Bloqueaste las notificaciones para este sitio. Se reactivan desde los ajustes
          del navegador, no desde acá.
        </p>
      )}

      {estado === 'sin-permiso' && (
        <>
          <p className="nota">
            Te avisamos a la hora de cada comida, con las opciones y los ingredientes que
            necesitás. Sin esto, la app es una pantalla que tenés que acordarte de abrir.
          </p>
          {!sesion && (
            <p className="nota">
              Entrá con Google primero: los recordatorios se mandan desde el servidor y hay que
              saber a quién.
            </p>
          )}
          <button
            className="boton boton-lleno boton-ancho"
            onClick={() => void activar()}
            disabled={pidiendo || !sesion}
          >
            {pidiendo ? 'Activando…' : 'Activar recordatorios'}
          </button>
        </>
      )}

      {estado === 'activo' && (
        <>
          <p className="nota">
            Vas a recibir el aviso de ingredientes antes de cocinar, el recordatorio de cada
            comida y los límites de tu ventana de ayuno.
          </p>
          <button
            className="boton boton-lleno boton-ancho"
            disabled={probando}
            onClick={() => {
              setProbando(true);
              setError(null);
              setProbada(false);
              enviarPrueba(sesion)
                .then(() => setProbada(true))
                .catch((e: unknown) => setError(e instanceof Error ? e.message : 'No se pudo enviar.'))
                .finally(() => setProbando(false));
            }}
          >
            {probando ? 'Enviando…' : 'Enviar una de prueba'}
          </button>
          {probada && (
            <p className="nota" style={{ color: 'var(--verde)' }}>
              Enviada. Si no llega en unos segundos, revisá que las notificaciones estén
              permitidas en el sistema, no solo en el navegador.
            </p>
          )}
          <button
            className="boton boton-ancho"
            onClick={() => void desactivarNotificaciones().then(() => setEstado(estadoPush()))}
          >
            Desactivar
          </button>
        </>
      )}

      {error && <p className="nota" style={{ color: 'var(--ambar)' }}>{error}</p>}
    </section>
  );
}
