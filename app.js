// 若谷自主阅读计划 · 主启动器（关卡路由 + 事件绑定）
// 依赖顺序见 game.html：数据源 → state-store → word-data → progress
//   → ocr-handwriting → weapon-system → ui-common → app

const stories = window.RUOGU_STORIES || [];
const readingTexts = window.RUOGU_READING_TEXTS || { recite: [], jokes: [], poems: [] };

const STATE = window.RUOGU_STATE;
const DATA = window.RUOGU_WORD_DATA;
const PROGRESS = window.RUOGU_PROGRESS;
const DICT = window.RUOGU_DICTATION;   // 听写手写板模块（区别于识字库数据 RUOGU_OCR）
const WS = window.RUOGU_WEAPON_SYSTEM;
const DUEL = window.RUOGU_DUEL_SYSTEM;
const UI = window.RUOGU_UI;

// ===== 初始化：加载档案 + 迁移旧数据 =====
STATE.loadProfiles();
PROGRESS.init(); // 若有旧 known，迁移为 proficiency
// 内置 OCR Key，若谷不用每次输入
localStorage.setItem("ruogu-ocr-key", "K87230002688957");

const profile = STATE.active();
let mode = "recognize";
let scope = profile.scope || "全部";     // 出题范围：上册 / 下册 / 全部
let words = DATA.buildWordTable(scope);   // 当前范围词表
let cursor = profile.cursor || 0;
let readingCursor = profile.readingCursor || 0;
let readingCat = profile.readingCat || "recite";
let readingInArticle = false;
let dictWord = null;

const stage = document.querySelector("#stage");
const tabs = document.querySelectorAll(".tab");

function persist() {
  const p = STATE.active();
  p.cursor = cursor;
  p.readingCursor = readingCursor;
  p.scope = scope;
  p.readingCat = readingCat;
  STATE.save();
}

// ===== 词表 / 光标 =====
function currentWord() {
  if (!words.length) return { word: "", pinyin: "", lesson: "", unit: "", vol: "" };
  return words[cursor % words.length] || words[0];
}

function nextWord() {
  if (words.length <= 1) { cursor = 0; persist(); return; }
  let next = cursor;
  while (next === cursor) next = Math.floor(Math.random() * words.length);
  cursor = next;
  persist();
}

function setScope(newScope) {
  scope = newScope;
  words = DATA.buildWordTable(scope);
  cursor = 0;
  dictWord = null;
  persist();
}

// 认读关：为某词生成 3 个干扰拼音 + 正确拼音，打乱
function pinyinOptions(answer) {
  const PINYIN = DATA.PINYIN;
  const allPinyins = Object.values(PINYIN).filter((p) => p && p !== answer.pinyin);
  const ans = answer.pinyin || "";
  const ansLen = ans.split(/\s+/).length;
  const sameLen = allPinyins.filter((p) => p.split(/\s+/).length === ansLen);
  const pool = (sameLen.length >= 3 ? sameLen : allPinyins);
  const distractors = DATA.shuffle([...new Set(pool)]).slice(0, 3);
  return DATA.shuffle([...distractors, ans]);
}

// ===== 听写关词池（只出会写词）=====
function dictationPool() {
  return words.filter((w) => w.isWrite);
}

function pickDictWord() {
  const pool = dictationPool();
  if (!pool.length) { dictWord = null; return; }
  if (pool.length === 1) { dictWord = pool[0]; return; }
  let next = dictWord;
  while (next === dictWord) next = pool[Math.floor(Math.random() * pool.length)];
  dictWord = next;
}

function currentDictWord() {
  if (!dictWord || dictationPool().indexOf(dictWord) === -1) pickDictWord();
  return dictWord || { word: "", pinyin: "", lesson: "", unit: "", vol: "", isWrite: true };
}

