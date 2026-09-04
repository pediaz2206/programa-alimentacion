import type { Session } from '@supabase/supabase-js';
import {
  adherencia, comidasEsperadas, librasUsadas, proteinaPromedio, racha,
  resumenDeConsulta, ultimosDias, DIAS_CONSULTA,
  type ComidaDeConsulta, type Medida, type NutritionPlan, type ResumenConsulta,
  type UserConfig,
} from '@pa/core';
import { supabase } from './supabase.ts';
import { fechaISO } from './registro.ts';

/**
 * Lo que ve la nutricionista. Es una vista distinta, no la del paciente con
 * mas datos: ella no sigue el plan, lo supervisa.
 */

export interface Paciente {
  vinculoId: string;
  id: string;
  nombre: string;
  email: string;
  foto: string | null;
  plan: NutritionPlan | null;
  /** La config del paciente: sin ella no se sabe que comidas tiene de verdad. */
  config: UserConfig | null;
  registros: ComidaDeConsulta[];
  medidas: Medida[];
}

export interface Metricas {
  adherencia: ReturnType<typeof adherencia>;
  racha: number;
  proteina: ReturnType<typeof proteinaPromedio>;
  libres: ReturnType<typeof librasUsadas>;
  dias: string[];
}

const DIAS_VENTANA = DIAS_CONSULTA;

export async function misPacientes(sesion: Session | null): Promise<Paciente[]> {
  if (!supabase || !sesion) return [];

  const { data: vinculos, error } = await supabase
    .from('care_relationships')
    .select('id, patient_id, patient_email, profiles!care_relationships_patient_id_fkey(display_name, email, avatar_url)')
    .eq('professional_id', sesion.user.id)
    .eq('status', 'active')
    .not('patient_id', 'is', null);
  if (error) throw error;

  const ids = (vinculos ?? []).map((v) => v['patient_id'] as string);
  if (ids.length === 0) return [];

  const desde = ultimosDias(fechaISO(), DIAS_VENTANA)[0]!;
  // Dos consultas para todos, no dos por paciente: una lista de veinte
  // pacientes no puede disparar cuarenta viajes al servidor.
  const [{ data: logs }, { data: planes }, { data: configs }, { data: medidas }] = await Promise.all([
    supabase.from('meal_logs')
      .select('patient_id, local_date, slot_id, option_id, portions, protein_grams, is_free_meal, note, photo_path')
      .in('patient_id', ids).gte('local_date', desde),
    supabase.from('plans')
      .select('patient_id, plan_versions(version, doc)')
      .in('patient_id', ids).eq('is_active', true),
    supabase.from('configs').select('patient_id, doc').in('patient_id', ids),
    supabase.from('body_measurements')
      .select('patient_id, local_date, weight_kg, waist_cm')
      .in('patient_id', ids).gte('local_date', desde),
  ]);

  const planPorPaciente = new Map<string, NutritionPlan>();
  for (const p of planes ?? []) {
    const versiones = (p['plan_versions'] ?? []) as Array<{ version: number; doc: NutritionPlan }>;
    const ultima = versiones.sort((a, b) => b.version - a.version)[0];
    if (ultima) planPorPaciente.set(p['patient_id'] as string, ultima.doc);
  }

  const configPorPaciente = new Map<string, UserConfig>();
  for (const c of configs ?? []) configPorPaciente.set(c['patient_id'] as string, c['doc'] as UserConfig);

  const logsPorPaciente = new Map<string, ComidaDeConsulta[]>();
  for (const l of logs ?? []) {
    const uid = l['patient_id'] as string;
    const lista = logsPorPaciente.get(uid) ?? [];
    lista.push({
      fecha: l['local_date'] as string,
      slotId: l['slot_id'] as string,
      optionId: (l['option_id'] as string | null) ?? null,
      porciones: (l['portions'] as Record<string, string | null> | null) ?? null,
      proteinGrams: l['protein_grams'] as number | null,
      esLibre: Boolean(l['is_free_meal']),
      nota: (l['note'] as string | null) ?? null,
      // La ruta, no una URL firmada: firmar cien fotos que quiza nadie abra
      // es caro. Se firma al desplegar el dia.
      foto: (l['photo_path'] as string | null) ?? null,
    });
    logsPorPaciente.set(uid, lista);
  }

  const medidasPorPaciente = new Map<string, Medida[]>();
  for (const m of medidas ?? []) {
    const uid = m['patient_id'] as string;
    const lista = medidasPorPaciente.get(uid) ?? [];
    lista.push({
      fecha: m['local_date'] as string,
      pesoKg: m['weight_kg'] != null ? Number(m['weight_kg']) : null,
      cinturaCm: m['waist_cm'] != null ? Number(m['waist_cm']) : null,
    });
    medidasPorPaciente.set(uid, lista);
  }

  return (vinculos ?? []).map((v) => {
    const id = v['patient_id'] as string;
    const email = v['patient_email'] as string;
    return {
      vinculoId: v['id'] as string,
      id,
      nombre: nombreDe(v['profiles']) ?? email,
      email,
      foto: fotoDe(v['profiles']),
      plan: planPorPaciente.get(id) ?? null,
      config: configPorPaciente.get(id) ?? null,
      registros: logsPorPaciente.get(id) ?? [],
      medidas: medidasPorPaciente.get(id) ?? [],
    };
  });
}

