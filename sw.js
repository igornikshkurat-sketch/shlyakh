// Service worker: застосунок працює без інтернету, переглянуті тайли карти кешуються.
const APP = 'waysafe-app-v2';
const TILES = 'waysafe-tiles-v1';
const MAX_TILES = 20000;

const APP_FILES = [
  './', './index.html', './manifest.json', './icon.svg', './places.json',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js',
  'https://unpkg.com/pmtiles@3.2.1/dist/pmtiles.js',
  'https://unpkg.com/protomaps-leaflet@4.0.1/dist/protomaps-leaflet.js',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(APP).then(c => c.addAll(APP_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(k => k !== APP && k !== TILES).map(k => caches.delete(k))
  )).then(() => self.clients.claim()));
});

async function trimTiles() {
  const c = await caches.open(TILES);
  const keys = await c.keys();
  for (let i = 0; i < keys.length - MAX_TILES; i++) await c.delete(keys[i]);
}

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;

  // тайли OSM: спершу кеш, інакше мережа + зберегти
  if (url.hostname === 'tile.openstreetmap.org') {
    e.respondWith(caches.open(TILES).then(async c => {
      const hit = await c.match(e.request);
      if (hit) return hit;
      try {
        const res = await fetch(e.request);
        if (res.ok) { c.put(e.request, res.clone()); if (Math.random() < 0.02) trimTiles(); }
        return res;
      } catch {
        return new Response('', { status: 504 });
      }
    }));
    return;
  }

  // файли застосунку: мережа, якщо є (оновлення), інакше кеш
  e.respondWith(
    fetch(e.request).then(res => {
      if (res.ok && (url.origin === location.origin || APP_FILES.includes(e.request.url))) {
        const copy = res.clone();
        caches.open(APP).then(c => c.put(e.request, copy));
      }
      return res;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match('./index.html')))
  );
});