// ===== 得星 → 结果页 / 铸造页 =====
function awardStars(amount, reason) {
  const p = STATE.active();
  const before = Math.floor((p.totalStars || 0) / 10);
  p.totalStars = (p.totalStars || 0) + amount;
  STATE.save();
  const after = WS.totalFragments();

  const callbacks = {
    onArmory: () => { mode = "armory"; render(); },
    onContinue: () => render()
  };

  if (after > before) {
    UI.renderForge(stage, { amount, reason, beforeFragments: before, afterFragments: after }, callbacks);
  } else {
    UI.renderResult(stage, amount, reason, callbacks);
  }
  renderProgress();
}

function renderProgress() {
  UI.renderProgress(mode, readingInArticle, scope, words);
}

// ===== 认读关 =====
function renderRecognize() {
  const word = currentWord();
  const options = pinyinOptions(word);
  stage.innerHTML = `
    <article class="challenge recognize-card">
      <div class="level-badge">认读关 · +1 星</div>
      <div class="big-word big-word-phrase">${word.word}</div>
      <div class="option-grid">
        ${options.map((option) => `<button class="option pinyin-option" data-pinyin="${option}">${option}</button>`).join("")}
      </div>
      <div class="feedback">看词语，选出正确的读音。</div>
    </article>
  `;
  const feedback = stage.querySelector(".feedback");
  stage.querySelectorAll(".pinyin-option").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.pinyin === word.pinyin) {
        PROGRESS.recordReadSuccess(word.word);
        feedback.textContent = "太棒了！";
        feedback.classList.add("glow");
        feedback.addEventListener("animationend", () => feedback.classList.remove("glow"), { once: true });
        nextWord();
        awardStars(1, "认读成功");
      } else {
        PROGRESS.recordError(word.word, "read");
        feedback.textContent = `再想想，「${word.word}」读「${word.pinyin}」。`;
        feedback.classList.add("shake");
        feedback.addEventListener("animationend", () => feedback.classList.remove("shake"), { once: true });
      }
    });
  });
}

// ===== 听写关（委托给 ocr-handwriting.js）=====
function renderDictation() {
  const word = currentDictWord();
  DICT.renderDictation(stage, word, {
    onSuccess: (w, reason) => {
      // 听写正确记一次会写答对（用于识字条分档：1/2/≥3 次）
      PROGRESS.recordWriteSuccess(w.word);
      pickDictWord();
      awardStars(3, reason);
    },
    onError: (w) => PROGRESS.recordError(w.word, "write"),
    onPickNext: () => { pickDictWord(); renderDictation(); }
  });
}

// ===== 阅读关 =====
const READING_CATS = [
  { key: "recite", icon: "📜", name: "必背课文", items: () => readingTexts.recite || [], annotate: false },
  { key: "jokes", icon: "😄", name: "米小圈", items: () => readingTexts.jokes || [], annotate: true },
  { key: "poems", icon: "🌸", name: "古诗", items: () => readingTexts.poems || [], annotate: true }
];

const READING_FILTERS = [
  { key: "all", label: "全部" },
  { key: "unread", label: "未读" },
  { key: "read", label: "已读" },
  { key: "easy", label: "简单" },
  { key: "challenge", label: "挑战" },
  { key: "hard", label: "难" }
];

let readingFilter = "all"; // 当前阅读筛选

function readingScore(item, catKey, index) {
  const key = readingKeyOf(catKey, item, index);
  const completedReadings = STATE.active().completedReadings || {};
  const isRead = Boolean(completedReadings[key]);
  const cov = DATA.textCoverage(item.text);
  const len = [...item.text].filter((c) => /[一-鿿]/.test(c)).length;

  let score = 0;
  if (!isRead) score += 50;
  if (cov >= 60 && cov <= 85) score += 20;
  if (cov < 40) score -= 30;
  score -= len * 0.05;
  return score;
}

function readingFilterMatch(item, catKey, index, filter) {
  const key = readingKeyOf(catKey, item, index);
  const completedReadings = STATE.active().completedReadings || {};
  const isRead = Boolean(completedReadings[key]);
  const cov = DATA.textCoverage(item.text);
  if (filter === "unread") return !isRead;
  if (filter === "read") return isRead;
  if (filter === "easy") return cov >= 85;
  if (filter === "challenge") return cov >= 60 && cov < 85;
  if (filter === "hard") return cov < 60;
  return true;
}

