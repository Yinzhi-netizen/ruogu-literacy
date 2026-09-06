// 若谷识字 · 词表与库内字集
// 依赖：grade1-words.js (window.RUOGU_OCR)、grade2-words.js (window.RUOGU_OCR_G2)、
//       pinyin-data.js + grade2-pinyin.js (window.RUOGU_PINYIN)

(function () {
  const PINYIN = window.RUOGU_PINYIN || {};

  // 统一数据源：年级 → 册 → 单元 → 课文（一年级数据在 RUOGU_OCR，二年级在 RUOGU_OCR_G2）
  const SOURCES = [];
  [["一年级", window.RUOGU_OCR || {}], ["二年级", window.RUOGU_OCR_G2 || {}]].forEach(([grade, data]) => {
    Object.keys(data).forEach((vol) => {
      SOURCES.push({ grade, vol, units: data[vol] || [] });
    });
  });

  function grades() {
    return SOURCES.map((s) => s.grade).filter((g, i, arr) => arr.indexOf(g) === i);
  }

  // 某年级有哪些册（"全部" + 实际存在的册）
  function volsOf(grade) {
    const vols = SOURCES.filter((s) => s.grade === grade).map((s) => s.vol);
    return vols.length > 1 ? ["全部", ...vols] : vols;
  }

  // 展开成扁平条目 [{grade, vol, unitLabel, unitObj}]
  // scope="全部" 时单元名前加册名前缀（如「上册·第一单元」），避免上下册单元重名
  function listEntries(grade, scope) {
    const out = [];
    SOURCES.filter((s) => s.grade === grade && (scope === "全部" || s.vol === scope)).forEach((s) => {
      const multiVol = volsOf(s.grade).length > 2; // "全部" + 多于1册
      s.units.forEach((u) => {
        out.push({
          grade: s.grade,
          vol: s.vol,
          unitLabel: scope === "全部" && multiVol ? s.vol + "·" + u.unit : u.unit,
          unitObj: u
        });
      });
    });
    return out;
  }

  // 某年级某册（或全部）的单元名列表
  function unitsOf(grade, scope) {
    const seen = [];
    listEntries(grade, scope).forEach((e) => {
      if (!seen.includes(e.unitLabel)) seen.push(e.unitLabel);
    });
    return seen;
  }

  // 某单元下的课文标题列表（unit=null 表示全部单元）
  function lessonsOf(grade, scope, unit) {
    const seen = [];
    listEntries(grade, scope).forEach((e) => {
      if (unit && e.unitLabel !== unit) return;
      e.unitObj.lessons.forEach((l) => {
        if (!seen.includes(l.title)) seen.push(l.title);
      });
    });
    return seen;
  }

  // 构建词表：{ word, pinyin, grade, vol, unit, lesson, isWrite }
  // isWrite=true 表示该词在任一课的 write 里出现过；听写关只出会写词
  // 兼容旧调用：buildWordTable("全部"|"上册"|"下册") → 一年级对应范围
  function buildWordTable(grade, scope, unit, lesson) {
    if (scope === undefined) { scope = grade; grade = "一年级"; }
    scope = scope || "全部";
    if (volsOf(grade).indexOf(scope) === -1) scope = "全部";

    const out = [];
    const index = new Map(); // key(grade|vol|word) → 词对象，便于合并 isWrite

    listEntries(grade, scope).forEach((e) => {
      if (unit && e.unitLabel !== unit) return;
      e.unitObj.lessons.forEach((l) => {
        if (lesson && l.title !== lesson) return;
        const push = (w, isWrite) => {
          const key = grade + "|" + e.vol + "|" + w;
          if (index.has(key)) {
            // 已存在：只要任一处是会写，就标为会写词
            if (isWrite) index.get(key).isWrite = true;
            return;
          }
          const item = {
            word: w,
            pinyin: PINYIN[w] || "",
            grade,
            vol: e.vol,
            unit: e.unitObj.unit,
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
    return out;
  }

  // 库内字集：两个年级会认+会写词拆出的所有单字（与出题范围无关），用于阅读关判断新字
  const LIB_CHARS = (function () {
    const set = new Set();
    SOURCES.forEach((s) => {
      s.units.forEach((u) =>
        u.lessons.forEach((l) => {
          [...(l.recognize || []), ...(l.write || [])].forEach((w) => {
            [...w].forEach((c) => {
              if (/[一-鿿]/.test(c)) set.add(c);
            });
          });
        })
      );
    });
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
    OCR: window.RUOGU_OCR || {},
    OCR_G2: window.RUOGU_OCR_G2 || {},
    PINYIN,
    grades,
    volsOf,
    unitsOf,
    lessonsOf,
    buildWordTable,
    LIB_CHARS,
    textCoverage,
    isLibChar,
    shuffle
  };
})();
