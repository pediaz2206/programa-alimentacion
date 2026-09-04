/**
 * Peso y cintura: la unica metrica que contesta "¿esto esta funcionando?".
 *
 * Todo lo demas que mide la app —adherencia, racha, proteina— mide si la
 * persona siguio el plan. Eso no es lo mismo que el plan sirva.
 *
 * Dos decisiones que gobiernan este modulo:
 *
 * 1. Nunca se compara el dato de hoy contra el de ayer. El peso oscila un kilo
 *    o mas por sal, agua y hora del dia; leer esa oscilacion como progreso es
 *    la forma mas rapida de abandonar un plan que estaba andando. Se compara
 *    promedio contra promedio.
 * 2. Se dice "no alcanza para saber" cuando no alcanza. Una tendencia dibujada
 *    sobre tres dias es una opinion disfrazada de dato.
 */

export interface Medida {
  fecha: string;
  pesoKg?: number | null;
  cinturaCm?: number | null;
  nota?: string;
}

export type Direccion = 'baja' | 'sube' | 'estable' | 'sin-datos';

export interface Tendencia {
  direccion: Direccion;
  /** Promedio del periodo reciente. */
  actual?: number;
  /** Promedio del periodo anterior, contra el que se compara. */
  previo?: number;
  /** actual - previo. Negativo es bajar. */
  cambio?: number;
  /** Cuantas mediciones sostienen el calculo. */
  mediciones: number;
  /** Que se puede afirmar con esto, en una frase. */
  resumen: string;
}

/** Debajo de este cambio, la diferencia es ruido y no direccion. */
const RUIDO_PESO_KG = 0.3;
const RUIDO_CINTURA_CM = 0.5;

/** Sin al menos esto en cada mitad, no hay dos promedios que comparar. */
const MINIMO_POR_LADO = 2;

function promedio(valores: number[]): number {
  return valores.reduce((a, b) => a + b, 0) / valores.length;
}

/** Redondeo a un decimal, que es toda la precision que estas medidas tienen. */
function red(n: number): number {
  return Math.round(n * 10) / 10;
}

function serie(medidas: Medida[], campo: 'pesoKg' | 'cinturaCm'): { fecha: string; valor: number }[] {
  return medidas
    .map((m) => ({ fecha: m.fecha, valor: m[campo] }))
    .filter((p): p is { fecha: string; valor: number } => p.valor != null)
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
}

/**
 * Compara el promedio de la mitad reciente contra el de la mitad anterior.
 *
 * Partir por la mitad, y no "ultimas 2 semanas contra las 2 previas", es lo que
 * permite que funcione igual con mediciones semanales que salteadas: usa lo que
 * hay en vez de exigir una cadencia.
 */
export function tendencia(
  medidas: Medida[],
  campo: 'pesoKg' | 'cinturaCm' = 'pesoKg',
): Tendencia {
  const puntos = serie(medidas, campo);
  const unidad = campo === 'pesoKg' ? 'kg' : 'cm';
  const que = campo === 'pesoKg' ? 'El peso' : 'La cintura';

  if (puntos.length === 0) {
    return { direccion: 'sin-datos', mediciones: 0, resumen: 'Todavía no hay mediciones.' };
  }
  if (puntos.length < MINIMO_POR_LADO * 2) {
    const faltan = MINIMO_POR_LADO * 2 - puntos.length;
    return {
      direccion: 'sin-datos',
      mediciones: puntos.length,
      resumen: faltan === 1
        ? 'Con una medición más ya se puede ver la tendencia.'
        : `Con ${faltan} mediciones más ya se puede ver la tendencia.`,
    };
  }

  const corte = Math.floor(puntos.length / 2);
  const previo = red(promedio(puntos.slice(0, corte).map((p) => p.valor)));
  const actual = red(promedio(puntos.slice(corte).map((p) => p.valor)));
  const cambio = red(actual - previo);

  const ruido = campo === 'pesoKg' ? RUIDO_PESO_KG : RUIDO_CINTURA_CM;
  const direccion: Direccion =
    Math.abs(cambio) < ruido ? 'estable' : cambio < 0 ? 'baja' : 'sube';

  const magnitud = `${Math.abs(cambio).toFixed(1).replace('.', ',')} ${unidad}`;
  const resumen =
    direccion === 'estable'
      ? `${que} se mantiene: ${magnitud} de diferencia entre las dos mitades del período.`
      : direccion === 'baja'
        ? `${que} bajó ${magnitud} respecto del promedio anterior.`
        : `${que} subió ${magnitud} respecto del promedio anterior.`;

  return { direccion, actual, previo, cambio, mediciones: puntos.length, resumen };
}

/**
 * Lo que hay que decir cuando el peso no se mueve pero la cintura si.
 *
 * Es el caso central de la recomposicion corporal y el que hace abandonar a
 * quien solo mira la balanza. Si las dos series estan, esto lo nombra.
 */
export function lectura(medidas: Medida[]): string {
  const peso = tendencia(medidas, 'pesoKg');
  const cintura = tendencia(medidas, 'cinturaCm');

  if (peso.direccion === 'sin-datos' && cintura.direccion === 'sin-datos') {
    return peso.mediciones === 0 && cintura.mediciones === 0
      ? 'Anotá tu peso una vez por semana y en un mes vas a poder ver si el plan está funcionando.'
      : 'Todavía no hay suficientes mediciones para hablar de tendencia.';
  }
  if (cintura.direccion === 'sin-datos') return peso.resumen;
  if (peso.direccion === 'sin-datos') return cintura.resumen;

  if (peso.direccion === 'estable' && cintura.direccion === 'baja') {
    return 'El peso no se mueve pero la cintura baja. Eso suele ser recomposición: ' +
      'la balanza sola no lo muestra.';
  }
  if (peso.direccion === 'baja' && cintura.direccion === 'baja') {
    return `${peso.resumen} La cintura acompaña.`;
  }
  if (peso.direccion === 'baja' && cintura.direccion === 'sube') {
    return `${peso.resumen} La cintura no acompaña: vale comentarlo en la consulta.`;
  }
  return `${peso.resumen} ${cintura.resumen}`;
}

/**
 * La serie lista para dibujar, con el promedio movil al lado del dato crudo.
 *
 * El punto crudo se guarda porque es lo que la persona anoto y desconocerlo
 * seria raro; el promedio es lo que se lee. La ventana de 3 alcanza para sacar
 * el ruido de un dia sin aplanar un mes.
 */
export function suavizada(
  medidas: Medida[],
  campo: 'pesoKg' | 'cinturaCm' = 'pesoKg',
  ventana = 3,
): { fecha: string; valor: number; media: number }[] {
  const puntos = serie(medidas, campo);
  return puntos.map((p, i) => {
    const desde = Math.max(0, i - ventana + 1);
    const trozo = puntos.slice(desde, i + 1).map((x) => x.valor);
    return { fecha: p.fecha, valor: p.valor, media: red(promedio(trozo)) };
  });
}
