// 若谷识字 ↔ 小人对战 · 总星兑换桥
// 只读写当前识字档案，不清空、不迁移旧记录。

(function () {
  const PROFILES_KEY = "ruogu-literacy-profiles-v1";
  const BACKUP_KEY = "ruogu-literacy-duel-spend-backup-v1";
  const COSTS = {
    playTime: 50,
    rainbow: 20,
    transform: 30
  };
  const REWARDS = {
    playTimeSeconds: 5 * 60
  };
  const LIMITS = {
    rainbowPerBattle: 3,
    transformPerBattle: 2
  };

  function bundle() {
    if (window.RUOGU_STATE && window.RUOGU_STATE.loadProfiles) {
      return window.RUOGU_STATE.loadProfiles();
    }
    try {
      return JSON.parse(localStorage.getItem(PROFILES_KEY) || "null");
    } catch {
      return null;
    }
  }

  function saveBundle(data) {
    if (!data) return false;
    if (window.RUOGU_STATE && window.RUOGU_STATE.save) {
      window.RUOGU_STATE.save();
      return true;
    }
    localStorage.setItem(PROFILES_KEY, JSON.stringify(data));
    return true;
  }

  function activeProfile() {
    const data = bundle();
    return activeProfileFrom(data);
  }

  function activeProfileFrom(data) {
    if (!data || !data.activeId || !data.profiles || !data.profiles[data.activeId]) return null;
    return data.profiles[data.activeId];
  }

  function ensureWallet(profile) {
    if (!profile.duel || typeof profile.duel !== "object") profile.duel = {};
    const duel = profile.duel;
    duel.playSeconds = Math.max(0, Number(duel.playSeconds || 0));
    duel.rainbowTickets = Math.max(0, Number(duel.rainbowTickets || 0));
    duel.transformTickets = Math.max(0, Number(duel.transformTickets || 0));
    duel.spentStars = Math.max(0, Number(duel.spentStars || 0));
    return duel;
  }

  function backupBeforeSpend() {
    try {
      const data = bundle();
      if (data) localStorage.setItem(`${BACKUP_KEY}-${Date.now()}`, JSON.stringify(data));
    } catch {}
  }

  function summary() {
    const profile = activeProfile();
    if (!profile) {
      return {
        ok: false,
        totalStars: 0,
        playSeconds: 0,
        rainbowTickets: 0,
        transformTickets: 0,
        spentStars: 0,
        costs: COSTS,
        limits: LIMITS
      };
    }
    const duel = ensureWallet(profile);
    return {
      ok: true,
      totalStars: Math.max(0, Number(profile.totalStars || 0)),
      playSeconds: duel.playSeconds,
      rainbowTickets: duel.rainbowTickets,
      transformTickets: duel.transformTickets,
      spentStars: duel.spentStars,
      costs: COSTS,
      limits: LIMITS
    };
  }

  function spendStars(profile, amount) {
    const total = Math.max(0, Number(profile.totalStars || 0));
    if (total < amount) return false;
    backupBeforeSpend();
    profile.totalStars = total - amount;
    ensureWallet(profile).spentStars += amount;
    return true;
  }

  function purchase(kind) {
    const data = bundle();
    const profile = activeProfileFrom(data);
    if (!data || !profile) return { ok: false, message: "没有找到识字档案。" };
    const duel = ensureWallet(profile);

    if (kind === "playTime") {
      if (!spendStars(profile, COSTS.playTime)) return { ok: false, message: "星星不够，50 星换 5 分钟。" };
      duel.playSeconds += REWARDS.playTimeSeconds;
      saveBundle(data);
      return { ok: true, message: "已兑换 5 分钟小人对战。" };
    }
    if (kind === "rainbow") {
      if (!spendStars(profile, COSTS.rainbow)) return { ok: false, message: "星星不够，20 星换 1 次彩虹防护罩。" };
      duel.rainbowTickets += 1;
      saveBundle(data);
      return { ok: true, message: "已兑换 1 次彩虹防护罩。" };
    }
    if (kind === "transform") {
      if (!spendStars(profile, COSTS.transform)) return { ok: false, message: "星星不够，30 星换 1 次变身。" };
      duel.transformTickets += 1;
      saveBundle(data);
      return { ok: true, message: "已兑换 1 次变身。" };
    }
    return { ok: false, message: "未知兑换项目。" };
  }

  function consume(kind, amount = 1) {
    const data = bundle();
    const profile = activeProfileFrom(data);
    if (!data || !profile) return false;
    const duel = ensureWallet(profile);
    if (kind === "playSeconds") {
      if (duel.playSeconds < amount) return false;
      duel.playSeconds -= amount;
    } else if (kind === "rainbow") {
      if (duel.rainbowTickets < amount) return false;
      duel.rainbowTickets -= amount;
    } else if (kind === "transform") {
      if (duel.transformTickets < amount) return false;
      duel.transformTickets -= amount;
    } else {
      return false;
    }
    saveBundle(data);
    return true;
  }

  function formatTime(seconds) {
    const s = Math.max(0, Number(seconds || 0));
    const min = Math.floor(s / 60);
    const sec = s % 60;
    return `${min}:${String(sec).padStart(2, "0")}`;
  }

  window.RUOGU_DUEL_LINK = {
    COSTS,
    REWARDS,
    LIMITS,
    summary,
    purchase,
    consume,
    formatTime
  };
})();
