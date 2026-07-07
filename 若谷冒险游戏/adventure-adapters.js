// 若谷大冒险 · 适配层
// 独立版只读主 App weapons.js；阶段二在这里切换题库、星星和 profile 存档。

window.RUOGU_ADVENTURE_ADAPTERS = (function () {
  "use strict";

  const DATA = window.RUOGU_ADVENTURE_DATA;
  const SAVE_KEY = "ruogu-adventure-v2";

  // ---------- 阶段二接入钩子 ----------
  // 主 App 可以通过 setQuestionProvider 注入真实题库，
  // 或通过 setStarSource 注入星星/碎片来源。
  let questionProvider = null;
  let starSource = null;

  function setQuestionProvider(fn) {
    questionProvider = fn;
  }

  function setStarSource(fn) {
    starSource = fn;
  }

  // ---------- 工具 ----------
  function shuffle(list) {
    const out = list.slice();
    for (let i = out.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = out[i];
      out[i] = out[j];
      out[j] = tmp;
    }
    return out;
  }

  // ---------- 武器适配 ----------
  function normalizeWeapon(weapon, index) {
    return {
      id: weapon.id || `weapon-${index}`,
      name: weapon.name || "神兵",
      mark: weapon.mark || "兵",
      source: weapon.source || "若谷神兵库",
      hero: weapon.hero || "若谷侠",
      power: Number(weapon.power || 50),
      fragmentsRequired: Number(weapon.fragmentsRequired || 10),
      image: weapon.image
        ? "../" + weapon.image.replace(/^\.\//, "")
        : "",
      intro: weapon.intro || ""
    };
  }

  function weapons() {
    const source = window.RUOGU_WEAPONS || [];
    if (source.length) return source.map(normalizeWeapon);
    return [
      {
        id: "quan",
        name: "小拳头",
        mark: "拳",
        source: "若谷大冒险",
        hero: "若谷侠",
        power: 45,
        fragmentsRequired: 0,
        image: "",
        intro: "没有神兵也能出发。"
      }
    ];
  }

  // ---------- 存档 ----------
  function defaultSave() {
    const firstWeapon = weapons()[0];
    return {
      version: 2,
      cleared: [],
      opened: [],
      armors: ["cloth"],
      equippedArmor: "cloth",
      equippedWeapon: firstWeapon.id,
      hp: DATA.HERO.maxHp,
      stars: 0,
      materials: {},
      bestRatings: {},
      defeated: []
    };
  }

  function migrateSave(raw) {
    if (!raw) return null;
    // 兼容 v1（ruogu-adventure-v1）和当前不完整的 v2
    const migrated = Object.assign({}, defaultSave(), raw);
    if (!Array.isArray(migrated.cleared)) migrated.cleared = [];
    if (!Array.isArray(migrated.opened)) migrated.opened = [];
    if (!Array.isArray(migrated.armors)) migrated.armors = ["cloth"];
    if (!migrated.equippedArmor) migrated.equippedArmor = "cloth";
    if (!migrated.equippedWeapon) migrated.equippedWeapon = weapons()[0].id;
    if (typeof migrated.hp !== "number") migrated.hp = DATA.HERO.maxHp;
    if (typeof migrated.stars !== "number") migrated.stars = 0;
    if (!migrated.materials || typeof migrated.materials !== "object") migrated.materials = {};
    if (!migrated.bestRatings || typeof migrated.bestRatings !== "object") migrated.bestRatings = {};
    if (!Array.isArray(migrated.defeated)) migrated.defeated = [];
    migrated.version = 2;
    return migrated;
  }

  function loadSave() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const migrated = migrateSave(parsed);
        if (migrated) return migrated;
      }
    } catch (error) {
      console.warn("[若谷大冒险] 读档失败，使用新存档", error);
    }
    return defaultSave();
  }

  function saveGame(save) {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    } catch (error) {
      console.warn("[若谷大冒险] 存档失败", error);
    }
  }

  // ---------- 出题 ----------
  function question(tier) {
    if (questionProvider) {
      const q = questionProvider(tier);
      if (q) return Object.assign({}, q, { options: shuffle(q.options || []) });
    }

    let pool = [];
    if (tier === "mixed") {
      pool = []
        .concat(DATA.QUESTION_BANK.recognize)
        .concat(DATA.QUESTION_BANK.reverse)
        .concat(DATA.QUESTION_BANK.similar)
        .concat(DATA.QUESTION_BANK.phrase)
        .concat(DATA.QUESTION_BANK.reading);
    } else {
      pool = DATA.QUESTION_BANK[tier] || DATA.QUESTION_BANK.recognize;
    }
    const item = pool[Math.floor(Math.random() * pool.length)];
    const answer = item.pinyin || item.answer;
    return Object.assign({}, item, {
      answer,
      options: shuffle(item.options || [])
    });
  }

  // ---------- 星星与碎片 ----------
  function fragmentProgress(stars) {
    const s = Math.max(0, Math.floor(Number(stars) || 0));
    const totalFragments = Math.floor(s / 10);
    const starsToNext = 10 - (s % 10 || 10);
    return { totalFragments, starsToNext };
  }

  function awardStars(save, amount) {
    const before = save.stars;
    save.stars += Math.max(0, amount);
    const progress = fragmentProgress(save.stars);
    const beforeProgress = fragmentProgress(before);
    const newFragments = progress.totalFragments - beforeProgress.totalFragments;
    return {
      totalStars: save.stars,
      newFragments,
      totalFragments: progress.totalFragments,
      starsToNextFragment: progress.starsToNext
    };
  }

  // ---------- 外部星星来源（阶段二） ----------
  function externalStars() {
    if (starSource) {
      try {
        return Number(starSource()) || 0;
      } catch (error) {
        console.warn("[若谷大冒险] 外部星星来源调用失败", error);
      }
    }
    return null;
  }

  return {
    SAVE_KEY,
    setQuestionProvider,
    setStarSource,
    weapons,
    loadSave,
    saveGame,
    question,
    fragmentProgress,
    awardStars,
    externalStars,
    shuffle
  };
})();
