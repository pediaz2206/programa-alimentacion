import type { Session } from '@supabase/supabase-js';
import type { NutritionPlan, UserConfig } from '@pa/core';
import { supabase } from './supabase.ts';
import { planEmpaquetado } from './semilla.ts';
import * as cache from './cache.ts';
import type { Registro } from './registro.ts';

/**
 * Unica puerta a los datos.
 *
 * Lee del servidor y guarda una copia local; si el servidor no responde,
 * devuelve la copia en vez de fallar. Las escrituras que no salen se encolan y
 * se reintentan al volver la conexion, porque registrar una comida pasa en la
 * mesa y ahi la senal es lo que es.
 */

export interface Datos {
  plan: NutritionPlan;
  config: UserConfig;
  planId: string | null;
  planVersionId: string | null;
  /** Los datos vienen de la copia local: hay algo que el servidor no confirmo. */
  desdeCache: boolean;
}

function exigirSesion(sesion: Session | null): Session {
  if (!supabase || !sesion) throw new Error('Hace falta iniciar sesión.');
  return sesion;
}

export async function cargarDatos(sesion: Session | null): Promise<Datos> {
  const { user } = exigirSesion(sesion);
  try {
    const datos = await traerDelServidor(user.id);
    cache.guardarDatos(user.id, datos);
    return { ...datos, desdeCache: false };
  } catch (e) {
    const copia = cache.leerDatos(user.id);
    if (!copia) throw e;
    return {
      plan: copia.plan,
      config: copia.config,
      planId: copia.planId,
      planVersionId: copia.planVersionId,
      desdeCache: true,
    };
  }
}

/**
 * El plan activo de una persona.
 *
 * Existe para que haya UNA definicion. Cuando leer y escribir eligen "el plan
 * activo" con consultas distintas y alguien tiene mas de una fila, se escribe
 * en una y se lee de la otra: el cambio se guarda de verdad y aun asi
 * desaparece al recargar. Con orden explicito, las dos eligen la misma.
 */
async function planActivoDe(uid: string, campos: string): Promise<Record<string, unknown> | null> {
  const { data, error } = await supabase!
    .from('plans')
    .select(campos)
    .eq('patient_id', uid)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .order('id', { ascending: true })   // desempate estable si comparten fecha
    .limit(1);
  if (error) throw error;
  return (data?.[0] as Record<string, unknown> | undefined) ?? null;
}

async function traerDelServidor(uid: string): Promise<Omit<Datos, 'desdeCache'>> {
  const planes = await planActivoDe(uid, 'id, plan_versions(id, version, doc)');

  // Primera vez: se siembra con el plan empaquetado para que la app tenga
  // contenido desde el minuto cero, sin una pantalla vacia esperando datos.
  if (!planes) return sembrar(uid);

  const fila = planes;
  const versiones = (fila['plan_versions'] ?? []) as Array<{ id: string; version: number; doc: unknown }>;
  const ultima = versiones.sort((a, b) => b.version - a.version)[0];

  const { data: configs } = await supabase!
    .from('configs').select('doc').eq('patient_id', uid).eq('plan_id', fila['id']).maybeSingle();

  return {
    plan: (ultima?.doc as NutritionPlan) ?? planEmpaquetado,
    config: configs?.doc as UserConfig,
    planId: fila['id'] as string,
    planVersionId: ultima?.id ?? null,
  };
}

async function sembrar(uid: string): Promise<Omit<Datos, 'desdeCache'>> {
  const { configEmpaquetada } = await import('./semilla.ts');
  const { data: plan, error: e1 } = await supabase!
    .from('plans')
    .insert({ patient_id: uid, author_id: uid, name: planEmpaquetado.name, source: planEmpaquetado.source })
    .select('id').single();
  if (e1) throw e1;

  const { data: version, error: e2 } = await supabase!
    .from('plan_versions')
    .insert({
      plan_id: plan.id, version: 1, doc: planEmpaquetado, author_id: uid,
      change_note: 'Transcripción inicial de los PDF',
    })
    .select('id').single();
  if (e2) throw e2;

  await supabase!.from('configs').insert({ patient_id: uid, plan_id: plan.id, doc: configEmpaquetada });
  return {
    plan: planEmpaquetado, config: configEmpaquetada,
    planId: plan.id as string, planVersionId: version.id as string,
  };
}

export async function guardarConfig(sesion: Session | null, config: UserConfig): Promise<void> {
  const { user } = exigirSesion(sesion);
  const copia = cache.leerDatos(user.id);
  if (copia) cache.guardarDatos(user.id, { ...copia, config });

  const plan = await planActivoDe(user.id, 'id');
  // Antes esto era `return`: la funcion terminaba bien, quien llamaba creia que
  // habia guardado, y no se escribia nada. Un exito silencioso es peor que un
  // error, porque nadie lo investiga.
  if (!plan) throw new Error('No encontré tu plan activo, así que no pude guardar el cambio.');

  const { data, error } = await supabase!.from('configs').upsert(
    { patient_id: user.id, plan_id: plan['id'], doc: config, updated_at: new Date().toISOString() },
    { onConflict: 'patient_id,plan_id' },
  ).select('id');
  if (error) throw error;
  // Un upsert que no toca ninguna fila devuelve 200 y un arreglo vacio: sin
  // esto, una politica de RLS que filtra en silencio se ve como un guardado.
  if (!data || data.length === 0) {
    throw new Error('El servidor aceptó el pedido pero no guardó nada.');
  }
}

