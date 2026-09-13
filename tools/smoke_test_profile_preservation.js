// 档案保护冒烟测试：从新识字库深链进入课文时，不得丢失星星、熟练度或已读记录
const assert = require("assert");
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
global.localStorage = {
  _m: {},
  getItem(key) { return this._m[key] ?? null; },
  setItem(key, value) { this._m[key] = String(value); },
  removeItem(key) { delete this._m[key]; }
};
global.navigator = {};
global.location = {
  search: "?grade=%E4%BA%8C%E5%B9%B4%E7%BA%A7&scope=%E4%B8%8A%E5%86%8C&unit=%E7%AC%AC%E4%B8%80%E5%8D%95%E5%85%83&lesson=%E5%B0%8F%E8%9D%8C%E8%9A%AA%E6%89%BE%E5%A6%88%E5%A6%88"
};
global.requestAnimationFrame = (fn) => fn();
global.document = {
  querySelector(selector) {
    if (selector === "#scopeBar") return scopeBar;
    if (selector === "#stage") return stage;
    return null;
  },
  querySelectorAll: () => [],
  createElement: () => makeEl(),
  body: makeEl()
};

// 这里的 1336 是测试夹具，用于模拟当前 iPad 档案；产品代码不写死任何星星数。
const originalStars = 1336;
const originalProficiency = {
  "树之歌": {
    read: { hits: 3, errors: 1, streak: 2, lastSeen: 123456, mastered: false },
    write: { hits: 2, errors: 0, streak: 2, lastSeen: 123456, mastered: false },
    learnedAt: 123000,
    lastReview: 123456
  }
};
const originalCompletedReadings = { "recite::静夜思": true };

localStorage.setItem("ruogu-literacy-profiles-v1", JSON.stringify({
  activeId: "ruogu",
  profiles: {
    ruogu: {
      id: "ruogu",
      name: "若谷",
      version: 1,
      totalStars: originalStars,
      cursor: 9,
      readingCursor: 2,
      readingCat: "recite",
      grade: "一年级",
      scope: "下册",
      unit: null,
      lesson: null,
      proficiency: originalProficiency,
      completedReadings: originalCompletedReadings,
      learnedAt: {}
    }
  }
}));

["grade1-words.js", "grade2-words.js", "pinyin-data.js", "grade2-pinyin.js", "reading-texts.js", "words.js", "weapons.js",
  "state-store.js", "word-data.js", "progress.js", "weapon-system.js", "ui-common.js", "duel-link.js", "app.js"]
  .forEach((file) => eval(fs.readFileSync(file, "utf8")));

setTimeout(() => {
  const profile = window.RUOGU_STATE.active();
  assert.strictEqual(profile.totalStars, originalStars, "进入新课文路径后星星数必须不变");
  assert.deepStrictEqual(profile.proficiency, originalProficiency, "熟练度记录必须不变");
  assert.deepStrictEqual(profile.completedReadings, originalCompletedReadings, "已读记录必须不变");
  assert(scopeBar.innerHTML.includes('grade-badge">二年级'), "应进入二年级");
  assert(scopeBar.innerHTML.includes('<option value="第一单元" selected>第一单元</option>'), "应选中第一单元");
  assert(scopeBar.innerHTML.includes('<option value="小蝌蚪找妈妈" selected>小蝌蚪找妈妈</option>'), "应选中目标课文");
  assert(["蝌蚪", "脑筋", "口袋", "灰色", "甩开", "生活", "大腿", "教课", "欢迎", "嘴巴", "乌龟", "披上", "蹲下", "肚子", "打鼓", "两条", "哪里", "宽广", "那个", "长短", "孩子", "成长"]
    .some((word) => stage.innerHTML.includes(word)), "应从目标课文的词表开始出题");
  console.log(`档案保护通过：${originalStars} 星、熟练度和已读记录均完整保留。`);
}, 400);
