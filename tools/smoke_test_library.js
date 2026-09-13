// 识字库三级导航冒烟测试：二年级 → 单元 → 课文 → 字词详情 → 本课练习
const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const content = { innerHTML: "" };
const tabs = ["上册", "下册", "二上"].map((vol) => ({
  dataset: { vol },
  classList: { toggle() {} },
  addEventListener() {}
}));

const windowStub = {
  location: { hash: "#grade=二上" },
  addEventListener() {},
  scrollTo() {}
};

const context = {
  window: windowStub,
  document: {
    querySelector(selector) {
      return selector === "#content" ? content : null;
    },
    querySelectorAll(selector) {
      return selector === ".vol-tab" ? tabs : [];
    }
  },
  URL,
  URLSearchParams,
  console
};

vm.createContext(context);
["grade1-library.js", "grade1-words.js", "grade2-words.js"].forEach((file) => {
  vm.runInContext(fs.readFileSync(file, "utf8"), context, { filename: file });
});

const html = fs.readFileSync("library-view.html", "utf8");
const inlineScripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)]
  .map((match) => match[1])
  .filter((script) => script.trim());
assert.strictEqual(inlineScripts.length, 1, "应只有一个内联页面脚本");
vm.runInContext(inlineScripts[0], context, { filename: "library-view-inline.js" });

const g2Units = windowStub.RUOGU_OCR_G2["上册"];
assert.strictEqual((content.innerHTML.match(/data-action="unit"/g) || []).length, g2Units.length);

const firstUnit = g2Units[0];
windowStub.location.hash = `#grade=二上&unit=${encodeURIComponent(firstUnit.unit)}`;
vm.runInContext("route()", context);
assert.strictEqual((content.innerHTML.match(/data-action="lesson"/g) || []).length, firstUnit.lessons.length);

const firstLesson = firstUnit.lessons[0];
windowStub.location.hash = `#grade=二上&unit=${encodeURIComponent(firstUnit.unit)}&lesson=${encodeURIComponent(firstLesson.title)}`;
vm.runInContext("route()", context);
assert(content.innerHTML.includes(`《${firstLesson.title}》`), "详情页应显示课文名");
assert(content.innerHTML.includes(firstLesson.recognize[0]), "详情页应显示会认词");
assert(content.innerHTML.includes("进入本课练习"), "详情页应提供练习入口");

const gameHref = content.innerHTML.match(/href="(\.\/game\.html\?[^\"]+)"/);
assert(gameHref, "应生成本课练习链接");
const gameUrl = new URL(gameHref[1], "https://local.invalid/library-view.html");
assert.strictEqual(gameUrl.searchParams.get("grade"), "二年级");
assert.strictEqual(gameUrl.searchParams.get("scope"), "上册");
assert.strictEqual(gameUrl.searchParams.get("unit"), "第一单元");
assert.strictEqual(gameUrl.searchParams.get("lesson"), firstLesson.title);

const home = fs.readFileSync("home.html", "utf8");
assert(home.includes("./library-view.html#grade=二上"), "二年级入口应指向单元列表");
assert(html.includes("background: #f2ead8"), "年级标签应使用高不透明度底色");

console.log(`识字库导航通过：二年级 ${g2Units.length} 个单元，首单元 ${firstUnit.lessons.length} 篇课文，本课练习参数完整。`);
