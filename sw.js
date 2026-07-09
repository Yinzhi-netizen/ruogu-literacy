const cacheName = "ruogu-literacy-v28";
const assets = [
  "./",
  "./index.html",
  "./home.html",
  "./game.html",
  "./weapon-library.html",
  "./weapon-preview.html",
  "./library-view.html",
  "./styles.css",
  "./grade1-words.js",
  "./grade1-library.js",
  "./pinyin-data.js",
  "./reading-texts.js",
  "./words.js",
  "./weapons.js",
  "./state-store.js",
  "./word-data.js",
  "./progress.js",
  "./ocr-handwriting.js",
  "./weapon-system.js",
  "./ui-common.js",
  "./duel-link.js",
  "./app.js",
  "./若谷冒险游戏/index.html",
  "./manifest.webmanifest",
  "./icons/icon-180.png",
  "./icons/icon-192.svg",
  "./icons/icon-512.svg",
  "./assets/backgrounds/07_reading_galaxy_map_mobile.jpg",
  "./assets/backgrounds/pedestal_book_flat.png",
  "./assets/backgrounds/pedestal_book_stack.png",
  "./assets/backgrounds/06_cloud_characters_mobile.jpg",
  "./assets/backgrounds/05_scholar_mountain_mobile.jpg",
  "./assets/backgrounds/01_fengshen_cloud.jpg",
  "./assets/backgrounds/02_fire_mountain.jpg",
  "./assets/backgrounds/03_star_moon.jpg",
  "./assets/backgrounds/04_dragon_palace.jpg",
  "./assets/backgrounds/06_cloud_characters.jpg",
  "./assets/backgrounds/08_翠竹幽林.jpg",
  "./assets/backgrounds/09_碧海潮生.jpg",
  "./assets/backgrounds/10_冰封雪原.jpg",
  "./assets/backgrounds/11_桃源花谷.jpg",
  "./assets/backgrounds/12_雷霆深渊.jpg",
  "./assets/backgrounds/13_云端仙境.jpg"
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
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req).then((res) => {
          const clone = res.clone();
          caches.open(cacheName).then((cache) => cache.put(req, clone)).catch(() => {});
          return res;
        });
      })
    );
  }
});
