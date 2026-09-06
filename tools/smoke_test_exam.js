// 星河书旅冒烟测试2：模拟旧档案启动 + 完整跑一遍《树之歌》考试（全对），验证出分与星星奖励
const fs = require("fs");

function makeEl(tag) {
  const el = {
    innerHTML: "", textContent: "", style: {}, dataset: {},
    classList: { toggle() {}, add() {}, remove() {} },
    _listeners: {},
    _qc: null, // 查询缓存：innerHTML 不变时返回同一批假元素
    addEventListener(ev, fn) { (this._listeners[ev] = this._listeners[ev] || []).push(fn); },
    querySelector(sel) {
      if (!el._qc || el._qc.html !== el.innerHTML) el._qc = { html: el.innerHTML, map: {} };
      if (!(sel in el._qc.map)) el._qc.map[sel] = queryIn(el.innerHTML, sel, false);
      return el._qc.map[sel][0] || null;
    },
    querySelectorAll(sel) {
      if (!el._qc || el._qc.html !== el.innerHTML) el._qc = { html: el.innerHTML, map: {} };
      if (!(sel in el._qc.map)) el._qc.map[sel] = queryIn(el.innerHTML, sel, false);
      return el._qc.map[sel];
    },
    appendChild() {}, remove() {}, click() {}
  };
  return el;
}

// 从 innerHTML 里粗解析出带 data-* 的按钮，返回可操作假元素
function queryIn(html, sel, single) {
  const out = [];
  let m;
  if (sel === ".pinyin-option") {
    const re = /<button class="option pinyin-option" data-pinyin="([^"]*)">/g;
    while ((m = re.exec(html))) out.push(fakeBtn({ pinyin: m[1] }));
  } else if (sel.startsWith("[data-action='")) {
    const action = sel.match(/data-action='([^']+)'/)[1];
    if (html.includes(`data-action="${action}"`) || html.includes(`data-action='${action}'`)) out.push(fakeBtn({ action }));
  } else if (sel === ".exam-timer-bar" || sel === ".exam-timer-text" || sel === ".exam-timer") {
    if (html.includes(sel.slice(1))) out.push(fakeBtn({}));
  } else if (sel === ".feedback") {
    if (html.includes("feedback")) out.push(fakeBtn({}));
  }
  return single ? (out[0] || null) : out;
}

function fakeBtn(dataset) {
  return {
    dataset, style: {}, hidden: false, textContent: "",
    classList: { toggle() {}, add() {}, remove() {} },
    _listeners: {},
    addEventListener(ev, fn) { (this._listeners[ev] = this._listeners[ev] || []).push(fn); },
    click() { (this._listeners.click || []).forEach((f) => f()); },
    remove() {}, appendChild() {}
  };
}

const scopeBar = makeEl();
const stage = makeEl();

global.window = global;
global.localStorage = { _m: {}, getItem(k) { return this._m[k] ?? null; }, setItem(k, v) { this._m[k] = String(v); }, removeItem(k) { delete this._m[k]; } };
// 预置：若谷旧档案，77 星，直接定位到 二年级·上册·第二单元·树之歌
localStorage.setItem("ruogu-literacy-profiles-v1", JSON.stringify({ activeId: "ruogu", profiles: { ruogu: {
  id: "ruogu", name: "若谷", version: 1, totalStars: 77, cursor: 0, readingCursor: 0, readingCat: "recite",
  scope: "上册", grade: "二年级", unit: "第二单元·识字", lesson: "树之歌",
  proficiency: {}, completedReadings: { "recite::静夜思": true }, learnedAt: {}
} } }));
global.navigator = {};
global.location = { search: "?grade=二年级" };
global.requestAnimationFrame = (fn) => fn();
global.document = {
  querySelector(sel) {
    if (sel === "#scopeBar") return scopeBar;
    if (sel === "#stage") return stage;
    return null;
  },
  querySelectorAll: () => [],
  createElement: () => makeEl(),
  body: makeEl()
};
// 听写手写板在 node 里没法跑 canvas：用桩替代，每题自动「写对」
window.RUOGU_DICTATION = { renderDictation: (el, word, handlers) => handlers.onSuccess(word, "听写成功") };

["grade1-words.js","grade2-words.js","pinyin-data.js","grade2-pinyin.js","reading-texts.js","words.js","weapons.js",
 "state-store.js","word-data.js","progress.js","weapon-system.js","ui-common.js","duel-link.js","app.js"]
  .filter((f) => f !== "ocr-handwriting.js")
  .forEach((f) => eval(fs.readFileSync(f, "utf8")));

setTimeout(() => {
  console.log("== 启动 ==");
  console.log("测试入口出现:", scopeBar.innerHTML.includes("测试《树之歌》"));

  // 点「考试」→ 封面 → 开始
  scopeBar._listeners.click[0]({ target: { closest: (s) => (s.includes("startExam") ? fakeBtn({}) : null) } });
  console.log("封面渲染:", stage.innerHTML.includes("小测验"));
  stage.querySelector("[data-action='beginExam']").click();

  // 逐题作答：认读题选对拼音，听写题由桩自动答对
  let steps = 0;
  while (steps++ < 60 && !stage.innerHTML.includes("考试结果")) {
    const wordM = stage.innerHTML.match(/big-word big-word-phrase">([^<]+)</);
    if (!wordM) break;
    const word = wordM[1];
    const correct = window.RUOGU_PINYIN[word];
    const btns = stage.querySelectorAll(".pinyin-option");
    const target = btns.find((b) => b.dataset.pinyin === correct);
    if (!target) { console.log("!! 没找到正确选项:", word, correct); break; }
    target.click();
  }

  console.log("== 结果 ==");
  console.log("出分页面:", stage.innerHTML.includes("测试评估"));
  console.log("满分 100:", stage.innerHTML.includes(">100<"));
  const p = window.RUOGU_STATE.active();
  console.log("星星 77 + 15 =", p.totalStars, p.totalStars === 92 ? "✓" : "✗");
  console.log("已读记录仍在:", p.completedReadings["recite::静夜思"] === true);
  console.log("树之歌会写词已记熟练度:", Object.keys(p.proficiency).length > 0);
}, 400);
