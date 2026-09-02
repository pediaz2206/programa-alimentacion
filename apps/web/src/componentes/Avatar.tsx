import { useState } from 'react';

const COLORES = [
  'var(--g-proteinas)', 'var(--g-hidratos)', 'var(--g-vegetales)',
  'var(--g-frutas)', 'var(--g-grasas)', 'var(--indigo)',
];

/**
 * Foto de perfil, con iniciales de respaldo.
 *
 * El respaldo no es un detalle: no todo el mundo tiene foto en Google, la URL
 * puede dejar de responder, y una imagen rota se ve peor que ninguna. El color
 * sale del nombre, así que la misma persona siempre tiene el mismo.
 */
export function Avatar({ nombre, foto, tamano = 38 }: {
  nombre: string; foto?: string | null; tamano?: number;
}) {
  const [falló, setFalló] = useState(false);
  const estilo = { width: tamano, height: tamano, fontSize: Math.round(tamano * 0.38) };

  if (foto && !falló) {
    return (
      <img
        className="avatar"
        style={estilo}
        src={foto}
        alt=""
        referrerPolicy="no-referrer"
        onError={() => setFalló(true)}
      />
    );
  }

  return (
    <span
      className="avatar avatar-iniciales"
      style={{ ...estilo, background: COLORES[hash(nombre) % COLORES.length] }}
      aria-hidden="true"
    >
      {iniciales(nombre)}
    </span>
  );
}

function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/[\s@.]+/).filter(Boolean);
  const primera = partes[0]?.[0] ?? '?';
  const segunda = partes.length > 1 ? partes[1]?.[0] ?? '' : '';
  return (primera + segunda).toUpperCase();
}

function hash(texto: string): number {
  let h = 0;
  for (let i = 0; i < texto.length; i++) h = (h * 31 + texto.charCodeAt(i)) | 0;
  return Math.abs(h);
}
