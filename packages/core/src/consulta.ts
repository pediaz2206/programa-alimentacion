/**
 * El resumen que la nutricionista lee antes de una consulta.
 *
 * Hoy ese resumen se arma a mano: abrir WhatsApp, scrollear fotos, reconstruir
 * el mes. El problema no es que falten datos, es que sobran y no estan
 * ordenados por lo unico que importa en una consulta de treinta minutos: que
 * conviene preguntar primero.
 *
 * Por eso este modulo no devuelve tablas. Devuelve una lista corta de puntos de
 * atencion, cada uno con el dato que lo respalda, ordenados por cuanto cambian
 * la conversacion. Lo que no llama la atencion no aparece: un resumen donde
 * todo figura no es un resumen.
 */
import {
  comidasEsperadas, fechaLocal, librasUsadas, proteinaPromedio, slotsEsperados,
  ultimosDias, type Adherencia, type ComidaRegistrada,
} from './metricas.ts';
import { evaluarReglas, type ComidaDelDia } from './reglas.ts';
import { tendencia, type Medida } from './progreso.ts';
import type { NutritionPlan, UserConfig } from './types.ts';

/** Una comida registrada, con lo que la consulta necesita ademas de lo basico. */
export interface ComidaDeConsulta extends ComidaRegistrada {
  optionId?: string | null;
  porciones?: Record<string, string | null> | null;
  nota?: string | null;
  foto?: string | null;
}

export type Severidad = 'alta' | 'media' | 'baja';

export interface PuntoDeAtencion {
  id: string;
  severidad: Severidad;
  /** El titular, para leer de un vistazo. */
  titulo: string;
  /** El dato que lo respalda. Sin esto es una opinion. */
  detalle: string;
  /** Fechas concretas donde mirar, si las hay. */
  fechas?: string[];
}

export interface ResumenConsulta {
  desde: string;
  hasta: string;
  dias: number;
  adherencia: Adherencia;
  proteina: ReturnType<typeof proteinaPromedio>;
  libres: ReturnType<typeof librasUsadas>;
  /** Cuantas comidas del 20% entraban en el periodo, no en una semana. */
  libresPresupuesto: number;
  peso: ReturnType<typeof tendencia>;
  cintura: ReturnType<typeof tendencia>;
  puntos: PuntoDeAtencion[];
  /** Dias con desvio y nota, los mas utiles para conversar. */
  desvios: { fecha: string; slotId: string; nota: string; foto?: string | null }[];
}

const ORDEN: Record<Severidad, number> = { alta: 0, media: 1, baja: 2 };

/** Cuantos dias mira una consulta. Un mes es lo que suele separar dos. */
export const DIAS_CONSULTA = 28;

export function resumenDeConsulta(
  plan: NutritionPlan,
  config: UserConfig,
  comidas: ComidaDeConsulta[],
  medidas: Medida[],
  hasta: string,
  dias = DIAS_CONSULTA,
): ResumenConsulta {
  const rango = ultimosDias(hasta, dias);
  const delRango = new Set(rango);
  const enRango = comidas.filter((c) => delRango.has(c.fecha));
  const medidasEnRango = medidas.filter((m) => delRango.has(m.fecha));

  // Los momentos que esta persona realmente tiene: el plan puede declarar un
  // desayuno que su config apaga, y contarlo desvirtua todo lo que sigue.
  const esperadas = comidasEsperadas(plan, config, rango);
  const ad: Adherencia = {
    registradas: enRango.length,
    esperadas,
    porcentaje: esperadas === 0 ? 0 : Math.round((enRango.length / esperadas) * 100),
  };
  const prot = proteinaPromedio(plan, enRango, rango);
  const lib = librasUsadas(enRango, rango);
  const peso = tendencia(medidasEnRango, 'pesoKg');
  const cintura = tendencia(medidasEnRango, 'cinturaCm');

  const puntos: PuntoDeAtencion[] = [
    ...silencios(enRango, rango),
    ...comidasQueFaltan(plan, config, enRango, rango),
    ...proteinaBaja(plan, prot),
    ...libresAmontonadas(enRango),
    ...reglasIncumplidas(plan, enRango),
    ...cuerpoSinMovimiento(peso, cintura, ad),
  ].sort((a, b) => ORDEN[a.severidad] - ORDEN[b.severidad]);

  const desvios = enRango
    .filter((c) => c.nota && !c.esLibre && !c.optionId)
    .sort((a, b) => b.fecha.localeCompare(a.fecha))
    .map((c) => ({ fecha: c.fecha, slotId: c.slotId, nota: c.nota!, foto: c.foto ?? null }));

  return {
    desde: rango[0]!,
    hasta: rango[rango.length - 1]!,
    dias,
    adherencia: ad, proteina: prot, libres: lib, peso, cintura,
    libresPresupuesto: Math.round((plan.freeMeals?.perWeek ?? 0) * (dias / 7)),
    puntos, desvios,
  };
}

