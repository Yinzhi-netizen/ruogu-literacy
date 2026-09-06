// 出题逻辑验证：二年级顺序循环 + 一年级智能加权
const fs = require("fs");

function makeEl() {
  return {
    innerHTML: "", textContent: "", style: {}, dataset: {},
    classList: { toggle() {}, add() {}, remove() {} },
    addEventListener() {}, querySelector: () => null, querySelectorAll: () => [],
    appendChild() {}, remove() {}, click() {}
  };
}

global.window = global;
global.localStorage = { _m: {}, getItem(k) { return this._m[k] ?? null; }, setItem(k, v) { this._m[k] = String(v); }, removeItem(k) { delete this._m[k]; } };
global.navigator = {};
global.location = { search: "" };
global.requestAnimationFrame = (fn) => fn();
global.document = {
  querySelector(sel) {
    if (sel === "#scopeBar" || sel === "#stage") return makeEl();
    return null;
  },
  querySelectorAll: () => [], createElement: () => makeEl(), body: makeEl()
};
window.RUOGU_DICTATION = { renderDictation() {} };

// 预置档案：一年级，其中「春天」错过 1 次，「小鸟」已掌握很久
localStorage.setItem("ruogu-literacy-profiles-v1", JSON.stringify({ activeId: "ruogu", profiles: { ruogu: {
  id: "ruogu", name: "若谷", version: 1, totalStars: 100, cursor: 0, readingCursor: 0, readingCat: "recite",
  scope: "全部", grade: "一年级", unit: null, lesson: null,
  proficiency: {
    "春天": { read: { hits: 0, errors: 1, streak: 0, lastSeen: Date.now(), mastered: false }, write: { hits: 0, errors: 0, streak: 0, lastSeen: 0, mastered: false }, learnedAt: 0, lastReview: 0 },
    "小鸟": { read: { hits: 3, errors: 0, streak: 3, lastSeen: Date.now(), mastered: true }, write: { hits: 3, errors: 0, streak: 3, lastSeen: Date.now(), mastered: true }, learnedAt: 1, lastReview: 1 }
  },
  completedReadings: {}, learnedAt: {}
} } }));

const srcs = ["grade1-words.js","grade2-words.js","pinyin-data.js","grade2-pinyin.js","reading-texts.js","words.js","weapons.js",
  "state-store.js","word-data.js","progress.js","weapon-system.js","ui-common.js","duel-link.js","app.js"].map((f) => fs.readFileSync(f, "utf8"));

// 把内部函数暴露出来用于测试
const hook = ";globalThis.__t = { nextWord, pickDictWord, currentDictWord, setScope, setUnit, setLesson, getCursor: () => cursor, getWords: () => words, setGrade: (g) => { grade = g; scope = '全部'; unit = null; lesson = null; words = DATA.buildWordTable(grade, scope); cursor = 0; dictCursor = -1; dictWord = null; } };";
eval(srcs.join("\n") + hook);

const T = globalThis.__t;

// ===== 一年级：智能加权（缩到上册第五单元，分布看得清楚）=====
{
  T.setScope("上册");
  T.setUnit("第五单元");
  const pool = T.getWords().map((w) => w.word);
  console.log("第五单元词数:", pool.length, "| 含春天:", pool.includes("春天"), "| 含小鸟:", pool.includes("小鸟"));
  const counts = {};
  for (let i = 0; i < 600; i++) {
    T.nextWord();
    const w = T.getWords()[T.getCursor()].word;
    counts[w] = (counts[w] || 0) + 1;
  }
  console.log("一年级 600 题分布（上册第五单元）:");
  console.log("  错过1次的「春天」:", counts["春天"] || 0);
  console.log("  已掌握的「小鸟」:", counts["小鸟"] || 0);
  const ratio = (counts["春天"] || 0) / Math.max(1, counts["小鸟"] || 0);
  console.log("  加权生效(春天约为小鸟的4~16倍):", ratio >= 4 && ratio <= 16, `(实际 ${ratio.toFixed(1)}x)`);
  T.setUnit(null);
  T.setScope("全部");
}

// ===== 二年级：顺序循环 =====
{
  T.setGrade("二年级");
  const seq = [];
  for (let i = 0; i < 6; i++) { T.nextWord(); seq.push(T.getWords()[T.getCursor()].word); }
  const expected = T.getWords().slice(1, 7).map((w) => w.word);
  console.log("二年级顺序:", seq.join(" → "));
  console.log("按词表顺序循环:", JSON.stringify(seq) === JSON.stringify(expected));
  // 听写也顺序
  const dseq = [];
  for (let i = 0; i < 4; i++) { T.pickDictWord(); dseq.push(T.currentDictWord().word); }
  console.log("二年级听写顺序:", dseq.join(" → "));
}
