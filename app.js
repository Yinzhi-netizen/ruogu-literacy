// ===== 词库：从 RUOGU_OCR(定稿识字库) + RUOGU_PINYIN(整词拼音) 构建扁平词表 =====
const OCR = window.RUOGU_OCR;
const PINYIN = window.RUOGU_PINYIN || {};

// 构建：每个词 → { word, pinyin, vol, unit, lesson, isWrite }
// isWrite=true 表示该词是「会写词」（在任一课的 write 里出现过）；听写关只出会写词
function buildWordTable(scope) {
  const vols = scope === "全部" ? ["上册", "下册"] : [scope];
  const out = [];
  const index = new Map(); // key(vol|word) → 词对象，便于合并 isWrite
  vols.forEach((vol) => {
    (OCR[vol] || []).forEach((u) => {
      u.lessons.forEach((l) => {
        const push = (w, isWrite) => {
          const key = vol + "|" + w;
          if (index.has(key)) {
            // 已存在：只要任一处是会写，就标为会写词
            if (isWrite) index.get(key).isWrite = true;
            return;
          }
          const item = {
            word: w,
            pinyin: PINYIN[w] || "",
            vol,
            unit: u.unit,
            lesson: l.title,
            isWrite
          };
          index.set(key, item);
          out.push(item);
        };
        l.recognize.forEach((w) => push(w, false));
        l.write.forEach((w) => push(w, true));
      });
    });
  });
  return out;
}

const stories = (window.RUOGU_STORIES) || [];
const readingTexts = (window.RUOGU_READING_TEXTS) || { recite: [], jokes: [], poems: [] };
const weapons = window.RUOGU_WEAPONS;
const storeKey = "ruogu-literacy-state-v5"; // v5：v4 词级统计 + 若谷已解锁芭蕉扇（280星）

// 库内字集：全册会认+会写词拆出的所有单字（与出题范围无关），用于阅读关判断新字
const LIB_CHARS = (function () {
  const set = new Set();
  for (const vol of ["上册", "下册"]) {
    (OCR[vol] || []).forEach((u) => u.lessons.forEach((l) => {
      [...l.recognize, ...l.write].forEach((w) => {
        [...w].forEach((c) => { if (/[一-鿿]/.test(c)) set.add(c); });
      });
    }));
  }
  return set;
})();

const state = loadState();
// 内置 OCR Key，若谷不用每次输入（每次加载都保证有）
localStorage.setItem("ruogu-ocr-key", "K87230002688957");
let mode = "recognize";
let scope = state.scope || "全部"; // 出题范围：上册 / 下册 / 全部
let words = buildWordTable(scope); // 当前范围的词表
let cursor = state.cursor || 0;
let readingCursor = state.readingCursor || 0;

const stage = document.querySelector("#stage");
const tabs = document.querySelectorAll(".tab");

function freshState() {
  return {
    totalStars: 0,
    cursor: 0,
    readingCursor: 0,
    readingCat: "recite",
    scope: "全部",
    known: {},
    completedReadings: {}
  };
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(storeKey));
    if (saved) {
      // 兜底修复：iPad 上之前可能因 sw 缓存执行了旧 app.js，把 v5 存成 0 星
      if (typeof saved.totalStars !== "number" || saved.totalStars < 280) {
        saved.totalStars = 280;
      }
      return saved;
    }
  } catch {}
  // 首次进入 v4：迁移旧版(v3)的星数/碎片进度，保留若谷已有成果
  const fresh = freshState();
  try {
    const old = JSON.parse(localStorage.getItem("ruogu-literacy-state-v3"));
    if (old && typeof old.totalStars === "number") {
      fresh.totalStars = old.totalStars;              // 保留总星
      if (old.completedReadings) fresh.completedReadings = old.completedReadings; // 保留已读篇目
      // known 不迁移：旧的是「字」级、新的是「词」级，统计口径不同
    }
  } catch {}
  // v4→v5：若谷已解锁至芭蕉扇，保留旧星数，0星则注入280
  try {
    const old = JSON.parse(localStorage.getItem("ruogu-literacy-state-v4"));
    if (old && typeof old.totalStars === "number") {
      fresh.totalStars = Math.max(old.totalStars, 280);
    }
  } catch {}
  // 全新设备/无任何旧状态：至少给若谷保留已解锁的芭蕉扇进度
  if (fresh.totalStars < 280) fresh.totalStars = 280;
  return fresh;
}

