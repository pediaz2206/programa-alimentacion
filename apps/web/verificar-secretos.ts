import type { Plugin } from 'vite';

/**
 * Aborta el build si una variable VITE_* contiene una clave de servicio.
 *
 * Todo lo que empieza con VITE_ se incluye en el bundle del cliente, en texto
 * plano. Una service_role key ahi no es una fuga menor: saltea RLS por
 * completo, asi que cualquiera que abra las herramientas de desarrollo puede
 * leer y escribir los datos de salud de todos los usuarios.
 *
 * Es un error facil de cometer copiando variables, y silencioso: el build sale
 * bien y la app anda. Por eso se chequea en vez de confiar.
 */
export function verificarSecretos(): Plugin {
  return {
    name: 'en-punto:verificar-secretos',
    config(_, { mode }) {
      for (const [clave, valor] of Object.entries(process.env)) {
        if (!clave.startsWith('VITE_') || !valor) continue;
        if (rolDelJwt(valor) === 'service_role') {
          throw new Error(
            `\n\n  ${clave} contiene una service_role key.\n\n` +
            '  Todo lo que empieza con VITE_ viaja en el bundle del cliente, y esa\n' +
            '  clave saltea RLS: publicarla expone los datos de todos los usuarios.\n\n' +
            `  Renombrala sin el prefijo VITE_ (modo: ${mode}).\n`,
          );
        }
      }
      return undefined;
    },
  };
}

/** Lee el campo `role` de un JWT sin validarlo: solo interesa qué dice ser. */
function rolDelJwt(valor: string): string | null {
  const partes = valor.split('.');
  if (partes.length !== 3) return null;
  try {
    const carga = JSON.parse(Buffer.from(partes[1]!, 'base64url').toString('utf8'));
    return typeof carga.role === 'string' ? carga.role : null;
  } catch {
    return null;
  }
}
