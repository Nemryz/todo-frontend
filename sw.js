const CACHE_NAME    = 'infinity-todo-v4';
const CACHE_ASSETS  = [
    '/',
    '/index.html',
    '/src/main.js',
    '/style.css',
    '/manifest.json',
    '/js/supabase.min.js',
    '/js/sortable.min.js',
    '/js/confetti.min.js',
];

// ─── Install: pre-cachear assets estáticos ──────────────────────────────────
self.addEventListener('install', event => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(CACHE_ASSETS))
    );
});

// ─── Activate: limpiar cachés viejos ────────────────────────────────────────
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
        ).then(() => self.clients.claim())
    );
});

// ─── Fetch: estrategia por tipo de recurso ───────────────────────────────────
self.addEventListener('fetch', event => {
    const { request } = event;
    const url = new URL(request.url);

    // Solo manejar peticiones del mismo origen (no Supabase, no externas)
    if (url.origin !== self.location.origin) return;

    // Rutas de API: Network-First (datos dinámicos)
    if (url.pathname.startsWith('/api/')) {
        event.respondWith(networkFirst(request));
        return;
    }

    // Assets estáticos: Cache-First
    event.respondWith(cacheFirst(request));
});

// Cache-First: sirve desde caché, fallback a red y actualiza caché
async function cacheFirst(request) {
    const cached = await caches.match(request);
    if (cached) return cached;
    try {
        const response = await fetch(request);
        if (response.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, response.clone());
        }
        return response;
    } catch {
        // Offline fallback para navegación
        if (request.mode === 'navigate') {
            return caches.match('/index.html');
        }
        return new Response('Offline', { status: 503 });
    }
}

// Network-First: intenta red, fallback a caché si falla
async function networkFirst(request) {
    try {
        const response = await fetch(request);
        return response;
    } catch {
        const cached = await caches.match(request);
        return cached || new Response(JSON.stringify({ error: 'Sin conexión' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