function saveState() {
  state.cursor = cursor;
  state.readingCursor = readingCursor;
  state.scope = scope;
  state.readingCat = readingCat;
  localStorage.setItem(storeKey, JSON.stringify(state));
}

// 切换出题范围（上册/下册/全部），重建词表
function setScope(newScope) {
  scope = newScope;
  words = buildWordTable(scope);
  cursor = 0;
  dictWord = null; // 听写词重新从新范围抽
  saveState();
}

function currentWord() {
  if (!words.length) return { word: "", pinyin: "", lesson: "", unit: "", vol: "" };
  return words[cursor % words.length] || words[0];
}

function currentStory() {
  return stories[readingCursor % stories.length] || stories[0];
}

function shuffle(list) {
  return [...list].sort(() => Math.random() - 0.5);
}

// 认读关：为某词生成 3 个干扰拼音 + 正确拼音，打乱
function pinyinOptions(answer) {
  // 干扰池：全库所有不同的拼音（排除正确答案）
  const allPinyins = Object.values(PINYIN).filter((p) => p && p !== answer.pinyin);
  const ans = answer.pinyin || "";
  const ansLen = ans.split(/\s+/).length; // 正确答案的音节数
  // 优先选音节数相同的拼音做干扰，难度更接近
  const sameLen = allPinyins.filter((p) => p.split(/\s+/).length === ansLen);
  const pool = (sameLen.length >= 3 ? sameLen : allPinyins);
  const distractors = shuffle([...new Set(pool)]).slice(0, 3);
  return shuffle([...distractors, ans]);
}

function totalFragments() {
  return Math.floor(state.totalStars / 10);
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
  const rest = state.totalStars % 10;
  return rest === 0 ? 10 : 10 - rest;
}

function isFamiliar(word) {
  return (state.known[word.word] || 0) >= 2;
}

function getKnownCharacters() {
  return words.filter((w) => isFamiliar(w)).map((w) => w.word);
}

function getLiteracyRate() {
  if (words.length === 0) return 0;
  return Math.round((getKnownCharacters().length / words.length) * 100);
}

function passageCoverage(story) {
  const chars = story.text.filter(([char]) => char !== "，" && char !== "。" && char !== "、");
  if (chars.length === 0) return 0;
  // 词级库下：某字若出现在任一「已熟」的词里，算认识
  const knownChars = new Set();
  words.forEach((w) => {
    if (isFamiliar(w)) [...w.word].forEach((c) => knownChars.add(c));
  });
  const known = chars.filter(([char]) => knownChars.has(char)).length;
  return Math.round((known / chars.length) * 100);
}

function markKnown(word) {
  if (!state.known[word]) state.known[word] = 0;
  state.known[word] += 1;
  if (!state.learnedAt) state.learnedAt = {};
  if (state.known[word] >= 2 && !state.learnedAt[word]) {
    state.learnedAt[word] = Date.now();
  }
}

var literacyExpanded = false;

function renderLiteracyStrip() {
  var strip = document.querySelector("#literacyStrip");
  if (!strip) return;
  var known = getKnownCharacters();
  var rate = getLiteracyRate();
  var chars = words.map(function (w) {
    var familiar = isFamiliar(w);
    return "<span class=\"lit-char " + (familiar ? "known" : "") + "\" title=\"" + w.word + "（" + w.pinyin + "）" + (familiar ? " ✓" : "") + "\">" + w.word + "</span>";
  }).join("");
  strip.innerHTML = ""
    + "<div class=\"lit-summary\" id=\"litToggle\">"
    + "  <strong>📚 已识词（" + scope + "）</strong>"
    + "  <span>" + known.length + "/" + words.length + "（" + rate + "%）</span>"
    + "  <button class=\"lit-toggle-btn\">" + (literacyExpanded ? "收起 ▲" : "展开 ▼") + "</button>"
    + "</div>"
    + "<div class=\"lit-char-grid\" style=\"display:" + (literacyExpanded ? "flex" : "none") + "\">" + chars + "</div>";

  document.querySelector("#litToggle").addEventListener("click", function () {
    literacyExpanded = !literacyExpanded;
    renderLiteracyStrip();
  });
}

function speak(text) {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "zh-CN";
  utterance.rate = 0.82;
  window.speechSynthesis.speak(utterance);
}

