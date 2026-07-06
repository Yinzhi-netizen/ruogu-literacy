const cacheName = "ruogu-literacy-v17";
const assets = [
  "./",
  "./index.html",
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
  "./duel-system.js",
  "./ui-common.js",
  "./app.js",
  "./manifest.webmanifest",
  "./icons/icon-180.png",
  "./icons/icon-192.svg",
  "./icons/icon-512.svg",
  "./assets/weapons-png/01_jingubang.png",
  "./assets/weapons-png/02_jiuchidingpa.png",
  "./assets/weapons-png/04_sanjianliangrendao.png",
  "./assets/weapons-png/05_bajiaoshan.png",
  "./assets/weapons-png/11_dashenbian.png",
  "./assets/weapons-png/12_fantianyin.png",
  "./assets/weapons-png/13_qiankunquan.png",
  "./assets/weapons-png/16_shuimochanzhang.png",
  "./assets/weapons-png/18_langyabang.png",
  "./assets/weapons-png/24_jinshejian.png",
  "./Ruogu Painting/cutouts/1_cutout.png",
  "./Ruogu Painting/cutouts/2_cutout.png",
  "./Ruogu Painting/cutouts/4_cutout.png",
  "./Ruogu Painting/cutouts/5_cutout.png",
  "./Ruogu Painting/cutouts/6_cutout.png",
  "./Ruogu Painting/cutouts/10_cutout.png"
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
