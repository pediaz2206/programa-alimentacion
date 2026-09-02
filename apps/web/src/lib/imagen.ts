/**
 * Reduce una foto antes de guardarla o subirla.
 *
 * Una foto de telefono son 3 o 4 MB. Subir eso por cada comida es tirar datos
 * del usuario a la basura, y si ademas hay que encolarla sin conexion no entra
 * en la cuota de localStorage, que ronda los 5 MB en total.
 */
const LADO_MAXIMO = 1280;
const CALIDAD = 0.75;

export async function achicar(archivo: File): Promise<string> {
  const bitmap = await crearBitmap(archivo);
  const escala = Math.min(1, LADO_MAXIMO / Math.max(bitmap.width, bitmap.height));
  const ancho = Math.round(bitmap.width * escala);
  const alto = Math.round(bitmap.height * escala);

  const lienzo = document.createElement('canvas');
  lienzo.width = ancho;
  lienzo.height = alto;
  const ctx = lienzo.getContext('2d');
  if (!ctx) return leerComoDataURL(archivo);
  ctx.drawImage(bitmap, 0, 0, ancho, alto);
  if ('close' in bitmap) bitmap.close();

  return lienzo.toDataURL('image/jpeg', CALIDAD);
}

async function crearBitmap(archivo: File): Promise<ImageBitmap> {
  if ('createImageBitmap' in window) return createImageBitmap(archivo);
  throw new Error('El navegador no puede procesar la imagen.');
}

function leerComoDataURL(archivo: File): Promise<string> {
  return new Promise((resolver, rechazar) => {
    const lector = new FileReader();
    lector.onload = () => resolver(String(lector.result));
    lector.onerror = () => rechazar(new Error('No se pudo leer la foto.'));
    lector.readAsDataURL(archivo);
  });
}