function animateStarGain(amount) {
  const statsEl = document.querySelector(".stats div:first-child");
  if (!statsEl) return;
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

function awardStars(amount, reason) {
  const beforeStars = state.totalStars;
  const beforeFragments = Math.floor(beforeStars / 10);
  state.totalStars += amount;
  const afterFragments = totalFragments();
  saveState();

  if (afterFragments > beforeFragments) {
    renderForge({ amount, reason, beforeFragments, afterFragments });
  } else {
    renderResult(amount, reason);
  }
}

function nextWord() {
  // 随机抽下一词（词量大，不强制顺序），尽量不连续重复
  if (words.length <= 1) { cursor = 0; saveState(); return; }
  let next = cursor;
  while (next === cursor) next = Math.floor(Math.random() * words.length);
  cursor = next;
  saveState();
}

// ===== 听写关：只出「会写词」=====
let dictWord = null; // 当前听写词

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

// 绑定顶部全局范围切换控件
function bindGlobalScopeTabs() {
  document.querySelectorAll("#scopeBar .scope-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      setScope(btn.dataset.scope);
      render();
    });
  });
}

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
        markKnown(word.word);
        feedback.textContent = "太棒了！";
        feedback.classList.add("glow");
        feedback.addEventListener("animationend", () => feedback.classList.remove("glow"), { once: true });
        nextWord();
        awardStars(1, "认读成功");
      } else {
        feedback.textContent = `再想想，「${word.word}」读「${word.pinyin}」。`;
        feedback.classList.add("shake");
        feedback.addEventListener("animationend", () => feedback.classList.remove("shake"), { once: true });
      }
    });
  });
}

function renderDictation() {
  const word = currentDictWord();
  if (!word.word) {
    stage.innerHTML = `
      <article class="challenge dictation-card">
        <div class="level-badge">听写关 · +3 星</div>
        <div class="feedback">这个范围里暂时没有「会写词」，换个范围试试。</div>
      </article>`;
    return;
  }
  const hasApiKey = Boolean(localStorage.getItem("ruogu-ocr-key"));
  const n = Math.max(1, word.word.length);   // 字数 = 田字格数
  const cell = 360;                            // 每格像素
  const padW = n * cell;
  const padH = cell;
  const multiClass = n > 1 ? " multi" : "";
  const ratioStyle = n > 1 ? `style="--pad-ratio:${n} / 1"` : "";
  stage.innerHTML = `
    <article class="challenge dictation-card">
      <div class="level-badge">听写关 · +3 星</div>
      <button class="target listen-target" data-action="speak">🔊 听词语</button>
      <canvas class="handwrite-pad${multiClass}" ${ratioStyle} width="${padW}" height="${padH}" data-cells="${n}" aria-label="手写区域"></canvas>
      <div class="ocr-status" hidden></div>
      <div class="actions two-actions">
        <button class="soft-button" data-action="clear">擦掉重写</button>
        <button class="primary-button" data-action="submitOcr">提交识别</button>
      </div>
      <div class="ocr-settings" hidden>
        <input type="password" class="ocr-key-input" placeholder="输入 ocr.space API Key" />
        <button class="soft-button ocr-save-btn" style="min-height:36px;font-size:14px;">保存</button>
        <small><a href="https://ocr.space/ocrapi/freekey" target="_blank">免费获取 API Key</a></small>
      </div>
      ${hasApiKey
        ? `<button class="ocr-toggle ocr-toggle-mini" data-action="toggleOcrSettings" title="修改 API Key">⚙️</button>`
        : `<button class="ocr-toggle" data-action="toggleOcrSettings">⚙️ 设置 API Key（首次使用）</button>`}
      <div class="feedback">听词语，在方框里手写这个词，然后点「提交识别」。</div>
    </article>
  `;
  setupHandwritingPad(word);
}

