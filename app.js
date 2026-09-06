// 若谷自主阅读计划 · 主启动器（关卡路由 + 事件绑定）
// 依赖顺序见 game.html：数据源 → state-store → word-data → progress
//   → ocr-handwriting → weapon-system → ui-common → app

const stories = window.RUOGU_STORIES || [];
const readingTexts = window.RUOGU_READING_TEXTS || { recite: [], lyrics: [], poems: [] };

const STATE = window.RUOGU_STATE;
const DATA = window.RUOGU_WORD_DATA;
const PROGRESS = window.RUOGU_PROGRESS;
const DICT = window.RUOGU_DICTATION;   // 听写手写板模块（区别于识字库数据 RUOGU_OCR）
const WS = window.RUOGU_WEAPON_SYSTEM;
const UI = window.RUOGU_UI;
const DUEL = window.RUOGU_DUEL_LINK;

// ===== 初始化：加载档案 + 迁移旧数据 =====
STATE.loadProfiles();
PROGRESS.init(); // 若有旧 known，迁移为 proficiency
// 内置 OCR Key，若谷不用每次输入
localStorage.setItem("ruogu-ocr-key", "K87230002688957");

const profile = STATE.active();
let mode = "recognize";
// 出题范围四级：年级 → 册 → 单元 → 课文（旧存档只有 scope，自动落在一年级，行为不变）
let grade = profile.grade || "一年级";
if (!DATA.grades().includes(grade)) grade = DATA.grades()[0] || "一年级";
// 从首页进入时带年级参数（home.html → game.html?grade=二年级）
const urlGrade = new URLSearchParams(location.search).get("grade");
const urlGradeValid = urlGrade && DATA.grades().includes(urlGrade);
let scope = profile.scope || "全部";
let unit = profile.unit || null;
let lesson = profile.lesson || null;
// URL 指定了年级则切换到该年级全部范围，并写回档案
if (urlGradeValid && urlGrade !== grade) {
  grade = urlGrade;
  scope = "全部";
  unit = null;
  lesson = null;
}
// 校验存档里的范围选择仍然有效（跨年级/单元调整后可能失效）
if (scope !== "全部" && !DATA.volsOf(grade).includes(scope)) scope = "全部";
if (unit && !DATA.unitsOf(grade, scope).includes(unit)) { unit = null; lesson = null; }
if (lesson && !DATA.lessonsOf(grade, scope, unit).includes(lesson)) lesson = null;
let words = DATA.buildWordTable(grade, scope, unit, lesson); // 当前范围词表
let cursor = profile.cursor || 0;
let readingCursor = profile.readingCursor || 0;
let readingCat = profile.readingCat || "recite";
let readingInArticle = false;
let dictWord = null;
let dictCursor = -1;
let duelExchangeFeedback = "每次兑换前会自动备份档案。";

const stage = document.querySelector("#stage");
const tabs = document.querySelectorAll(".tab");

function persist() {
  const p = STATE.active();
  p.cursor = cursor;
  p.readingCursor = readingCursor;
  p.grade = grade;
  p.scope = scope;
  p.unit = unit;
  p.lesson = lesson;
  p.readingCat = readingCat;
  STATE.save();
}

// ===== 词表 / 光标 =====
function currentWord() {
  if (!words.length) return { word: "", pinyin: "", lesson: "", unit: "", vol: "" };
  return words[cursor % words.length] || words[0];
}

// 一年级复习用智能加权：没见过的多出现，错过的优先回来，该复习的插队，已掌握的偶尔抽查
function wordWeight(item, slot) {
  const p = (STATE.active().proficiency || {})[item.word];
  if (!p) return 5; // 没见过
  if ((p.read.errors || 0) > 0 || (p.write.errors || 0) > 0) return 8; // 错过，优先回来
  const s = slot === "write" ? p.write : p.read;
  if (!s.lastSeen) return 5;
  if ((Date.now() - s.lastSeen) / 86400000 > 7) return 6; // 超过 7 天没见，该复习了
  if (!s.mastered) return 4; // 见过但还没掌握
  return 1; // 已掌握，偶尔抽查
}

