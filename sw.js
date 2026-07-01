const cacheName = "ruogu-literacy-v10";
const assets = [
  "./",
  "./index.html",
  "./game.html",
  "./styles.css",
  "./grade1-words.js",
  "./pinyin-data.js",
  "./reading-texts.js",
  "./words.js",
  "./app.js",
  "./manifest.webmanifest",
  "./icons/icon-180.png",
  "./icons/icon-192.svg",
  "./icons/icon-512.svg"
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(cacheName).then((cache) => cache.addAll(assets)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((keys) =>
        Promise.all(keys.filter((key) => key !== cacheName).map((key) => caches.delete(key)))
      ),
      self.clients.claim()
    ])
  );
});

// Network-first for js/html/css：确保代码更新能立即生效；失败时回退缓存（离线可用）
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);
  const isCode = /\.(js|css|html|webmanifest)$/i.test(url.pathname) || url.pathname.endsWith("/");
  if (isCode) {
    event.respondWith(
      fetch(req).then((res) => {
        const clone = res.clone();
        caches.open(cacheName).then((cache) => cache.put(req, clone)).catch(() => {});
        return res;
      }).catch(() => caches.match(req))
    );
  } else {
    event.respondWith(caches.match(req).then((cached) => cached || fetch(req)));
  }
});