function setupHandwritingPad(word) {
  const canvas = stage.querySelector(".handwrite-pad");
  const ocrStatus = stage.querySelector(".ocr-status");
  const feedback = stage.querySelector(".feedback");
  const ctx = canvas.getContext("2d");
  let drawing = false;

  ctx.lineWidth = 26;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "#111111";

  function point(event) {
    const rect = canvas.getBoundingClientRect();
    const touch = event.touches ? event.touches[0] : event;
    return {
      x: ((touch.clientX - rect.left) / rect.width) * canvas.width,
      y: ((touch.clientY - rect.top) / rect.height) * canvas.height
    };
  }

  function startDraw(event) {
    event.preventDefault();
    drawing = true;
    const p = point(event);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  }

  function moveDraw(event) {
    if (!drawing) return;
    event.preventDefault();
    const p = point(event);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  }

  function stopDraw() {
    drawing = false;
  }

  // 画 N 个田字格（浅色，OCR 只认黑色笔迹，会忽略浅格线）
  function drawGrid() {
    const cells = parseInt(canvas.dataset.cells || "1", 10);
    const cw = canvas.width / cells;
    const h = canvas.height;
    ctx.save();
    ctx.strokeStyle = "rgba(143, 29, 29, 0.22)";
    ctx.lineWidth = 2;
    for (let i = 0; i < cells; i++) {
      const x0 = i * cw;
      // 外框
      ctx.strokeRect(x0 + 3, 3, cw - 6, h - 6);
      // 米字虚线（中横、中竖）
      ctx.save();
      ctx.setLineDash([10, 10]);
      ctx.beginPath();
      ctx.moveTo(x0 + cw / 2, 4); ctx.lineTo(x0 + cw / 2, h - 4);
      ctx.moveTo(x0 + 4, h / 2); ctx.lineTo(x0 + cw - 4, h / 2);
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
    // 还原手写笔的样式
    ctx.lineWidth = 26;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#111111";
  }

  function clearPad() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawGrid();
    ocrStatus.hidden = true;
  }

  drawGrid(); // 初始画格

  canvas.addEventListener("mousedown", startDraw);
  canvas.addEventListener("mousemove", moveDraw);
  window.addEventListener("mouseup", stopDraw);
  canvas.addEventListener("touchstart", startDraw, { passive: false });
  canvas.addEventListener("touchmove", moveDraw, { passive: false });
  canvas.addEventListener("touchend", stopDraw);

  // 读出整个词（重复一遍，便于听清）
  const playPrompt = () => speak(`${word.word}。${word.word}。`);
  stage.querySelector("[data-action='speak']").addEventListener("click", playPrompt);
  stage.querySelector("[data-action='clear']").addEventListener("click", clearPad);

  // OCR settings toggle
  stage.querySelector("[data-action='toggleOcrSettings']").addEventListener("click", () => {
    const panel = stage.querySelector(".ocr-settings");
    panel.hidden = !panel.hidden;
  });

  // Save OCR key
  stage.querySelector(".ocr-save-btn").addEventListener("click", () => {
    const input = stage.querySelector(".ocr-key-input");
    const key = input.value.trim();
    if (key) {
      localStorage.setItem("ruogu-ocr-key", key);
      stage.querySelector(".ocr-settings").hidden = true;
      feedback.textContent = "API Key 已保存，现在可以提交识别了。";
      feedback.classList.add("glow");
      feedback.addEventListener("animationend", () => feedback.classList.remove("glow"), { once: true });
    }
  });

  // Submit for OCR recognition
  stage.querySelector("[data-action='submitOcr']").addEventListener("click", async () => {
    ocrStatus.hidden = false;
    ocrStatus.className = "ocr-status";
    ocrStatus.innerHTML = "<span class='ocr-spinner'></span> 正在识别你写的字...";
    feedback.textContent = "";

    const imageBlob = await captureCanvas(canvas);
    const result = await recognizeCharacter(imageBlob);

    if (result.error === "no_key") {
      ocrStatus.className = "ocr-status ocr-warn";
      ocrStatus.innerHTML = "请先设置 API Key（点击下方 ⚙️ 链接，免费注册 ocr.space）。";
      return;
    }

    if (result.error === "network_error") {
      fallbackManualCheck(word, canvas);
      return;
    }

    if (result.error === "recognition_failed") {
      ocrStatus.className = "ocr-status ocr-warn";
      ocrStatus.innerHTML = `识别失败：${result.apiMessage || "未知错误"}。请重试或擦掉重新写。`;
      return;
    }

    handleRecognitionResult(result.text, word, canvas);
  });

  setTimeout(playPrompt, 260);
}

