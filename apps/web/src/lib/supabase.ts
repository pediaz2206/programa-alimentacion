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
export async function entrarConContrasena(email: string, contrasena: string): Promise<void> {
  if (!supabase) throw new Error('Falta configurar Supabase.');
  const { error } = await supabase.auth.signInWithPassword({ email, password: contrasena });
  // Un mensaje que distinga "ese email no existe" de "esa contrasena esta
  // mal" convierte la pantalla en un enumerador de cuentas. Es la misma razon
  // por la que se invita por email sin resolverlo a un id.
  if (error) throw new Error('Email o contraseña incorrectos.');
}

export async function salir(): Promise<void> {
  await supabase?.auth.signOut();
}
