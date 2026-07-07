// 若谷大冒险 · 输入层
// 绑定所有事件，连接引擎与渲染器。

(function () {
  "use strict";

  const DATA = window.RUOGU_ADVENTURE_DATA;
  const ENGINE = window.RUOGU_ADVENTURE_ENGINE;
  const RENDERER = window.RUOGU_ADVENTURE_RENDERER;

  let movingToNode = false;
  let inputEnabled = true;

  function $sel(sel) {
    return document.querySelector(sel);
  }

  function refreshMap() {
    ENGINE.setView("MAP");
    RENDERER.renderMap(ENGINE.state(), ENGINE);
    RENDERER.fadeIn();
    bindMapEvents();
    bindGlobalEvents();
  }

  // ---------- 地图事件 ----------
  function bindMapEvents() {
    $sel("#app")?.querySelectorAll(".map-node.open").forEach((button) => {
      button.addEventListener("click", () => moveHeroToNode(button.dataset.node));
    });
  }

  function moveHeroToNode(id) {
    if (movingToNode) return;
    const node = DATA.NODES.find((item) => item.id === id);
    const hero = $sel("#mapHero");
    if (!node || !hero) {
      openNode(id);
      return;
    }

    const currentLeft = parseFloat(hero.style.left) || 0;
    if (currentLeft > node.x) {
      hero.classList.add("facing-left");
    } else {
      hero.classList.remove("facing-left");
    }

    movingToNode = true;
    hero.classList.add("moving");
    hero.style.left = `${node.x}%`;
    hero.style.top = `${node.y}%`;

    setTimeout(() => {
      hero.classList.remove("moving");
      movingToNode = false;
      openNode(id);
    }, 900);
  }

  // ---------- 节点进入 ----------
  function openNode(id) {
    const node = DATA.NODES.find((item) => item.id === id);
    if (!node) return;

    if (node.type === "chest") {
      const result = ENGINE.openChest(id);
      ENGINE.setView("RESULT");
      RENDERER.renderReward(result, ENGINE.state(), ENGINE);
      RENDERER.fadeIn();
      bindResultEvents();
      bindGlobalEvents();
      return;
    }

    if (node.type === "rest") {
      const result = ENGINE.rest(id);
      ENGINE.setView("RESULT");
      RENDERER.renderRest(result, ENGINE.state(), ENGINE);
      RENDERER.fadeIn();
      bindResultEvents();
      bindGlobalEvents();
      return;
    }

    ENGINE.startBattle(id);
    RENDERER.renderBattle(ENGINE.battle(), ENGINE.state(), ENGINE);
    RENDERER.fadeIn();
    bindBattleEvents();
    bindGlobalEvents();
  }

  // ---------- 战斗事件 ----------
  function bindBattleEvents() {
    const app = $sel("#app");
    const hero = $sel("#heroRunner");
    const monster = $sel("#monsterRunner");
    const panel = $sel("#quizPanel");
    const log = $sel("#battleLog");

    if (!hero || !monster || !panel || !log) return;

    const battle = ENGINE.battle();
    if (!battle) return;

    function syncPositions() {
      hero.style.left = `${battle.scene.heroX}%`;
      monster.style.left = `${battle.scene.monsterX}%`;
      const distance = Math.abs(battle.scene.heroX - battle.scene.monsterX);
      if (distance <= 18 && !battle.scene.challenged) {
        log.textContent = "已经靠近怪物了，点「挑战」开始识字战斗。";
      }
    }

    app.querySelectorAll("[data-move]").forEach((button) => {
      button.addEventListener("click", () => {
        if (!inputEnabled || battle.scene.challenged) return;
        const delta = Number(button.dataset.move);
        battle.scene.heroX = Math.max(6, Math.min(70, battle.scene.heroX + delta));
        if (delta < 0) hero.classList.add("facing-left");
        if (delta > 0) hero.classList.remove("facing-left");
        syncPositions();
      });
    });

    app.querySelector("[data-jump]")?.addEventListener("click", () => {
      if (!inputEnabled || battle.scene.jumping) return;
      battle.scene.jumping = true;
      hero.classList.add("jumping");
      setTimeout(() => {
        hero.classList.remove("jumping");
        battle.scene.jumping = false;
      }, 620);
    });

    app.querySelector("[data-action='challenge']")?.addEventListener("click", () => {
      if (!inputEnabled) return;
      const distance = Math.abs(battle.scene.heroX - battle.scene.monsterX);
      if (distance > 18) {
        log.textContent = "再往前一点，靠近怪物才能发起挑战。";
        return;
      }
      battle.scene.challenged = true;
      panel.classList.remove("locked");
      hero.classList.add("ready");
      log.textContent = "识字挑战开始了，读对就攻击。";
    });

    app.querySelectorAll(".answer-btn").forEach((button) => {
      button.addEventListener("click", () => {
        if (!inputEnabled || !battle.scene.challenged) return;
        handleAnswer(button.dataset.answer);
      });
    });

    syncPositions();
  }

  function handleAnswer(option) {
    const result = ENGINE.answer(option);
    inputEnabled = false;

    if (result.type === "win") {
      RENDERER.animateBattleResult("hit", result.battle);
      setTimeout(() => {
        ENGINE.setView("RESULT");
        RENDERER.renderWin(result, ENGINE.state(), ENGINE);
        RENDERER.fadeIn();
        bindResultEvents();
        bindGlobalEvents();
        inputEnabled = true;
      }, 600);
      return;
    }

    if (result.type === "lose") {
      RENDERER.animateBattleResult("hurt", result.battle);
      setTimeout(() => {
        ENGINE.setView("RESULT");
        RENDERER.renderLose(result, ENGINE.state(), ENGINE);
        RENDERER.fadeIn();
        bindResultEvents();
        bindGlobalEvents();
        inputEnabled = true;
      }, 600);
      return;
    }

    RENDERER.animateBattleResult(result.type, result.battle);
    setTimeout(() => {
      RENDERER.updateBattle(result.battle, ENGINE.state(), ENGINE);
      bindBattleEvents();
      bindGlobalEvents();
      inputEnabled = true;
    }, 420);
  }

  // ---------- 结算事件 ----------
  function bindResultEvents() {
    $sel("#app")?.querySelectorAll("[data-action='map']").forEach((button) => {
      button.addEventListener("click", refreshMap);
    });

    $sel("#app")?.querySelectorAll("[data-node]").forEach((button) => {
      button.addEventListener("click", () => openNode(button.dataset.node));
    });
  }

  // ---------- 装备事件 ----------
  function bindEquipmentEvents() {
    $sel("#app")?.querySelectorAll("[data-weapon]").forEach((button) => {
      button.addEventListener("click", () => {
        ENGINE.equipWeapon(button.dataset.weapon);
        renderEquipment();
      });
    });

    $sel("#app")?.querySelectorAll("[data-armor]:not(:disabled)").forEach((button) => {
      button.addEventListener("click", () => {
        ENGINE.equipArmor(button.dataset.armor);
        renderEquipment();
      });
    });

    $sel("#app")?.querySelectorAll("[data-action='map']").forEach((button) => {
      button.addEventListener("click", refreshMap);
    });
  }

  function renderEquipment() {
    ENGINE.setView("EQUIPMENT");
    RENDERER.renderEquipment(ENGINE.state(), ENGINE);
    RENDERER.fadeIn();
    bindEquipmentEvents();
    bindGlobalEvents();
  }

  // ---------- 图鉴事件 ----------
  function renderBestiary() {
    ENGINE.setView("BESTIARY");
    RENDERER.renderBestiary(ENGINE.state(), ENGINE);
    RENDERER.fadeIn();
    $sel("#app")?.querySelectorAll("[data-action='map']").forEach((button) => {
      button.addEventListener("click", refreshMap);
    });
    bindGlobalEvents();
  }

  // ---------- 全局事件 ----------
  function bindGlobalEvents() {
    $sel("#app")?.querySelectorAll("[data-action='equipment']").forEach((button) => {
      button.addEventListener("click", renderEquipment);
    });

    $sel("#app")?.querySelectorAll("[data-action='bestiary']").forEach((button) => {
      button.addEventListener("click", renderBestiary);
    });
  }

  // ---------- 键盘支持 ----------
  function setupKeyboard() {
    document.addEventListener("keydown", (event) => {
      if (ENGINE.getView() !== "BATTLE") return;
      const battle = ENGINE.battle();
      if (!battle || battle.scene.challenged) return;

      const hero = $sel("#heroRunner");
      switch (event.key) {
        case "ArrowLeft":
        case "a":
        case "A":
          battle.scene.heroX = Math.max(6, battle.scene.heroX - 8);
          hero?.classList.add("facing-left");
          break;
        case "ArrowRight":
        case "d":
        case "D":
          battle.scene.heroX = Math.min(70, battle.scene.heroX + 8);
          hero?.classList.remove("facing-left");
          break;
        case " ":
        case "ArrowUp":
        case "w":
        case "W":
          event.preventDefault();
          if (battle.scene.jumping) return;
          battle.scene.jumping = true;
          hero?.classList.add("jumping");
          setTimeout(() => {
            hero?.classList.remove("jumping");
            battle.scene.jumping = false;
          }, 620);
          break;
        case "Enter":
          event.preventDefault();
          $sel("[data-action='challenge']")?.click();
          break;
      }
      if (hero) hero.style.left = `${battle.scene.heroX}%`;
    });
  }

  // ---------- 启动 ----------
  function init() {
    refreshMap();
    setupKeyboard();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
