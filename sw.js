// Delete old website caches, do not cache authentication or code.
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil((async()=>{await self.registration.unregister();await self.clients.claim();})()));
