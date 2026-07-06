// 若谷识字 · 多档案状态管理
// 负责：localStorage 读写、历史版本迁移、档案切换、数据备份

(function () {
  const PROFILES_KEY = "ruogu-literacy-profiles-v1";
  const MIGRATED_FLAG = "ruogu-literacy-migrated-v1";
  const BACKUP_KEY = "ruogu-literacy-backup-v1";

  const LEGACY_KEYS = [
    "ruogu-literacy-state-v5",
    "ruogu-literacy-state-v4",
    "ruogu-literacy-state-v3"
  ];

  let profilesCache = null;

  function freshProfile(id, name) {
    return {
      id,
      name,
      version: 1,
      totalStars: 0,
      cursor: 0,
      readingCursor: 0,
      readingCat: "recite",
      scope: "全部",
      known: {},              // 旧字段，初始化时由 progress.js 迁移为 proficiency
      proficiency: {},        // 新熟练度模型，由 progress.js 初始化/迁移
      completedReadings: {},
      learnedAt: {}
    };
  }

  function backupLegacy() {
    try {
      const backup = {};
      LEGACY_KEYS.forEach((key) => {
        const value = localStorage.getItem(key);
        if (value) backup[key] = value;
      });
      if (Object.keys(backup).length) {
        localStorage.setItem(BACKUP_KEY, JSON.stringify(backup));
      }
    } catch {}
  }

  function readLegacy() {
    for (const key of LEGACY_KEYS) {
      try {
        const raw = localStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === "object") {
            return { key, data: parsed };
          }
        }
      } catch {}
    }
    return null;
  }

  function migrateLegacy() {
    // 已有新结构则不重复迁移
    if (localStorage.getItem(MIGRATED_FLAG)) return false;

    backupLegacy();

    const legacy = readLegacy();
    const profile = freshProfile("ruogu", "若谷");

    if (legacy && legacy.data) {
      const d = legacy.data;
      if (typeof d.totalStars === "number") profile.totalStars = Math.max(0, d.totalStars);
      if (typeof d.cursor === "number") profile.cursor = d.cursor;
      if (typeof d.readingCursor === "number") profile.readingCursor = d.readingCursor;
      if (d.readingCat) profile.readingCat = d.readingCat;
      if (d.scope) profile.scope = d.scope;
      if (d.completedReadings) profile.completedReadings = d.completedReadings;
      if (d.learnedAt) profile.learnedAt = d.learnedAt;
      // 保留旧 known 给 progress.js 迁移
      if (d.known && typeof d.known === "object") profile.known = d.known;
    }

    profilesCache = {
      activeId: profile.id,
      profiles: { [profile.id]: profile }
    };

    saveProfiles();
    localStorage.setItem(MIGRATED_FLAG, "true");
    return true;
  }

  function loadProfiles() {
    if (profilesCache) return profilesCache;

    try {
      const raw = localStorage.getItem(PROFILES_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.profiles && parsed.activeId && parsed.profiles[parsed.activeId]) {
          profilesCache = parsed;
          return profilesCache;
        }
      }
    } catch {}

    migrateLegacy();
    return profilesCache;
  }

  function saveProfiles() {
    try {
      localStorage.setItem(PROFILES_KEY, JSON.stringify(profilesCache));
    } catch {}
  }

  function active() {
    const p = loadProfiles();
    return p.profiles[p.activeId];
  }

  function switchProfile(id) {
    const p = loadProfiles();
    if (p.profiles[id]) {
      p.activeId = id;
      saveProfiles();
      return true;
    }
    return false;
  }

  function createProfile(id, name) {
    const p = loadProfiles();
    if (p.profiles[id]) return false;
    p.profiles[id] = freshProfile(id, name);
    p.activeId = id;
    saveProfiles();
    return true;
  }

  function removeProfile(id) {
    const p = loadProfiles();
    if (!p.profiles[id]) return false;
    delete p.profiles[id];
    if (p.activeId === id) {
      const ids = Object.keys(p.profiles);
      p.activeId = ids.length ? ids[0] : "";
    }
    saveProfiles();
    return true;
  }

  function profileList() {
    const p = loadProfiles();
    return Object.values(p.profiles).map((x) => ({ id: x.id, name: x.name }));
  }

  // 兼容层：让旧代码能直接读写当前档案字段
  function get(key) {
    return active()[key];
  }

  function set(key, value) {
    active()[key] = value;
    saveProfiles();
  }

  function setSilent(key, value) {
    active()[key] = value;
  }

  function save() {
    saveProfiles();
  }

  function exportProfiles() {
    return JSON.stringify({
      kind: "ruogu-literacy-profiles",
      version: 1,
      exportedAt: new Date().toISOString(),
      data: loadProfiles()
    }, null, 2);
  }

  function importProfiles(text) {
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error("档案不是有效的 JSON。");
    }
    const data = parsed && parsed.kind === "ruogu-literacy-profiles" ? parsed.data : parsed;
    if (!data || !data.activeId || !data.profiles || !data.profiles[data.activeId]) {
      throw new Error("没有找到可用的若谷识字档案。");
    }
    try {
      localStorage.setItem(`${BACKUP_KEY}-${Date.now()}`, JSON.stringify(loadProfiles()));
    } catch {}
    profilesCache = data;
    saveProfiles();
    localStorage.setItem(MIGRATED_FLAG, "true");
    return active();
  }

  window.RUOGU_STATE = {
    freshProfile,
    loadProfiles,
    saveProfiles,
    active,
    switchProfile,
    createProfile,
    removeProfile,
    profileList,
    migrateLegacy,
    get,
    set,
    setSilent,
    save,
    exportProfiles,
    importProfiles,
    PROFILES_KEY,
    BACKUP_KEY
  };
})();
