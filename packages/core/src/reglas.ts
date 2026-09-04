/**
 * Las reglas del plan, vivas.
 *
 * El PDF de la nutricionista no es solo una lista de comidas: es una lista de
 * comidas MAS un puñado de reglas que las conectan entre si. "Si el almuerzo
 * predomino el carbohidrato, en la cena evitar agregarlo" no se puede contestar
 * mirando la cena sola; hay que saber que paso al mediodia.
 *
 * Este modulo es lo que convierte esas reglas de texto que se lee en criterio
 * que la app aplica. No inventa ninguna: interpreta las que el plan declara en
 * `reglas`, y devuelve siempre el motivo concreto junto con la redaccion
 * original, porque un aviso sin motivo se siente un reto y con motivo se siente
 * la nutricionista.
 */
import type { MealOption, NutritionPlan } from './types.ts';

/** Una comida registrada, en lo minimo que estas reglas necesitan saber. */
export interface ComidaDelDia {
  slotId: string;
  optionId?: string | null;
  /** Que grupo se cubrio con que equivalencia, cuando no fue una opcion del plan. */
  porciones?: Record<string, string | null> | null;
  esLibre?: boolean;
}

/** Un grupo que esta comida no deberia incluir, y por que. */
export interface GrupoCerrado {
  groupId: string;
  reglaId: string;
  /** Lo que paso hoy que cerro el grupo: "Almorzaste hidratos". */
  motivo: string;
  /** La regla, tal como la escribio la nutricionista. */
  texto: string;
}

/** Algo que el dia todavia debe cubrir. */
export interface GrupoPendiente {
  groupId: string;
  faltan: number;
  reglaId: string;
  motivo: string;
  texto: string;
}

export interface AvisoRegla {
  reglaId: string;
  motivo: string;
  texto: string;
}

export interface Evaluacion {
  cerrados: GrupoCerrado[];
  pendientes: GrupoPendiente[];
  avisos: AvisoRegla[];
}

/**
 * Que grupos aporto una comida ya registrada.
 *
 * Devuelve `null` cuando no se puede saber —una comida libre sin detalle— y esa
 * diferencia importa: no saber no es lo mismo que saber que no hubo. Una regla
 * que se dispara sobre una suposicion es peor que una regla que se calla.
 */
export function gruposComidos(plan: NutritionPlan, comida: ComidaDelDia): Set<string> | null {
  if (comida.porciones) {
    const grupos = Object.entries(comida.porciones)
      .filter(([, elegido]) => elegido != null)
      .map(([groupId]) => groupId);
    return new Set(grupos);
  }
  if (comida.optionId) {
    const opcion = plan.options.find((o) => o.id === comida.optionId);
    if (opcion) return gruposDeOpcion(opcion);
  }
  return null;
}

/** Los grupos que aporta una opcion del plan, segun sus ingredientes. */
export function gruposDeOpcion(opcion: MealOption): Set<string> {
  const grupos = new Set<string>();
  if (opcion.portions) for (const groupId of Object.keys(opcion.portions)) grupos.add(groupId);
  for (const i of opcion.ingredients) {
    // La sal, el aceite y las especias no definen de que es una comida.
    if (i.groupId && !i.staple) grupos.add(i.groupId);
  }
  return grupos;
}

function nombreSlot(plan: NutritionPlan, slotId: string): string {
  return plan.slots.find((s) => s.id === slotId)?.name ?? slotId;
}

function nombreGrupo(plan: NutritionPlan, groupId: string): string {
  return plan.foodGroups.find((g) => g.id === groupId)?.name ?? groupId;
}

/**
 * Evalua las reglas del plan para la comida que viene.
 *
 * `comidas` son las de hoy, ya registradas. `slotId` es el momento que se esta
 * por resolver: las reglas se contestan siempre respecto de una comida
 * concreta, no en el aire.
 */
