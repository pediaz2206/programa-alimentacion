import { useState } from 'react';
import { lectura, suavizada, tendencia, type Medida } from '@pa/core';
import { fechaISO } from '../lib/registro.ts';

/**
 * ¿Esto esta funcionando?
 *
 * Es la unica pregunta que las demas metricas no contestan: adherencia y
 * proteina miden si se siguio el plan, no si el plan sirve.
 *
 * La pantalla muestra la linea del promedio y deja los puntos crudos como
 * marcas chicas. Es a proposito: el peso de un dia oscila por sal, agua y hora,
 * y leer esa oscilacion como progreso es lo que hace abandonar planes que
 * estaban andando.
 */
export function Progreso({ medidas, onGuardar, guardando }: {
  medidas: Medida[];
  onGuardar: (m: Medida) => void;
  guardando: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  const [peso, setPeso] = useState('');
  const [cintura, setCintura] = useState('');

  const t = tendencia(medidas, 'pesoKg');
  const serie = suavizada(medidas, 'pesoKg');
  const hoy = fechaISO();
  const yaHoy = medidas.some((m) => m.fecha === hoy);

  function guardar() {
    const p = Number(peso.replace(',', '.'));
    const c = Number(cintura.replace(',', '.'));
    const m: Medida = {
      fecha: hoy,
      ...(peso.trim() && Number.isFinite(p) ? { pesoKg: p } : {}),
      ...(cintura.trim() && Number.isFinite(c) ? { cinturaCm: c } : {}),
    };
    if (m.pesoKg == null && m.cinturaCm == null) return;
    onGuardar(m);
    setPeso('');
    setCintura('');
    setAbierto(false);
  }

  const puedeGuardar = peso.trim().length > 0 || cintura.trim().length > 0;

  return (
    <section className="tarjeta">
      <div className="progreso-tope">
        <h3 className="encabezado-seccion" style={{ margin: 0 }}>Cómo viene</h3>
        {t.direccion !== 'sin-datos' && (
          <span className={`chip chip-${t.direccion === 'baja' ? 'verde' : t.direccion === 'sube' ? 'ambar' : 'neutro'}`}>
            {t.direccion === 'baja' ? 'baja' : t.direccion === 'sube' ? 'sube' : 'estable'}
          </span>
        )}
      </div>

      {serie.length >= 2 && <Curva serie={serie} />}

      <p className="nota">{lectura(medidas)}</p>

      {!abierto && (
        <button className="boton boton-ancho" onClick={() => setAbierto(true)}>
          {yaHoy ? 'Corregir la medición de hoy' : 'Anotar peso o cintura'}
        </button>
      )}

      {abierto && (
        <div className="medir">
          <div className="medir-campos">
            <label>
              <span>Peso (kg)</span>
              <input
                type="text" inputMode="decimal" placeholder="80,4"
                value={peso} onChange={(e) => setPeso(e.target.value)}
              />
            </label>
            <label>
              <span>Cintura (cm)</span>
              <input
                type="text" inputMode="decimal" placeholder="92"
                value={cintura} onChange={(e) => setCintura(e.target.value)}
              />
            </label>
          </div>
          {/*
            * Se puede anotar una sola: pesarse sin cinta es valido, y medirse
            * sin balanza tambien. Exigir las dos hace que algunos dias no se
            * anote ninguna.
            */}
          <p className="nota">Con una alcanza. Una vez por semana es suficiente.</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="boton" style={{ flex: 1 }} onClick={() => setAbierto(false)}>
              Cancelar
            </button>
            <button
              className="boton boton-lleno" style={{ flex: 2 }}
              disabled={guardando || !puedeGuardar}
              onClick={guardar}
            >
              {guardando ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

/**
 * La curva del promedio, con los puntos crudos como marcas.
 *
 * SVG a mano y no una libreria de graficos: son dos polilineas sobre una
 * escala lineal, y la dependencia pesaria mas que el codigo.
 */
function Curva({ serie }: { serie: { fecha: string; valor: number; media: number }[] }) {
  const ancho = 300;
  const alto = 84;
  const pad = 6;

  const valores = serie.flatMap((p) => [p.valor, p.media]);
  const min = Math.min(...valores);
  const max = Math.max(...valores);
  // Un rango de cero (todo el mismo peso) dividiria por cero: se abre a mano.
  const rango = max - min < 0.4 ? 0.4 : max - min;
  const centro = (max + min) / 2;
  const techo = centro + rango / 2;

  const x = (i: number) => pad + (i * (ancho - pad * 2)) / Math.max(1, serie.length - 1);
  const y = (v: number) => pad + ((techo - v) / rango) * (alto - pad * 2);

  const linea = serie.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(p.media).toFixed(1)}`).join(' ');
  const ultima = serie[serie.length - 1]!;

  return (
    <figure className="curva">
      <svg viewBox={`0 0 ${ancho} ${alto}`} preserveAspectRatio="none" role="img"
        aria-label={`Promedio de peso: ${ultima.media} kg al ${ultima.fecha}`}>
        <path d={linea} fill="none" stroke="var(--verde)" strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        {serie.map((p, i) => (
          <circle key={p.fecha} cx={x(i)} cy={y(p.valor)} r="1.8" fill="var(--tenue)" opacity=".5" />
        ))}
        <circle cx={x(serie.length - 1)} cy={y(ultima.media)} r="3.5" fill="var(--verde)" />
      </svg>
      <figcaption className="curva-pie">
        <span className="mono">{serie[0]!.fecha.slice(5)}</span>
        <span className="mono curva-ultimo">
          {ultima.media.toFixed(1).replace('.', ',')} kg
        </span>
        <span className="mono">{ultima.fecha.slice(5)}</span>
      </figcaption>
    </figure>
  );
}
