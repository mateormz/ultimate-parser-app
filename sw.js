// ParserLab Service Worker
// Strategy:
//   - /api/* requests: always go to network (AI endpoint, never cached).
//   - Same-origin GET requests: cache-first, with background update.
//   - Cross-origin (CDN, Google Fonts): not intercepted; browser HTTP cache handles it.

const CACHE_VERSION = 'parserlab-v1';
const PRECACHE_URLS = [
    './',
    './index.html',
    './manifest.json',
    './icon.svg',
    './css/style.css',
    './js/app.js',
    './js/grammar/grammar.js',
    './js/grammar/transformer.js',
    './js/parsers/recursive-descent.js',
    './js/parsers/ll1-parser.js',
    './js/parsers/lr-base.js',
    './js/parsers/lr-parsers.js',
    './js/visualizers/visualizers.js'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_VERSION)
            .then(cache => cache.addAll(PRECACHE_URLS))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET') return;

    const url = new URL(req.url);

    // Never cache or intercept API calls (AI endpoint requires fresh network).
    if (url.pathname.startsWith('/api/')) return;

    // Only handle same-origin requests; let cross-origin (CDNs) pass through.
    if (url.origin !== self.location.origin) return;

    event.respondWith(
        caches.match(req).then(cached => {
            const networkFetch = fetch(req)
                .then(response => {
                    if (response && response.ok) {
                        const copy = response.clone();
                        caches.open(CACHE_VERSION).then(c => c.put(req, copy)).catch(() => {});
                    }
                    return response;
                })
                .catch(() => cached); // offline fallback
            return cached || networkFetch;
        })
    );
});