function bestNextReading(cat) {
  const items = cat.items();
  const scored = items
    .map((item, index) => ({ item, index, score: readingScore(item, cat.key, index) }))
    .filter((x) => readingFilterMatch(x.item, cat.key, x.index, "unread"))
    .sort((a, b) => b.score - a.score);
  return scored.length ? scored[0] : null;
}

function renderReadingText(text, py, annotate) {
  py = py || {};
  let html = "";
  for (const ch of text) {
    if (ch === "\n") { html += "<br>"; continue; }
    if (annotate && /[一-鿿]/.test(ch) && !DATA.isLibChar(ch)) {
      html += `<ruby class="rd-new">${ch}<rt>${py[ch] || ""}</rt></ruby>`;
    } else {
      html += ch;
    }
  }
  return html;
}

function readingKeyOf(cat, item, index) {
  return cat + "::" + (item.title || index);
}

function renderReading() {
  readingInArticle = false;
  const cat = READING_CATS.find((c) => c.key === readingCat) || READING_CATS[0];
  const rawItems = cat.items();
  const completedReadings = STATE.active().completedReadings || {};

  const scoredItems = rawItems.map((item, index) => ({
    item,
    index,
    key: readingKeyOf(cat.key, item, index),
    score: readingScore(item, cat.key, index)
  }));

  const filteredItems = scoredItems
    .filter((x) => readingFilterMatch(x.item, cat.key, x.index, readingFilter))
    .sort((a, b) => b.score - a.score);

  const next = bestNextReading(cat);

  stage.innerHTML = `
    <article class="reader reader-browser">
      <div class="level-badge">阅读关 · +5 星</div>
      <div class="scope-tabs reading-cats">
        ${READING_CATS.map((c) =>
          `<button class="scope-tab ${c.key === readingCat ? "active" : ""}" data-cat="${c.key}">${c.icon} ${c.name}</button>`
        ).join("")}
      </div>
      ${next ? `
        <div class="continue-reading-bar">
          <button class="primary-button continue-reading-btn" data-index="${next.index}">🔥 继续读《${next.item.title || cat.name}》</button>
        </div>
      ` : ""}
      <div class="reading-filter-bar">
        ${READING_FILTERS.map((f) =>
          `<button class="reading-filter-pill ${f.key === readingFilter ? "active" : ""}" data-filter="${f.key}">${f.label}</button>`
        ).join("")}
      </div>
      <p class="prompt">认识的字越多，读起来越轻松。黄底字带拼音，可以拼出来。</p>
      <div class="story-list">
        ${filteredItems.map((x) => {
          const done = Boolean(completedReadings[x.key]);
          const cov = DATA.textCoverage(x.item.text);
          const sub = x.item.author ? x.item.author : (x.item.type || "");
          const isTop = x === filteredItems[0] && !done && readingFilter === "all";
          return `
            <button class="story-pick ${done ? "is-read" : ""}" data-index="${x.index}">
              <div class="story-pick-head">
                <strong>${x.item.title || (cat.name + (x.index + 1))}</strong>
                ${isTop ? `<span class="recommend-badge">推荐</span>` : ""}
                <span class="coverage-badge ${cov >= 85 ? "high" : cov >= 60 ? "mid" : "low"}">认识 ${cov}%</span>
              </div>
              <small>${done ? "✅ 已读完" : "🆕 未读"}${sub ? " · " + sub : ""}</small>
            </button>
          `;
        }).join("")}
      </div>
      <div class="feedback">读完一篇获得 5 星。</div>
    </article>
  `;

  stage.querySelectorAll(".reading-cats .scope-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      readingCat = btn.dataset.cat;
      readingFilter = "all";
      persist();
      renderReading();
    });
  });

  stage.querySelectorAll(".reading-filter-pill").forEach((btn) => {
    btn.addEventListener("click", () => {
      readingFilter = btn.dataset.filter;
      renderReading();
    });
  });

  const continueBtn = stage.querySelector(".continue-reading-btn");
  if (continueBtn) {
    continueBtn.addEventListener("click", () => {
      const idx = parseInt(continueBtn.dataset.index, 10);
      renderStoryReader(cat, rawItems[idx], idx);
    });
  }

  stage.querySelectorAll(".story-pick").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.dataset.index, 10);
      renderStoryReader(cat, rawItems[idx], idx);
    });
  });
}

