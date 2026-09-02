import type { Config } from '@netlify/functions';
import type { SupabaseClient } from '@supabase/supabase-js';
import { enviarA, prepararEntorno } from '../lib/push.mts';
import { buildDaySchedule } from '../../../../packages/core/src/schedule.ts';
import { claveEvento, eventsDue, notificacionDe } from '../../../../packages/core/src/notificaciones.ts';
import type { NutritionPlan, UserConfig } from '../../../../packages/core/src/types.ts';

/**
 * El cron de recordatorios.
 *
 * Corre cada 5 minutos y pregunta "que eventos vencieron desde la corrida
 * anterior". Toda la decision de que notificar vive en el motor (eventsDue,
 * notificacionDe): aca solo hay entrada y salida. Es la misma funcion que usa
 * la pantalla, asi que la notificacion nunca dice algo distinto a la app.
 *
 * La granularidad del cron es el error maximo del recordatorio: cada 5 minutos
 * significa que un aviso de las 12:30 puede llegar 12:34. Aceptable para
 * comidas.
 */

const VENTANA_MINUTOS = 5;

export default async (): Promise<Response> => {
  const entorno = prepararEntorno();
  if ('error' in entorno) return Response.json({ error: entorno.error }, { status: 500 });
  const { db } = entorno;

  // Solo interesan las personas con al menos un dispositivo suscrito: al resto
  // no hay a donde avisarles.
  const { data: suscripciones, error } = await db
    .from('push_subscriptions')
    .select('owner_id')
    .eq('is_active', true);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const usuarios = [...new Set((suscripciones ?? []).map((s) => s['owner_id'] as string))];

  let enviadas = 0;
  let saltadas = 0;

  for (const uid of usuarios) {
    const contexto = await datosDe(db, uid);
    if (!contexto) continue;
    const { plan, config, zona } = contexto;

    // El dia y la hora son los del usuario, no los del servidor.
    const ahora = new Date();
    const local = new Date(ahora.toLocaleString('en-US', { timeZone: zona }));
    const minutoActual = local.getHours() * 60 + local.getMinutes();
    const desde = (minutoActual - VENTANA_MINUTOS + 1440) % 1440;
    const fechaLocal = `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, '0')}-${String(local.getDate()).padStart(2, '0')}`;

    const agenda = buildDaySchedule(plan, config, local);
    for (const evento of eventsDue(agenda, desde, minutoActual)) {
      const clave = claveEvento(evento);

      // El log es la garantia de idempotencia: si dos corridas se solapan o una
      // se reintenta, la insercion falla por clave duplicada y no se reenvia.
      const { error: yaEnviada } = await db
        .from('notification_log')
        .insert({ owner_id: uid, local_date: fechaLocal, event_key: clave });
      if (yaEnviada) { saltadas++; continue; }

      const resultado = await enviarA(db, uid, notificacionDe(evento));
      enviadas += resultado.enviadas;
    }
  }

  return Response.json({ enviadas, saltadas, usuarios: usuarios.length });
};

async function datosDe(
  db: SupabaseClient,
  uid: string,
): Promise<{ plan: NutritionPlan; config: UserConfig; zona: string } | null> {
  const { data: perfil } = await db
    .from('profiles').select('timezone').eq('id', uid).maybeSingle();

  const { data: planes } = await db
    .from('plans')
    .select('id, plan_versions(version, doc)')
    .eq('patient_id', uid).eq('is_active', true)
    .order('created_at', { ascending: false }).limit(1);

  const fila = planes?.[0];
  if (!fila) return null;

  const versiones = (fila['plan_versions'] ?? []) as Array<{ version: number; doc: NutritionPlan }>;
  const plan = versiones.sort((a, b) => b.version - a.version)[0]?.doc;
  if (!plan) return null;

  const { data: config } = await db
    .from('configs').select('doc').eq('patient_id', uid).eq('plan_id', fila['id']).maybeSingle();
  if (!config) return null;

  return {
    plan,
    config: config['doc'] as UserConfig,
    zona: typeof perfil?.['timezone'] === 'string'
      ? perfil['timezone']
      : 'America/Argentina/Buenos_Aires',
  };
}

export const config: Config = {
  // Cada 5 minutos: la granularidad del cron es el error maximo del aviso.
  schedule: '*/5 * * * *',
};
