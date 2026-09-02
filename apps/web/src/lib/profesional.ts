import type { Session } from '@supabase/supabase-js';
import {
  adherencia, librasUsadas, proteinaPromedio, racha, ultimosDias,
  type ComidaRegistrada, type NutritionPlan,
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
  plan: NutritionPlan | null;
  registros: ComidaRegistrada[];
}

export interface Metricas {
  adherencia: ReturnType<typeof adherencia>;
  racha: number;
  proteina: ReturnType<typeof proteinaPromedio>;
  libres: ReturnType<typeof librasUsadas>;
  dias: string[];
}

const DIAS_VENTANA = 7;

export async function misPacientes(sesion: Session | null): Promise<Paciente[]> {
  if (!supabase || !sesion) return [];

  const { data: vinculos, error } = await supabase
    .from('care_relationships')
    .select('id, patient_id, patient_email, profiles!care_relationships_patient_id_fkey(display_name)')
    .eq('professional_id', sesion.user.id)
    .eq('status', 'active')
    .not('patient_id', 'is', null);
  if (error) throw error;

  const ids = (vinculos ?? []).map((v) => v['patient_id'] as string);
  if (ids.length === 0) return [];

  const desde = ultimosDias(fechaISO(), DIAS_VENTANA)[0]!;
  // Dos consultas para todos, no dos por paciente: una lista de veinte
  // pacientes no puede disparar cuarenta viajes al servidor.
  const [{ data: logs }, { data: planes }] = await Promise.all([
    supabase.from('meal_logs')
      .select('patient_id, local_date, slot_id, protein_grams, is_free_meal')
      .in('patient_id', ids).gte('local_date', desde),
    supabase.from('plans')
      .select('patient_id, plan_versions(version, doc)')
      .in('patient_id', ids).eq('is_active', true),
  ]);

  const planPorPaciente = new Map<string, NutritionPlan>();
  for (const p of planes ?? []) {
    const versiones = (p['plan_versions'] ?? []) as Array<{ version: number; doc: NutritionPlan }>;
    const ultima = versiones.sort((a, b) => b.version - a.version)[0];
    if (ultima) planPorPaciente.set(p['patient_id'] as string, ultima.doc);
  }

  const logsPorPaciente = new Map<string, ComidaRegistrada[]>();
  for (const l of logs ?? []) {
    const uid = l['patient_id'] as string;
    const lista = logsPorPaciente.get(uid) ?? [];
    lista.push({
      fecha: l['local_date'] as string,
      slotId: l['slot_id'] as string,
      proteinGrams: l['protein_grams'] as number | null,
      esLibre: Boolean(l['is_free_meal']),
    });
    logsPorPaciente.set(uid, lista);
  }

  return (vinculos ?? []).map((v) => {
    const id = v['patient_id'] as string;
    const email = v['patient_email'] as string;
    return {
      vinculoId: v['id'] as string,
      id,
      nombre: nombreDe(v['profiles']) ?? email,
      email,
      plan: planPorPaciente.get(id) ?? null,
      registros: logsPorPaciente.get(id) ?? [],
    };
  });
}

export function metricasDe(paciente: Paciente): Metricas | null {
  if (!paciente.plan) return null;
  const hoy = fechaISO();
  const dias = ultimosDias(hoy, DIAS_VENTANA);
  const comidasPorDia = paciente.plan.slots.filter((s) => s.id !== 'colacion').length;
  return {
    adherencia: adherencia(paciente.registros, comidasPorDia, dias),
    racha: racha(paciente.registros, hoy),
    proteina: proteinaPromedio(paciente.plan, paciente.registros, dias),
    libres: librasUsadas(paciente.registros, dias),
    dias,
  };
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
  if (!fila) throw new Error('Esa persona todavía no tiene un plan activo.');

  const versiones = (fila['plan_versions'] ?? []) as Array<{ version: number }>;
  const siguiente = Math.max(0, ...versiones.map((v) => v.version)) + 1;

  const { error } = await supabase.from('plan_versions').insert({
    plan_id: fila['id'],
    version: siguiente,
    doc: plan,
    author_id: sesion.user.id,
    change_note: nota || null,
  });
  if (error) throw error;
}

function nombreDe(perfil: unknown): string | null {
  if (Array.isArray(perfil)) return nombreDe(perfil[0]);
  if (perfil && typeof perfil === 'object' && 'display_name' in perfil) {
    const n = (perfil as { display_name: unknown }).display_name;
    return typeof n === 'string' ? n : null;
  }
  return null;
}
