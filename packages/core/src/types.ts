/**
 * Modelo de dominio del asistente.
 *
 * La idea: el PDF de la nutricionista se transcribe UNA vez a un `NutritionPlan`,
 * el usuario ajusta horarios en un `UserConfig`, y el motor deriva todo lo demas.
 */

/** Minutos desde medianoche, 0..1439. */
export type MinuteOfDay = number;

/** Hora en formato "HH:MM" (24h). */
export type TimeString = string;

/** 0 = domingo ... 6 = sabado (igual que Date#getDay). */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** Fraccion del plato por grupo de alimento. Las fracciones suman 1. */
export type PlateTarget = Record<string, number>;

/** Porciones por grupo de alimento. */
export type Portions = Record<string, number>;

/**
 * Una equivalencia dentro de un grupo: las opciones intercambiables entre si.
 * "70 g de arroz" y "120 g de papa" son el mismo hidrato a los ojos del plan.
 */
export interface ExchangeOption {
  label: string;
  qty?: number;
  unit?: string;
  note?: string;
  /** Proteina que aporta, en gramos. Solo tiene sentido en el grupo proteinas. */
  proteinGrams?: number;
  /** Momentos donde aplica esta equivalencia. Si se omite, todos. */
  slotIds?: string[];
}

/** Un componente exigido por la formula de una comida. */
export interface ComponentSpec {
  groupId: string;
  /** Como lo expresa el plan: "1 opcion", "1/3 del plato", "1 fruta". */
  cantidad: string;
}

export interface FoodGroup {
  id: string;
  name: string;
  /** Como lo nombra el PDF, para poder mapear al transcribir. */
  aliases?: string[];
  /** Alimentos de ejemplo del grupo. */
  examples: string[];
  notes?: string;
  /** Opciones intercambiables del grupo, con sus cantidades. */
  exchanges?: ExchangeOption[];
}

export interface Ingredient {
  item: string;
  qty?: number;
  /** "g", "ml", "unidad", "taza", "cda"... */
  unit?: string;
  /** A que grupo de alimentos pertenece. */
  groupId?: string;
  optional?: boolean;
  note?: string;
  /** Sal, aceite, especias: se asumen en la alacena y no van a la lista de compras. */
  staple?: boolean;
}

/** Una sugerencia concreta de comida o colacion, tal como figura en el PDF. */
export interface MealOption {
  id: string;
  name: string;
  /** En que momentos del dia aplica. */
  slotIds: string[];
  ingredients: Ingredient[];
  /** Cuantas porciones de cada grupo aporta. Alimenta el balance diario. */
  portions?: Portions;
  /** "rapido", "vegetariano", "sin lactosa", "alto en proteina"... */
  tags?: string[];
  prepMinutes?: number;
  notes?: string;
  /** Proteina que aporta la opcion completa, en gramos. */
  proteinGrams?: number;
}

export interface MealSlot {
  id: string;
  name: string;
  defaultTime: TimeString;
  /** Minutos antes para el aviso de "chequea si tenes todo". */
  prepLeadMinutes?: number;
  /** Reparto del plato especifico de este momento (almuerzo y cena lo usan). */
  plateTarget?: PlateTarget;
  /** Usa `plateDefault` del plan cuando no define un `plateTarget` propio. */
  usesPlateMethod?: boolean;
  isSnack?: boolean;
  /**
   * Como se arma la comida: los componentes que hay que elegir.
   * Es la forma real de los planes por intercambios, donde el plan no dicta
   * platos cerrados sino una combinacion ("1 hidrato + 1 proteina + 1/3 de
   * vegetales") que se completa eligiendo de las listas de equivalencias.
   */
  formula?: ComponentSpec[];
  notes?: string;
}

export interface NutritionPlan {
  id: string;
  name: string;
  /** De donde salio: "PDF nutricionista - agosto 2026". */
  source?: string;
  foodGroups: FoodGroup[];
  slots: MealSlot[];
  options: MealOption[];
  /** Porciones objetivo por grupo para el dia completo. */
  dailyTargets?: Portions;
  /** Reparto del plato por defecto, si el slot no define uno. */
  plateDefault?: PlateTarget;
  /** Notas generales del plan que conviene tener a mano. */
  guidelines?: string[];
  /** Objetivo diario de proteina en gramos, si el plan lo fija asi. */
  proteinTargetGrams?: number;
}

export interface SlotConfig {
  slotId: string;
  enabled?: boolean;
  /** Pisa `defaultTime` del plan. */
  time?: TimeString;
  /** Dias en que aplica. Si se omite, todos. */
  weekdays?: Weekday[];
  prepLeadMinutes?: number;
}

export interface FastingConfig {
  enabled: boolean;
  /** "16:8", "18:6", "20:4", "OMAD", "custom". Informativo. */
  protocol?: string;
  /** Hora en que se abre la ventana de alimentacion. */
  eatingWindowStart: TimeString;
  /** Duracion de la ventana en horas. El cierre se deriva. */
  eatingWindowHours: number;
  /** Avisar N minutos antes de que cierre la ventana. */
  closingWarningMinutes?: number;
}

export interface UserConfig {
  planId: string;
  slots: SlotConfig[];
  fasting?: FastingConfig;
  /** Lead por defecto para el aviso de ingredientes. */
  defaultPrepLeadMinutes: number;
  /** Tags a evitar: "cerdo", "lactosa", "picante". */
  excludeTags?: string[];
  /** Cuantas opciones ofrecer por comida. */
  optionsPerSuggestion: number;
}

export type EventKind =
  | 'prep-check'
  | 'meal'
  | 'fast-start'
  | 'fast-closing'
  | 'fast-end';

export interface ScheduledEvent {
  kind: EventKind;
  time: TimeString;
  minutes: MinuteOfDay;
  title: string;
  body: string;
  slotId?: string;
  /** Opciones sugeridas para este momento (solo en 'meal' y 'prep-check'). */
  suggestions?: MealOption[];
  /** Ingredientes a verificar antes de cocinar. */
  checklist?: Ingredient[];
  /** Conflictos detectados: comida fuera de la ventana de ayuno, etc. */
  warnings?: string[];
}

export interface GroupBalance {
  groupId: string;
  groupName: string;
  target: number;
  consumed: number;
  remaining: number;
}

export interface ProteinBalance {
  target: number;
  consumed: number;
  remaining: number;
}

export interface DailyBalance {
  groups: GroupBalance[];
  /** Presente solo si el plan fija un objetivo proteico en gramos. */
  protein?: ProteinBalance;
  /** Texto listo para mostrar: que falta cubrir en lo que queda del dia. */
  advice: string[];
}

export interface ShoppingItem {
  item: string;
  qty?: number;
  unit?: string;
  groupId?: string;
  /** En que comidas aparece. */
  usedIn: string[];
  /** Cantidad no sumable porque las unidades no coinciden. */
  mixedUnits?: boolean;
}
