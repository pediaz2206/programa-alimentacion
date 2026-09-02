import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import './estilos.css';

// Se registra al arrancar, no al activar las notificaciones: que la app abra
// sin conexión no debería depender de haber dado permiso para avisos.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').catch(() => {
      // Sin service worker la app sigue andando: pierde el modo sin conexión.
    });
  });
}

const raiz = document.getElementById('root');
if (!raiz) throw new Error('Falta el nodo #root');
createRoot(raiz).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