export function evaluarReglas(
  plan: NutritionPlan,
  comidas: ComidaDelDia[],
  slotId: string,
  /**
   * Cuantas comidas quedan hoy, contando esta. Un minimo diario solo se avisa
   * cuando el dia se pone ajustado: decir "te faltan 2 frutas" en el desayuno
   * es ruido, porque todavia no empezo nada. Sin este dato, se avisa siempre.
   */
  restantes?: number,
): Evaluacion {
  const cerrados: GrupoCerrado[] = [];
  const pendientes: GrupoPendiente[] = [];
  const avisos: AvisoRegla[] = [];

  // Los grupos de cada comida de hoy, resueltos una sola vez.
  const previas = comidas
    .filter((c) => c.slotId !== slotId)
    .map((c) => ({ comida: c, grupos: gruposComidos(plan, c) }));

  for (const regla of plan.reglas ?? []) {
    switch (regla.tipo) {
      case 'una-vez-al-dia': {
        const donde = previas.find((p) => p.grupos?.has(regla.groupId));
        if (donde) {
          cerrados.push({
            groupId: regla.groupId,
            reglaId: regla.id,
            motivo: `Ya usaste ${nombreGrupo(plan, regla.groupId).toLowerCase()} en ${nombreSlot(plan, donde.comida.slotId).toLowerCase()}.`,
            texto: regla.texto,
          });
        }
        break;
      }

      case 'no-repetir-en': {
        if (slotId !== regla.entonces) break;
        const origen = previas.find((p) => p.comida.slotId === regla.siEn);
        if (origen?.grupos?.has(regla.groupId)) {
          cerrados.push({
            groupId: regla.groupId,
            reglaId: regla.id,
            motivo: `${nombreSlot(plan, regla.siEn)} ya trajo ${nombreGrupo(plan, regla.groupId).toLowerCase()}.`,
            texto: regla.texto,
          });
        }
        break;
      }

      case 'minimo-diario': {
        const veces = previas.filter((p) => p.grupos?.has(regla.groupId)).length;
        const faltan = regla.minimo - veces;
        // Ajustado = ya no sobran oportunidades: hace falta una en (casi) cada
        // comida que queda. Antes de eso, callarse.
        if (faltan > 0 && (restantes === undefined || faltan >= restantes)) {
          pendientes.push({
            groupId: regla.groupId,
            faltan,
            reglaId: regla.id,
            motivo: veces === 0
              ? `Todavía no comiste ${nombreGrupo(plan, regla.groupId).toLowerCase()} hoy.`
              : `Llevás ${veces} de ${regla.minimo}.`,
            texto: regla.texto,
          });
        }
        break;
      }

      case 'libres-espaciadas': {
        const yaHubo = comidas.filter((c) => c.esLibre && c.slotId !== slotId).length;
        if (yaHubo > 0) {
          avisos.push({
            reglaId: regla.id,
            motivo: yaHubo === 1
              ? 'Hoy ya registraste una comida del 20%.'
              : `Hoy ya registraste ${yaHubo} comidas del 20%.`,
            texto: regla.texto,
          });
        }
        break;
      }
    }
  }

  return { cerrados, pendientes, avisos };
}

/** Si esta opcion respeta los grupos que quedaron cerrados. */
export function respeta(opcion: MealOption, cerrados: GrupoCerrado[]): boolean {
  if (cerrados.length === 0) return true;
  const grupos = gruposDeOpcion(opcion);
  return !cerrados.some((c) => grupos.has(c.groupId));
}

/**
 * Una frase para la pantalla, ya redactada.
 *
 * Junta el motivo (lo que paso hoy) con la consecuencia (que hacer ahora). El
 * texto de la regla va aparte, para poder mostrarlo como la cita que es.
 */
export function frase(plan: NutritionPlan, cerrado: GrupoCerrado): string {
  return `${cerrado.motivo} Esta comida va sin ${nombreGrupo(plan, cerrado.groupId).toLowerCase()}.`;
}
