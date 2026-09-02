import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import webpush from 'web-push';
import type { Notificacion } from '../../../../packages/core/src/notificaciones.ts';

/** Config compartida por las funciones que mandan push. */
export interface Entorno {
  db: SupabaseClient;
  url: string;
  anon: string;
}

export function prepararEntorno(): Entorno | { error: string } {
  // Es la misma URL que usa el cliente; no hace falta duplicarla.
  const url = process.env['SUPABASE_URL'] ?? process.env['VITE_SUPABASE_URL'];
  const service = process.env['SUPABASE_SERVICE_ROLE_KEY'];
  const anon = process.env['SUPABASE_ANON_KEY'] ?? process.env['VITE_SUPABASE_ANON_KEY'];
  const publica = process.env['VAPID_PUBLIC_KEY'];
  const privada = process.env['VAPID_PRIVATE_KEY'];
  const sujeto = process.env['VAPID_SUBJECT'] ?? 'mailto:hola@en-punto.app';

  const faltan = [
    !url && 'SUPABASE_URL',
    !service && 'SUPABASE_SERVICE_ROLE_KEY',
    !publica && 'VAPID_PUBLIC_KEY',
    !privada && 'VAPID_PRIVATE_KEY',
  ].filter(Boolean);
  if (faltan.length > 0) return { error: `Faltan variables de entorno: ${faltan.join(', ')}.` };

  webpush.setVapidDetails(sujeto, publica!, privada!);
  return {
    // service_role saltea RLS. Es la unica pieza que corre con esta clave, y
    // solo despues de haber verificado quien pide.
    db: createClient(url!, service!, { auth: { persistSession: false } }),
    url: url!,
    anon: anon ?? '',
  };
}

/**
 * Manda una notificacion a todos los dispositivos de una persona.
 * Devuelve cuantos recibieron y desactiva los endpoints muertos.
 */
export async function enviarA(
  db: SupabaseClient,
  uid: string,
  notificacion: Notificacion,
): Promise<{ enviadas: number; caidas: number }> {
  const { data: subs } = await db
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('owner_id', uid)
    .eq('is_active', true);

  const payload = JSON.stringify(notificacion);
  let enviadas = 0;
  let caidas = 0;

  for (const s of subs ?? []) {
    try {
      await webpush.sendNotification(
        { endpoint: s['endpoint'], keys: { p256dh: s['p256dh'], auth: s['auth'] } },
        payload,
      );
      enviadas++;
      await db.from('push_subscriptions')
        .update({ last_ok_at: new Date().toISOString() }).eq('id', s['id']);
    } catch (e) {
      // 404/410: el navegador se desinstalo o el permiso se revoco. Se
      // desactiva en vez de reintentar para siempre.
      const codigo = (e as { statusCode?: number }).statusCode;
      if (codigo === 404 || codigo === 410) {
        await db.from('push_subscriptions').update({ is_active: false }).eq('id', s['id']);
        caidas++;
      }
    }
  }
  return { enviadas, caidas };
}
