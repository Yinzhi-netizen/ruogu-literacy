// 若谷大冒险 · 渲染层
// 负责所有 DOM 渲染与 CSS 动画触发，不直接处理业务逻辑。

window.RUOGU_ADVENTURE_RENDERER = (function () {
  "use strict";

  const DATA = window.RUOGU_ADVENTURE_DATA;
  const app = document.querySelector("#app");

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }

  function img(src, cls, fallback) {
    return `<img class="${cls}" src="${src}" alt=""
      onerror="this.onerror=null;this.replaceWith(Object.assign(document.createElement('span'),{className:'${cls} fallback',textContent:'${fallback || "字"}'}))">`;
  }

  function stars(n) {
    return "★".repeat(n) + "☆".repeat(Math.max(0, 3 - n));
  }

  function materialList(save) {
    return Object.keys(DATA.MATERIALS)
      .map((key) => `<span>${DATA.MATERIALS[key]} ${save.materials[key] || 0}</span>`)
      .join("");
  }

  // ---------- 顶部状态条 ----------
  function topbar(save, engine, extraButtons) {
    const weapon = engine.equippedWeapon();
    const armor = engine.equippedArmor();
    const info = engine.fragmentInfo();
    const extras = extraButtons || "";
    return `
      <header class="ad-topbar">
        <div>
          <p class="eyebrow">RUOGU ADVENTURE</p>
          <h1>若谷大冒险</h1>
        </div>
        <div class="hero-stats">
          ${extras}
          <button class="stat-pill" data-action="equipment">
            <span>${weapon.mark || "兵"}</span>
            <strong>${weapon.name}</strong>
            <small>武力 ${weapon.power}</small>
          </button>
          <button class="stat-pill" data-action="equipment">
            <span>甲</span>
            <strong>${armor.name}</strong>
            <small>防御 ${armor.defense}</small>
          </button>
          <button class="stat-pill hp-pill">
            <span>心</span>
            <strong>${save.hp}/${engine.maxHp()}</strong>
            <small>生命</small>
          </button>
          <button class="stat-pill" data-action="bestiary">
            <span>鉴</span>
            <strong>图鉴</strong>
            <small>已击败 ${save.defeated.length}</small>
          </button>
          <div class="stat-pill star-pill">
            <span>星</span>
            <strong>${save.stars}</strong>
            <small>总星</small>
          </div>
          <div class="stat-pill fragment-pill" title="再 ${info.starsToNext} 星铸 1 碎片">
            <span>碎</span>
            <strong>${info.totalFragments}</strong>
            <small>神兵碎片</small>
          </div>
        </div>
      </header>
    `;
  }

  // ---------- 场景元素生成器 ----------
  function sceneElements(regionId) {
    const region = DATA.REGIONS.find((r) => r.id === regionId);
    const elements = region.visual.elements;
    let html = "";

    if (elements.indexOf("canopy") !== -1) {
      html += `
        <div class="canopy canopy-left"></div>
        <div class="canopy canopy-right"></div>
        <div class="sunray"></div>
      `;
    }
    if (elements.indexOf("falling-leaves") !== -1) {
      html += `<div class="falling-leaves">
        <span></span><span></span><span></span><span></span>
      </div>`;
    }
    if (elements.indexOf("bubbles") !== -1) {
      html += `<div class="scene-mud"></div>
        <div class="scene-bubbles">
          <span></span><span></span><span></span><span></span><span></span>
        </div>`;
    }
    if (elements.indexOf("fog") !== -1) {
      html += `<div class="scene-fog thick"></div>`;
    }
    if (elements.indexOf("vines") !== -1) {
      html += `<div class="vines">
        <span></span><span></span><span></span>
      </div>`;
    }
    if (elements.indexOf("bridge") !== -1) {
      html += `<div class="scene-bridge"></div>`;
    }
    if (elements.indexOf("stalactites") !== -1) {
      html += `<div class="stalactites">
        <span></span><span></span><span></span>
      </div>`;
    }
    if (elements.indexOf("echo") !== -1) {
      html += `<div class="echo-waves">
        <span></span><span></span><span></span>
      </div>`;
    }
    if (elements.indexOf("glow-moss") !== -1) {
      html += `<div class="glow-moss">
        <span></span><span></span><span></span>
      </div>`;
    }
    if (elements.indexOf("battlements") !== -1) {
      html += `<div class="battlements"></div>`;
    }
    if (elements.indexOf("gears") !== -1) {
      html += `<div class="gears">
        <span></span><span></span>
      </div>`;
    }
    if (elements.indexOf("torches") !== -1) {
      html += `<div class="torches">
        <span></span><span></span>
      </div>`;
    }
    if (elements.indexOf("gate") !== -1) {
      html += `<div class="castle-gate"></div>`;
    }
    if (elements.indexOf("clouds") !== -1) {
      html += `<div class="cloud-layer cloud-back"></div>
        <div class="cloud-layer cloud-mid"></div>
        <div class="cloud-layer cloud-front"></div>`;
    }
    if (elements.indexOf("temple") !== -1) {
      html += `<div class="cloud-temple"></div>`;
    }
    if (elements.indexOf("sun-rays") !== -1) {
      html += `<div class="sun-rays"></div>`;
    }

    return html;
  }

  function sceneBackground(regionId) {
    const region = DATA.REGIONS.find((r) => r.id === regionId);
    return region.visual.sky;
  }

  // ---------- 地图 ----------
  function renderMap(save, engine) {
    const heroNode = engine.currentHeroNode();
    const nodes = DATA.NODES.map((node) => {
      const unlocked = engine.isUnlocked(node.id);
      const cleared = engine.isCleared(node.id);
      const rating = save.bestRatings[node.id] || 0;
      const typeLabel = { battle: "战", elite: "精", boss: "王", chest: "箱", rest: "泉" }[node.type] || "关";
      const cls = ["map-node", `node-${node.type}`];
      if (unlocked) cls.push("open");
      if (cleared) cls.push("done");
      if (!unlocked) cls.push("locked");
      return `
        <button class="${cls.join(" ")}" style="left:${node.x}%;top:${node.y}%"
          data-node="${node.id}" ${unlocked ? "" : "disabled"}>
          <span class="node-mark">${cleared ? "✓" : unlocked ? typeLabel : "锁"}</span>
          <strong>${node.name}</strong>
          <small>${rating ? stars(rating) : DATA.REGIONS.find((r) => r.id === node.region).tone}</small>
        </button>
      `;
    }).join("");

    const path = DATA.NODES.slice(0, -1).map((node, i) => {
      const next = DATA.NODES[i + 1];
      const cleared = engine.isCleared(node.id);
      const cls = cleared ? "cleared-path" : "";
      return `<line class="${cls}" x1="${node.x}" y1="${node.y}" x2="${next.x}" y2="${next.y}"></line>`;
    }).join("");

    const regionCards = DATA.REGIONS.map((region) => {
      const p = engine.regionProgress(region.id);
      return `
        <section class="region-card" data-region="${region.id}">
          <strong>${region.name}</strong>
          <span>${region.tone}</span>
          <small>${p.done}/${p.total}</small>
        </section>
      `;
    }).join("");

    app.innerHTML = `
      ${topbar(save, engine)}
      <main class="ad-grid">
        <section class="map-panel">
          <div class="map-scroll" data-current-region="${heroNode.region}">
            <div class="map-art"></div>
            <svg class="route-lines" viewBox="0 0 100 100" preserveAspectRatio="none">${path}</svg>
            <div class="map-hero" id="mapHero" style="left:${heroNode.x}%;top:${heroNode.y}%">
              ${img(DATA.HERO.image, "map-hero-img", "哪")}
              <span>若谷侠</span>
            </div>
            ${nodes}
          </div>
        </section>
        <aside class="side-panel">
          <section class="hero-card">
            <div class="hero-portrait">${img(DATA.HERO.image, "hero-img", "哪")}</div>
            <div>
              <p class="eyebrow">小哪吒型识字英雄</p>
              <h2>${DATA.HERO.name}</h2>
              <p>读对字词就出招，带着神兵穿过森林、沼泽、山洞和云顶宝殿。</p>
            </div>
          </section>
          <div class="region-grid">${regionCards}</div>
          <section class="rule-box">
            <strong>奖励册</strong>
            <p>10 星铸成 1 个神兵碎片；宝箱会掉材料和盔甲。失败不扣星，半血再挑战。</p>
            <div class="material-row">${materialList(save)}</div>
          </section>
        </aside>
      </main>
    `;
  }

  // ---------- 战斗 ----------
  function questionMarkup(q) {
    if (q.word) {
      return `
        <p class="challenge-label">看词语，选出正确读音</p>
        <div class="quiz-word">${q.word}</div>
      `;
    }
    if (q.pinyin) {
      return `
        <p class="challenge-label">看拼音，选出正确词语</p>
        <div class="quiz-word latin">${q.pinyin}</div>
      `;
    }
    return `
      <p class="challenge-label">机关题</p>
      <div class="quiz-prompt">${q.prompt}</div>
    `;
  }

  function renderBattle(battle, save, engine) {
    const weapon = engine.equippedWeapon();
    const armor = engine.equippedArmor();
    const q = battle.question;
    const monsterPct = Math.max(0, Math.round((battle.monsterHp / battle.monsterMaxHp) * 100));
    const heroPct = Math.max(0, Math.round((save.hp / engine.maxHp()) * 100));
    const region = DATA.REGIONS.find((r) => r.id === battle.node.region);
    const isBoss = battle.node.type === "boss";

    app.innerHTML = `
      ${topbar(save, engine)}
      <main class="battle-shell">
        <section class="battle-stage dynamic-stage scene-${battle.node.region}" id="battleStage"
          style="background:${sceneBackground(battle.node.region)}">
          <div class="scene-ground" style="background:${region.visual.ground}"></div>
          ${sceneElements(battle.node.region)}
          ${isBoss ? '<div class="boss-vignette"></div><div class="boss-banner">终局之战 · 云顶红怪王</div>' : ""}
          <div class="cinematic-banner" id="cinematicBanner"></div>
          <div class="slash-effect" id="slashEffect"></div>

          <div class="battle-hud hero-hud">
            <div class="hp-line"><span id="heroHpBar" style="width:${heroPct}%"></span></div>
            <strong>${DATA.HERO.name}</strong>
            <small>${armor.name} · ${weapon.name}</small>
          </div>
          <div class="battle-hud monster-hud">
            <div class="hp-line monster"><span id="monsterHpBar" style="width:${monsterPct}%"></span></div>
            <strong>${battle.monster.name}</strong>
            <small>${battle.monster.intro}</small>
          </div>

          <div class="runner hero-runner" id="heroRunner" style="left:${battle.scene.heroX}%">
            ${img(DATA.HERO.image, "runner-sprite hero-sprite", "哪")}
            ${weapon.image ? `<img class="hero-weapon-overlay" src="${weapon.image}" alt="" onerror="this.style.display='none'">` : ""}
          </div>
          <div class="runner monster-runner" id="monsterRunner" style="left:${battle.scene.monsterX}%">
            ${img(battle.monster.image, "runner-sprite monster-sprite", "怪")}
          </div>

          <div class="battle-center">
            <span class="battle-tag">${battle.node.name}</span>
            <strong>${isBoss ? "BOSS 战" : battle.node.type === "elite" ? "精英战" : "识字战斗"}</strong>
            <small>连击 ${battle.combo} · 第 ${battle.turn} 回合</small>
          </div>

          <div class="battle-controls">
            <button class="control-btn" data-move="-8">左移</button>
            <button class="control-btn" data-jump="1">跳跃</button>
            <button class="control-btn" data-move="8">右移</button>
            <button class="control-btn action" data-action="challenge">挑战</button>
          </div>
        </section>

        <section class="quiz-panel ${battle.scene.challenged ? "" : "locked"}" id="quizPanel">
          ${questionMarkup(q)}
          <div class="option-grid">
            ${q.options.map((option) => `<button class="answer-btn" data-answer="${option}">${option}</button>`).join("")}
          </div>
          <p class="battle-log" id="battleLog">${battle.log}</p>
        </section>
        <button class="ghost-btn" data-action="map">回地图</button>
      </main>
    `;
  }

  function updateBattle(battle, save, engine) {
    const q = battle.question;
    const monsterPct = Math.max(0, Math.round((battle.monsterHp / battle.monsterMaxHp) * 100));
    const heroPct = Math.max(0, Math.round((save.hp / engine.maxHp()) * 100));

    const heroHpBar = $("#heroHpBar", app);
    const monsterHpBar = $("#monsterHpBar", app);
    const quizPanel = $("#quizPanel", app);
    const battleLog = $("#battleLog", app);
    const battleCenter = $(".battle-center", app);

    if (heroHpBar) heroHpBar.style.width = `${heroPct}%`;
    if (monsterHpBar) monsterHpBar.style.width = `${monsterPct}%`;
    if (quizPanel) {
      quizPanel.classList.toggle("locked", !battle.scene.challenged);
      quizPanel.innerHTML = `
        ${questionMarkup(q)}
        <div class="option-grid">
          ${q.options.map((option) => `<button class="answer-btn" data-answer="${option}">${option}</button>`).join("")}
        </div>
        <p class="battle-log" id="battleLog">${battle.log}</p>
      `;
    }
    if (battleCenter) {
      battleCenter.innerHTML = `
        <span class="battle-tag">${battle.node.name}</span>
        <strong>${battle.node.type === "boss" ? "BOSS 战" : battle.node.type === "elite" ? "精英战" : "识字战斗"}</strong>
        <small>连击 ${battle.combo} · 第 ${battle.turn} 回合</small>
      `;
    }
  }

  function animateBattleResult(type, battle) {
    const hero = $("#heroRunner", app);
    const monster = $("#monsterRunner", app);
    const stage = $("#battleStage", app);
    const slash = $("#slashEffect", app);
    const banner = $("#cinematicBanner", app);

    if (type === "hit") {
      if (hero) {
        hero.classList.add("attacking");
        setTimeout(() => hero.classList.remove("attacking"), 520);
      }
      if (monster) {
        monster.classList.add("hurt");
        monster.classList.add("flash-white");
        setTimeout(() => {
          monster.classList.remove("hurt");
          monster.classList.remove("flash-white");
        }, 520);
      }
      if (slash) {
        slash.classList.add("active");
        setTimeout(() => slash.classList.remove("active"), 420);
      }
      if (stage) {
        stage.classList.add("shake");
        setTimeout(() => stage.classList.remove("shake"), 280);
      }
      if (banner && battle.combo > 0 && battle.combo % 3 === 0) {
        banner.textContent = "哪吒连击！";
        banner.classList.add("show");
        setTimeout(() => banner.classList.remove("show"), 1400);
      }
    }

    if (type === "hurt") {
      if (hero) {
        hero.classList.add("hurt");
        setTimeout(() => hero.classList.remove("hurt"), 520);
      }
      if (monster) {
        monster.classList.add("attacking");
        setTimeout(() => monster.classList.remove("attacking"), 520);
      }
      if (stage) {
        stage.classList.add("shake");
        setTimeout(() => stage.classList.remove("shake"), 280);
      }
    }
  }

  // ---------- 结算 ----------
  function renderWin(result, save, engine) {
    const fragmentText = result.fragmentMsg && result.fragmentMsg.newFragments
      ? `铸成 ${result.fragmentMsg.newFragments} 枚神兵碎片！`
      : "";
    app.innerHTML = `
      ${topbar(save, engine)}
      <section class="result-panel">
        <p class="eyebrow">VICTORY</p>
        <h2>${result.node.name} 闯关成功</h2>
        <div class="rating">${stars(result.rating)}</div>
        <p>获得 ${result.stars} 星。${fragmentText}</p>
        ${result.armor ? `<div class="unlock-card">
          <strong>${result.armor.name}</strong>
          <span>${result.armor.intro}</span>
        </div>` : ""}
        <button class="primary-btn" data-action="map">回地图</button>
      </section>
    `;
  }

  function renderLose(result, save, engine) {
    app.innerHTML = `
      ${topbar(save, engine)}
      <section class="result-panel">
        <p class="eyebrow">TRY AGAIN</p>
        <h2>${result.node.name} 暂时撤退</h2>
        <p>若谷侠已经恢复到半血，可以马上再挑战。星星不会丢。</p>
        <div class="result-actions">
          <button class="primary-btn" data-node="${result.node.id}">再挑战</button>
          <button class="ghost-btn" data-action="map">回地图</button>
        </div>
      </section>
    `;
  }

  function renderReward(result, save, engine) {
    if (!result) return;
    const mats = Object.keys(result.reward.materials || {})
      .map((key) => `${DATA.MATERIALS[key]} +${result.reward.materials[key]}`)
      .join(" · ");
    const fragmentText = result.fragmentMsg && result.fragmentMsg.newFragments
      ? `铸成 ${result.fragmentMsg.newFragments} 枚神兵碎片！`
      : "";
    app.innerHTML = `
      ${topbar(save, engine)}
      <section class="result-panel">
        <p class="eyebrow">TREASURE</p>
        <h2>${result.node.name}</h2>
        <p>${result.already ? "宝箱已经打开过了。" : `获得 ${result.reward.stars || 0} 星${mats ? " · " + mats : ""}${fragmentText ? " · " + fragmentText : ""}`}</p>
        ${result.armor ? `<div class="unlock-card">
          <strong>${result.armor.name}</strong>
          <span>${result.armor.intro}</span>
        </div>` : ""}
        <button class="primary-btn" data-action="map">回地图</button>
      </section>
    `;
  }

  function renderRest(result, save, engine) {
    if (!result) return;
    app.innerHTML = `
      ${topbar(save, engine)}
      <section class="result-panel">
        <p class="eyebrow">REST</p>
        <h2>${result.node.name}</h2>
        <p>生命从 ${result.before} 恢复到 ${result.after}。若谷侠又可以出发了。</p>
        <button class="primary-btn" data-action="map">回地图</button>
      </section>
    `;
  }

  // ---------- 装备 ----------
  function renderEquipment(save, engine) {
    const weaponCards = engine.weapons().map((weapon) => {
      const skill = DATA.WEAPON_SKILLS[weapon.id];
      const info = engine.weaponUnlockInfo(weapon);
      const active = save.equippedWeapon === weapon.id ? "active" : "";
      const art = weapon.image
        ? `<img src="${weapon.image}" alt="${weapon.name}" onerror="this.style.display='none';this.parentElement.textContent='${weapon.mark}'">`
        : `<span>${weapon.mark}</span>`;
      const lockedText = info.required
        ? `需累计 ${info.required} 碎片解锁（当前 ${info.progress}）`
        : "出发神兵";
      return `
        <button class="equip-card ${active}" data-weapon="${weapon.id}" ${info.unlocked ? "" : "disabled"}>
          <div class="equip-art">${art}</div>
          <strong>${weapon.name}<span>武力 ${weapon.power}</span></strong>
          <p>${weapon.source} · ${weapon.hero}</p>
          <small>${info.unlocked ? (skill ? skill.desc : weapon.intro) : lockedText}</small>
        </button>
      `;
    }).join("");

    const armorCards = DATA.ARMORS.map((armor) => {
      const owned = save.armors.indexOf(armor.id) !== -1;
      const active = save.equippedArmor === armor.id ? "active" : "";
      return `
        <button class="armor-card ${active}" data-armor="${armor.id}" ${owned ? "" : "disabled"}>
          <strong>${armor.name}</strong>
          <span>防御 ${armor.defense} · 生命 +${armor.hpBonus}</span>
          <small>${owned ? armor.intro : "还没有解锁"}</small>
        </button>
      `;
    }).join("");

    app.innerHTML = `
      ${topbar(save, engine)}
      <main class="equipment-shell">
        <section>
          <p class="eyebrow">ARMORY</p>
          <h2>神兵出战</h2>
          <p class="fragment-hint">${engine.fragmentInfo().totalFragments} 枚碎片 · 再 ${engine.fragmentInfo().starsToNext} 星铸 1 碎片</p>
          <div class="equip-grid">${weaponCards}</div>
        </section>
        <section>
          <p class="eyebrow">ARMOR</p>
          <h2>盔甲册</h2>
          <div class="armor-grid">${armorCards}</div>
        </section>
        <button class="primary-btn" data-action="map">回地图</button>
      </main>
    `;
  }

  // ---------- 图鉴 ----------
  function renderBestiary(save, engine) {
    const defeatedIds = save.defeated
      .map((name) => Object.values(DATA.MONSTERS).find((m) => m.name === name))
      .filter(Boolean);

    const cards = defeatedIds.length
      ? defeatedIds.map((monster) => `
        <div class="bestiary-card">
          <div class="bestiary-art">${img(monster.image, "bestiary-img", "怪")}</div>
          <strong>${monster.name}</strong>
          <p>${monster.intro}</p>
        </div>
      `).join("")
      : `<div class="bestiary-empty">
          <p>还没有击败过怪物，去地图上闯关吧！</p>
        </div>`;

    app.innerHTML = `
      ${topbar(save, engine)}
      <main class="bestiary-shell">
        <section class="bestiary-header">
          <p class="eyebrow">BESTIARY</p>
          <h2>怪物图鉴</h2>
          <p>已击败 ${save.defeated.length} / ${Object.keys(DATA.MONSTERS).length} 种怪物</p>
        </section>
        <div class="bestiary-grid">${cards}</div>
        <button class="primary-btn" data-action="map">回地图</button>
      </main>
    `;
  }

  // ---------- 公共方法 ----------
  function fadeIn() {
    app.classList.remove("fade-in");
    void app.offsetWidth; // force reflow
    app.classList.add("fade-in");
  }

  return {
    app,
    $,
    img,
    stars,
    topbar,
    materialList,
    renderMap,
    renderBattle,
    updateBattle,
    animateBattleResult,
    renderWin,
    renderLose,
    renderReward,
    renderRest,
    renderEquipment,
    renderBestiary,
    fadeIn
  };
})();
