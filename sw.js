const cacheName = "ruogu-literacy-v23";
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
  "./ui-common.js",
  "./duel-link.js",
  "./app.js",
  "./manifest.webmanifest",
  "./icons/icon-180.png",
  "./icons/icon-192.svg",
  "./icons/icon-512.svg",
  "./assets/weapons-held/01_jingubang_r.png",
  "./assets/weapons-held/01_jingubang_l.png",
  "./assets/weapons-held/02_jiuchidingpa_r.png",
  "./assets/weapons-held/02_jiuchidingpa_l.png",
  "./assets/weapons-held/03_jiangyaobaozhang_r.png",
  "./assets/weapons-held/03_jiangyaobaozhang_l.png",
  "./assets/weapons-held/04_sanjianliangrendao_r.png",
  "./assets/weapons-held/04_sanjianliangrendao_l.png",
  "./assets/weapons-held/05_bajiaoshan_r.png",
  "./assets/weapons-held/05_bajiaoshan_l.png",
  "./assets/weapons-held/06_qinglongyanyuedao_r.png",
  "./assets/weapons-held/06_qinglongyanyuedao_l.png",
  "./assets/weapons-held/07_zhangbashemao_r.png",
  "./assets/weapons-held/07_zhangbashemao_l.png",
  "./assets/weapons-held/08_fangtianhuaji_r.png",
  "./assets/weapons-held/08_fangtianhuaji_l.png",
  "./assets/weapons-held/09_qinggangjian_r.png",
  "./assets/weapons-held/09_qinggangjian_l.png",
  "./assets/weapons-held/10_qixingbaodao_r.png",
  "./assets/weapons-held/10_qixingbaodao_l.png",
  "./assets/weapons-held/11_dashenbian_r.png",
  "./assets/weapons-held/11_dashenbian_l.png",
  "./assets/weapons-held/12_fantianyin_r.png",
  "./assets/weapons-held/12_fantianyin_l.png",
  "./assets/weapons-held/13_qiankunquan_r.png",
  "./assets/weapons-held/13_qiankunquan_l.png",
  "./assets/weapons-held/14_huojianqiang_r.png",
  "./assets/weapons-held/14_huojianqiang_l.png",
  "./assets/weapons-held/15_jiulongshenhuozhao_r.png",
  "./assets/weapons-held/15_jiulongshenhuozhao_l.png",
  "./assets/weapons-held/16_shuimochanzhang_r.png",
  "./assets/weapons-held/16_shuimochanzhang_l.png",
  "./assets/weapons-held/17_shuangbanfu_r.png",
  "./assets/weapons-held/17_shuangbanfu_l.png",
  "./assets/weapons-held/18_langyabang_r.png",
  "./assets/weapons-held/18_langyabang_l.png",
  "./assets/weapons-held/19_xuehuabingtiejiedao_r.png",
  "./assets/weapons-held/19_xuehuabingtiejiedao_l.png",
  "./assets/weapons-held/20_goulianqiang_r.png",
  "./assets/weapons-held/20_goulianqiang_l.png",
  "./assets/weapons-held/21_xuantiezhongjian_r.png",
  "./assets/weapons-held/21_xuantiezhongjian_l.png",
  "./assets/weapons-held/22_tulongdao_r.png",
  "./assets/weapons-held/22_tulongdao_l.png",
  "./assets/weapons-held/23_yitianjian_r.png",
  "./assets/weapons-held/23_yitianjian_l.png",
  "./assets/weapons-held/24_jinshejian_r.png",
  "./assets/weapons-held/24_jinshejian_l.png",
  "./assets/weapons-held/25_dagoubang_r.png",
  "./assets/weapons-held/25_dagoubang_l.png"
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
