/**
 * La linea que aclara que no muestra un bloque, al pie del bloque.
 *
 * Va adentro de lo que si hay y no como una tarjeta vacia con un cartel:
 * tres bloques anunciando ausencias hacen leer una lista de faltantes en vez
 * de un producto.
 *
 * Son dos cosas distintas y confundirlas es el error que esto existe para
 * evitar:
 *
 *   `pendiente`  — todavia no lo construimos. Va a estar.
 *   `alcance`    — no es para vos. Esta hecho y es de otro rol.
 *
 * Un entrenador que lee "pendiente" donde dice "no te corresponde" se queda
 * esperando algo que no va a llegar; y al reves, leer "no te corresponde"
 * donde falta trabajo hace parecer deliberado un hueco.
 *
 * El icono es texto y no color: el color nunca dice solo.
 */
export function AlPie({ tipo, children }: {
  tipo: 'pendiente' | 'alcance';
  children: React.ReactNode;
}) {
  return (
    <p className={`al-pie al-pie-${tipo}`}>
      <span className="al-pie-marca">{tipo === 'pendiente' ? 'Todavía no' : 'No lo ves'}</span>
      {children}
    </p>
  );
}