function captureCanvas(canvas) {
  return new Promise(function (resolve) {
    var fullCanvas = document.createElement("canvas");
    fullCanvas.width = canvas.width;
    fullCanvas.height = canvas.height;
    var fctx = fullCanvas.getContext("2d");
    fctx.fillStyle = "#ffffff";
    fctx.fillRect(0, 0, fullCanvas.width, fullCanvas.height);
    fctx.drawImage(canvas, 0, 0);
    // 缩小到 800px 宽以内，减少上传体积
    var scale = Math.min(1, 800 / fullCanvas.width);
    var target = fullCanvas;
    if (scale < 1) {
      target = document.createElement("canvas");
      target.width = Math.round(fullCanvas.width * scale);
      target.height = Math.round(fullCanvas.height * scale);
      var sctx = target.getContext("2d");
      sctx.drawImage(fullCanvas, 0, 0, target.width, target.height);
    }
    target.toBlob(function (blob) {
      resolve(blob);
    }, "image/png");
  });
}

async function recognizeCharacter(blob) {
  var apiKey = localStorage.getItem("ruogu-ocr-key");
  if (!apiKey) return { error: "no_key" };

  var formData = new FormData();
  formData.append("file", blob, "handwrite.png");
  formData.append("apikey", apiKey);
  formData.append("language", "chs");
  formData.append("OCREngine", "3");
  formData.append("isOverlayRequired", "false");

  try {
    var res = await fetch("https://api.ocr.space/parse/image", {
      method: "POST",
      body: formData
    });
    var raw = await res.text();
    console.log("OCR API raw response:", raw);
    var data;
    try {
      data = JSON.parse(raw);
    } catch (e) {
      return { error: "recognition_failed", apiMessage: "Non-JSON response: " + raw.slice(0, 200) };
    }
    if ((data.OCRExitCode === 1 || data.OCRExitCode === 2) && data.ParsedResults && data.ParsedResults.length) {
      var text = data.ParsedResults[0].ParsedText ? data.ParsedResults[0].ParsedText.trim() : "";
      return { success: true, text: text };
    }
    var errMsg = data.ErrorMessage || data.ErrorDetails || "API returned exit code " + (data.OCRExitCode || "unknown");
    return { error: "recognition_failed", apiMessage: errMsg };
  } catch (e) {
    return { error: "network_error", apiMessage: e.message };
  }
}

function handleRecognitionResult(recognizedText, word, canvas) {
  const ocrStatus = stage.querySelector(".ocr-status");
  const cleaned = recognizedText.replace(/\s/g, "");
  const target = word.word;
  // 整词校验：识别文本完整包含该词 → 完全正确
  const exact = cleaned.includes(target);
  // 多字词容错：该词的每个字都在识别结果里（顺序可乱，OCR 手写易错位）
  const allChars = [...target].every((c) => cleaned.includes(c));

  if (exact || (target.length > 1 && allChars)) {
    ocrStatus.className = "ocr-status ocr-ok";
    ocrStatus.innerHTML = `识别成功：${cleaned} ✓`;
    markKnown(word.word);
    markKnown(word.word);
    pickDictWord();
    awardStars(3, "听写成功");
  } else {
    // 部分命中：给人工确认入口（OCR 对手写多字词常不准）
    const hitCount = [...new Set(target)].filter((c) => cleaned.includes(c)).length;
    ocrStatus.className = "ocr-status ocr-warn";
    ocrStatus.innerHTML = `
      <div class="fallback-check">
        <p>识别结果：<strong>${cleaned || "无"}</strong>（要写的是「${target}」）</p>
        <p class="hit-hint">${hitCount > 0 ? `认出了 ${hitCount}/${target.length} 个字。` : ""}手写的字 OCR 有时认不准，你自己看写对了吗？</p>
        <div class="actions two-actions">
          <button class="soft-button" data-action="retryManual">再写一次</button>
          <button class="primary-button" data-action="confirmManual">我写对了 ✓</button>
        </div>
      </div>
    `;
    stage.querySelector("[data-action='retryManual']").addEventListener("click", () => {
      const canvasEl = stage.querySelector(".handwrite-pad");
      const ctx = canvasEl.getContext("2d");
      ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
      ocrStatus.hidden = true;
    });
    stage.querySelector("[data-action='confirmManual']").addEventListener("click", () => {
      markKnown(word.word);
      markKnown(word.word);
      pickDictWord();
      awardStars(3, "听写成功");
    });
  }
}

