import type { Session } from '@supabase/supabase-js';
import type { NutritionPlan, UserConfig } from '@pa/core';
import { supabase } from './supabase.ts';
import { planEmpaquetado, configEmpaquetada } from './semilla.ts';
import type { Registro } from './registro.ts';
import * as local from './registro.ts';

/**
 * Unica puerta a los datos. Adentro decide si el origen es Supabase o el
 * navegador; afuera nadie se entera. Es lo que permite que la app funcione
 * sin sesion: ver el plan del dia no deberia depender de estar logueado.
 */

export interface Datos {
  plan: NutritionPlan;
  config: UserConfig;
  planVersionId: string | null;
}

const CLAVE_CONFIG = 'en-punto:config:v1';

function configLocal(): UserConfig {
  try {
    const crudo = localStorage.getItem(CLAVE_CONFIG);
    if (crudo) return JSON.parse(crudo) as UserConfig;
  } catch { /* storage bloqueado o JSON corrupto */ }
  return configEmpaquetada;
}

export async function cargarDatos(sesion: Session | null): Promise<Datos> {
  if (!supabase || !sesion) {
    return { plan: planEmpaquetado, config: configLocal(), planVersionId: null };
  }
  const uid = sesion.user.id;

  const { data: planes, error } = await supabase
    .from('plans')
    .select('id, plan_versions(id, version, doc)')
    .eq('patient_id', uid)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) throw error;

  // Primera vez: se siembra con el plan empaquetado para que la app tenga
  // contenido desde el minuto cero, sin una pantalla vacia esperando datos.
  if (!planes || planes.length === 0) return sembrar(uid);

  const fila = planes[0]!;
  const versiones = (fila.plan_versions ?? []) as Array<{ id: string; version: number; doc: unknown }>;
  const ultima = versiones.sort((a, b) => b.version - a.version)[0];

  const { data: configs } = await supabase
    .from('configs').select('doc').eq('patient_id', uid).eq('plan_id', fila.id).maybeSingle();

  return {
    plan: (ultima?.doc as NutritionPlan) ?? planEmpaquetado,
    config: (configs?.doc as UserConfig) ?? configLocal(),
    planVersionId: ultima?.id ?? null,
  };
}

async function sembrar(uid: string): Promise<Datos> {
  if (!supabase) throw new Error('Sin backend');
  const { data: plan, error: e1 } = await supabase
    .from('plans')
    .insert({ patient_id: uid, author_id: uid, name: planEmpaquetado.name, source: planEmpaquetado.source })
    .select('id').single();
  if (e1) throw e1;

  const { data: version, error: e2 } = await supabase
    .from('plan_versions')
    .insert({ plan_id: plan.id, version: 1, doc: planEmpaquetado, author_id: uid, change_note: 'Transcripción inicial de los PDF' })
    .select('id').single();
  if (e2) throw e2;

  const config = configLocal();
  await supabase.from('configs').insert({ patient_id: uid, plan_id: plan.id, doc: config });

  return { plan: planEmpaquetado, config, planVersionId: version.id };
}

export async function guardarConfig(sesion: Session | null, config: UserConfig): Promise<void> {
  try { localStorage.setItem(CLAVE_CONFIG, JSON.stringify(config)); } catch { /* idem */ }
  if (!supabase || !sesion) return;
  const { data: plan } = await supabase
    .from('plans').select('id').eq('patient_id', sesion.user.id).eq('is_active', true).limit(1).maybeSingle();
  if (!plan) return;
  await supabase.from('configs')
    .upsert({ patient_id: sesion.user.id, plan_id: plan.id, doc: config, updated_at: new Date().toISOString() },
            { onConflict: 'patient_id,plan_id' });
}

export async function listarRegistros(sesion: Session | null): Promise<Registro[]> {
  if (!supabase || !sesion) return local.leerRegistros();

  const { data, error } = await supabase
    .from('meal_logs')
    .select('local_date, slot_id, option_id, protein_grams, is_free_meal, note, photo_path')
    .eq('patient_id', sesion.user.id)
    .order('local_date', { ascending: false })
    .limit(120);
  if (error) throw error;

  return Promise.all((data ?? []).map(async (r) => ({
    fecha: r.local_date as string,
    slotId: r.slot_id as string,
    optionId: (r.option_id as string | null) ?? null,
    proteinGrams: (r.protein_grams as number | null) ?? null,
    esLibre: Boolean(r.is_free_meal),
    ...(r.note ? { nota: r.note as string } : {}),
    ...(r.photo_path ? { foto: await urlFirmada(r.photo_path as string) } : {}),
  })));
}

/** Las fotos viven en un bucket privado: se leen con URLs que vencen. */
async function urlFirmada(ruta: string): Promise<string | undefined> {
  const { data } = await supabase!.storage.from('meal-photos').createSignedUrl(ruta, 3600);
  return data?.signedUrl;
}

export async function guardarRegistro(
  sesion: Session | null,
  registro: Registro,
  planVersionId: string | null,
): Promise<Registro[]> {
  if (!supabase || !sesion) return local.guardarRegistro(registro);
  const uid = sesion.user.id;

  let photoPath: string | null = null;
  if (registro.foto?.startsWith('data:')) {
    photoPath = `${uid}/${registro.fecha}-${registro.slotId}.jpg`;
    const blob = await (await fetch(registro.foto)).blob();
    const { error } = await supabase.storage
      .from('meal-photos')
      .upload(photoPath, blob, { upsert: true, contentType: blob.type || 'image/jpeg' });
    if (error) throw error;
  }

  const { error } = await supabase.from('meal_logs').upsert({
    patient_id: uid,
    plan_version_id: planVersionId,
    local_date: registro.fecha,
    slot_id: registro.slotId,
    option_id: registro.optionId,
    protein_grams: registro.proteinGrams,
    is_free_meal: registro.esLibre,
    note: registro.nota ?? null,
    ...(photoPath ? { photo_path: photoPath } : {}),
  }, { onConflict: 'patient_id,local_date,slot_id' });
  if (error) throw error;

  return listarRegistros(sesion);
}

export async function borrarRegistro(
  sesion: Session | null,
  fecha: string,
  slotId: string,
): Promise<Registro[]> {
  if (!supabase || !sesion) return local.borrarRegistro(fecha, slotId);
  await supabase.from('meal_logs').delete()
    .eq('patient_id', sesion.user.id).eq('local_date', fecha).eq('slot_id', slotId);
  // La foto se borra aparte: el registro es la fuente de verdad, no el archivo.
  await supabase.storage.from('meal-photos').remove([`${sesion.user.id}/${fecha}-${slotId}.jpg`]);
  return listarRegistros(sesion);
}
