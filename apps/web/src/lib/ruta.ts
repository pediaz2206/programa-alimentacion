import { useCallback, useEffect, useState } from 'react';

/**
 * Ruteo minimo sobre la History API.
 *
 * Sin esto las pestañas son estado en memoria: para el navegador todo es una
 * sola pagina. El boton "atras" sale de la app, en Android el boton fisico la
 * cierra, y volver puede remontar el arbol y perder lo que no se habia
 * guardado todavia. Tres sintomas distintos, la misma causa.
 *
 * No se usa una libreria porque son cinco rutas: la dependencia costaria mas
 * que el codigo.
 */

export type Pestana = 'hoy' | 'plan' | 'compras' | 'registro' | 'pacientes' | 'ajustes';

export interface Ruta {
  pestana: Pestana;
  /** Solo en el detalle de un paciente. */
  pacienteId?: string;
}

const PESTANAS: Pestana[] = ['hoy', 'plan', 'compras', 'registro', 'pacientes', 'ajustes'];

export function leerRuta(path = window.location.pathname): Ruta {
  const partes = path.split('/').filter(Boolean);
  const primera = partes[0] as Pestana | undefined;
  if (!primera || !PESTANAS.includes(primera)) return { pestana: 'hoy' };
  const segunda = partes[1];
  return segunda ? { pestana: primera, pacienteId: segunda } : { pestana: primera };
}

export function escribirRuta(ruta: Ruta): string {
  return ruta.pacienteId ? `/${ruta.pestana}/${ruta.pacienteId}` : `/${ruta.pestana}`;
}

export function useRuta(): [Ruta, (r: Ruta, opciones?: { reemplazar?: boolean }) => void] {
  const [ruta, setRuta] = useState<Ruta>(() => leerRuta());

  useEffect(() => {
    const alVolver = () => setRuta(leerRuta());
    window.addEventListener('popstate', alVolver);
    return () => window.removeEventListener('popstate', alVolver);
  }, []);

  // La URL de entrada suele ser "/", que no es ninguna pestaña. Se reemplaza
  // por la real para que el primer "atras" no salga de la app.
  useEffect(() => {
    if (window.location.pathname === '/') {
      window.history.replaceState(null, '', escribirRuta({ pestana: 'hoy' }));
    }
  }, []);

  const navegar = useCallback((destino: Ruta, opciones?: { reemplazar?: boolean }) => {
    const path = escribirRuta(destino);
    if (path === window.location.pathname) return;
    if (opciones?.reemplazar) window.history.replaceState(null, '', path);
    else window.history.pushState(null, '', path);
    setRuta(destino);
    window.scrollTo(0, 0);
  }, []);

  return [ruta, navegar];
}
