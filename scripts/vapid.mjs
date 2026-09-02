// Genera el par de claves VAPID que identifica al servidor ante los servicios
// de push de los navegadores. Se hace UNA vez: si cambian, todas las
// suscripciones existentes dejan de recibir y hay que volver a pedir permiso.
//
//   node scripts/vapid.mjs
import webpush from 'web-push';

const { publicKey, privateKey } = webpush.generateVAPIDKeys();

console.log(`
Guardá esto en las variables de entorno de Netlify.

  VAPID_PUBLIC_KEY   ${publicKey}
  VAPID_PRIVATE_KEY  ${privateKey}
  VAPID_SUBJECT      mailto:tu@email.com

La pública va TAMBIÉN en el build del cliente, para poder suscribirse:

  VITE_VAPID_PUBLIC_KEY   ${publicKey}

La privada NO va al cliente ni al repo: solo a Netlify.
`);
