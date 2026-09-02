import type { Config } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';
import { buildDaySchedule } from '../../packages/core/src/schedule.ts';
import { claveEvento, eventsDue, notificacionDe } from '../../packages/core/src/notificaciones.ts';
import type { NutritionPlan, UserConfig } from '../../packages/core/src/types.ts';

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
  const url = process.env['SUPABASE_URL'];
  const service = process.env['SUPABASE_SERVICE_ROLE_KEY'];
  const publica = process.env['VAPID_PUBLIC_KEY'];
  const privada = process.env['VAPID_PRIVATE_KEY'];
  const sujeto = process.env['VAPID_SUBJECT'] ?? 'mailto:hola@en-punto.app';

  if (!url || !service || !publica || !privada) {
    return Response.json({ error: 'Faltan variables de entorno del cron.' }, { status: 500 });
  }
  webpush.setVapidDetails(sujeto, publica, privada);

  // service_role saltea RLS: el cron necesita leer los datos de todos para
  // decidir a quien avisar. Es la unica pieza que corre con esa clave.
  const db = createClient(url, service, { auth: { persistSession: false } });

  const { data: suscripciones, error } = await db
    .from('push_subscriptions')
    .select('id, owner_id, endpoint, p256dh, auth')
    .eq('is_active', true);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const porUsuario = new Map<string, typeof suscripciones>();
  for (const s of suscripciones ?? []) {
    const lista = porUsuario.get(s.owner_id) ?? [];
    lista.push(s);
    porUsuario.set(s.owner_id, lista);
  }

  let enviadas = 0;
  let saltadas = 0;

  for (const [uid, subs] of porUsuario) {
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

      const payload = JSON.stringify(notificacionDe(evento));
      for (const s of subs) {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            payload,
          );
          enviadas++;
          await db.from('push_subscriptions')
            .update({ last_ok_at: new Date().toISOString() }).eq('id', s.id);
        } catch (e) {
          // 404/410 significa que el endpoint murio: el navegador se
          // desinstalo o el permiso se revoco. Se desactiva en vez de
          // reintentar para siempre.
          const codigo = (e as { statusCode?: number }).statusCode;
          if (codigo === 404 || codigo === 410) {
            await db.from('push_subscriptions').update({ is_active: false }).eq('id', s.id);
          }
        }
      }
    }
  }

  return Response.json({ enviadas, saltadas, usuarios: porUsuario.size });
};

async function datosDe(
  db: ReturnType<typeof createClient>,
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
    zona: (perfil?.['timezone'] as string) ?? 'America/Argentina/Buenos_Aires',
  };
}

export const config: Config = {
  // Cada 5 minutos: la granularidad del cron es el error maximo del aviso.
  schedule: '*/5 * * * *',
};