export function metricasDe(paciente: Paciente, dias = 7): Metricas | null {
  if (!paciente.plan) return null;
  const hoy = fechaISO();
  const rango = ultimosDias(hoy, dias);
  // Antes se contaban los slots del plan. Quien hace ayuno sin desayuno tiene
  // el slot declarado y apagado: contarlo le hunde la adherencia a un techo
  // que no puede superar por mas que registre todo.
  const esperadas = paciente.config
    ? comidasEsperadas(paciente.plan, paciente.config, rango)
    : paciente.plan.slots.filter((s) => !s.isSnack).length * rango.length;
  return {
    adherencia: {
      registradas: paciente.registros.filter((r) => rango.includes(r.fecha)).length,
      esperadas,
      porcentaje: esperadas === 0 ? 0
        : Math.round((paciente.registros.filter((r) => rango.includes(r.fecha)).length / esperadas) * 100),
    },
    racha: racha(paciente.registros, hoy),
    proteina: proteinaPromedio(paciente.plan, paciente.registros, rango),
    libres: librasUsadas(paciente.registros, rango),
    dias: rango,
  };
}

/** El resumen para leer antes de la consulta. Necesita plan y config. */
export function consultaDe(paciente: Paciente): ResumenConsulta | null {
  if (!paciente.plan || !paciente.config) return null;
  return resumenDeConsulta(
    paciente.plan, paciente.config, paciente.registros, paciente.medidas, fechaISO(),
  );
}

/** Los planes que la profesional puede copiar: el suyo y el de sus pacientes. */
export async function planesParaCopiar(
  sesion: Session | null,
  pacientes: Paciente[],
): Promise<Array<{ etiqueta: string; plan: NutritionPlan }>> {
  const salida: Array<{ etiqueta: string; plan: NutritionPlan }> = [];
  if (supabase && sesion) {
    const { data } = await supabase
      .from('plans').select('plan_versions(version, doc)')
      .eq('patient_id', sesion.user.id).eq('is_active', true).limit(1).maybeSingle();
    const versiones = (data?.['plan_versions'] ?? []) as Array<{ version: number; doc: NutritionPlan }>;
    const propio = versiones.sort((a, b) => b.version - a.version)[0];
    if (propio) salida.push({ etiqueta: 'Mi plan', plan: propio.doc });
  }
  for (const p of pacientes) {
    if (p.plan) salida.push({ etiqueta: `Plan de ${p.nombre}`, plan: p.plan });
  }
  return salida;
}

/**
 * Publica una version nueva del plan. Las versiones no se editan: una version
 * publicada es el registro de que se indico y cuando, y los registros de
 * comidas apuntan a la que regia ese dia.
 */
export async function publicarVersion(
  sesion: Session | null,
  pacienteId: string,
  plan: NutritionPlan,
  nota: string,
): Promise<void> {
  if (!supabase || !sesion) throw new Error('Hace falta iniciar sesión.');

  const { data: fila, error: e1 } = await supabase
    .from('plans').select('id, plan_versions(version)')
    .eq('patient_id', pacienteId).eq('is_active', true).limit(1).maybeSingle();
  if (e1) throw e1;

  // Si todavia no tiene plan, se crea: asignarle uno no puede depender de que
  // antes haya entrado a la app y se le haya sembrado algo.
  let planId = fila?.['id'] as string | undefined;
  let siguiente = 1;
  if (fila) {
    const versiones = (fila['plan_versions'] ?? []) as Array<{ version: number }>;
    siguiente = Math.max(0, ...versiones.map((v) => v.version)) + 1;
  } else {
    const { data: nuevo, error: e2 } = await supabase
      .from('plans')
      .insert({ patient_id: pacienteId, author_id: sesion.user.id, name: plan.name, source: plan.source })
      .select('id').single();
    if (e2) throw e2;
    planId = nuevo.id as string;
  }

  const { error } = await supabase.from('plan_versions').insert({
    plan_id: planId,
    version: siguiente,
    doc: plan,
    author_id: sesion.user.id,
    change_note: nota || null,
  });
  if (error) throw error;
}

function nombreDe(perfil: unknown): string | null {
  if (Array.isArray(perfil)) return nombreDe(perfil[0]);
  if (!perfil || typeof perfil !== 'object') return null;
  const p = perfil as { display_name?: unknown };
  return typeof p.display_name === 'string' && p.display_name ? p.display_name : null;
}

function fotoDe(perfil: unknown): string | null {
  if (Array.isArray(perfil)) return fotoDe(perfil[0]);
  if (!perfil || typeof perfil !== 'object') return null;
  const url = (perfil as { avatar_url?: unknown }).avatar_url;
  return typeof url === 'string' && url ? url : null;
}
