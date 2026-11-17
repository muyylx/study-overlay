// v2 cleanup: do not install a cache-first service worker on Safari.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil((async()=>{const keys=await caches.keys();await Promise.all(keys.filter(k=>k.startsWith('study-overlay-')).map(k=>caches.delete(k)));await self.registration.unregister();})()));
