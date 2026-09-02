/*
 * Service worker de En Punto.
 *
 * Su unico trabajo es recibir el push y mostrarlo. La decision de que notificar
 * ya la tomo el cron con el mismo motor que usa la pantalla, asi que aca no hay
 * logica de negocio: si la hubiera, se desincronizaria.
 */

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (evento) => evento.waitUntil(self.clients.claim()));

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
      badge: '/icono-badge.png',
      icon: '/icono-192.png',
      data: { url: datos.url || '/' },
    }),
  );
});

self.addEventListener('notificationclick', (evento) => {
  evento.notification.close();
  const destino = (evento.notification.data && evento.notification.data.url) || '/';

  evento.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((ventanas) => {
      // Si la app ya esta abierta se la enfoca, en vez de abrir otra pestaña.
      for (const v of ventanas) {
        if (v.url.includes(self.location.origin) && 'focus' in v) return v.focus();
      }
      return self.clients.openWindow(destino);
    }),
  );
});
