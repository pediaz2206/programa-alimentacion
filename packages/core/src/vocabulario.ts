/**
 * Reconocer de que grupo es un alimento que alguien escribio.
 *
 * "Comi tarta de verdura" es como la gente piensa la comida. El plan, en
 * cambio, razona por grupos. Este modulo traduce entre las dos cosas usando
 * como diccionario el propio plan —sus ejemplos, sus equivalencias y los
 * ingredientes de sus opciones—, no una base de datos externa: lo que la
 * nutricionista nombro es exactamente lo que la app sabe.
 *
 * Nunca decide solo. Devuelve una propuesta con su confianza, y la pantalla
 * deja cambiarla de un toque. Un grupo mal adivinado en silencio ensuciaria el
 * historial que ella lee, que es lo unico que esta app no se puede permitir.
 */
import type { ExchangeOption, NutritionPlan } from './types.ts';

export interface Termino {
  /** Como aparece en el plan. */
  texto: string;
  /** Normalizado: minusculas, sin acentos. */
  clave: string;
  groupId: string;
  /** La equivalencia, si el termino vino de la tabla de intercambios. */
  ex?: ExchangeOption;
}

export interface Reconocido {
  groupId: string;
  /** Que termino del plan lo hizo coincidir. */
  segun: string;
  ex?: ExchangeOption;
  /** 'exacta' cuando el texto es el termino; 'parcial' cuando lo contiene. */
  confianza: 'exacta' | 'parcial';
}

/** Sin acentos, sin mayusculas, sin puntuacion ni espacios de mas. */
export function normalizar(texto: string): string {
  return texto
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9ñ ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Palabras que no distinguen un alimento de otro.
 *
 * Sin esto "pan integral" y "harina integral" comparten una palabra y cualquier
 * coincidencia por palabra suelta las confunde.
 */
const VACIAS = new Set([
  'de', 'del', 'la', 'el', 'los', 'las', 'con', 'sin', 'y', 'o', 'a', 'al',
  'integral', 'integrales', 'natural', 'naturales', 'magra', 'magro', 'fresco',
  'fresca', 'bajo', 'baja', 'en', 'grasas', 'varias', 'variadas', 'para',
  'otra', 'otro', 'u', 'un', 'una', 'rallada', 'cocidos', 'cocidas', 'crudo',
  'cruda', 'polvo', 'instantanea', 'molde', 'lactal', 'blanco', 'morado',
]);

function palabras(clave: string): string[] {
  return clave.split(' ').filter((p) => p.length > 2 && !VACIAS.has(p));
}

/** El diccionario que el plan define, sin repetidos. */
export function vocabularioDe(plan: NutritionPlan): Termino[] {
  const porClave = new Map<string, Termino>();

  const sumar = (texto: string, groupId: string, ex?: ExchangeOption) => {
    const clave = normalizar(texto);
    if (!clave) return;
    // El primero gana: las equivalencias se cargan antes que los ingredientes
    // sueltos, y son la fuente mas precisa porque traen cantidad y proteina.
    if (!porClave.has(clave)) porClave.set(clave, { texto, clave, groupId, ...(ex ? { ex } : {}) });
  };

  for (const g of plan.foodGroups) {
    for (const ex of g.exchanges ?? []) sumar(ex.label, g.id, ex);
  }
  for (const g of plan.foodGroups) {
    for (const e of g.examples ?? []) sumar(e, g.id);
  }
  for (const o of plan.options) {
    for (const i of o.ingredients) {
      if (i.groupId && !i.staple) sumar(i.item, i.groupId);
    }
  }
  return [...porClave.values()];
}

/**
 * A que grupo pertenece lo que alguien escribio.
 *
 * Tres pasadas, de mas a menos segura. Se corta en la primera que da, para que
 * una coincidencia exacta nunca pierda contra una parcial mas larga.
 */
export function reconocer(plan: NutritionPlan, texto: string): Reconocido | null {
  const clave = normalizar(texto);
  if (!clave) return null;
  const vocabulario = vocabularioDe(plan);

  const exacta = vocabulario.find((t) => t.clave === clave);
  if (exacta) {
    return { groupId: exacta.groupId, segun: exacta.texto, ...(exacta.ex ? { ex: exacta.ex } : {}), confianza: 'exacta' };
  }

  // "queso port salut" contiene "queso"; "pan integral de molde" contiene "pan
  // integral". Gana el termino mas largo, que es el mas especifico.
  //
  // Lo que justifica la coincidencia es el texto mas corto de los dos, y si ese
  // no tiene ninguna palabra que distinga un alimento de otro, no justifica
  // nada: "integral" esta dentro de "cereales integrales" y de "pan integral",
  // que ni siquiera son el mismo alimento.
  const contenidas = vocabulario
    .filter((t) => {
      if (!clave.includes(t.clave) && !t.clave.includes(clave)) return false;
      const corta = t.clave.length <= clave.length ? t.clave : clave;
      return palabras(corta).length > 0;
    })
    .sort((a, b) => b.clave.length - a.clave.length);
  const contenida = contenidas[0];
  if (contenida) {
    return { groupId: contenida.groupId, segun: contenida.texto, ...(contenida.ex ? { ex: contenida.ex } : {}), confianza: 'parcial' };
  }

  // Ultima chance: una palabra significativa en comun ("morron rojo" -> "Morron").
  const mias = new Set(palabras(clave));
  if (mias.size === 0) return null;
  const porPalabra = vocabulario
    .map((t) => ({ t, comunes: palabras(t.clave).filter((p) => mias.has(p)).length }))
    .filter((x) => x.comunes > 0)
    .sort((a, b) => b.comunes - a.comunes || b.t.clave.length - a.t.clave.length)[0];
  if (!porPalabra) return null;
  return {
    groupId: porPalabra.t.groupId,
    segun: porPalabra.t.texto,
    ...(porPalabra.t.ex ? { ex: porPalabra.t.ex } : {}),
    confianza: 'parcial',
  };
}

/** Un ingrediente de un plato descrito a mano. */
export interface IngredienteSuelto {
  texto: string;
  /** Puede venir del reconocimiento o corregido a mano. Null = no cuenta. */
  groupId: string | null;
  ex?: ExchangeOption;
}

/**
 * De una lista de ingredientes al mapa de porciones que usa el resto de la app.
 *
 * Es la traduccion que hace que describir un plato valga lo mismo que elegir de
 * la tabla: las reglas, el resumen de consulta y la proteina del dia leen todos
 * el mismo mapa, sin importar por donde entro el dato.
 */
export function porcionesDe(ingredientes: IngredienteSuelto[]): Record<string, string | null> {
  const salida: Record<string, string | null> = {};
  for (const i of ingredientes) {
    if (!i.groupId) continue;
    // Si dos ingredientes caen en el mismo grupo, se listan juntos: la tarta
    // lleva espinaca Y cebolla, y borrar una seria perder la mitad del plato.
    const previo = salida[i.groupId];
    salida[i.groupId] = previo ? `${previo}, ${i.texto}` : i.texto;
  }
  return salida;
}

/** La proteina que aportan los ingredientes reconocidos como equivalencias. */
export function proteinaDe(ingredientes: IngredienteSuelto[]): number {
  return ingredientes.reduce((total, i) => total + (i.groupId ? i.ex?.proteinGrams ?? 0 : 0), 0);
}
