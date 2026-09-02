import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase.ts';

/**
 * Avisa cuando la nutricionista publica una version nueva del plan.
 *
 * Un plan que cambia y no aparece hasta que alguien recarga es un plan que se
 * sigue mal. La suscripcion pasa por RLS igual que una consulta: cada quien
 * recibe solo lo que ya podia leer.
 *
 * Ademas se revisa al volver a la app: Realtime puede no estar habilitado, y
 * una pestaña dormida pierde eventos. Volver a mirar al despertarse es barato
 * y cubre los dos casos.
 */
export function escucharPlan(
  sesion: Session | null,
  planId: string | null,
  alCambiar: () => void,
): () => void {
  const limpiezas: Array<() => void> = [];

  const cliente = supabase;
  if (cliente && sesion && planId) {
    const canal = cliente
      .channel(`plan:${planId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'plan_versions', filter: `plan_id=eq.${planId}` },
        () => alCambiar(),
      )
      .subscribe();
    limpiezas.push(() => { void cliente.removeChannel(canal); });
  }

  const alVolver = () => { if (document.visibilityState === 'visible') alCambiar(); };
  document.addEventListener('visibilitychange', alVolver);
  limpiezas.push(() => document.removeEventListener('visibilitychange', alVolver));

  return () => limpiezas.forEach((f) => f());
}
