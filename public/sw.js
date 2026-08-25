// Service worker mínimo — solo existe para que Chrome/Android considere el
// sitio instalable como app (uno de los criterios de instalabilidad es tener
// un service worker con manejador de "fetch" registrado). No cachea nada
// a propósito: los datos del ERP son en vivo, cachearlos podría mostrar
// información desactualizada.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (event) => event.respondWith(fetch(event.request)));
