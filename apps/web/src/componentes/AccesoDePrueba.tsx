import { useState } from 'react';
import { entrarConContrasena } from '../lib/supabase.ts';

/**
 * Acceso por email y contrasena, para recorrer la app sin una cuenta de
 * Google. Vive en su propio archivo para que el `false &&` de Bienvenida deje
 * este modulo sin referencias y el bundle de produccion no lo incluya.
 *
 * Que no este en el bundle es higiene, no seguridad: el grant de contrasena lo
 * atiende la API de Supabase igual. Ver `entrarConContrasena`.
 */
export function AccesoDePrueba() {
  const [email, setEmail] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [entrando, setEntrando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="acceso-prueba"
      onSubmit={(e) => {
        e.preventDefault();
        setEntrando(true);
        setError(null);
        entrarConContrasena(email.trim(), contrasena).catch((err: unknown) => {
          setError(err instanceof Error ? err.message : 'No se pudo iniciar sesión.');
          // El email se conserva a proposito: reescribirlo en el teléfono
          // despues de cada intento es la parte que hace abandonar.
          setContrasena('');
          setEntrando(false);
        });
      }}
    >
      <p className="acceso-prueba-titulo">Acceso de prueba</p>

      <label className="acceso-prueba-campo">
        <span>Email</span>
        <input
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>

      <label className="acceso-prueba-campo">
        <span>Contraseña</span>
        <input
          type="password"
          autoComplete="current-password"
          required
          value={contrasena}
          onChange={(e) => setContrasena(e.target.value)}
        />
      </label>

      <button className="boton boton-ancho" type="submit" disabled={entrando}>
        {entrando ? 'Entrando…' : 'Entrar'}
      </button>

      {error && (
        <p className="acceso-prueba-error" role="alert">{error}</p>
      )}
    </form>
  );
}
