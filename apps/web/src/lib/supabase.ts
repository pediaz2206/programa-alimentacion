import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * Es `null` cuando faltan las variables de entorno, y la app sigue andando en
 * modo local. Que la falta de configuracion no rompa la pantalla es a proposito:
 * el valor del producto (ver el plan del dia) no depende de estar logueado.
 */
export const supabase: SupabaseClient | null =
  url && anonKey ? createClient(url, anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  }) : null;

export const hayBackend = supabase !== null;

export async function entrarConGoogle(): Promise<void> {
  if (!supabase) throw new Error('Falta configurar Supabase.');
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin },
  });
  if (error) throw error;
}

/**
 * El acceso de prueba, para mostrar la app sin dar de alta una cuenta de
 * Google. La sesion que emite es una sesion real: las mismas politicas de RLS
 * gobiernan lo que esa persona puede leer y escribir.
 *
 * Ojo con lo que esto NO es. La bandera de compilacion saca el formulario de
 * la pantalla, no la capacidad del servidor: el grant de contrasena lo atiende
 * la API de Supabase, y produccion y vista previa comparten una sola base, asi
 * que estas credenciales sirven contra produccion aunque ahi no haya
 * formulario. Lo que contiene a una cuenta de prueba son las politicas de
 * `006-aislar-cuentas-de-prueba.sql`, no esta bandera.
 */
/** Por qué falló el ingreso. La pantalla decide qué conservar según esto. */
export type MotivoDeFallo = 'credencial' | 'tasa' | 'servidor' | 'red';

export class FalloDeIngreso extends Error {
  constructor(public readonly motivo: MotivoDeFallo, mensaje: string) {
    super(mensaje);
    this.name = 'FalloDeIngreso';
  }
}

export async function entrarConContrasena(email: string, contrasena: string): Promise<void> {
  if (!supabase) throw new Error('Falta configurar Supabase.');
  const { error } = await supabase.auth.signInWithPassword({ email, password: contrasena });
  if (!error) return;

  // Colapsar el 400 es a proposito: un mensaje que distinga "ese email no
  // existe" de "esa contrasena esta mal" convierte la pantalla en un
  // enumerador de cuentas. Es la misma razon por la que se invita por email
  // sin resolverlo a un id.
  //
  // Colapsar TODO lo demas no: un limite de tasa o un 500 leidos como
  // "contrasena incorrecta" hacen reintentar, y reintentar empeora el
  // bloqueo. El objetivo antienumeracion solo pide el 400.
  if (error.status === 429) {
    throw new FalloDeIngreso('tasa', 'Demasiados intentos. Esperá un minuto y probá de nuevo.');
  }
  if (error.status != null && error.status >= 500) {
    throw new FalloDeIngreso('servidor', 'El servidor no respondió. Probá de nuevo en un momento.');
  }
  if (error.status == null) {
    throw new FalloDeIngreso('red', 'No se pudo conectar. Revisá la señal.');
  }
  throw new FalloDeIngreso('credencial', 'Email o contraseña incorrectos.');
}

export async function salir(): Promise<void> {
  await supabase?.auth.signOut();
}
