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
  let literacyFilter = "all"; // all | unread | unwrite | review | mastered

  const FILTERS = [
    { key: "all", label: "全部" },
    { key: "unread", label: "不会认" },
    { key: "unwrite", label: "不会写" },
    { key: "review", label: "待复习" },
    { key: "mastered", label: "已掌握" }
  ];

  function getCharState(word) {
    const readMastered = PROGRESS.isMasteredRead(word);
    const writeMastered = PROGRESS.isMasteredWrite(word);
    const needsReview = PROGRESS.needsReview(word);
    const readHits = (PROGRESS.readLevel(word) || 0);

    if (needsReview) return { key: "review", label: "待复习" };
    if (readMastered && writeMastered) return { key: "mastered-both", label: "会认且会写" };
    if (writeMastered) return { key: "can-write", label: "会写" };
    if (readMastered || readHits > 0) return { key: "can-read", label: readMastered ? "会认" : "认过" };
    return { key: "unseen", label: "还没认" };
  }

  function matchesFilter(word, filter) {
    const readMastered = PROGRESS.isMasteredRead(word);
    const writeMastered = PROGRESS.isMasteredWrite(word);
    const needsReview = PROGRESS.needsReview(word);
    if (filter === "unread") return !readMastered;
    if (filter === "unwrite") return !writeMastered;
    if (filter === "review") return needsReview;
    if (filter === "mastered") return readMastered && writeMastered;
    return true;
  }

  function renderLiteracyStrip(scope, words) {
    const strip = document.querySelector("#literacyStrip");
    if (!strip) return;

    let canRead = 0, canWrite = 0, reviewCount = 0, masteredBoth = 0;
    const charItems = words.map((w) => {
      const state = getCharState(w.word);
      if (state.key === "can-read" || state.key === "mastered-both") canRead++;
      if (state.key === "can-write" || state.key === "mastered-both") canWrite++;
      if (state.key === "review") reviewCount++;
      if (state.key === "mastered-both") masteredBoth++;

      const visible = matchesFilter(w.word, literacyFilter);
      let cls = "lit-char " + state.key;
      return {
        html: `<span class="${cls}" title="${w.word}（${w.pinyin || ""}）· ${state.label}" style="display:${visible ? "inline-flex" : "none"}">${w.word}</span>`,
        visible
      };
    });

    const charsHtml = charItems.map((i) => i.html).join("");
    const visibleCount = charItems.filter((i) => i.visible).length;

    const filterPills = FILTERS.map((f) =>
      `<button class="lit-filter-pill ${f.key === literacyFilter ? "active" : ""}" data-filter="${f.key}">${f.label}</button>`
    ).join("");

    strip.innerHTML = ""
      + "<div class=\"lit-summary\" id=\"litToggle\">"
      + "  <strong>📚 识词（" + scope + "）</strong>"
      + "  <span class=\"lit-stats\">"
      + "    <span class=\"stat-read\">会认 " + canRead + "/" + words.length + "</span>"
      + "    <span class=\"stat-write\">会写 " + canWrite + "</span>"
      + "    <span class=\"stat-review\">待复习 " + reviewCount + "</span>"
      + "  </span>"
      + "  <button class=\"lit-toggle-btn\">" + (literacyExpanded ? "收起 ▲" : "展开 ▼") + "</button>"
      + "</div>"
      + "<div class=\"lit-filter-bar\" style=\"display:" + (literacyExpanded ? "flex" : "none") + "\">" + filterPills + "</div>"
      + "<div class=\"lit-char-grid\" style=\"display:" + (literacyExpanded ? "flex" : "none") + "\">" + charsHtml + "</div>"
      + "<div class=\"lit-empty-hint\" style=\"display:" + (literacyExpanded && visibleCount === 0 ? "block" : "none") + "\">这一栏暂时没有字。</div>";

    document.querySelector("#litToggle").addEventListener("click", function () {
      literacyExpanded = !literacyExpanded;
      renderLiteracyStrip(scope, words);
    });

    strip.querySelectorAll(".lit-filter-pill").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        literacyFilter = btn.dataset.filter;
        renderLiteracyStrip(scope, words);
      });
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
