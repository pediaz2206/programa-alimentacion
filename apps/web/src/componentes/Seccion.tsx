import { useState, type ReactNode } from 'react';

interface Props {
  titulo: string;
  /** Resumen que se lee sin abrir: evita tener que desplegar para saber. */
  resumen?: string;
  chip?: ReactNode;
  abiertaPorDefecto?: boolean;
  children: ReactNode;
}

/**
 * Sección plegable.
 *
 * La app se consulta en ráfagas cortas. Todo lo que no se necesita en este
 * momento se pliega, pero deja a la vista un resumen: plegar no puede
 * significar esconder lo que hay que saber.
 */
export function Seccion({ titulo, resumen, chip, abiertaPorDefecto = false, children }: Props) {
  const [abierta, setAbierta] = useState(abiertaPorDefecto);

  return (
    <section className={`plegable ${abierta ? 'abierta' : ''}`}>
      <button
        type="button"
        className="plegable-tope"
        aria-expanded={abierta}
        onClick={() => setAbierta((v) => !v)}
      >
        <span className="plegable-textos">
          <span className="plegable-titulo">{titulo}</span>
          {resumen && !abierta && <span className="plegable-resumen">{resumen}</span>}
        </span>
        {chip}
        <svg className="plegable-flecha" viewBox="0 0 20 20" aria-hidden="true">
          <path d="M6 8l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.8"
                strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {abierta && <div className="plegable-cuerpo">{children}</div>}
    </section>
  );
}
