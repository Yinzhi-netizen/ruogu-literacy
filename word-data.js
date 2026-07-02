// 若谷识字 · 词表与库内字集
// 依赖：grade1-words.js (window.RUOGU_OCR)、pinyin-data.js (window.RUOGU_PINYIN)

(function () {
  const OCR = window.RUOGU_OCR || {};
  const PINYIN = window.RUOGU_PINYIN || {};

  // 构建：每个词 → { word, pinyin, vol, unit, lesson, isWrite }
  // isWrite=true 表示该词在任一课的 write 里出现过；听写关只出会写词
  function buildWordTable(scope) {
    const vols = scope === "全部" ? ["上册", "下册"] : [scope];
    const out = [];
    const index = new Map(); // key(vol|word) → 词对象，便于合并 isWrite

    vols.forEach((vol) => {
      (OCR[vol] || []).forEach((u) => {
        u.lessons.forEach((l) => {
          const push = (w, isWrite) => {
            const key = vol + "|" + w;
            if (index.has(key)) {
              // 已存在：只要任一处是会写，就标为会写词
              if (isWrite) index.get(key).isWrite = true;
              return;
            }
            const item = {
              word: w,
              pinyin: PINYIN[w] || "",
              vol,
              unit: u.unit,
              lesson: l.title,
              isWrite
            };
            index.set(key, item);
            out.push(item);
          };
          (l.recognize || []).forEach((w) => push(w, false));
          (l.write || []).forEach((w) => push(w, true));
        });
      });
    });
    return out;
  }

  // 库内字集：全册会认+会写词拆出的所有单字（与出题范围无关），用于阅读关判断新字
  const LIB_CHARS = (function () {
    const set = new Set();
    for (const vol of ["上册", "下册"]) {
      (OCR[vol] || []).forEach((u) =>
        u.lessons.forEach((l) => {
          [...(l.recognize || []), ...(l.write || [])].forEach((w) => {
            [...w].forEach((c) => {
              if (/[一-鿿]/.test(c)) set.add(c);
            });
          });
        })
      );
    }
    return set;
  })();

  // 文本认字率：库内字占比
  function textCoverage(text) {
    const han = [...text].filter((c) => /[一-鿿]/.test(c));
    if (!han.length) return 100;
    const known = han.filter((c) => LIB_CHARS.has(c)).length;
    return Math.round((known / han.length) * 100);
  }

  function isLibChar(c) {
    return LIB_CHARS.has(c);
  }

  // 打乱数组（用于干扰项）
  function shuffle(list) {
    return [...list].sort(() => Math.random() - 0.5);
  }

  window.RUOGU_WORD_DATA = {
    OCR,
    PINYIN,
    buildWordTable,
    LIB_CHARS,
    textCoverage,
    isLibChar,
    shuffle
  };
})();