function fallbackManualCheck(word, canvas) {
  const ocrStatus = stage.querySelector(".ocr-status");
  const imageUrl = canvas.toDataURL("image/png");
  ocrStatus.className = "ocr-status ocr-warn";
  ocrStatus.innerHTML = `
    <div class="fallback-check">
      <p>联网识别失败，请手动比对：</p>
      <img src="${imageUrl}" alt="手写内容" class="handwrite-preview" />
      <p class="fallback-answer">答案：<strong>${word.word}</strong><span class="py">（${word.pinyin}）</span></p>
      <div class="actions two-actions">
        <button class="soft-button" data-action="retryManual">再写一次</button>
        <button class="primary-button" data-action="confirmManual">写对了</button>
      </div>
    </div>
  `;

  stage.querySelector("[data-action='retryManual']").addEventListener("click", () => {
    const canvasEl = stage.querySelector(".handwrite-pad");
    const ctx = canvasEl.getContext("2d");
    ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
    ocrStatus.hidden = true;
  });

  stage.querySelector("[data-action='confirmManual']").addEventListener("click", () => {
    markKnown(word.word);
    markKnown(word.word);
    pickDictWord();
    awardStars(3, "听写成功");
  });
}

// 阅读关三类配置
const READING_CATS = [
  { key: "recite", icon: "📜", name: "必背课文", items: () => readingTexts.recite || [], annotate: false },
  { key: "jokes", icon: "😄", name: "米小圈", items: () => readingTexts.jokes || [], annotate: true },
  { key: "poems", icon: "🌸", name: "古诗", items: () => readingTexts.poems || [], annotate: true }
];
let readingCat = state.readingCat || "recite"; // 当前阅读类别
let readingInArticle = false; // 是否在阅读文章详情页（列表页隐藏侧栏，文章页显示）

// 把一段文本渲染成 HTML：库内字直接显示；库外新字加 ruby 注音（annotate=false 则纯文本）
function renderReadingText(text, py, annotate) {
  py = py || {};
  let html = "";
  for (const ch of text) {
    if (ch === "\n") { html += "<br>"; continue; }
    if (annotate && /[一-鿿]/.test(ch) && !LIB_CHARS.has(ch)) {
      html += `<ruby class="rd-new">${ch}<rt>${py[ch] || ""}</rt></ruby>`;
    } else {
      html += ch;
    }
  }
  return html;
}

// 文本认字率：库内字占比
function textCoverage(text) {
  const han = [...text].filter((c) => /[一-鿿]/.test(c));
  if (!han.length) return 100;
  const known = han.filter((c) => LIB_CHARS.has(c)).length;
  return Math.round((known / han.length) * 100);
}

function readingKeyOf(cat, item, index) {
  return cat + "::" + (item.title || index);
}

function renderReading() {
  readingInArticle = false; // 列表页不显示侧栏
  const cat = READING_CATS.find((c) => c.key === readingCat) || READING_CATS[0];
  const items = cat.items();

  stage.innerHTML = `
    <article class="reader reader-browser">
      <div class="level-badge">阅读关 · +5 星</div>
      <div class="scope-tabs reading-cats">
        ${READING_CATS.map((c) =>
          `<button class="scope-tab ${c.key === readingCat ? "active" : ""}" data-cat="${c.key}">${c.icon} ${c.name}</button>`
        ).join("")}
      </div>
      <p class="prompt">认识的字越多，读起来越轻松。黄底字带拼音，可以拼出来。</p>
      <div class="story-list">
        ${items.map((item, index) => {
          const key = readingKeyOf(cat.key, item, index);
          const done = Boolean(state.completedReadings[key]);
          const cov = textCoverage(item.text);
          const sub = item.author ? item.author : (item.type || "");
          return `
            <button class="story-pick" data-index="${index}">
              <div class="story-pick-head">
                <strong>${item.title || (cat.name + (index + 1))}</strong>
                <span class="coverage-badge ${cov >= 85 ? "high" : cov >= 70 ? "mid" : "low"}">认识 ${cov}%</span>
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
      state.readingCat = readingCat;
      saveState();
      renderReading();
    });
  });

  stage.querySelectorAll(".story-pick").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.dataset.index, 10);
      renderStoryReader(cat, items[idx], idx);
    });
  });
}

function renderStoryReader(cat, item, index) {
  readingInArticle = true; // 文章详情页显示侧栏
  const key = readingKeyOf(cat.key, item, index);
  const alreadyDone = Boolean(state.completedReadings[key]);
  const cov = textCoverage(item.text);
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
      state.completedReadings[key] = true;
      saveState();
      awardStars(5, "阅读通关");
    } else {
      saveState();
      renderReading();
    }
  });

  stage.querySelector("[data-action='backToList']").addEventListener("click", () => {
    renderReading();
  });
}

