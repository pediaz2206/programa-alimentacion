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

export async function salir(): Promise<void> {
  await supabase?.auth.signOut();
}