function weightedIndex(pool, currentIdx, slot) {
  const weights = pool.map((w, i) => (i === currentIdx ? 0 : wordWeight(w, slot)));
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) return (currentIdx + 1) % pool.length;
  let r = Math.random() * total;
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i];
    if (r <= 0) return i;
  }
  return (currentIdx + 1) % pool.length;
}

function nextWord() {
  if (words.length <= 1) { cursor = 0; persist(); return; }
  if (grade === "二年级") {
    // 二年级是新课复习：按课文顺序循环，接着上次的位置走
    cursor = (cursor + 1) % words.length;
  } else {
    // 一年级是旧知复习：智能加权抽题
    cursor = weightedIndex(words, cursor, "read");
  }
  persist();
}

function rebuildWords() {
  words = DATA.buildWordTable(grade, scope, unit, lesson);
  cursor = 0;
  dictWord = null;
  dictCursor = -1;
  persist();
}

function setScope(newScope) {
  scope = newScope;
  unit = null;
  lesson = null;
  rebuildWords();
}

function setUnit(newUnit) {
  unit = newUnit || null;
  lesson = null;
  rebuildWords();
}

function setLesson(newLesson) {
  lesson = newLesson || null;
  rebuildWords();
}

// 进度条/识字条上显示的范围名（如「二年级·上册·树之歌」）
function scopeLabel() {
  const parts = [grade];
  if (scope !== "全部") parts.push(scope);
  if (unit) parts.push(unit);
  if (lesson) parts.push(lesson);
  return parts.join("·");
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
  if (!pool.length) { dictWord = null; dictCursor = -1; return; }
  if (grade === "二年级") {
    // 二年级新课：按课文顺序循环
    dictCursor = (dictCursor + 1) % pool.length;
    dictWord = pool[dictCursor];
    return;
  }
  if (pool.length === 1) { dictCursor = 0; dictWord = pool[0]; return; }
  // 一年级：智能加权（按会写熟练度）
  const currentIdx = dictWord ? pool.indexOf(dictWord) : -1;
  dictCursor = weightedIndex(pool, currentIdx, "write");
  dictWord = pool[dictCursor];
}

function currentDictWord() {
  if (!dictWord || dictationPool().indexOf(dictWord) === -1) pickDictWord();
  return dictWord || { word: "", pinyin: "", lesson: "", unit: "", vol: "", isWrite: true };
}

// ===== 得星 → 结果页 / 连续模式 =====
function awardStars(amount, reason, options = {}) {
  const p = STATE.active();
  p.totalStars = (p.totalStars || 0) + amount;
  STATE.save();

  if (options.silent) {
    UI.animateStarGain(amount, stage);
    renderProgress();
    return;
  }

  const callbacks = {
    onContinue: () => render()
  };

  UI.renderResult(stage, amount, reason, callbacks);
  renderProgress();
}

function renderProgress() {
  UI.renderProgress(mode, readingInArticle, scopeLabel(), words);
  renderDuelExchange();
}

function renderDuelExchange() {
  const box = document.querySelector("#duelExchange");
  if (!box || !DUEL) return;
  const info = DUEL.summary();
  box.innerHTML = `
    <div class="duel-exchange-head">
      <div>
        <p>小人对战兑换</p>
        <strong>识字星力可以换导演时间和强力技能</strong>
      </div>
      <a class="duel-open-link" href="./若谷冒险游戏/index.html">打开小人对战台</a>
    </div>
    <div class="duel-wallet">
      <span><strong>${info.totalStars}</strong><small>当前总星</small></span>
      <span><strong>${DUEL.formatTime(info.playSeconds)}</strong><small>可用对战时间</small></span>
      <span><strong>${info.rainbowTickets}</strong><small>彩虹防护罩次数</small></span>
      <span><strong>${info.transformTickets}</strong><small>变身次数</small></span>
    </div>
    <div class="duel-buy-row">
      <button class="soft-button" data-duel-buy="playTime" ${info.totalStars < info.costs.playTime ? "disabled" : ""}>50 星换 5 分钟</button>
      <button class="soft-button" data-duel-buy="rainbow" ${info.totalStars < info.costs.rainbow ? "disabled" : ""}>20 星换防护罩</button>
      <button class="soft-button" data-duel-buy="transform" ${info.totalStars < info.costs.transform ? "disabled" : ""}>30 星换变身</button>
    </div>
    <div class="duel-exchange-feedback" id="duelExchangeFeedback">${duelExchangeFeedback}<br>每局最多：彩虹罩 3 次，变身 2 次。</div>
  `;
  box.querySelectorAll("[data-duel-buy]").forEach((button) => {
    button.addEventListener("click", () => {
      const result = DUEL.purchase(button.dataset.duelBuy);
      duelExchangeFeedback = result.message;
      renderProgress();
    });
  });
}

