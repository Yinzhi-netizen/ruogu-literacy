// 若谷识字 · 公共 UI（朗读、星星动画、结果页、铸造页、进度条、识字条）
// 依赖：state-store.js、weapon-system.js、progress.js

(function () {
  const STATE = window.RUOGU_STATE;
  const WS = window.RUOGU_WEAPON_SYSTEM;
  const PROGRESS = window.RUOGU_PROGRESS;

  function speak(text) {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "zh-CN";
    utterance.rate = 0.82;
    window.speechSynthesis.speak(utterance);
  }

  function animateStarGain(amount, stage) {
    const statsEl = document.querySelector(".stats div:first-child");
    if (!statsEl || !stage) return;
    const stageRect = stage.getBoundingClientRect();
    const targetRect = statsEl.getBoundingClientRect();
    const centerX = stageRect.left + stageRect.width / 2;
    const centerY = stageRect.top + stageRect.height / 2;

    for (let i = 0; i < Math.min(amount, 5); i++) {
      setTimeout(() => {
        const star = document.createElement("span");
        star.textContent = "★";
        star.style.cssText = `
          position: fixed;
          z-index: 999;
          left: ${centerX}px;
          top: ${centerY}px;
          font-size: 28px;
          color: #d4a017;
          pointer-events: none;
          transition: all 700ms cubic-bezier(0.2, 0.8, 0.2, 1.2);
          opacity: 1;
          text-shadow: 0 0 12px rgba(212, 160, 23, 0.7);
        `;
        document.body.appendChild(star);

        requestAnimationFrame(() => {
          star.style.left = `${targetRect.left + targetRect.width / 2 - 14}px`;
          star.style.top = `${targetRect.top + targetRect.height / 2 - 14}px`;
          star.style.opacity = "0";
          star.style.transform = "scale(0.3)";
        });

        setTimeout(() => star.remove(), 800);
      }, i * 100);
    }
  }

  function renderResult(stage, amount, reason, callbacks) {
    animateStarGain(amount, stage);
    stage.innerHTML = `
      <article class="result-card">
        <div class="level-badge">${reason}</div>
        <div class="gain">+${amount}</div>
        <h2>获得 ${amount} 星</h2>
        <p>${WS.unlockText()}</p>
        <div class="actions two-actions">
          <button class="soft-button" data-action="armory">看神兵库</button>
          <button class="primary-button" data-action="continue">继续闯关</button>
        </div>
      </article>
    `;
    stage.querySelector("[data-action='armory']").addEventListener("click", () => callbacks.onArmory());
    stage.querySelector("[data-action='continue']").addEventListener("click", () => callbacks.onContinue());
  }

  function renderForge(stage, { amount, reason, beforeFragments, afterFragments }, callbacks) {
    animateStarGain(amount, stage);
    const after = WS.weaponStateByFragments(afterFragments);
    const unlockedNow = WS.unlockedWeaponCount(afterFragments) > WS.unlockedWeaponCount(beforeFragments);
    const title = unlockedNow ? `${after.weapon.name} 解锁！` : "神兵碎片 +1";
    const subtitle = unlockedNow
      ? `${after.weapon.source} · ${after.weapon.hero} 的神兵已收入武器库`
      : `${after.weapon.name} 已点亮 ${after.progress}/${after.weapon.fragmentsRequired}`;

    stage.innerHTML = `
      <article class="forge-scene ${unlockedNow ? "unlock" : ""}">
        <div class="spark s1"></div>
        <div class="spark s2"></div>
        <div class="spark s3"></div>
        <div class="level-badge">${reason} · +${amount} 星</div>
        <div class="forge-core">
          <div class="forge-stars">★ ★ ★ ★ ★</div>
          <div class="weapon-silhouette forge-weapon ${unlockedNow ? "complete" : ""}">${unlockedNow && after.weapon.image ? `<img src="${after.weapon.image}" alt="${after.weapon.name}"/>` : after.weapon.mark}</div>
          <h2>${title}</h2>
          <p>${subtitle}</p>
          <div class="fragment-row forge-dots">${WS.fragmentDots(after.progress, after.weapon.fragmentsRequired)}</div>
        </div>
        <div class="actions two-actions">
          <button class="soft-button" data-action="armory">收入武器库</button>
          <button class="primary-button" data-action="continue">继续闯关</button>
        </div>
      </article>
    `;
    stage.querySelector("[data-action='armory']").addEventListener("click", () => callbacks.onArmory());
    stage.querySelector("[data-action='continue']").addEventListener("click", () => callbacks.onContinue());
  }

  let literacyExpanded = false;

  function renderLiteracyStrip(scope, words) {
    const strip = document.querySelector("#literacyStrip");
    if (!strip) return;

    // 三档统计：答对 1 次 / 2 次 / ≥3 次
    let lv1 = 0, lv2 = 0, lv3 = 0;
    const chars = words.map((w) => {
      const level = PROGRESS.readLevel(w.word);
      const write = PROGRESS.isMasteredWrite(w.word);
      const review = PROGRESS.needsReview(w.word);
      if (level === 1) lv1++;
      else if (level === 2) lv2++;
      else if (level >= 3) lv3++;
      let cls = "lit-char";
      if (level > 0) cls += " lvl-" + level;
      if (write) cls += " can-write";
      if (review) cls += " review";
      const lvlText = level === 0 ? "还没认" : level === 1 ? "认过 1 次" : level === 2 ? "认过 2 次" : "很熟（≥3 次）";
      const tag = lvlText + (write ? " ✍会写" : "") + (review ? " ⟳该复习" : "");
      return `<span class="${cls}" title="${w.word}（${w.pinyin}）· ${tag}">${w.word}</span>`;
    }).join("");

    const seen = lv1 + lv2 + lv3;

    strip.innerHTML = ""
      + "<div class=\"lit-summary\" id=\"litToggle\">"
      + "  <strong>📚 识词（" + scope + "）</strong>"
      + "  <span class=\"lit-legend\">"
      + "    <i class=\"dot lvl-1\"></i>" + lv1
      + "    <i class=\"dot lvl-2\"></i>" + lv2
      + "    <i class=\"dot lvl-3\"></i>" + lv3
      + "    <em>共 " + seen + "/" + words.length + "</em>"
      + "  </span>"
      + "  <button class=\"lit-toggle-btn\">" + (literacyExpanded ? "收起 ▲" : "展开 ▼") + "</button>"
      + "</div>"
      + "<div class=\"lit-char-grid\" style=\"display:" + (literacyExpanded ? "flex" : "none") + "\">" + chars + "</div>";

    document.querySelector("#litToggle").addEventListener("click", function () {
      literacyExpanded = !literacyExpanded;
      renderLiteracyStrip(scope, words);
    });
  }

  function renderProgress(mode, readingInArticle, scope, words) {
    const totalStars = WS.totalStars();
    const starProgress = totalStars % 10;
    const active = WS.weaponStateByFragments();
    document.querySelector("#stars").textContent = totalStars;
    document.querySelector("#fragments").textContent = WS.totalFragments();
    document.querySelector("#unlockStatus").textContent = WS.unlockText();
    document.querySelector("#meterLabel").textContent = `下一枚碎片 · ${active.weapon.name} ${active.progress}/${active.weapon.fragmentsRequired}`;
    document.querySelector("#meterText").textContent = `${starProgress}/10`;

    const meterBar = document.querySelector("#meterBar");
    const currentWidth = parseFloat(meterBar.style.width) || 0;

    if (starProgress === 0 && currentWidth > 50) {
      meterBar.style.transition = "none";
      meterBar.style.width = "100%";
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          meterBar.style.transition = "width 500ms cubic-bezier(0.4, 0, 0.2, 1)";
          meterBar.style.width = "0%";
        });
      });
    } else {
      meterBar.style.width = `${(starProgress / 10) * 100}%`;
    }

    renderLiteracyStrip(scope, words);
    WS.renderForgeSide(mode, readingInArticle);
  }

  window.RUOGU_UI = {
    speak,
    animateStarGain,
    renderResult,
    renderForge,
    renderLiteracyStrip,
    renderProgress
  };
})();
