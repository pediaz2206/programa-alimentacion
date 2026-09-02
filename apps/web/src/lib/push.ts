import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase.ts';

/**
 * Notificaciones push.
 *
 * No existen las notificaciones locales programadas en una PWA: no hay forma de
 * decirle al navegador "avisame a las 12:30". La unica via es un push desde el
 * servidor, y por eso hay un cron.
 */

export type EstadoPush =
  | 'sin-soporte'      // el navegador no tiene Push API
  | 'requiere-instalar' // iOS: solo funciona agregada a la pantalla de inicio
  | 'sin-permiso'
  | 'bloqueado'
  | 'activo';

export function esIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export function estaInstalada(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches
    || ('standalone' in navigator && Boolean((navigator as { standalone?: boolean }).standalone));
}

export function estadoPush(): EstadoPush {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    // En iOS la Push API solo aparece cuando la app esta en la pantalla de
    // inicio, asi que la ausencia se explica distinto segun el caso.
    return esIOS() && !estaInstalada() ? 'requiere-instalar' : 'sin-soporte';
  }
  if (esIOS() && !estaInstalada()) return 'requiere-instalar';
  if (Notification.permission === 'granted') return 'activo';
  if (Notification.permission === 'denied') return 'bloqueado';
  return 'sin-permiso';
}

/**
 * El navegador espera la clave VAPID como bytes, no como base64url. El buffer
 * se crea explicito: `Uint8Array.from` puede quedar respaldado por un
 * SharedArrayBuffer, que `applicationServerKey` no acepta.
 */
function claveABytes(base64url: string): Uint8Array<ArrayBuffer> {
  const relleno = '='.repeat((4 - (base64url.length % 4)) % 4);
  const base64 = (base64url + relleno).replace(/-/g, '+').replace(/_/g, '/');
  const crudo = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(crudo.length));
  for (let i = 0; i < crudo.length; i++) bytes[i] = crudo.charCodeAt(i);
  return bytes;
}

export async function activarNotificaciones(sesion: Session | null): Promise<EstadoPush> {
  const estado = estadoPush();
  if (estado === 'sin-soporte' || estado === 'requiere-instalar' || estado === 'bloqueado') {
    return estado;
  }

  const permiso = await Notification.requestPermission();
  if (permiso !== 'granted') return permiso === 'denied' ? 'bloqueado' : 'sin-permiso';

  const clavePublica = import.meta.env.VITE_VAPID_PUBLIC_KEY;
  if (!clavePublica) throw new Error('Falta VITE_VAPID_PUBLIC_KEY en el build.');

  const registro = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;

  const suscripcion = await registro.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: claveABytes(clavePublica),
  });

  if (supabase && sesion) {
    const json = suscripcion.toJSON() as { endpoint?: string; keys?: Record<string, string> };
    const { error } = await supabase.from('push_subscriptions').upsert({
      owner_id: sesion.user.id,
      endpoint: json.endpoint,
      p256dh: json.keys?.['p256dh'],
      auth: json.keys?.['auth'],
      user_agent: navigator.userAgent,
      is_active: true,
    }, { onConflict: 'endpoint' });
    if (error) throw error;
  }

  return 'activo';
}

export async function desactivarNotificaciones(): Promise<void> {
  const registro = await navigator.serviceWorker.getRegistration('/sw.js');
  const suscripcion = await registro?.pushManager.getSubscription();
  if (!suscripcion) return;
  const endpoint = suscripcion.endpoint;
  await suscripcion.unsubscribe();
  if (supabase) {
    await supabase.from('push_subscriptions').update({ is_active: false }).eq('endpoint', endpoint);
  }
}
