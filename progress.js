// 若谷识字 · 会认/会写熟练度模型
// 依赖：state-store.js、word-data.js

(function () {
  const STATE = window.RUOGU_STATE;
  const DATA = window.RUOGU_WORD_DATA;

  const MASTER_THRESHOLD = 2; // 连续/累计正确 2 次算掌握

  function ensureProficiency(word) {
    const profile = STATE.active();
    if (!profile.proficiency) profile.proficiency = {};
    const p = profile.proficiency;
    if (!p[word]) {
      p[word] = {
        read: { hits: 0, errors: 0, streak: 0, lastSeen: 0, mastered: false },
        write: { hits: 0, errors: 0, streak: 0, lastSeen: 0, mastered: false },
        learnedAt: 0,
        lastReview: 0
      };
    }
    return p[word];
  }

  function now() {
    return Date.now();
  }

  function updateLearnedAt(prof, word) {
    const p = prof || ensureProficiency(word);
    if (p.read.mastered || p.write.mastered) {
      if (!p.learnedAt) p.learnedAt = now();
    }
  }

  function recordReadSuccess(word) {
    const p = ensureProficiency(word);
    const r = p.read;
    r.hits += 1;
    r.streak += 1;
    r.errors = 0;
    r.lastSeen = now();
    if (r.hits >= MASTER_THRESHOLD) r.mastered = true;
    p.lastReview = now();
    updateLearnedAt(p, word);
    STATE.save();
  }

  function recordWriteSuccess(word) {
    const p = ensureProficiency(word);
    const w = p.write;
    w.hits += 1;
    w.streak += 1;
    w.errors = 0;
    w.lastSeen = now();
    if (w.hits >= MASTER_THRESHOLD) w.mastered = true;
    p.lastReview = now();
    updateLearnedAt(p, word);
    STATE.save();
  }

  function recordError(word, mode) {
    const p = ensureProficiency(word);
    const slot = mode === "write" ? p.write : p.read;
    slot.errors += 1;
    slot.streak = 0;
    slot.lastSeen = now();
    // 出错后取消 mastered，需要重新连续答对
    slot.mastered = false;
    STATE.save();
  }

  function isMasteredRead(word) {
    const p = (STATE.active().proficiency || {})[word];
    return !!(p && p.read && p.read.mastered);
  }

  function isMasteredWrite(word) {
    const p = (STATE.active().proficiency || {})[word];
    return !!(p && p.write && p.write.mastered);
  }

  // 兼容旧语义：会认或会写任一掌握即算熟悉
  function isFamiliar(word) {
    return isMasteredRead(word) || isMasteredWrite(word);
  }

  // 识字熟练度档位（按答对次数）：0=没见过, 1=浅, 2=中, 3=(≥3次)深
  // 取会认/会写中较高的答对次数，认读或听写答对都能推进档位
  function readLevel(word) {
    const p = (STATE.active().proficiency || {})[word];
    if (!p) return 0;
    const hits = Math.max((p.read && p.read.hits) || 0, (p.write && p.write.hits) || 0);
    if (hits <= 0) return 0;
    if (hits === 1) return 1;
    if (hits === 2) return 2;
    return 3;
  }

  function needsReview(word) {
    const p = (STATE.active().proficiency || {})[word];
    if (!p) return false;
    if ((p.read.errors || 0) > 0 || (p.write.errors || 0) > 0) return true;
    const lastSeen = Math.max(p.read.lastSeen || 0, p.write.lastSeen || 0, p.lastReview || 0);
    if (!lastSeen) return false;
    const daysSince = (now() - lastSeen) / 86400000;
    return daysSince > 7;
  }

  // 阅读关完成后，对故事中出现过的词增加会认曝光
  // articleKey 用于防止同一篇文章重复加分
  function recordReadingExposure(storyText, articleKey) {
    const profile = STATE.active();
    if (!profile.readExposure) profile.readExposure = {};
    const exposure = profile.readExposure;

    // 收集故事中出现的所有汉字
    const storyChars = new Set([...storyText].filter((c) => /[一-鿿]/.test(c)));
    if (!storyChars.size) return;

    // 遍历当前词表，词中任意一字出现在故事中即加分
    const words = DATA.buildWordTable(profile.scope || "全部");
    let changed = false;
    words.forEach((item) => {
      const w = item.word;
      const key = articleKey + "|" + w;
      if (exposure[key]) return; // 本篇文章已加过
      const appears = [...w].some((c) => storyChars.has(c));
      if (appears) {
        recordReadSuccess(w);
        exposure[key] = true;
        changed = true;
      }
    });
    if (changed) STATE.save();
  }

  function getLiteracyRates(words) {
    if (!words || words.length === 0) return { readRate: 0, writeRate: 0 };
    const readCount = words.filter((w) => isMasteredRead(w.word)).length;
    const writeCount = words.filter((w) => isMasteredWrite(w.word)).length;
    return {
      readRate: Math.round((readCount / words.length) * 100),
      writeRate: Math.round((writeCount / words.length) * 100)
    };
  }

  // 故事覆盖率：基于会认字（read.mastered）覆盖故事中的汉字
  function passageCoverage(story) {
    const text = typeof story === "string" ? story : story.text;
    const chars = [...text].filter((c) => c !== "，" && c !== "。" && c !== "、" && /[一-鿿]/.test(c));
    if (!chars.length) return 0;

    const profile = STATE.active();
    const prof = profile.proficiency || {};

    // 收集所有已会认词中的字
    const masteredChars = new Set();
    Object.entries(prof).forEach(([word, p]) => {
      if (p.read && p.read.mastered) {
        [...word].forEach((c) => masteredChars.add(c));
      }
    });

    const known = chars.filter((c) => masteredChars.has(c)).length;
    return Math.round((known / chars.length) * 100);
  }

  // 迁移旧 known：旧 count → 新 proficiency
  function migrateOldKnown() {
    const profile = STATE.active();
    const oldKnown = profile.known;
    if (!oldKnown || typeof oldKnown !== "object") return;

    if (!profile.proficiency) profile.proficiency = {};
    const prof = profile.proficiency;

    Object.entries(oldKnown).forEach(([word, n]) => {
      const hits = Math.max(0, Number(n) || 0);
      const mastered = hits >= MASTER_THRESHOLD;
      prof[word] = {
        read: { hits, errors: 0, streak: hits, lastSeen: now(), mastered },
        write: { hits, errors: 0, streak: hits, lastSeen: now(), mastered },
        learnedAt: mastered ? now() : 0,
        lastReview: now()
      };
    });

    delete profile.known;
    STATE.save();
  }

  // 初始化：迁移旧 known（如果有）
  function init() {
    migrateOldKnown();
  }

  window.RUOGU_PROGRESS = {
    init,
    recordReadSuccess,
    recordWriteSuccess,
    recordError,
    recordReadingExposure,
    isMasteredRead,
    isMasteredWrite,
    isFamiliar,
    readLevel,
    needsReview,
    getLiteracyRates,
    passageCoverage,
    migrateOldKnown
  };
})();
