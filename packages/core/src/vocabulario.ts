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

/**
 * Una correccion al diccionario del plan.
 *
 * `groupId: null` no es "no se": es "se, y no cuenta". El agua, el cafe y la
 * sal no ocupan lugar en ningun grupo, y hacer que la pantalla los marque en
 * ambar pidiendo que alguien los clasifique es pedirle trabajo para nada.
 */
export interface Excepcion {
  termino: string;
  groupId: string | null;
  /** Por que se corrige. Queda a la vista para poder discutirlo. */
  nota?: string;
}

/**
 * Lo que el diccionario del plan no puede resolver solo.
 *
 * Tres clases, y ninguna inventa nutricion:
 *
 * 1. Homonimos que la coincidencia parcial arruina. "Leche de almendras" no es
 *    leche, "dulce de leche" tampoco.
 * 2. Cosas que no ocupan lugar en ningun grupo: agua, infusiones, condimentos.
 *    Marcarlas explicitamente evita que la pantalla pida clasificarlas.
 * 3. Comida corriente de acá que el plan no nombra porque no la indica, pero
 *    que igual se come. Se les asigna el grupo que predomina, nunca una
 *    cantidad ni gramos de proteina: eso lo dice la nutricionista, no esta
 *    lista.
 *
 * Todo esto se corrige de un toque en la pantalla. Es un punto de partida
 * mejor que "sin reconocer", no una autoridad.
 */
export const EXCEPCIONES_BASE: Excepcion[] = [
  // -- no ocupan lugar en el plan --
  { termino: 'agua', groupId: null },
  { termino: 'agua con gas', groupId: null },
  { termino: 'soda', groupId: null },
  { termino: 'mate', groupId: null },
  { termino: 'mate cocido', groupId: null },
  { termino: 'te', groupId: null },
  { termino: 'cafe', groupId: null },
  { termino: 'cafe con leche', groupId: null, nota: 'La leche del café no llega a ser una porción.' },
  { termino: 'infusion', groupId: null },
  { termino: 'sal', groupId: null },
  { termino: 'pimienta', groupId: null },
  { termino: 'especias', groupId: null },
  { termino: 'condimentos', groupId: null },
  { termino: 'vinagre', groupId: null },
  { termino: 'mostaza', groupId: null },
  { termino: 'limon', groupId: null },
  { termino: 'caldo', groupId: null },
  { termino: 'edulcorante', groupId: null },

  // -- homonimos que la coincidencia parcial confunde --
  { termino: 'leche de almendras', groupId: null, nota: 'Bebida vegetal: no equivale a una porción de proteína.' },
  { termino: 'leche de coco', groupId: null, nota: 'Bebida vegetal: no equivale a una porción de proteína.' },
  { termino: 'leche de avena', groupId: null, nota: 'Bebida vegetal: no equivale a una porción de proteína.' },
  { termino: 'bebida vegetal', groupId: null, nota: 'No equivale a una porción de proteína.' },
  { termino: 'dulce de leche', groupId: null, nota: 'Es azúcar, no lácteo: no entra en ningún grupo del plan.' },

  // -- dulces y ultraprocesados: no hay grupo del plan que los represente --
  { termino: 'azucar', groupId: null, nota: 'No hay grupo del plan que lo represente. Suele ser comida del 20%.' },
  { termino: 'miel', groupId: null, nota: 'No hay grupo del plan que lo represente. Suele ser comida del 20%.' },
  { termino: 'mermelada', groupId: null, nota: 'No hay grupo del plan que lo represente. Suele ser comida del 20%.' },
  { termino: 'alfajor', groupId: null, nota: 'Suele ser parte de una comida del 20%.' },
  { termino: 'factura', groupId: null, nota: 'Suele ser parte de una comida del 20%.' },
  { termino: 'medialuna', groupId: null, nota: 'Suele ser parte de una comida del 20%.' },
  { termino: 'chocolate', groupId: null, nota: 'Suele ser parte de una comida del 20%.' },
  { termino: 'helado', groupId: null, nota: 'Suele ser parte de una comida del 20%.' },
  { termino: 'gaseosa', groupId: null, nota: 'Suele ser parte de una comida del 20%.' },
  { termino: 'cerveza', groupId: null, nota: 'Suele ser parte de una comida del 20%.' },
  { termino: 'vino', groupId: null, nota: 'Suele ser parte de una comida del 20%.' },

  // -- proteinas que el plan no enumera --
  { termino: 'ricota', groupId: 'proteinas' },
  { termino: 'merluza', groupId: 'proteinas' },
  { termino: 'salmon', groupId: 'proteinas' },
  { termino: 'pejerrey', groupId: 'proteinas' },
  { termino: 'langostinos', groupId: 'proteinas' },
  { termino: 'camarones', groupId: 'proteinas' },
  { termino: 'bondiola', groupId: 'proteinas' },
  { termino: 'matambre', groupId: 'proteinas' },
  { termino: 'asado', groupId: 'proteinas' },
  { termino: 'chorizo', groupId: 'proteinas' },
  { termino: 'morcilla', groupId: 'proteinas' },
  { termino: 'provoleta', groupId: 'proteinas' },
  { termino: 'muzzarella', groupId: 'proteinas' },
  { termino: 'milanesa', groupId: 'proteinas', nota: 'El rebozado además aporta hidrato: agregalo aparte si querés contarlo.' },
  { termino: 'lentejas', groupId: 'hidratos' },

  // -- hidratos que el plan no enumera --
  { termino: 'masa de tarta', groupId: 'hidratos' },
  { termino: 'tapa de tarta', groupId: 'hidratos' },
  { termino: 'masa de empanada', groupId: 'hidratos' },
  { termino: 'tarta', groupId: 'hidratos', nota: 'La masa es el hidrato; el relleno va aparte.' },
  { termino: 'empanada', groupId: 'hidratos', nota: 'La masa es el hidrato; el relleno va aparte.' },
  { termino: 'pizza', groupId: 'hidratos', nota: 'La masa es el hidrato; el queso va aparte.' },
  { termino: 'noquis', groupId: 'hidratos' },
  { termino: 'polenta', groupId: 'hidratos' },
  { termino: 'budin', groupId: 'hidratos' },
  { termino: 'galletitas', groupId: 'hidratos' },
  { termino: 'pan frances', groupId: 'hidratos' },
  { termino: 'locro', groupId: 'hidratos' },
  { termino: 'guiso', groupId: 'hidratos' },

  // -- vegetales y frutas que el plan no enumera --
  { termino: 'ensalada', groupId: 'vegetales' },
  { termino: 'sopa', groupId: 'vegetales' },
  { termino: 'uvas', groupId: 'frutas' },
  { termino: 'sandia', groupId: 'frutas' },
  { termino: 'melon', groupId: 'frutas' },
  { termino: 'anana', groupId: 'frutas' },
  { termino: 'mandarina', groupId: 'frutas' },
  { termino: 'ciruela', groupId: 'frutas' },
  { termino: 'arandanos', groupId: 'frutas' },
  { termino: 'higo', groupId: 'frutas' },

  // -- grasas que el plan no enumera --
  { termino: 'almendras', groupId: 'grasas' },
  { termino: 'nueces', groupId: 'grasas' },
  { termino: 'castanas', groupId: 'grasas' },
  { termino: 'avellanas', groupId: 'grasas' },
  { termino: 'aceitunas', groupId: 'grasas' },
  { termino: 'manteca', groupId: 'grasas' },
  { termino: 'mayonesa', groupId: 'grasas' },
];

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
  /**
   * `null` significa "lo conozco y no ocupa lugar en ningun grupo" —el agua, la
   * sal, el cafe—, que es distinto de que `reconocer` devuelva `null`, o sea
   * "no lo conozco". La pantalla trata los dos casos distinto: uno no pide
   * nada, el otro pide que alguien lo clasifique.
   */
  groupId: string | null;
  /** Que termino del plan lo hizo coincidir. */
  segun: string;
  ex?: ExchangeOption;
  /** 'exacta' cuando el texto es el termino; 'parcial' cuando lo contiene. */
  confianza: 'exacta' | 'parcial';
  /** Por que, cuando hay algo que aclarar. */
  nota?: string;
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