export async function listarRegistros(sesion: Session | null): Promise<Registro[]> {
  const { user } = exigirSesion(sesion);
  try {
    const { data, error } = await supabase!
      .from('meal_logs')
      .select('local_date, slot_id, option_id, protein_grams, is_free_meal, note, photo_path')
      .eq('patient_id', user.id)
      .order('local_date', { ascending: false })
      .limit(120);
    if (error) throw error;

    const registros = await Promise.all((data ?? []).map(async (r) => ({
      fecha: r.local_date as string,
      slotId: r.slot_id as string,
      optionId: (r.option_id as string | null) ?? null,
      proteinGrams: (r.protein_grams as number | null) ?? null,
      esLibre: Boolean(r.is_free_meal),
      ...(r.note ? { nota: r.note as string } : {}),
      ...(r.photo_path ? { foto: await urlFirmada(r.photo_path as string) } : {}),
    })));
    cache.guardarRegistros(user.id, registros);
    return conPendientes(user.id, registros);
  } catch {
    return conPendientes(user.id, cache.leerRegistros(user.id));
  }
}

/** Lo encolado se muestra como si ya estuviera: para quien mira, esta hecho. */
function conPendientes(uid: string, registros: Registro[]): Registro[] {
  const cola = cache.leerCola(uid);
  if (cola.length === 0) return registros;
  let salida = registros;
  for (const p of cola) {
    if (p.tipo === 'borrar') {
      salida = salida.filter((r) => !(r.fecha === p.fecha && r.slotId === p.slotId));
    } else {
      salida = [
        ...salida.filter((r) => !(r.fecha === p.registro.fecha && r.slotId === p.registro.slotId)),
        p.registro,
      ];
    }
  }
  return salida.sort((a, b) => (a.fecha === b.fecha ? a.slotId.localeCompare(b.slotId) : b.fecha.localeCompare(a.fecha)));
}

async function urlFirmada(ruta: string): Promise<string | undefined> {
  const { data } = await supabase!.storage.from('meal-photos').createSignedUrl(ruta, 3600);
  return data?.signedUrl;
}

export async function guardarRegistro(
  sesion: Session | null,
  registro: Registro,
  planVersionId: string | null,
): Promise<Registro[]> {
  const { user } = exigirSesion(sesion);
  try {
    await escribirRegistro(user.id, registro, planVersionId);
    return await listarRegistros(sesion);
  } catch (e) {
    if (!cache.encolar(user.id, { tipo: 'guardar', registro, planVersionId })) throw e;
    return conPendientes(user.id, cache.leerRegistros(user.id));
  }
}

async function escribirRegistro(uid: string, registro: Registro, planVersionId: string | null) {
  let photoPath: string | null = null;
  if (registro.foto?.startsWith('data:')) {
    photoPath = `${uid}/${registro.fecha}-${registro.slotId}.jpg`;
    const blob = await (await fetch(registro.foto)).blob();
    const { error } = await supabase!.storage
      .from('meal-photos')
      .upload(photoPath, blob, { upsert: true, contentType: blob.type || 'image/jpeg' });
    if (error) throw error;
  }

  const { error } = await supabase!.from('meal_logs').upsert({
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
}

export async function borrarRegistro(
  sesion: Session | null,
  fecha: string,
  slotId: string,
): Promise<Registro[]> {
  const { user } = exigirSesion(sesion);
  try {
    await borrarEnServidor(user.id, fecha, slotId);
    return await listarRegistros(sesion);
  } catch (e) {
    if (!cache.encolar(user.id, { tipo: 'borrar', fecha, slotId })) throw e;
    return conPendientes(user.id, cache.leerRegistros(user.id));
  }
}

async function borrarEnServidor(uid: string, fecha: string, slotId: string) {
  const { error } = await supabase!.from('meal_logs').delete()
    .eq('patient_id', uid).eq('local_date', fecha).eq('slot_id', slotId);
  if (error) throw error;
  // La foto se borra aparte: el registro es la fuente de verdad, no el archivo.
  await supabase!.storage.from('meal-photos').remove([`${uid}/${fecha}-${slotId}.jpg`]);
}

/** Cuantas escrituras esperan salir. */
export function pendientes(sesion: Session | null): number {
  if (!sesion) return 0;
  return cache.leerCola(sesion.user.id).length;
}

/**
 * Reintenta la cola. Se vacia solo si sale todo: dejar la mitad adentro es
 * peor que reintentar de nuevo, porque las escrituras son idempotentes.
 */
export async function sincronizar(sesion: Session | null): Promise<Registro[]> {
  const { user } = exigirSesion(sesion);
  const cola = cache.leerCola(user.id);
  if (cola.length === 0) return listarRegistros(sesion);

  for (const p of cola) {
    if (p.tipo === 'guardar') await escribirRegistro(user.id, p.registro, p.planVersionId);
    else await borrarEnServidor(user.id, p.fecha, p.slotId);
  }
  cache.vaciarCola(user.id);
  return listarRegistros(sesion);
}
