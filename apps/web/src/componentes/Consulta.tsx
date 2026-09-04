import type { PuntoDeAtencion, ResumenConsulta } from '@pa/core';
import { Seccion } from './Seccion.tsx';

/**
 * Lo que la nutricionista lee en los dos minutos antes de la consulta.
 *
 * No es "el panel con mas datos". Un mes de registros son cien filas, y cien
 * filas no caben en una consulta de treinta minutos. Lo que cabe es una lista
 * corta de cosas por preguntar, ordenadas por cuanto cambian la conversacion,
 * cada una con el dato que la respalda para que no sea una corazonada.
 *
 * Cuando no hay nada que senalar, no se muestra nada: un resumen donde siempre
 * figura algo deja de leerse a la tercera vez.
 */
export function Consulta({ resumen, nombre }: { resumen: ResumenConsulta; nombre: string }) {
  const { puntos, adherencia: a, proteina: p, libres, libresPresupuesto, peso, cintura, desvios } = resumen;
  const primerNombre = nombre.split(' ')[0] ?? nombre;

  return (
    <Seccion
      titulo="Para la consulta"
      resumen={puntos.length === 0
        ? 'Sin puntos de atención'
        : `${puntos.length} ${puntos.length === 1 ? 'punto' : 'puntos'} para preguntar`}
    >
      <p className="nota">
        Últimos {resumen.dias} días, del {resumen.desde.slice(5)} al {resumen.hasta.slice(5)}.
      </p>

      <div className="consulta-cifras">
        <Cifra valor={`${a.porcentaje}%`} etiqueta="adherencia" pie={`${a.registradas} de ${a.esperadas}`} />
        <Cifra
          valor={p.diasConRegistro > 0 ? `${Math.round(p.promedio)} g` : '—'}
          etiqueta="proteína"
          pie={p.objetivo ? `objetivo ${p.objetivo} g` : 'sin objetivo'}
        />
        <Cifra valor={`${libres.usadas}`} etiqueta="del 20%" pie={`de ${libresPresupuesto}`} />
      </div>

      {(peso.direccion !== 'sin-datos' || cintura.direccion !== 'sin-datos') && (
        <p className="consulta-cuerpo">
          {peso.direccion !== 'sin-datos' && peso.resumen}
          {peso.direccion !== 'sin-datos' && cintura.direccion !== 'sin-datos' && ' '}
          {cintura.direccion !== 'sin-datos' && cintura.resumen}
        </p>
      )}

      {puntos.length === 0 ? (
        <p className="nota">
          Nada que llame la atención en el período. {primerNombre} viene siguiendo el plan.
        </p>
      ) : (
        <ul className="puntos">
          {puntos.map((punto) => <Punto key={punto.id} punto={punto} />)}
        </ul>
      )}

      {desvios.length > 0 && (
        <>
          <h4 className="consulta-subtitulo">Qué comió cuando se salió del plan</h4>
          <ul className="eq-lista">
            {desvios.slice(0, 8).map((d, n) => (
              <li key={n}>
                <span>
                  <span className="mono" style={{ color: 'var(--tenue)' }}>{d.fecha.slice(5)}</span>{' '}
                  {d.nota}
                </span>
                <span className="eq-cant mono">{d.slotId}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Seccion>
  );
}

function Cifra({ valor, etiqueta, pie }: { valor: string; etiqueta: string; pie: string }) {
  return (
    <div className="consulta-cifra">
      <strong className="mono">{valor}</strong>
      <span>{etiqueta}</span>
      <small>{pie}</small>
    </div>
  );
}

function Punto({ punto }: { punto: PuntoDeAtencion }) {
  return (
    <li className={`punto-atencion punto-${punto.severidad}`}>
      <span className="punto-titulo">{punto.titulo}</span>
      <span className="punto-detalle">{punto.detalle}</span>
      {punto.fechas && punto.fechas.length > 0 && (
        <span className="punto-fechas mono">
          {punto.fechas.map((f) => f.slice(5)).join(' · ')}
        </span>
      )}
    </li>
  );
}
