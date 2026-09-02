import { createClient } from '@supabase/supabase-js';
import { enviarA, prepararEntorno } from '../lib/push.mts';

/**
 * Manda una notificacion de prueba a quien la pide.
 *
 * Sin esto, activar los recordatorios es un acto de fe: hay que esperar al
 * proximo evento del dia para saber si funcionaron. Con el cron cada 5 minutos,
 * eso puede ser horas.
 *
 * Solo manda a QUIEN PIDE: valida el token del usuario contra Supabase y usa
 * ese id, nunca uno que venga en el cuerpo. Un endpoint que acepta un uid
 * arbitrario es un endpoint para spamear a cualquiera.
 */
export default async (peticion: Request): Promise<Response> => {
  const entorno = prepararEntorno();
  if ('error' in entorno) return Response.json({ error: entorno.error }, { status: 500 });

  const token = peticion.headers.get('authorization')?.replace(/^Bearer /i, '');
  if (!token) return Response.json({ error: 'Falta el token de sesión.' }, { status: 401 });

  const comoUsuario = createClient(entorno.url, entorno.anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
  const { data: quien, error } = await comoUsuario.auth.getUser();
  if (error || !quien.user) {
    return Response.json({ error: 'Sesión inválida.' }, { status: 401 });
  }

  const { enviadas, caidas } = await enviarA(entorno.db, quien.user.id, {
    titulo: 'En Punto funciona',
    cuerpo: 'Así se van a ver tus recordatorios de comida.',
    tag: 'prueba',
    url: '/',
  });

  if (enviadas === 0) {
    return Response.json({
      error: caidas > 0
        ? 'Tus suscripciones estaban vencidas. Volvé a activar los recordatorios.'
        : 'No hay ningún dispositivo suscrito todavía.',
    }, { status: 409 });
  }
  return Response.json({ enviadas });
};