/**
 * Dias sin un solo registro.
 *
 * Es el punto que mas cambia una consulta, porque tiene dos lecturas opuestas
 * —dejo de anotar, o dejo de seguir el plan— y solo se puede resolver
 * preguntando. Por eso el titulo no elige una.
 */
function silencios(comidas: ComidaDeConsulta[], rango: string[]): PuntoDeAtencion[] {
  const conAlgo = new Set(comidas.map((c) => c.fecha));
  const vacios = rango.filter((d) => !conAlgo.has(d));
  if (vacios.length === 0) return [];

  // Una racha de silencio dice mas que dias sueltos desperdigados.
  const rachaMax = rachaDe(vacios, rango);
  const severidad: Severidad = rachaMax >= 4 ? 'alta' : vacios.length > rango.length / 3 ? 'media' : 'baja';
  return [{
    id: 'dias-sin-registro',
    severidad,
    titulo: `${vacios.length} ${vacios.length === 1 ? 'día' : 'días'} sin ningún registro`,
    detalle: rachaMax >= 2
      ? `El silencio más largo fue de ${rachaMax} días seguidos. Puede ser que dejó de anotar o que dejó de seguir el plan: son cosas distintas.`
      : 'Días sueltos, sin una racha larga.',
    fechas: vacios.slice(-6),
  }];
}

function rachaDe(vacios: string[], rango: string[]): number {
  const set = new Set(vacios);
  let mejor = 0, actual = 0;
  for (const d of rango) {
    actual = set.has(d) ? actual + 1 : 0;
    if (actual > mejor) mejor = actual;
  }
  return mejor;
}

/** La comida que se saltea sistematicamente. Casi siempre tiene una razon practica. */
function comidasQueFaltan(
  plan: NutritionPlan,
  config: UserConfig,
  comidas: ComidaDeConsulta[],
  rango: string[],
): PuntoDeAtencion[] {
  const conRegistro = new Set(comidas.map((c) => c.fecha));
  const diasActivos = rango.filter((d) => conRegistro.has(d));
  if (diasActivos.length < 3) return [];

  // Un slot solo se puede extrañar los dias en que estaba previsto.
  const previstos = new Map<string, number>();
  for (const dia of diasActivos) {
    for (const slot of slotsEsperados(plan, config, fechaLocal(dia))) {
      previstos.set(slot.id, (previstos.get(slot.id) ?? 0) + 1);
    }
  }

  const salida: PuntoDeAtencion[] = [];
  for (const slot of plan.slots) {
    const veces = previstos.get(slot.id) ?? 0;
    if (veces === 0) continue;
    const hechas = comidas.filter((c) => c.slotId === slot.id).length;
    const faltan = veces - hechas;
    // Solo cuenta si falta la mayoria de los dias en que si anoto otras cosas:
    // ahi ya no es olvido, es un habito.
    if (faltan > veces / 2) {
      salida.push({
        id: `falta-${slot.id}`,
        severidad: 'media',
        titulo: `${slot.name} falta ${faltan} de ${veces} días`,
        detalle: `En los días que sí registró otras comidas, ${slot.name.toLowerCase()} no aparece. Suele tener una razón práctica: horario, trabajo, o que no le cierra la opción.`,
      });
    }
  }
  return salida;
}

function proteinaBaja(
  plan: NutritionPlan,
  prot: ReturnType<typeof proteinaPromedio>,
): PuntoDeAtencion[] {
  const objetivo = plan.proteinTargetGrams;
  if (!objetivo || prot.diasConRegistro === 0) return [];
  const faltante = objetivo - prot.promedio;
  if (faltante < objetivo * 0.15) return [];
  return [{
    id: 'proteina-baja',
    severidad: faltante > objetivo * 0.3 ? 'alta' : 'media',
    titulo: `Proteína promedio ${Math.round(prot.promedio)} g sobre ${objetivo} g`,
    detalle: `Promedio de los ${prot.diasConRegistro} días con registro. Faltan unos ${Math.round(faltante)} g por día.`,
  }];
}