function renderStoryReader(cat, item, index) {
  readingInArticle = true;
  const key = readingKeyOf(cat.key, item, index);
  const completedReadings = STATE.active().completedReadings || {};
  const alreadyDone = Boolean(completedReadings[key]);
  const cov = DATA.textCoverage(item.text);
  const bodyHtml = renderReadingText(item.text, item.py, cat.annotate);
  const meta = item.author || item.type || "";

  stage.innerHTML = `
    <article class="reader">
      <div class="level-badge">阅读关 · +5 星</div>
      <div class="story-meta">
        <h2>${item.title || cat.name}</h2>
        ${meta ? `<span class="story-author">${meta}</span>` : ""}
        <span class="coverage-badge ${cov >= 85 ? "high" : cov >= 70 ? "mid" : "low"}">认识 ${cov}%</span>
      </div>
      <div class="story reading-body ${cat.key === "poems" ? "is-poem" : ""}">${bodyHtml}</div>
      <div class="actions two-actions">
        <button class="soft-button" data-action="backToList">返回列表</button>
        <button class="primary-button" data-action="complete">${alreadyDone ? "换一篇" : "我读完了"}</button>
      </div>
      <div class="feedback">${alreadyDone ? "这篇已经得过星了，可以换下一篇。" : "自己读一遍，读完获得 5 星。"}</div>
    </article>
  `;

  stage.querySelector("[data-action='complete']").addEventListener("click", () => {
    if (!alreadyDone) {
      const p = STATE.active();
      if (!p.completedReadings) p.completedReadings = {};
      p.completedReadings[key] = true;
      STATE.save();
      // 阅读也累积会认熟练度
      PROGRESS.recordReadingExposure(item.text, key);
      awardStars(5, "阅读通关");
    } else {
      renderReading();
    }
  });

  stage.querySelector("[data-action='backToList']").addEventListener("click", () => {
    renderReading();
  });
}

// ===== 路由 =====
function render() {
  tabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.mode === mode));

  document.querySelectorAll("#scopeBar .scope-tab").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.scope === scope);
  });

  stage.style.opacity = "0";
  stage.style.transform = "translateY(8px)";
  stage.style.transition = "opacity 0.2s ease, transform 0.2s ease";

  setTimeout(() => {
    if (mode === "recognize") renderRecognize();
    if (mode === "dictation") renderDictation();
    if (mode === "reading") renderReading();
    if (mode === "duel") DUEL.renderDuel(stage);
    if (mode === "armory") WS.renderArmory(stage);
    renderProgress();

    requestAnimationFrame(() => {
      stage.style.opacity = "1";
      stage.style.transform = "translateY(0)";
    });
  }, 200);
}

// ===== 事件绑定 =====
tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    mode = tab.dataset.mode;
    render();
  });
});

function bindGlobalScopeTabs() {
  document.querySelectorAll("#scopeBar .scope-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      setScope(btn.dataset.scope);
      render();
    });
  });
}

