import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import {
  aceptarVinculo, declararseProfesional, misVinculos, reclamarInvitaciones,
  revocarVinculo, type Vinculo as Dato,
} from '../lib/vinculos.ts';
import { Aviso } from './Aviso.tsx';

/**
 * El control del paciente sobre quien ve sus datos.
 *
 * Aceptar es dar consentimiento explicito sobre datos de salud, asi que la
 * pantalla dice exactamente que se comparte y que no. Revocar esta al mismo
 * nivel que aceptar: no escondido detras de un menu.
 */
export function Vinculos({ sesion, esProfesional, onEsProfesional }: {
  sesion: Session | null;
  esProfesional: boolean;
  onEsProfesional: (v: boolean) => void;
}) {
  const [vinculos, setVinculos] = useState<Dato[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function recargar() {
    try {
      await reclamarInvitaciones(sesion);
      setVinculos(await misVinculos(sesion));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar las invitaciones.');
    }
  }
  useEffect(() => { void recargar(); }, [sesion]);

  const pendientes = vinculos.filter((v) => v.estado === 'pending');
  const activos = vinculos.filter((v) => v.estado === 'active');

  return (
    <>
      {pendientes.map((v) => (
        <section className="tarjeta destacada" key={v.id}>
          <h3 style={{ fontSize: 17, fontWeight: 600 }}>{v.contraparte} quiere seguir tu plan</h3>
          <p className="nota">
            Si aceptás, va a ver tu registro de comidas, tus fotos y tu plan, y va a poder
            publicar versiones nuevas. <b>No</b> puede cambiar tus horarios ni tu registro.
            Podés cortarlo cuando quieras.
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="boton" style={{ flex: 1 }}
                    onClick={() => void revocarVinculo(sesion, v.id).then(recargar)}>
              Rechazar
            </button>
            <button className="boton boton-lleno" style={{ flex: 2 }}
                    onClick={() => void aceptarVinculo(sesion, v.id).then(recargar)}>
              Aceptar y compartir
            </button>
          </div>
        </section>
      ))}

      <section className="tarjeta">
        <h3 className="encabezado-seccion" style={{ margin: 0 }}>Quién ve tus datos</h3>
        {activos.length === 0 ? (
          <p className="nota">Nadie más que vos.</p>
        ) : activos.map((v) => (
          <div className="campo" key={v.id}>
            <label>
              {v.contraparte}
              {v.desde && (
                <span className="nota" style={{ display: 'block' }}>
                  Desde el {new Date(v.desde).toLocaleDateString('es-AR')}
                </span>
              )}
            </label>
            <button className="boton" onClick={() => void revocarVinculo(sesion, v.id).then(recargar)}>
              Cortar acceso
            </button>
          </div>
        ))}

        <div className="campo">
          <label htmlFor="soy-pro">
            Soy nutricionista
            <span className="nota" style={{ display: 'block' }}>
              Habilita la pestaña para seguir a tus pacientes.
            </span>
          </label>
          <input
            id="soy-pro"
            type="checkbox"
            checked={esProfesional}
            onChange={(e) => {
              const valor = e.target.checked;
              onEsProfesional(valor);
              void declararseProfesional(sesion, valor).catch((err: unknown) => {
                onEsProfesional(!valor);
                setError(err instanceof Error ? err.message : 'No se pudo guardar.');
              });
            }}
          />
        </div>

        {error && <Aviso texto={error} />}
      </section>
    </>
  );
}
