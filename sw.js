// エネルギー管理ダッシュボード用の簡易Service Worker
// 同一オリジンのアプリ本体（index.html/app.compiled.js等）はネットワーク優先＋失敗時にキャッシュへフォールバック。
// こうしないと「キャッシュ優先」ではコード修正後も常に1つ前のバージョンが表示され続けてしまう。
// CDN（バージョン固定URL）はキャッシュ優先で保持し、初回オンライン後はオフラインでも起動できるようにする。
const CACHE_NAME = "energy-app-cache-v2";
const APP_SHELL = [
  "./",
  "./index.html",
  "./app.compiled.js",
  "./manifest.json",
  "./data/energy-data.js",
  "./data/holidays.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const isSameOrigin = event.request.url.startsWith(self.location.origin);

  if (isSameOrigin) {
    // アプリ本体：ネットワーク優先（常に最新を取得し、オフライン時のみキャッシュを使う）
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
  } else {
    // CDN（バージョン固定URL）：キャッシュ優先
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          if (response && (response.ok || response.type === "opaque")) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        });
      })
    );
  }
});
