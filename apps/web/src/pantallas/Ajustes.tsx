import type { Session } from '@supabase/supabase-js';
import type { NutritionPlan, UserConfig } from '@pa/core';
import { entrarConGoogle, hayBackend, salir } from '../lib/supabase.ts';
import { nombresSlot } from '../lib/datos.ts';
import { Notificaciones } from '../componentes/Notificaciones.tsx';
import { Vinculos } from '../componentes/Vinculo.tsx';
import { Encabezado } from '../componentes/Encabezado.tsx';

interface Props {
  plan: NutritionPlan;
  config: UserConfig;
  onConfig: (c: UserConfig) => void;
  tema: 'claro' | 'oscuro';
  onTema: (t: 'claro' | 'oscuro') => void;
  sesion: Session | null;
  esProfesional: boolean;
  onEsProfesional: (v: boolean) => void;
}

export function Ajustes({ plan, config, onConfig, tema, onTema, sesion, esProfesional, onEsProfesional }: Props) {
  const NOMBRE_SLOT = nombresSlot(plan);
  function cambiarHora(slotId: string, time: string) {
    onConfig({
      ...config,
      slots: config.slots.map((s) => (s.slotId === slotId ? { ...s, time } : s)),
    });
  }

  const ayuno = config.fasting;

  return (
    <>
      <Encabezado eyebrow="En Punto" titulo="Ajustes" />

      <section className="tarjeta">
        <h3 className="encabezado-seccion" style={{ margin: 0 }}>Horarios</h3>
        {config.slots.filter((s) => s.enabled !== false).map((s) => (
          <div className="campo" key={s.slotId}>
            <label htmlFor={`h-${s.slotId}`}>{NOMBRE_SLOT.get(s.slotId) ?? s.slotId}</label>
            <input
              id={`h-${s.slotId}`}
              type="time"
              value={s.time ?? plan.slots.find((p) => p.id === s.slotId)?.defaultTime ?? '12:00'}
              onChange={(e) => cambiarHora(s.slotId, e.target.value)}
            />
          </div>
        ))}
      </section>

      {ayuno && (
        <section className="tarjeta">
          <h3 className="encabezado-seccion" style={{ margin: 0 }}>Ayuno intermitente</h3>
          <div className="campo">
            <label htmlFor="ayuno-on">Activado</label>
            <input
              id="ayuno-on"
              type="checkbox"
              checked={ayuno.enabled}
              onChange={(e) => onConfig({ ...config, fasting: { ...ayuno, enabled: e.target.checked } })}
            />
          </div>
          <div className="campo">
            <label htmlFor="ayuno-inicio">Abre la ventana</label>
            <input
              id="ayuno-inicio"
              type="time"
              value={ayuno.eatingWindowStart}
              onChange={(e) => onConfig({ ...config, fasting: { ...ayuno, eatingWindowStart: e.target.value } })}
            />
          </div>
          <div className="campo">
            <label htmlFor="ayuno-horas">Horas de ventana</label>
            <input
              id="ayuno-horas"
              type="number"
              min={1}
              max={23}
              step={0.5}
              value={ayuno.eatingWindowHours}
              onChange={(e) => onConfig({ ...config, fasting: { ...ayuno, eatingWindowHours: Number(e.target.value) } })}
              style={{ width: 90 }}
            />
          </div>
          <p className="nota">
            Ventana de {ayuno.eatingWindowHours} h · ayuno de {24 - ayuno.eatingWindowHours} h.
          </p>
        </section>
      )}

      <Notificaciones sesion={sesion} />

      <Vinculos sesion={sesion} esProfesional={esProfesional} onEsProfesional={onEsProfesional} />

      <section className="tarjeta">
        <h3 className="encabezado-seccion" style={{ margin: 0 }}>Apariencia</h3>
        <div className="campo">
          <label htmlFor="tema">Tema</label>
          <select id="tema" value={tema} onChange={(e) => onTema(e.target.value as 'claro' | 'oscuro')}>
            <option value="claro">Claro</option>
            <option value="oscuro">Oscuro</option>
          </select>
        </div>
        <p className="nota">
          La app no sigue el tema del sistema: la comida y las fotos del registro se leen
          mejor en claro, así que ese es el default y el cambio es tuyo.
        </p>
      </section>

      <section className="tarjeta">
        <h3 className="encabezado-seccion" style={{ margin: 0 }}>Cuenta</h3>
        {!hayBackend ? (
          <p className="nota">
            Falta configurar Supabase. Mientras tanto todo se guarda solo en este dispositivo.
          </p>
        ) : sesion ? (
          <>
            <p className="nota">Sesión iniciada como <b>{sesion.user.email}</b>.</p>
            <button className="boton boton-ancho" onClick={() => void salir()}>Cerrar sesión</button>
          </>
        ) : (
          <>
            <p className="nota">
              Entrá para sincronizar el registro entre dispositivos y compartirlo con tu nutricionista.
            </p>
            <button className="boton boton-lleno boton-ancho" onClick={() => void entrarConGoogle()}>
              Entrar con Google
            </button>
          </>
        )}
      </section>
    </>
  );
}