/** Las comidas del 20% amontonadas el mismo dia: el plan las quiere repartidas. */
function libresAmontonadas(comidas: ComidaDeConsulta[]): PuntoDeAtencion[] {
  const porDia = new Map<string, number>();
  for (const c of comidas) {
    if (c.esLibre) porDia.set(c.fecha, (porDia.get(c.fecha) ?? 0) + 1);
  }
  const juntas = [...porDia.entries()].filter(([, n]) => n >= 2);
  if (juntas.length === 0) return [];
  return [{
    id: 'libres-amontonadas',
    severidad: 'baja',
    titulo: `${juntas.length} ${juntas.length === 1 ? 'día' : 'días'} con más de una comida del 20%`,
    detalle: 'El plan pide repartirlas en la semana.',
    fechas: juntas.map(([f]) => f),
  }];
}

/**
 * Las reglas del plan que mas se incumplieron.
 *
 * Esto solo es posible porque las reglas dejaron de ser texto: se evalua cada
 * comida contra lo que la persona ya habia comido ese dia.
 */
function reglasIncumplidas(plan: NutritionPlan, comidas: ComidaDeConsulta[]): PuntoDeAtencion[] {
  if (!plan.reglas || plan.reglas.length === 0) return [];

  const porFecha = new Map<string, ComidaDelDia[]>();
  for (const c of comidas) {
    const lista = porFecha.get(c.fecha) ?? [];
    lista.push({ slotId: c.slotId, optionId: c.optionId ?? null, porciones: c.porciones ?? null, esLibre: c.esLibre });
    porFecha.set(c.fecha, lista);
  }

  const cuenta = new Map<string, { veces: number; texto: string; fechas: string[] }>();
  for (const [fecha, delDia] of porFecha) {
    for (const comida of delDia) {
      const { cerrados } = evaluarReglas(plan, delDia, comida.slotId);
      for (const c of cerrados) {
        // Se incumplio si el grupo estaba cerrado y la comida igual lo trajo.
        const grupos = comida.porciones
          ? new Set(Object.entries(comida.porciones).filter(([, v]) => v != null).map(([g]) => g))
          : null;
        if (!grupos?.has(c.groupId)) continue;
        const previo = cuenta.get(c.reglaId) ?? { veces: 0, texto: c.texto, fechas: [] };
        previo.veces += 1;
        if (!previo.fechas.includes(fecha)) previo.fechas.push(fecha);
        cuenta.set(c.reglaId, previo);
      }
    }
  }

  return [...cuenta.entries()]
    .filter(([, v]) => v.veces >= 2)
    .sort((a, b) => b[1].veces - a[1].veces)
    .map(([id, v]) => ({
      id: `regla-${id}`,
      severidad: 'media' as Severidad,
      titulo: `Se repitió ${v.veces} veces: ${v.texto}`,
      detalle: 'Puede ser que la indicación no esté clara, o que sea difícil de sostener en la práctica.',
      fechas: v.fechas.slice(-6),
    }));
}

/** El caso que hace abandonar: hace un mes que se esfuerza y la balanza no se mueve. */
function cuerpoSinMovimiento(
  peso: ReturnType<typeof tendencia>,
  cintura: ReturnType<typeof tendencia>,
  ad: Adherencia,
): PuntoDeAtencion[] {
  if (peso.direccion === 'estable' && cintura.direccion === 'baja') {
    return [{
      id: 'recomposicion',
      severidad: 'baja',
      titulo: 'Peso estable con cintura en baja',
      detalle: 'Vale nombrarlo en la consulta: mirando solo la balanza parece que no pasa nada.',
    }];
  }
  if (peso.direccion === 'estable' && cintura.direccion === 'estable' && peso.mediciones >= 4) {
    // Con adherencia floja, el plan no llego a probarse: decir "revisar el
    // plan" seria sacar una conclusion que estos datos no sostienen.
    const seSiguio = ad.porcentaje >= 70;
    return [{
      id: 'sin-cambios',
      severidad: 'media',
      titulo: 'Ni peso ni cintura se movieron en el período',
      detalle: seSiguio
        ? `${peso.mediciones} mediciones sin cambio con ${ad.porcentaje}% de adherencia. El plan se siguió y no movió la aguja.`
        : `${peso.mediciones} mediciones sin cambio, pero con ${ad.porcentaje}% de adherencia el plan no llegó a probarse.`,
    }];
  }
  return [];
}