function openProfileTools() {
  const encodeSyncCode = (text) => {
    const bytes = new TextEncoder().encode(text);
    let binary = "";
    bytes.forEach((b) => { binary += String.fromCharCode(b); });
    return btoa(binary);
  };
  const decodeSyncCode = (code) => {
    const clean = code.replace(/\s+/g, "");
    const binary = atob(clean);
    const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  };

  const overlay = document.createElement("div");
  overlay.className = "profile-overlay";
  const exported = STATE.exportProfiles();
  const syncCode = encodeSyncCode(exported);
  overlay.innerHTML = `
    <div class="profile-card">
      <button class="profile-close" data-action="closeProfileTools">×</button>
      <p class="prompt">档案迁移</p>
      <h2>导出 / 导入若谷记录</h2>
      <p class="profile-note">星星、碎片、已解锁神兵都保存在这个浏览器的本地档案里。导入前会自动备份当前档案。</p>
      <div class="profile-actions">
        <button class="soft-button" data-action="downloadProfile">导出档案文件</button>
        <label class="profile-file-button">
          导入档案文件
          <input type="file" id="profileFile" accept=".json,application/json,text/plain">
        </label>
      </div>
      <label class="profile-field">
        <span>同步码</span>
        <textarea id="profileSyncCode" spellcheck="false">${syncCode}</textarea>
      </label>
      <div class="profile-actions">
        <button class="soft-button" data-action="copySyncCode">复制同步码</button>
        <button class="primary-button" data-action="importSyncCode">导入同步码</button>
      </div>
      <details class="profile-raw">
        <summary>高级：查看原始档案 JSON</summary>
      <textarea id="profileText">${exported.replace(/</g, "&lt;")}</textarea>
      </details>
      <div class="profile-actions">
        <button class="soft-button" data-action="copyProfile">复制导出档案</button>
        <button class="primary-button" data-action="importProfile">导入文本中的档案</button>
      </div>
      <div class="feedback" id="profileFeedback">在 iPad 上复制这里的档案文本，再到另一台设备导入。</div>
    </div>
  `;
  document.body.appendChild(overlay);
  const text = overlay.querySelector("#profileText");
  const sync = overlay.querySelector("#profileSyncCode");
  const fileInput = overlay.querySelector("#profileFile");
  const feedback = overlay.querySelector("#profileFeedback");
  const close = () => overlay.remove();
  const importText = (value) => {
    const imported = STATE.importProfiles(value);
    feedback.textContent = `导入成功：${imported.name || "若谷"}，${imported.totalStars || 0} 星。页面即将刷新。`;
    setTimeout(() => location.reload(), 900);
  };
  fileInput.addEventListener("change", () => {
    const file = fileInput.files && fileInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        importText(String(reader.result || ""));
      } catch (err) {
        feedback.textContent = err.message || "导入失败，请检查文件。";
      }
    };
    reader.readAsText(file, "utf-8");
  });
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay || e.target.dataset.action === "closeProfileTools") close();
    if (e.target.dataset.action === "downloadProfile") {
      const blob = new Blob([STATE.exportProfiles()], { type: "application/json;charset=utf-8" });
      const a = document.createElement("a");
      const date = new Date().toISOString().slice(0, 10);
      a.href = URL.createObjectURL(blob);
      a.download = `ruogu-literacy-profile-${date}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      feedback.textContent = "已生成档案文件。";
    }
    if (e.target.dataset.action === "copySyncCode") {
      sync.select();
      const value = sync.value;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(value).then(() => {
          feedback.textContent = "同步码已复制。";
        }).catch(() => {
          document.execCommand("copy");
          feedback.textContent = "已选中并尝试复制同步码。";
        });
      } else {
        document.execCommand("copy");
        feedback.textContent = "已选中并尝试复制同步码。";
      }
    }
    if (e.target.dataset.action === "importSyncCode") {
      try {
        importText(decodeSyncCode(sync.value));
      } catch (err) {
        feedback.textContent = "同步码无效，请检查是否复制完整。";
      }
    }
    if (e.target.dataset.action === "copyProfile") {
      text.select();
      const value = text.value;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(value).then(() => {
          feedback.textContent = "已复制。";
        }).catch(() => {
          document.execCommand("copy");
          feedback.textContent = "已选中并尝试复制。";
        });
      } else {
        document.execCommand("copy");
        feedback.textContent = "已选中并尝试复制。";
      }
    }
    if (e.target.dataset.action === "importProfile") {
      try {
        importText(text.value);
      } catch (err) {
        feedback.textContent = err.message || "导入失败，请检查文本。";
      }
    }
  });
}

const startBtn = document.querySelector("[data-action='startQuest']");
if (startBtn) {
  startBtn.addEventListener("click", () => {
    mode = "recognize";
    render();
  });
}

const profileToolsBtn = document.querySelector("[data-action='profileTools']");
if (profileToolsBtn) profileToolsBtn.addEventListener("click", openProfileTools);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js"));
}

bindGlobalScopeTabs();
render();
