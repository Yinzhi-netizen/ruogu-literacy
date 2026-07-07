// 若谷大冒险 · 引擎层
// 纯逻辑，不直接操作 DOM。状态、战斗、进度、装备、存档都在这里。

window.RUOGU_ADVENTURE_ENGINE = (function () {
  "use strict";

  const DATA = window.RUOGU_ADVENTURE_DATA;
  const ADAPTER = window.RUOGU_ADVENTURE_ADAPTERS;

  // 状态
  let save = ADAPTER.loadSave();
  let battle = null;
  let currentView = "MAP"; // MAP | BATTLE | RESULT | EQUIPMENT | BESTIARY

  function persist() {
    ADAPTER.saveGame(save);
  }

  // ---------- 基础查询 ----------
  function weapons() {
    return ADAPTER.weapons();
  }

  function weaponById(id) {
    return weapons().find((item) => item.id === id) || weapons()[0];
  }

  function armorById(id) {
    return DATA.ARMORS.find((item) => item.id === id) || DATA.ARMORS[0];
  }

  function equippedWeapon() {
    return weaponById(save.equippedWeapon);
  }

  function equippedArmor() {
    return armorById(save.equippedArmor);
  }

  function maxHp() {
    return DATA.HERO.maxHp + equippedArmor().hpBonus;
  }

  function normalizeHp() {
    save.hp = Math.max(1, Math.min(save.hp || maxHp(), maxHp()));
  }

  function fragmentInfo() {
    return ADAPTER.fragmentProgress(save.stars);
  }

  function isWeaponUnlocked(weapon) {
    const list = weapons();
    const idx = list.findIndex((w) => w.id === weapon.id);
    if (idx <= 0) return true; // 第一件神兵默认可用，作为出发武器
    const required = list.slice(0, idx + 1).reduce((sum, w) => sum + (w.fragmentsRequired || 0), 0);
    return fragmentInfo().totalFragments >= required;
  }

  function weaponUnlockInfo(weapon) {
    const list = weapons();
    const idx = list.findIndex((w) => w.id === weapon.id);
    if (idx < 0) return { unlocked: false, required: 0, progress: 0 };
    if (idx === 0) return { unlocked: true, required: 0, progress: 0 };
    const required = list.slice(0, idx + 1).reduce((sum, w) => sum + (w.fragmentsRequired || 0), 0);
    const progress = fragmentInfo().totalFragments;
    return { unlocked: progress >= required, required, progress };
  }

  // ---------- 地图进度 ----------
  function nodeIndex(id) {
    return DATA.NODES.findIndex((node) => node.id === id);
  }

  function nodeById(id) {
    return DATA.NODES.find((node) => node.id === id);
  }

  function isCleared(id) {
    return save.cleared.indexOf(id) !== -1;
  }

  function isOpened(id) {
    return save.opened.indexOf(id) !== -1;
  }

  function isUnlocked(id) {
    const idx = nodeIndex(id);
    if (idx <= 0) return true;
    return isCleared(DATA.NODES[idx - 1].id) || isOpened(id);
  }

  function regionProgress(regionId) {
    const nodes = DATA.NODES.filter((node) => node.region === regionId);
    const done = nodes.filter((node) => isCleared(node.id)).length;
    return { done, total: nodes.length };
  }

  function unlockNextNode(currentId) {
    const idx = nodeIndex(currentId);
    const next = DATA.NODES[idx + 1];
    if (next && save.opened.indexOf(next.id) === -1) save.opened.push(next.id);
    return next || null;
  }

  function currentHeroNode() {
    const clearedCount = DATA.NODES.filter((node) => isCleared(node.id)).length;
    return DATA.NODES[Math.min(clearedCount, DATA.NODES.length - 1)];
  }

  // ---------- 材料与盔甲 ----------
  function addMaterials(materials) {
    Object.keys(materials || {}).forEach((key) => {
      save.materials[key] = (save.materials[key] || 0) + materials[key];
    });
  }

  function unlockArmor(armorId) {
    if (!armorId || save.armors.indexOf(armorId) !== -1) return null;
    save.armors.push(armorId);
    return armorById(armorId);
  }

  // ---------- 宝箱与休息 ----------
  function openChest(nodeId) {
    const node = nodeById(nodeId);
    if (!node || node.type !== "chest" || !isUnlocked(node.id)) return null;
    const already = isCleared(node.id);
    const reward = already ? { stars: 0 } : node.reward || {};
    let armor = null;
    let fragmentMsg = null;

    if (!already) {
      save.cleared.push(node.id);
      fragmentMsg = ADAPTER.awardStars(save, reward.stars || 0);
      addMaterials(reward.materials);
      armor = unlockArmor(reward.armor);
      unlockNextNode(node.id);
      persist();
    }

    return { node, reward, armor, already, fragmentMsg };
  }

  function rest(nodeId) {
    const node = nodeById(nodeId);
    if (!node || node.type !== "rest" || !isUnlocked(node.id)) return null;
    const before = save.hp;
    save.hp = Math.min(maxHp(), save.hp + (node.heal || 3));
    if (!isCleared(node.id)) {
      save.cleared.push(node.id);
      unlockNextNode(node.id);
    }
    persist();
    return { node, before, after: save.hp };
  }

  // ---------- 战斗 ----------
  function startBattle(nodeId) {
    const node = nodeById(nodeId);
    if (!node || !node.monster || !isUnlocked(node.id)) return null;
    normalizeHp();
    const monsterTemplate = DATA.MONSTERS[node.monster];
    const monster = Object.assign({}, monsterTemplate);
    const eliteBonus = node.type === "elite" ? 2 : 0;
    const bossBonus = node.type === "boss" ? 5 : 0;
    const monsterMaxHp = monster.hp + eliteBonus + bossBonus;
    const w = equippedWeapon();
    const skill = DATA.WEAPON_SKILLS[w.id] || null;

    battle = {
      node,
      monster,
      monsterHp: monsterMaxHp,
      monsterMaxHp,
      combo: skill && skill.type === "quickStart" ? 1 : 0,
      correct: 0,
      wrong: 0,
      turn: 1,
      log: "靠近怪物，发起识字挑战！",
      question: ADAPTER.question(node.tier),
      scene: {
        heroX: 12,
        monsterX: 74,
        challenged: false,
        jumping: false
      }
    };
    currentView = "BATTLE";
    return battle;
  }

  function baseDamage() {
    const w = equippedWeapon();
    const skill = DATA.WEAPON_SKILLS[w.id] || {};
    let dmg = DATA.HERO.baseAttack + Math.floor(w.power / 35);

    if (battle.combo >= 2) dmg += 1;
    if (skill.type === "swampClear" && battle.monster.terrain === "swamp") dmg += 2;
    if (skill.type === "breakDefense" && (battle.monster.elite || battle.monster.boss || battle.node.type === "elite" || battle.node.type === "boss")) dmg += 2;
    if (skill.type === "eliteStrike" && battle.node.type === "elite") dmg += 2;
    if (skill.type === "castleCut" && battle.monster.terrain === "castle") dmg += 2;
    if (skill.type === "brute" && battle.node.type === "battle") dmg += 1;

    return Math.max(1, dmg);
  }

  function incomingDamage() {
    const armor = equippedArmor();
    const w = equippedWeapon();
    const skill = DATA.WEAPON_SKILLS[w.id] || {};
    let dmg = battle.monster.attack || 1;

    if (battle.node.type === "boss") dmg = Math.min(2, dmg);
    if (skill.type === "guard" && battle.combo > 0) dmg -= 1;
    if (skill.type === "bind" && battle.combo >= 2 && Math.random() < 0.35) dmg = 0;
    dmg -= Math.floor(armor.defense / 2);

    return Math.max(0, dmg);
  }

  function answer(option) {
    if (!battle) return { type: "none" };
    const correct = option === battle.question.answer;

    if (correct) {
      let dmg = baseDamage();
      battle.combo += 1;
      battle.correct += 1;
      const w = equippedWeapon();
      const skill = DATA.WEAPON_SKILLS[w.id] || {};
      let skillText = "";

      if (battle.combo > 0 && battle.combo % 3 === 0) {
        dmg += 2;
        skillText = "哪吒连击！";
        if (skill.type === "comboStrike") {
          dmg += 2;
          skillText = "金箍棒如意连击！";
        }
      }

      battle.monsterHp = Math.max(0, battle.monsterHp - dmg);
      battle.log = `${skillText || "读对了！"} ${equippedWeapon().name} 打出 ${dmg} 点伤害。`;

      if (battle.monsterHp <= 0) return finishBattle();

      battle.question = ADAPTER.question(battle.node.tier);
      battle.turn += 1;
      return { type: "hit", damage: dmg, battle };
    }

    battle.combo = 0;
    battle.wrong += 1;
    const dmg = incomingDamage();
    save.hp = Math.max(0, save.hp - dmg);
    battle.log = dmg
      ? `${battle.monster.name} 反击，若谷侠少了 ${dmg} 点生命。`
      : `${battle.monster.name} 想反击，被乾坤圈定住了！`;
    persist();

    if (save.hp <= 0) return loseBattle();

    battle.question = ADAPTER.question(battle.node.tier);
    battle.turn += 1;
    return { type: "hurt", damage: dmg, battle };
  }

  function rating() {
    if (!battle) return 1;
    if (battle.wrong === 0) return 3;
    if (battle.wrong <= 2) return 2;
    return 1;
  }

  function finishBattle() {
    const node = battle.node;
    const reward = node.reward || {};
    const first = !isCleared(node.id);
    const stars = first
      ? (reward.stars || 0) + Math.max(0, rating() - 1)
      : Math.max(1, rating());
    let armor = null;

    if (first) {
      save.cleared.push(node.id);
      addMaterials(reward.materials);
      armor = unlockArmor(reward.armor);
      unlockNextNode(node.id);
      if (save.defeated.indexOf(battle.monster.name) === -1) {
        save.defeated.push(battle.monster.name);
      }
    }

    const fragmentMsg = ADAPTER.awardStars(save, stars);
    const wSkill = DATA.WEAPON_SKILLS[equippedWeapon().id] || {};
    if (wSkill.type === "recover") save.hp = Math.min(maxHp(), save.hp + 1);
    save.bestRatings[node.id] = Math.max(save.bestRatings[node.id] || 0, rating());
    normalizeHp();
    persist();

    const result = {
      type: "win",
      node,
      stars,
      rating: rating(),
      armor,
      first,
      fragmentMsg,
      battle
    };
    battle = null;
    currentView = "RESULT";
    return result;
  }

  function loseBattle() {
    const node = battle.node;
    battle = null;
    save.hp = Math.max(4, Math.ceil(maxHp() / 2));
    persist();
    currentView = "RESULT";
    return { type: "lose", node };
  }

  // ---------- 装备 ----------
  function equipWeapon(id) {
    const w = weaponById(id);
    if (w && isWeaponUnlocked(w)) {
      save.equippedWeapon = id;
      persist();
      return true;
    }
    return false;
  }

  function equipArmor(id) {
    if (save.armors.indexOf(id) !== -1) {
      save.equippedArmor = id;
      normalizeHp();
      persist();
      return true;
    }
    return false;
  }

  // ---------- 视图切换 ----------
  function setView(view) {
    currentView = view;
  }

  function getView() {
    return currentView;
  }

  // ---------- 重置 ----------
  function reset() {
    localStorage.removeItem(ADAPTER.SAVE_KEY);
    save = ADAPTER.loadSave();
    battle = null;
    currentView = "MAP";
  }

  // 初始化
  normalizeHp();
  persist();

  return {
    state: () => save,
    battle: () => battle,
    getView,
    setView,
    weapons,
    equippedWeapon,
    equippedArmor,
    maxHp,
    fragmentInfo,
    isWeaponUnlocked,
    weaponUnlockInfo,
    isCleared,
    isUnlocked,
    isOpened,
    regionProgress,
    nodeById,
    currentHeroNode,
    openChest,
    rest,
    startBattle,
    answer,
    equipWeapon,
    equipArmor,
    reset
  };
})();
