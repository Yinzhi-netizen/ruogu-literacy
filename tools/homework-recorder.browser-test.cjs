// 使用隔离的浏览器和合成声音验收，不访问真实麦克风或用户档案。
const assert = require("node:assert/strict");
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require(process.env.PLAYWRIGHT_PATH || "playwright");
const project = path.resolve(__dirname, "..");
const qaDir = process.env.QA_DIR;
const mime = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".jpg": "image/jpeg", ".png": "image/png", ".svg": "image/svg+xml" };

async function main() {
  const server = http.createServer((req, res) => {
    const file = path.resolve(project, "." + decodeURIComponent(new URL(req.url, "http://localhost").pathname));
    if (!file.startsWith(project + path.sep)) { res.writeHead(403).end(); return; }
    fs.readFile(file, (err, body) => {
      if (err) { res.writeHead(404).end(); return; }
      res.writeHead(200, { "Content-Type": mime[path.extname(file)] || "application/octet-stream" });
      res.end(body);
    });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  let browser;
  try {
    browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || undefined, args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] });
    const context = await browser.newContext({ viewport: { width: 820, height: 1180 }, deviceScaleFactor: 1, acceptDownloads: true });
    await context.addInitScript(() => {
      window.__shares = [];
      window.__shortcutLaunches = [];
      window.__clipboardText = "";
      window.__rejectClipboard = false;
      Object.defineProperty(navigator, "platform", { configurable: true, get: () => "MacIntel" });
      Object.defineProperty(navigator, "maxTouchPoints", { configurable: true, get: () => 5 });
      Object.defineProperty(navigator, "clipboard", { value: {
        write(items) {
          window.__clipboardGesture = navigator.userActivation.isActive;
          if (window.__rejectClipboard) return Promise.reject(new DOMException("denied", "NotAllowedError"));
          return items[0].getType("text/plain").then((blob) => blob.text()).then((text) => { window.__clipboardText = text; });
        }
      } });
      window.open = (url, target) => { window.__shortcutLaunches.push({ url, target }); return window; };
      Object.defineProperty(navigator, "canShare", { value: ({ files }) => Boolean(files?.length) });
      Object.defineProperty(navigator, "share", { value: async ({ files }) => { window.__shares.push({ name: files[0].name, type: files[0].type, size: files[0].size }); } });
      const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      navigator.mediaDevices.getUserMedia = async (options) => {
        const stream = await original(options);
        window.__lastStream = stream;
        return stream;
      };
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const mainUrl = `http://127.0.0.1:${server.address().port}/library-view.html#grade=二上`;
    await page.goto(mainUrl);
    await page.locator("#homeworkEntry").waitFor();
    assert.equal(await page.locator("#homeworkRecorder").isVisible(), false, "单元页只显示入口，不展开录音内容");
    assert.equal(await page.locator('[data-action="unit"]').count(), 8);
    assert.equal(await page.locator("#content").isVisible(), true);
    if (qaDir) {
      fs.mkdirSync(qaDir, { recursive: true });
      await page.screenshot({ path: path.join(qaDir, "二上页面-录音入口.png"), fullPage: true });
    }
    await page.locator("#homeworkEntry").click();
    await page.locator("#homeworkRecorder").waitFor();
    assert.equal(await page.locator("#content").isVisible(), false, "录音与单元列表应为两个视图");
    await page.goBack();
    await page.locator("#homeworkEntry").waitFor();
    assert.equal(await page.locator("#content").isVisible(), true);
    await page.goForward();
    await page.locator("#homeworkRecorder").waitFor();
    await page.locator("#homeworkStart:not([disabled])").waitFor();
    const profile = JSON.stringify({ activeId: "ruogu", profiles: { ruogu: { totalStars: 1336, proficiency: { 春天: { read: { hits: 4 } } }, completedReadings: { 古诗: true } } } });
    await page.evaluate((value) => localStorage.setItem("ruogu-literacy-profiles-v1", value), profile);
    await page.locator("#homeworkTitle").fill("葡萄沟 + 词语2遍");
    if (qaDir) {
      fs.mkdirSync(qaDir, { recursive: true });
      await page.screenshot({ path: path.join(qaDir, "作业录音-iPad-准备.png"), fullPage: true });
    }
    await page.locator("#homeworkStart").click();
    await page.waitForFunction(() => document.querySelector(".homework-console").dataset.recordingState === "recording");
    await page.waitForFunction(() => document.getElementById("homeworkTimer").textContent >= "00:02");
    await page.locator("#homeworkStop").click();
    await page.locator(".homework-take").waitFor();
    await page.waitForFunction(() => !document.getElementById("homeworkStart").disabled);
    assert.equal(await page.locator(".homework-take h4").textContent(), "葡萄沟 + 词语2遍");
    assert.match(await page.locator(".homework-take-meta").textContent(), /已存本机/);
    assert.equal(await page.evaluate(() => window.__lastStream.getTracks().every((track) => track.readyState === "ended")), true, "停止后必须关闭麦克风");
    await page.waitForFunction(() => {
      const audio = document.querySelector(".homework-take audio");
      return audio.readyState >= 1 && audio.duration > 0;
    });
    const audioInfo = await page.locator(".homework-take audio").evaluate(async (audio) => {
      await audio.play();
      const info = { duration: audio.duration, playing: !audio.paused, error: audio.error?.message };
      audio.pause();
      return info;
    });
    assert.equal(audioInfo.playing, true);
    assert.equal(audioInfo.error, undefined);
    assert(audioInfo.duration >= .5, `下载前的录音必须可播放且有时长：${JSON.stringify(audioInfo)}`);
    const downloaded = page.waitForEvent("download");
    await page.locator(".homework-download").click();
    const download = await downloaded;
    assert.match(download.suggestedFilename(), /^语文作业_\d{4}-\d{2}-\d{2}_\d{6}_葡萄沟 \+ 词语2遍\.(m4a|webm|ogg)$/);
    const file = await download.path();
    const bytes = fs.readFileSync(file);
    assert(bytes.length > 1000);
    if (download.suggestedFilename().endsWith(".m4a")) assert.equal(bytes.toString("ascii", 4, 8), "ftyp");
    else if (download.suggestedFilename().endsWith(".webm")) assert.equal(bytes.subarray(0, 4).toString("hex"), "1a45dfa3");
    if (qaDir) await download.saveAs(path.join(qaDir, "合成声音验收" + path.extname(download.suggestedFilename())));
    assert.equal(await page.locator(".homework-take .homework-wechat").count(), 1, "iPad M4A 录音应提供快捷指令入口");
    await page.locator(".homework-take .homework-wechat").click();
    await page.waitForFunction(() => window.__shortcutLaunches.length === 1);
    const handoff = await page.evaluate(() => ({
      text: window.__clipboardText,
      gesture: window.__clipboardGesture,
      launch: window.__shortcutLaunches[0]
    }));
    assert.deepEqual(Buffer.from(handoff.text, "base64"), bytes, "剪贴板解码后必须与原音频逐字节相等");
    assert.equal(handoff.gesture, true, "剪贴板权限必须在点击手势内请求");
    const shortcut = new URL(handoff.launch.url);
    assert.equal(shortcut.protocol, "shortcuts:");
    assert.equal(shortcut.hostname, "run-shortcut");
    assert.equal(shortcut.searchParams.get("name"), "语文作业");
    assert.equal(shortcut.searchParams.get("input"), "clipboard");
    assert.equal([...shortcut.searchParams].length, 2, "音频内容不能放进 URL");
    assert.equal(handoff.launch.target, "_self");
    assert.equal(await page.locator("#homeworkShortcutLaunch").isVisible(), true, "自动跳转被系统拦截时需保留手动入口");
    await page.evaluate(() => { window.__rejectClipboard = true; });
    await page.locator(".homework-take .homework-wechat").click();
    await page.waitForFunction(() => document.getElementById("homeworkMessage").dataset.error === "true");
    assert.equal(await page.evaluate(() => window.__shortcutLaunches.length), 1, "写入失败时不得启动快捷指令并传入旧剪贴板");
    assert.equal(await page.locator("#homeworkShortcutLaunch").isVisible(), false);
    assert.equal(await page.locator(".homework-take").count(), 1, "交接失败不能丢失录音");
    await page.evaluate(() => { window.__rejectClipboard = false; });
    await page.locator(".homework-take .homework-wechat").click();
    await page.waitForFunction(() => window.__shortcutLaunches.length === 2);
    await page.locator("#homeworkOpenShortcut").click();
    assert.equal(await page.evaluate(() => window.__shortcutLaunches.length), 3, "备用打开按钮应可再次启动同名快捷指令");
    await page.getByRole("button", { name: "分享 / 存到文件", exact: true }).click();
    const shared = await page.evaluate(() => window.__shares[0]);
    assert.equal(shared.name, download.suggestedFilename());
    assert.equal(shared.size, bytes.length, "分享的必须是完整音频文件");
    await page.reload();
    await page.locator(".homework-take").waitFor();
    assert.equal(await page.locator(".homework-take").count(), 1, "刷新后录音应恢复");
    await page.locator(".homework-return").click();
    await page.locator("#homeworkEntry").waitFor();
    await page.locator('[data-action="unit"]').first().click();
    await page.locator('[data-action="lesson"]').first().click();
    assert.equal(await page.locator(".homework-take").count(), 1, "切换单元课文不能丢录音");
    assert.equal(await page.locator("#homeworkTitle").inputValue(), "小蝌蚪找妈妈");
    await page.locator("#homeworkEntry").click();
    await page.locator("#homeworkRecorder").waitFor();
    await page.locator("#homeworkTitle").fill("第二份朗读");
    await page.locator("#homeworkStart").click();
    await page.waitForFunction(() => document.querySelector(".homework-console").dataset.recordingState === "recording");
    await page.waitForFunction(() => document.getElementById("homeworkTimer").textContent >= "00:01");
    await page.evaluate(() => {
      Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await page.waitForFunction(() => document.querySelectorAll(".homework-take").length === 2);
    assert.match(await page.locator("#homeworkMessage").textContent(), /自动结束/);
    await page.evaluate(() => {
      Object.defineProperty(document, "hidden", { configurable: true, get: () => false });
      navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException("denied", "NotAllowedError"));
    });
    await page.locator("#homeworkStart").click();
    await page.waitForFunction(() => document.getElementById("homeworkMessage").dataset.error === "true");
    assert.match(await page.locator("#homeworkMessage").textContent(), /麦克风权限/);
    assert.equal(await page.locator(".homework-take").count(), 2, "拒绝授权不能删除已有录音");
    assert.equal(await page.evaluate(() => localStorage.getItem("ruogu-literacy-profiles-v1")), profile, "星星档案必须逐字不变");
    await page.reload();
    await page.locator(".homework-take").first().waitFor();
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    if (qaDir) {
      await page.screenshot({ path: path.join(qaDir, "作业录音-iPad-已录好.png"), fullPage: true });
      await page.locator("#homeworkRecorder").screenshot({ path: path.join(qaDir, "作业录音-板块预览.png") });
    }
    for (const width of [390, 768, 1024]) {
      await page.setViewportSize({ width, height: 1100 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${width}px 不应出现横向溢出`);
      const box = await page.locator("#homeworkStart").boundingBox();
      assert(box.height >= 44, "主要按钮需适合手指点击");
    }
    if (qaDir) {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.screenshot({ path: path.join(qaDir, "作业录音-窄屏.png"), fullPage: true });
    }
    await page.locator(".homework-return").click();
    await page.locator("#homeworkEntry").waitFor();
    await page.locator('[data-vol="上册"]').click();
    await page.locator("#homeworkRecorder").waitFor({ state: "hidden" });
    assert.equal(await page.locator("#homeworkRecorder").isVisible(), false);
    await page.locator('[data-vol="二上"]').click();
    await page.locator("#homeworkEntry").waitFor();
    assert.equal(await page.locator("#homeworkRecorder").isVisible(), false);
    await page.locator("#homeworkEntry").click();
    await page.locator("#homeworkRecorder").waitFor({ state: "visible" });
    assert.equal(await page.locator(".homework-take").count(), 2);
    // 存储失败时仍必须保留内存中的音频，允许立即下载。
    await page.evaluate(() => {
      const original = IDBDatabase.prototype.transaction;
      IDBDatabase.prototype.transaction = function (names, mode) {
        if (mode === "readwrite") throw new DOMException("full", "QuotaExceededError");
        return original.apply(this, arguments);
      };
    });
    await page.locator("#homeworkStart").click();
    await page.waitForFunction(() => document.querySelector(".homework-console").dataset.recordingState === "recording");
    await page.waitForFunction(() => document.getElementById("homeworkTimer").textContent >= "00:01");
    await page.locator(".homework-return").click();
    await page.waitForFunction(() => document.querySelectorAll(".homework-take").length === 3);
    await page.locator("#homeworkEntry").click();
    await page.locator("#homeworkRecorder").waitFor();
    assert.match(await page.locator("#homeworkMessage").textContent(), /现在下载/);
    assert.equal(await page.locator(".homework-download").count(), 3);
    assert.deepEqual(errors, [], "页面不应出现运行异常");
    console.log("通过：单元页/独立视图、录制播放下载、快捷指令名称与 URL、手势内写入、音频逐字节还原、剪贴板失败保护、备用打开、刷新恢复、授权/存储失败、档案不变及3种屏宽布局。");
    await context.close();
  } finally {
    if (browser) await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
}
main().catch((err) => { console.error(err); process.exitCode = 1; });