// ===== 认读关 =====
function renderRecognize() {
  const word = currentWord();
  const options = pinyinOptions(word);
  stage.innerHTML = `
    <article class="challenge recognize-card">
      <div class="level-badge">认读关 · +2 星</div>
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
        feedback.textContent = "太棒了！+2 星，下一题来了。";
        feedback.classList.add("glow");
        feedback.addEventListener("animationend", () => feedback.classList.remove("glow"), { once: true });
        awardStars(2, "认读成功", { silent: true });
        setTimeout(() => {
          nextWord();
          renderRecognize();
        }, 360);
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
      awardStars(10, reason || "写字成功");
    },
    onError: (w) => PROGRESS.recordError(w.word, "write"),
    onPickNext: () => { pickDictWord(); renderDictation(); }
  });
}

// ===== 测试模式（按课文）=====
// 选了具体课文后可开测：会认词出「看词选拼音」，会写词出手写听写，每题限时 120 秒
const EXAM_SECONDS = 120;
let exam = null;
// exam = { lesson, questions:[{word,pinyin,isWrite}], idx, results:[{word,isWrite,ok,reason}], timerId, deadline, startedAt }

function examAvailable() {
  return Boolean(lesson) && words.length > 0;
}

function startExam() {
  if (!examAvailable()) return;
  const recognize = DATA.shuffle(words.filter((w) => !w.isWrite && w.pinyin));
  const write = DATA.shuffle(words.filter((w) => w.isWrite));
  exam = {
    lesson,
    questions: [...recognize, ...write],
    idx: 0,
    results: [],
    timerId: null,
    deadline: 0,
    startedAt: 0
  };
  renderExamCover();
}

function cancelExam() {
  if (!exam) return;
  if (exam.timerId) clearInterval(exam.timerId);
  exam = null;
}

function examHead() {
  const left = Math.max(0, Math.ceil((exam.deadline - Date.now()) / 1000));
  const pct = Math.max(0, Math.min(100, (left / EXAM_SECONDS) * 100));
  return `
    <div class="exam-head">
      <span class="exam-progress">第 ${exam.idx + 1} / ${exam.questions.length} 题</span>
      <div class="exam-timer ${left <= 30 ? "urgent" : ""}">
        <div class="exam-timer-bar" style="width:${pct}%"></div>
        <span class="exam-timer-text">${left}s</span>
      </div>
      <button class="soft-button exam-quit" data-action="quitExam">交卷退出</button>
    </div>
  `;
}

function examTick() {
  const bar = stage.querySelector(".exam-timer-bar");
  const text = stage.querySelector(".exam-timer-text");
  const timer = stage.querySelector(".exam-timer");
  if (!bar || !exam) return;
  const left = Math.max(0, Math.ceil((exam.deadline - Date.now()) / 1000));
  bar.style.width = `${(left / EXAM_SECONDS) * 100}%`;
  if (text) text.textContent = `${left}s`;
  if (timer) timer.classList.toggle("urgent", left <= 30);
  if (left <= 0) examAnswer(false, "超时未答");
}

function examStartTimer() {
  if (exam.timerId) clearInterval(exam.timerId);
  exam.deadline = Date.now() + EXAM_SECONDS * 1000;
  exam.timerId = setInterval(examTick, 500);
}

function renderExamCover() {
  const totalR = exam.questions.filter((q) => !q.isWrite).length;
  const totalW = exam.questions.filter((q) => q.isWrite).length;
  stage.innerHTML = `
    <article class="exam-cover">
      <div class="level-badge">测试 · 《${exam.lesson}》</div>
      <h2>《${exam.lesson}》小测验</h2>
      <div class="exam-rules">
        <p>📖 认读题 ${totalR} 道：看词语选拼音</p>
        <p>✍️ 听写题 ${totalW} 道：听语音写词语</p>
        <p>⏱ 每题限时 ${EXAM_SECONDS / 60} 分钟，超时不答算错</p>
        <p>🏆 测完按正确率打分：60 分 +5 星 · 80 分 +10 星 · 满分 +15 星</p>
        <p>🔁 没测好可以再测一次</p>
      </div>
      <div class="actions two-actions">
        <button class="soft-button" data-action="backToGame">再复习一下</button>
        <button class="primary-button" data-action="beginExam">我准备好了，开始！</button>
      </div>
    </article>
  `;
  stage.querySelector("[data-action='beginExam']").addEventListener("click", () => {
    exam.startedAt = Date.now();
    renderExamQuestion();
  });
  stage.querySelector("[data-action='backToGame']").addEventListener("click", () => {
    cancelExam();
    render();
  });
}

function renderExamQuestion() {
  if (!exam || exam.idx >= exam.questions.length) { finishExam(); return; }
  const q = exam.questions[exam.idx];
  examStartTimer();

  if (q.isWrite) {
    stage.innerHTML = `<article class="exam-box">${examHead()}<div id="examBody"></div></article>`;
    bindExamHead();
    DICT.renderDictation(stage.querySelector("#examBody"), q, {
      examMode: true, // 测试：无看答案/无重写，识别不过只能下一题
      onSuccess: () => examAnswer(true, "写对了"),
      onError: () => {},
      onPickNext: () => examAnswer(false, "没写对/跳过")
    });
    return;
  }

  const options = pinyinOptions(q);
  stage.innerHTML = `
    <article class="exam-box">
      ${examHead()}
      <div class="exam-body">
        <div class="exam-type-badge">认读题 · 选出正确读音</div>
        <div class="big-word big-word-phrase">${q.word}</div>
        <div class="option-grid">
          ${options.map((option) => `<button class="option pinyin-option" data-pinyin="${option}">${option}</button>`).join("")}
        </div>
      </div>
    </article>
  `;
  bindExamHead();
  stage.querySelectorAll(".pinyin-option").forEach((button) => {
    button.addEventListener("click", () => {
      examAnswer(button.dataset.pinyin === q.pinyin, button.dataset.pinyin === q.pinyin ? "答对了" : "选错了");
    });
  });
}

function bindExamHead() {
  const quit = stage.querySelector("[data-action='quitExam']");
  if (quit) {
    quit.addEventListener("click", () => {
      finishExam(true);
    });
  }
}

function examAnswer(ok, reason) {
  if (!exam || exam.idx >= exam.questions.length) return;
  const q = exam.questions[exam.idx];
  if (q._answered) return; // 防止超时与点击同时触发
  q._answered = true;
  if (exam.timerId) { clearInterval(exam.timerId); exam.timerId = null; }
  exam.results.push({ word: q.word, pinyin: q.pinyin, isWrite: q.isWrite, ok, reason });
  // 结果写入熟练度档案（与平时闯关一致）
  if (q.isWrite) {
    if (ok) PROGRESS.recordWriteSuccess(q.word); else PROGRESS.recordError(q.word, "write");
  } else {
    if (ok) PROGRESS.recordReadSuccess(q.word); else PROGRESS.recordError(q.word, "read");
  }
  exam.idx += 1;
  renderExamQuestion();
}

function examStars(score) {
  if (score >= 100) return 15;
  if (score >= 80) return 10;
  if (score >= 60) return 5;
  return 0;
}

function finishExam(quitEarly) {
  if (!exam) return;
  if (exam.timerId) { clearInterval(exam.timerId); exam.timerId = null; }
  const done = exam.results.length;
  const total = exam.questions.length;
  const correct = exam.results.filter((r) => r.ok).length;
  const score = done ? Math.round((correct / total) * 100) : 0;
  const seconds = Math.max(1, Math.round(((exam.startedAt ? Date.now() - exam.startedAt : 0)) / 1000));
  const wrong = exam.results.filter((r) => !r.ok);
  const missed = exam.questions.slice(done); // 提前交卷未答的题

  // 分数星星奖励（提前交卷不给）
  const stars = quitEarly ? 0 : examStars(score);
  if (stars > 0) {
    const p = STATE.active();
    p.totalStars = (p.totalStars || 0) + stars;
    STATE.save();
  }

  const encouragement =
    score >= 100 ? "🏆 满分！太厉害了！" :
    score >= 90 ? "🌟 优秀！差一点就满分啦！" :
    score >= 75 ? "👍 不错！把错题再看看就更好。" :
    score >= 60 ? "💪 及格了，错题再复习一遍吧。" :
    "📖 先回去复习，准备好了再来测一次。";

  stage.innerHTML = `
    <article class="exam-result">
      <div class="level-badge">测试评估 · 《${exam.lesson}》</div>
      <div class="exam-score ${score >= 80 ? "good" : score >= 60 ? "mid" : "low"}">${score}<small>分</small></div>
      <p class="exam-encourage">${encouragement}</p>
      <div class="exam-summary">
        <span>答对 <strong>${correct}</strong> / ${total}</span>
        <span>用时 ${Math.floor(seconds / 60)}分${seconds % 60}秒</span>
        ${quitEarly ? `<span>提前交卷，${missed.length} 题未答</span>` : ""}
        ${stars > 0 ? `<span class="exam-stars-gain">+${stars} ★</span>` : ""}
      </div>
      ${wrong.length ? `
        <div class="exam-wrong-box">
          <h3>错题清单（${wrong.length}）</h3>
          ${wrong.map((r) => `
            <div class="exam-wrong-item">
              <strong>${r.word}</strong>
              <span class="py">${r.pinyin || ""}</span>
              <small>${r.isWrite ? "听写题" : "认读题"} · ${r.reason}</small>
            </div>
          `).join("")}
        </div>
      ` : `<p class="exam-all-right">🎉 没有错题，全部答对！</p>`}
      <div class="actions two-actions">
        <button class="soft-button" data-action="backToGame">回到闯关</button>
        <button class="primary-button" data-action="retryExam">再测一次</button>
      </div>
    </article>
  `;
  if (stars > 0) UI.animateStarGain(stars, stage);
  renderProgress();

  stage.querySelector("[data-action='backToGame']").addEventListener("click", () => {
    cancelExam();
    render();
  });
  stage.querySelector("[data-action='retryExam']").addEventListener("click", () => {
    cancelExam();
    startExam();
  });
}

// ===== 阅读关 =====
const READING_CATS = [
  { key: "recite", icon: "📜", name: "必背课文", items: () => readingTexts.recite || [], annotate: false },
  { key: "lyrics", icon: "🎵", name: "歌词", items: () => readingTexts.lyrics || [], annotate: true },
  { key: "poems", icon: "🌸", name: "古诗", items: () => readingTexts.poems || [], annotate: true }
];

// 旧存档里可能还存着已经删掉的分类（如 jokes），落回第一个分类，
// 否则顶栏三个 tab 会一个都不高亮
if (!READING_CATS.some((c) => c.key === readingCat)) readingCat = READING_CATS[0].key;

const READING_FILTERS = [
  { key: "all", label: "全部" },
  { key: "unread", label: "未读" },
  { key: "read", label: "已读" },
  { key: "easy", label: "简单" },
  { key: "challenge", label: "挑战" },
  { key: "hard", label: "难" }
];

let readingFilter = "all"; // 当前阅读筛选

// 阅读年级筛选：全部 / 一年级 / 二年级（未标年级的拓展阅读两个年级都显示）
const READING_GRADE_FILTERS = [
  { key: "all", label: "全部" },
  { key: "一年级", label: "一年级" },
  { key: "二年级", label: "二年级" }
];
let readingGrade = "all";

function readingGradeOf(item) {
  return item.grade || (/上册|下册/.test(item.author || "") ? "一年级" : "");
}

function readingGradeMatch(item) {
  if (readingGrade === "all") return true;
  const g = readingGradeOf(item);
  return g === readingGrade || g === "";
}

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
    .filter((x) => readingGradeMatch(x.item))
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
    .filter((x) => readingGradeMatch(x.item))
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
      <div class="reading-filter-bar">
        ${READING_GRADE_FILTERS.map((f) =>
          `<button class="reading-filter-pill ${f.key === readingGrade ? "active" : ""}" data-grade="${f.key}">${f.label}</button>`
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

  stage.querySelectorAll(".reading-filter-pill[data-filter]").forEach((btn) => {
    btn.addEventListener("click", () => {
      readingFilter = btn.dataset.filter;
      renderReading();
    });
  });

  stage.querySelectorAll(".reading-filter-pill[data-grade]").forEach((btn) => {
    btn.addEventListener("click", () => {
      readingGrade = btn.dataset.grade;
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

// ===== 范围选择栏（年级在首页选好，这里用下拉：册 → 单元 → 课文）=====
function renderScopeBar() {
  const bar = document.querySelector("#scopeBar");
  if (!bar) return;

  const vols = DATA.volsOf(grade);
  if (scope !== "全部" && !vols.includes(scope)) scope = "全部";
  const units = DATA.unitsOf(grade, scope);
  if (unit && !units.includes(unit)) { unit = null; lesson = null; }
  const lessons = unit ? DATA.lessonsOf(grade, scope, unit) : [];
  if (lesson && !lessons.includes(lesson)) lesson = null;

  const opts = (list, current, allLabel) =>
    [`<option value="">${allLabel}</option>`]
      .concat(list.map((v) => `<option value="${v}" ${v === current ? "selected" : ""}>${v}</option>`))
      .join("");

  let html = `<div class="scope-select-row">
    <span class="grade-badge">${grade}</span>
    ${vols.length > 1
      ? `<select class="scope-select" data-level="scope" aria-label="选择册">${opts(vols.filter((v) => v !== "全部"), scope === "全部" ? "" : scope, "全部（上册+下册）")}</select>`
      : ""}
    <select class="scope-select" data-level="unit" aria-label="选择单元">${opts(units, unit, "全部单元")}</select>
    <select class="scope-select" data-level="lesson" aria-label="选择课文" ${unit ? "" : "disabled"}>${
      unit ? opts(lessons, lesson, "全部课文") : '<option value="">← 先选单元</option>'
    }</select>
    <a class="grade-switch" href="./home.html">换年级</a>
  </div>`;

  // 选中具体课文后出现测试入口
  if (examAvailable()) {
    const wCount = words.filter((w) => w.isWrite).length;
    html += `<div class="scope-row exam-entry-row">
      <button class="exam-entry-btn" data-action="startExam">📝 测试《${lesson}》 · 认读 ${words.length - wCount} 题 + 听写 ${wCount} 题 · 每题 ${EXAM_SECONDS / 60} 分钟</button>
    </div>`;
  }

  bar.innerHTML = html;
}

function bindScopeBar() {
  const bar = document.querySelector("#scopeBar");
  if (!bar) return;
  bar.addEventListener("click", (e) => {
    const examBtn = e.target.closest("[data-action='startExam']");
    if (examBtn) { startExam(); return; }
  });
  bar.addEventListener("change", (e) => {
    const sel = e.target.closest(".scope-select");
    if (!sel) return;
    cancelExam(); // 换范围即退出测试
    const level = sel.dataset.level;
    const value = sel.value; // 选中值在 option 上，不在 select 的 dataset 里
    if (level === "scope") setScope(value || "全部");
    if (level === "unit") setUnit(value || null);
    if (level === "lesson") setLesson(value || null);
    render();
  });
}
function render() {
  tabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.mode === mode));

  renderScopeBar();

  stage.style.opacity = "0";
  stage.style.transform = "translateY(8px)";
  stage.style.transition = "opacity 0.2s ease, transform 0.2s ease";

  setTimeout(() => {
    if (mode === "recognize") renderRecognize();
    if (mode === "dictation") renderDictation();
    if (mode === "reading") renderReading();
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
    cancelExam(); // 切关卡即退出测试
    mode = tab.dataset.mode;
    render();
  });
});

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
  // 新版本上线后自动刷新一次，免手动清缓存
  let refreshing = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (refreshing) return;
    refreshing = true;
    location.reload();
  });
}

bindScopeBar();
render();
