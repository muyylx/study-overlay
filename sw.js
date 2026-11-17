// This site deliberately does not cache app code or authentication data.
// Replaces and unregisters the former Study Overlay service worker.
self.addEventListener('install', e => { self.skipWaiting(); });
self.addEventListener('activate', e => e.waitUntil((async () => {
  for (const name of await caches.keys()) await caches.delete(name);
  await self.registration.unregister();
  await self.clients.claim();
})()));
