// 若谷识字 · 神兵系统（碎片计算 + 神兵库/铸造渲染）
// 依赖：weapons.js (window.RUOGU_WEAPONS)、state-store.js

(function () {
  const STATE = window.RUOGU_STATE;
  const weapons = window.RUOGU_WEAPONS || [];

  function totalStars() {
    return STATE.get("totalStars") || 0;
  }

  function totalFragments() {
    return Math.floor(totalStars() / 10);
  }

  function weaponStateByFragments(fragmentCount = totalFragments()) {
    let used = 0;
    for (let index = 0; index < weapons.length; index += 1) {
      const weapon = weapons[index];
      const progress = Math.max(0, Math.min(weapon.fragmentsRequired, fragmentCount - used));
      const unlocked = progress >= weapon.fragmentsRequired;
      if (!unlocked) return { weapon, index, progress, used, unlocked: false };
      used += weapon.fragmentsRequired;
    }
    const last = weapons[weapons.length - 1];
    return { weapon: last, index: weapons.length - 1, progress: last.fragmentsRequired, used, unlocked: true, allDone: true };
  }

  function unlockedWeaponCount(fragmentCount = totalFragments()) {
    let used = 0;
    let count = 0;
    weapons.forEach((weapon) => {
      if (fragmentCount >= used + weapon.fragmentsRequired) count += 1;
      used += weapon.fragmentsRequired;
    });
    return count;
  }

  function starsToNextFragment() {
    const rest = totalStars() % 10;
    return rest === 0 ? 10 : 10 - rest;
  }

  function unlockText() {
    const active = weaponStateByFragments();
    if (active.allDone) return "神兵已经全部解锁，后面可以继续做升级系统。";
    return `还差 ${starsToNextFragment()} 星铸出下一个碎片；「${active.weapon.name}」已点亮 ${active.progress}/${active.weapon.fragmentsRequired}。`;
  }

  function fragmentDots(done, total) {
    return Array.from({ length: total }, (_, index) =>
      `<span class="fragment-dot ${index < done ? "lit" : ""}"></span>`
    ).join("");
  }

  function showWeaponModal(weapon) {
    const overlay = document.createElement("div");
    overlay.className = "weapon-overlay";
    overlay.innerHTML = `
      <div class="weapon-overlay-bg"></div>
      <div class="weapon-overlay-card">
        <button class="weapon-overlay-close">✕</button>
        <img src="${weapon.image}" alt="${weapon.name}" />
        <h2>${weapon.name}${weapon.power ? ` <span class="power-badge">武力 ${weapon.power}</span>` : ""}</h2>
        <p><strong>${weapon.source}</strong> · ${weapon.hero}</p>
        <p>${weapon.intro}</p>
      </div>
    `;
    document.body.appendChild(overlay);
    const close = () => { overlay.remove(); };
    overlay.querySelector(".weapon-overlay-close").addEventListener("click", close);
    overlay.querySelector(".weapon-overlay-bg").addEventListener("click", close);
    const onKey = (e) => { if (e.key === "Escape") { close(); document.removeEventListener("keydown", onKey); } };
    document.addEventListener("keydown", onKey);
  }

  function renderWeaponGrid(grid, fragmentCount) {
    let used = 0;
    weapons.forEach((weapon) => {
      const progress = Math.max(0, Math.min(weapon.fragmentsRequired, fragmentCount - used));
      const unlocked = progress >= weapon.fragmentsRequired;
      const card = document.createElement("section");
      card.className = `weapon-card ${unlocked ? "unlocked" : "locked"}`;
      const icon = weapon.image
        ? `<div class="weapon-icon weapon-img ${unlocked ? "" : "locked-img"}"><img src="${weapon.image}" alt="${weapon.name}" loading="lazy"/></div>`
        : `<div class="weapon-icon">${weapon.mark}</div>`;
      card.innerHTML = `
        ${icon}
        <h3>${weapon.name}${weapon.power ? ` <span class="power-badge">武力 ${weapon.power}</span>` : ""}</h3>
        <p><strong>${weapon.source}</strong> · ${weapon.hero}</p>
        <p>${weapon.intro}</p>
        <div class="fragment-row small">${fragmentDots(progress, weapon.fragmentsRequired)}</div>
        <p>${unlocked ? "✓ 已收入武器库" : `${progress}/${weapon.fragmentsRequired} 碎片`}</p>
      `;
      if (weapon.image) {
        card.style.cursor = "pointer";
        card.addEventListener("click", () => showWeaponModal(weapon));
      }
      grid.append(card);
      used += weapon.fragmentsRequired;
    });
  }

  function renderArmory(stage) {
    const fragmentCount = totalFragments();
    const unlockedCount = unlockedWeaponCount(fragmentCount);
    const active = weaponStateByFragments(fragmentCount);
    stage.innerHTML = `
      <article class="armory">
        <div class="armory-head">
          <div>
            <p class="prompt">10 星铸成 1 个碎片，碎片点满后收入武器库</p>
            <h2>若谷的神兵库</h2>
          </div>
          <div class="armory-count">${unlockedCount}/${weapons.length}</div>
        </div>
        <div class="rule-box">
          <strong>${unlockText()}</strong>
          <span>当前共有 ${totalStars()} 星，已铸成 ${fragmentCount} 个碎片。</span>
        </div>
        <section class="current-forge">
          <div class="weapon-silhouette ${active.unlocked ? "complete" : ""}">${active.unlocked && active.weapon.image ? `<img src="${active.weapon.image}" alt="${active.weapon.name}"/>` : active.weapon.mark}</div>
          <div>
            <p class="prompt">正在铸造</p>
            <h3>${active.weapon.name}</h3>
            <div class="fragment-row">${fragmentDots(active.progress, active.weapon.fragmentsRequired)}</div>
          </div>
        </section>
        <div class="weapon-grid"></div>
      </article>
    `;
    renderWeaponGrid(stage.querySelector(".weapon-grid"), fragmentCount);
  }

  // 拼片网格布局：碎片数 → {cols, rows}
  const PUZZLE_LAYOUT = {
    3: { cols: 3, rows: 1 },
    5: { cols: 5, rows: 1 },
    10: { cols: 5, rows: 2 }
  };

  // 右侧神兵铸造侧栏：把正在铸造的武器大图按碎片需求切成 N 块拼片
  function renderForgeSide(mode, readingInArticle) {
    const side = document.querySelector("#forgeSide");
    if (!side) return;
    if (mode === "armory" || (mode === "reading" && !readingInArticle)) { side.classList.add("hidden"); return; }
    side.classList.remove("hidden");

    const fragCount = totalFragments();
    const active = weaponStateByFragments();
    const w = active.weapon;
    const total = w.fragmentsRequired;
    const done = active.unlocked ? total : active.progress;
    const layout = PUZZLE_LAYOUT[total] || { cols: Math.ceil(Math.sqrt(total)), rows: Math.ceil(total / Math.ceil(Math.sqrt(total))) };

    document.querySelector("#forgeSideName").textContent = w.name;
    document.querySelector("#forgeSideMeta").textContent = `${w.hero} · ${w.source}`;
    document.querySelector("#forgeSideProgress").textContent = active.unlocked
      ? "✨ 已收入武器库"
      : `${done}/${total} 碎片`;

    const puzzle = document.querySelector("#forgePuzzle");
    const sig = `${w.name}|${total}|${done}`;
    if (puzzle.dataset.sig !== sig) {
      const prevSig = puzzle.dataset.sig || "";
      const prevDone = prevSig.startsWith(w.name + "|") ? parseInt(prevSig.split("|").pop(), 10) || 0 : 0;
      const isNewWeapon = !prevSig.startsWith(w.name + "|");
      if (isNewWeapon || puzzle.children.length !== total) {
        puzzle.innerHTML = "";
        puzzle.style.gridTemplateColumns = `repeat(${layout.cols}, 1fr)`;
        puzzle.style.gridTemplateRows = `repeat(${layout.rows}, 1fr)`;
        for (let i = 0; i < total; i++) {
          const r = Math.floor(i / layout.cols);
          const c = i % layout.cols;
          const cell = document.createElement("div");
          cell.className = "puzzle-cell";
          cell.style.backgroundImage = `url("${w.image}")`;
          cell.style.backgroundSize = `${layout.cols * 100}% ${layout.rows * 100}%`;
          cell.style.backgroundPosition = `${(c / Math.max(1, layout.cols - 1)) * 100}% ${(r / Math.max(1, layout.rows - 1)) * 100}%`;
          puzzle.appendChild(cell);
        }
      }
      [...puzzle.children].forEach((cell, i) => {
        const wasLit = cell.classList.contains("lit");
        const lit = i < done;
        cell.classList.toggle("lit", lit);
        if (lit && !wasLit && !isNewWeapon && i >= prevDone) {
          cell.classList.add("just-lit");
          cell.addEventListener("animationend", () => cell.classList.remove("just-lit"), { once: true });
        }
      });
      puzzle.dataset.sig = sig;
    }

    // 迷你武器网格
    const mini = document.querySelector("#forgeMiniGrid");
    const miniSig = `${fragCount}-${active.index}`;
    if (mini.dataset.sig !== miniSig) {
      mini.innerHTML = "";
      let used = 0;
      weapons.forEach((weap) => {
        const prog = Math.max(0, Math.min(weap.fragmentsRequired, fragCount - used));
        const unlocked = prog >= weap.fragmentsRequired;
        const isActive = weap.name === w.name;
        const img = weap.image ? `<img src="${weap.image}" alt="${weap.name}"/>` : `<span>${weap.mark}</span>`;
        const card = document.createElement("div");
        card.className = `mini-weapon ${unlocked ? "done" : ""} ${isActive ? "current" : ""}`;
        card.title = `${weap.name}（${weap.hero}）${unlocked ? " ✓" : ` ${prog}/${weap.fragmentsRequired}`}`;
        card.innerHTML = `<div class="mini-img">${img}</div>`;
        mini.appendChild(card);
        used += weap.fragmentsRequired;
      });
      mini.dataset.sig = miniSig;
    }
  }

  window.RUOGU_WEAPON_SYSTEM = {
    weapons,
    totalStars,
    totalFragments,
    weaponStateByFragments,
    unlockedWeaponCount,
    starsToNextFragment,
    unlockText,
    fragmentDots,
    showWeaponModal,
    renderWeaponGrid,
    renderArmory,
    renderForgeSide,
    PUZZLE_LAYOUT
  };
})();
