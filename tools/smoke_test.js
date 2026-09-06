// 星河书旅启动冒烟测试：用最小 DOM 桩加载真实数据与 app.js，验证不抛异常 + scopeBar 渲染正确
const fs = require("fs");

function makeEl() {
  return {
    innerHTML: "", textContent: "", style: {}, dataset: {},
    classList: { toggle() {}, add() {}, remove() {} },
    addEventListener() {}, querySelector: () => null, querySelectorAll: () => [],
    appendChild() {}, remove() {}, click() {}
  };
}

const scopeBar = makeEl();
const stage = makeEl();
global.window = global;
global.localStorage = { _m: {}, getItem(k) { return this._m[k] ?? null; }, setItem(k, v) { this._m[k] = String(v); }, removeItem(k) { delete this._m[k]; } };
global.navigator = {};
global.location = { search: "" };
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

["grade1-words.js","grade2-words.js","pinyin-data.js","grade2-pinyin.js","reading-texts.js","words.js","weapons.js",
 "state-store.js","word-data.js","progress.js","weapon-system.js","ui-common.js","duel-link.js","app.js"]
  .forEach((f) => eval(fs.readFileSync(f, "utf8")));

setTimeout(() => {
  console.log("== 启动无异常 ==");
  const p = window.RUOGU_STATE.active();
  console.log("星星数(totalStars):", p.totalStars);
  console.log("grade:", p.grade, "scope:", p.scope);
  const h = scopeBar.innerHTML;
  console.log("scopeBar含年级徽章:", h.includes('grade-badge">一年级'));
  console.log("scopeBar不再列年级tab:", !h.includes('data-value="二年级"'));
  console.log("scopeBar含册下拉:", h.includes('data-level="scope"') && h.includes("上册") && h.includes("下册"));
  console.log("scopeBar含单元下拉:", h.includes("全部单元"));
  console.log("scopeBar含换年级链接:", h.includes("换年级"));
  console.log("stage已渲染:", stage.innerHTML.length > 0);
  // 阅读关（模拟切到 reading 会经过 render()，这里直接验证数据层）
  const D = window.RUOGU_WORD_DATA;
  console.log("二年级上册词数:", D.buildWordTable("二年级", "上册").length);
  console.log("一年级下册词数(旧路径):", D.buildWordTable("下册").length);
}, 400);
