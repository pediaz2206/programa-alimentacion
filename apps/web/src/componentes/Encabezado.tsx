import type { ReactNode } from 'react';

/**
 * Encabezado de pantalla.
 *
 * Existe para que el título esté siempre en el mismo lugar y del mismo tamaño:
 * cuando cada pantalla arma el suyo, el nombre salta de posición al cambiar de
 * pestaña y la app se siente hecha de pedazos.
 */
export function Encabezado({ eyebrow, titulo, extra }: {
  eyebrow: string;
  titulo: string;
  extra?: ReactNode;
}) {
  return (
    <header className="encabezado">
      <div className="encabezado-textos">
        <span className="encabezado-seccion">{eyebrow}</span>
        <h1 className="titulo-pantalla">{titulo}</h1>
      </div>
      {extra}
    </header>
  );
}
