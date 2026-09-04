const CACHE_NAME = 'zigzag-runner-v4';
const CACHE_PREFIX = 'zigzag-runner-';
const APP_PATH = '/zigzag-runner/';

const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './css/style.css',
    './js/app.js',
    './js/data.js',
    './js/i18n.js',
    './js/storage-manager.js',
    './js/leaderboard-manager.js',
    './js/sound-engine.js',
    './manifest.json',
    './icon-192.svg',
    './icon-512.svg',
    './assets/bg-opt.png',
    ...['ko', 'en', 'zh', 'hi', 'ru', 'ja', 'es', 'pt', 'id', 'tr', 'de', 'fr'].map((lang) => `./js/locales/${lang}.json`)
];

self.addEventListener('install', (event) => {
    event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE)));
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((names) => Promise.all(
            names
                .filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
                .map((name) => caches.delete(name))
        ))
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;

    const url = new URL(event.request.url);
    if (url.origin !== self.location.origin || !url.pathname.startsWith(APP_PATH)) return;

    event.respondWith(
        caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
            if (response.ok) {
                const copy = response.clone();
                caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
            }
            return response;
        }))
    );
});