function renderArmory() {
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
        <span>当前共有 ${state.totalStars} 星，已铸成 ${fragmentCount} 个碎片。</span>
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
    // 点小图弹大图
    if (weapon.image) {
      card.style.cursor = "pointer";
      card.addEventListener("click", () => showWeaponModal(weapon));
    }
    grid.append(card);
    used += weapon.fragmentsRequired;
  });
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
  // ESC 关闭
  const onKey = (e) => { if (e.key === "Escape") { close(); document.removeEventListener("keydown", onKey); } };
  document.addEventListener("keydown", onKey);
}

function fragmentDots(done, total) {
  return Array.from({ length: total }, (_, index) =>
    `<span class="fragment-dot ${index < done ? "lit" : ""}"></span>`
  ).join("");
}

function renderResult(amount, reason) {
  animateStarGain(amount);
  stage.innerHTML = `
    <article class="result-card">
      <div class="level-badge">${reason}</div>
      <div class="gain">+${amount}</div>
      <h2>获得 ${amount} 星</h2>
      <p>${unlockText()}</p>
      <div class="actions two-actions">
        <button class="soft-button" data-action="armory">看神兵库</button>
        <button class="primary-button" data-action="continue">继续闯关</button>
      </div>
    </article>
  `;
  stage.querySelector("[data-action='armory']").addEventListener("click", () => {
    mode = "armory";
    render();
  });
  stage.querySelector("[data-action='continue']").addEventListener("click", () => render());
  renderProgress();
}

function renderForge({ amount, reason, beforeFragments, afterFragments }) {
  animateStarGain(amount);
  const after = weaponStateByFragments(afterFragments);
  const before = weaponStateByFragments(beforeFragments);
  const unlockedNow = unlockedWeaponCount(afterFragments) > unlockedWeaponCount(beforeFragments);
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
        <div class="fragment-row forge-dots">${fragmentDots(after.progress, after.weapon.fragmentsRequired)}</div>
      </div>
      <div class="actions two-actions">
        <button class="soft-button" data-action="armory">收入武器库</button>
        <button class="primary-button" data-action="continue">继续闯关</button>
      </div>
    </article>
  `;
  stage.querySelector("[data-action='armory']").addEventListener("click", () => {
    mode = "armory";
    render();
  });
  stage.querySelector("[data-action='continue']").addEventListener("click", () => render());
  renderProgress();
}

function unlockText() {
  const active = weaponStateByFragments();
  if (active.allDone) return "神兵已经全部解锁，后面可以继续做升级系统。";
  return `还差 ${starsToNextFragment()} 星铸出下一个碎片；「${active.weapon.name}」已点亮 ${active.progress}/${active.weapon.fragmentsRequired}。`;
}

function renderProgress() {
  const starProgress = state.totalStars % 10;
  const active = weaponStateByFragments();
  document.querySelector("#stars").textContent = state.totalStars;
  document.querySelector("#fragments").textContent = totalFragments();
  document.querySelector("#unlockStatus").textContent = unlockText();
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

  renderLiteracyStrip();
  renderForgeSide();
}

// 拼片网格布局：碎片数 → {cols, rows}（用 N 块拼图覆盖整张大图）
const PUZZLE_LAYOUT = {
  3: { cols: 3, rows: 1 },
  5: { cols: 5, rows: 1 },
  10: { cols: 5, rows: 2 }
};

// 右侧神兵铸造侧栏：把当前正在铸造的武器大图按碎片需求切成 N 块拼片
function renderForgeSide() {
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

  // 迷你武器网格：全部武器小图，解锁/未解锁一目了然
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

function render() {
  tabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.mode === mode));

  // 更新顶部范围控件高亮
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
    if (mode === "armory") renderArmory();
    renderProgress();

    requestAnimationFrame(() => {
      stage.style.opacity = "1";
      stage.style.transform = "translateY(0)";
    });
  }, 200);
}

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    mode = tab.dataset.mode;
    render();
  });
});

document.querySelector("[data-action='startQuest']").addEventListener("click", () => {
  mode = "recognize";
  render();
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js"));
}

bindGlobalScopeTabs();
render();
