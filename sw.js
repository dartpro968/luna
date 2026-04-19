// Minimal service worker for PWA installability requirements
self.addEventListener('install', (e) => {
    self.skipWaiting();
});

self.addEventListener('fetch', function(event) {
    // Pass through requests immediately. Caching can be added later if offline support is needed.
});
