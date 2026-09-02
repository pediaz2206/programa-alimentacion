/*
 * Service worker de En Punto.
 *
 * Dos trabajos: recibir los push y hacer que la app abra sin conexión.
 *
 * Lo que NO hace: cachear las llamadas a Supabase. Ahí viajan la sesión y
 * datos de salud, y servir una respuesta vieja como si fuera fresca es peor
 * que fallar. Los datos los cachea la app, que sabe distinguir una copia de
 * lo actual y lo dice en pantalla.
 */

const CACHE = 'en-punto-v3';
const ESENCIALES = ['/', '/index.html', '/manifest.webmanifest'];

/**
 * Los assets llevan hash en el nombre, así que no se pueden listar acá.
 * Se leen del propio index.html: es la única fuente que siempre está al día,
 * y se vuelve a leer en cada versión del service worker.
 *
 * Hace falta hacerlo en la instalación: cuando el worker toma control, la
 * página que lo registró ya cargó sus assets sin pasar por él, así que nunca
 * llegarían al caché por la vía normal. Sin esto, abrir sin red devuelve el
 * HTML pero sin el código: una pantalla en blanco.
 */
async function precachear() {
  const cache = await caches.open(CACHE);
  await cache.addAll(ESENCIALES);

  try {
    const html = await (await fetch('/index.html', { cache: 'reload' })).text();
    const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((m) => m[1]);
    if (assets.length > 0) await cache.addAll([...new Set(assets)]);
  } catch {
    // Sin assets precacheados la app igual instala; pierde el modo sin conexión
    // hasta la próxima visita con red.
  }
}

self.addEventListener('install', (evento) => {
  evento.waitUntil(precachear().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches.keys()
      .then((nombres) => Promise.all(nombres.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (evento) => {
  const peticion = evento.request;
  if (peticion.method !== 'GET') return;

  const url = new URL(peticion.url);
  if (url.origin !== self.location.origin) return;   // Supabase, fuentes: pasan de largo
  if (url.pathname.startsWith('/.netlify/')) return; // las funciones no se cachean

  // Navegación: red primero para no servir una versión vieja de la app, y el
  // caché solo cuando no hay red.
  if (peticion.mode === 'navigate') {
    evento.respondWith(
      fetch(peticion)
        .then((respuesta) => {
          const copia = respuesta.clone();
          caches.open(CACHE).then((c) => c.put('/index.html', copia));
          return respuesta;
        })
        .catch(() => caches.match('/index.html', { ignoreVary: true }).then((r) => r || Response.error())),
    );
    return;
  }

  // Estáticos: se sirve el caché al instante y se actualiza por detrás. Los
  // nombres llevan hash, así que una versión vieja nunca pisa a una nueva.
  //
  // `ignoreVary` es obligatorio: el servidor manda `Vary: Accept-Encoding`, y
  // sin esto una diferencia de compresión entre la petición guardada y la
  // nueva hace que el caché no encuentre nada y la app abra en blanco.
  evento.respondWith(
    caches.match(peticion, { ignoreVary: true }).then((cacheada) => {
      const red = fetch(peticion)
        .then((respuesta) => {
          if (respuesta.ok) {
            const copia = respuesta.clone();
            caches.open(CACHE).then((c) => c.put(peticion, copia));
          }
          return respuesta;
        })
        .catch(() => cacheada || Response.error());
      return cacheada || red;
    }),
  );
});

self.addEventListener('push', (evento) => {
  let datos = {};
  try {
    datos = evento.data ? evento.data.json() : {};
  } catch {
    datos = { titulo: 'En Punto', cuerpo: evento.data ? evento.data.text() : '' };
  }

  evento.waitUntil(
    self.registration.showNotification(datos.titulo || 'En Punto', {
      body: datos.cuerpo || '',
      // El tag reemplaza el aviso anterior del mismo momento en vez de
      // apilarlo: nadie quiere seis notificaciones del mismo almuerzo.
      tag: datos.tag || 'en-punto',
      renotify: true,
      data: { url: datos.url || '/' },
    }),
  );
});

self.addEventListener('notificationclick', (evento) => {
  evento.notification.close();
  const destino = (evento.notification.data && evento.notification.data.url) || '/';

  evento.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((ventanas) => {
      for (const v of ventanas) {
        if (v.url.includes(self.location.origin) && 'focus' in v) return v.focus();
      }
      return self.clients.openWindow(destino);
    }),
  );
});