/**
 * Si `frase` aparece en `texto` como palabras enteras.
 *
 * Con `includes` a secas, "sal" entra en "queso port salut" y "mate" en
 * "tomates cherry": la app decia que la sal era proteina y el mate, vegetal.
 * Rodear de espacios alcanza porque `normalizar` ya dejo un solo espacio entre
 * palabras y saco toda la puntuacion.
 */
function contienePalabras(texto: string, frase: string): boolean {
  return ` ${texto} `.includes(` ${frase} `);
}

function palabras(clave: string): string[] {
  return clave.split(' ').filter((p) => p.length > 2 && !VACIAS.has(p));
}

/**
 * Los alimentos que enumera una nota, si es que enumera alguno.
 *
 * Las notas mezclan dos cosas: listas de alimentos ("nalga, peceto, cuadril")
 * e indicaciones ("4 cucharadas", "maximo una vez al dia"). Se quedan solo los
 * trozos cortos y sin numeros, que es lo que distingue a una de la otra.
 */
function alimentosDeNota(nota: string | undefined): string[] {
  if (!nota) return [];
  return nota
    .split(/[,;]/)
    .map((t) => t.trim())
    .filter((t) => {
      if (!t || /\d/.test(t)) return false;
      const n = normalizar(t).split(' ').length;
      return n >= 1 && n <= 3;
    });
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
    for (const ex of g.exchanges ?? []) {
      sumar(ex.label, g.id, ex);
      // Las notas suelen enumerar alimentos concretos: "Carne vacuna magra"
      // trae "nalga, peceto, cuadril, bola de lomo, lomo". Ignorarlas era
      // desperdiciar el vocabulario mas preciso que el plan tiene.
      for (const trozo of alimentosDeNota(ex.note)) sumar(trozo, g.id, ex);
    }
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

  // Las excepciones van primero: existen justamente para ganarle al
  // diccionario. Las del plan pisan a las de la app, porque quien escribio el
  // plan sabe mas que esta lista.
  const excepciones = [...(plan.excepciones ?? []), ...EXCEPCIONES_BASE];
  const exacta0 = excepciones.find((e) => normalizar(e.termino) === clave);
  if (exacta0) {
    return {
      groupId: exacta0.groupId, segun: exacta0.termino,
      confianza: 'exacta', ...(exacta0.nota ? { nota: exacta0.nota } : {}),
    };
  }
  const parcial0 = excepciones
    .filter((e) => contienePalabras(clave, normalizar(e.termino)))
    .sort((a, b) => b.termino.length - a.termino.length)[0];
  if (parcial0) {
    return {
      groupId: parcial0.groupId, segun: parcial0.termino,
      confianza: 'parcial', ...(parcial0.nota ? { nota: parcial0.nota } : {}),
    };
  }

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
      if (!contienePalabras(clave, t.clave) && !contienePalabras(t.clave, clave)) return false;
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
  /**
   * La app lo conoce y sabe que no ocupa lugar (agua, sal, café). Sin esto no
   * se distingue de un ingrediente que todavía nadie clasificó, y la pantalla
   * pediría clasificar el agua.
   */
  conocido?: boolean;
  nota?: string;
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
