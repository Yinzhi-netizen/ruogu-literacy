// 作业录音独立保存在 IndexedDB；不读取或修改星星、学习档案，也不上传音频。
(function () {
  "use strict";
  const root = document.getElementById("homeworkRecorder");
  if (!root) return;
  const el = (id) => document.getElementById(id);
  const startButton = el("homeworkStart");
  const stopButton = el("homeworkStop");
  const titleInput = el("homeworkTitle");
  const timer = el("homeworkTimer");
  const stateLabel = el("homeworkState");
  const message = el("homeworkMessage");
  const list = el("homeworkRecordings");
  const consolePanel = root.querySelector(".homework-console");
  const takes = [];
  const urls = new Map();
  let phase = "idle";
  let session = null;
  let requestId = 0;
  let route = { grade: "二上" };
  let autoTitle = "";
  let database;
  let shortcutTransferBusy = false;
  const shortcutUrl = "shortcuts://run-shortcut?" + new URLSearchParams({ name: "语文作业", input: "clipboard" }).toString();
  const shortcutLaunch = el("homeworkShortcutLaunch");

  function canUseShortcut(take) {
    const appleMobile = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (/Mac/.test(navigator.platform || "") && navigator.maxTouchPoints > 1);
    return Boolean(appleMobile && extension(take.blob.type) === "m4a" &&
      navigator.clipboard && navigator.clipboard.write && window.ClipboardItem);
  }

  function updateShortcutButtons() {
    startButton.disabled = shortcutTransferBusy || busy() || !supported();
    list.querySelectorAll(".homework-wechat").forEach((button) => {
      button.disabled = shortcutTransferBusy || busy();
    });
  }

  function openShortcut() {
    // 链接只携带快捷指令名称；音频内容不放进 URL、浏览记录或服务器。
    window.open(shortcutUrl, "_self");
  }

  function base64Audio(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(reader.error || new Error("无法读取录音"));
      reader.onload = () => {
        const result = String(reader.result || "");
        const comma = result.indexOf(",");
        if (comma < 0 || !result.slice(comma + 1)) { reject(new Error("录音内容为空")); return; }
        resolve(result.slice(comma + 1));
      };
      reader.readAsDataURL(blob);
    });
  }

  function sendToWechat(take) {
    if (shortcutTransferBusy || busy()) return;
    shortcutTransferBusy = true;
    updateShortcutButtons();
    shortcutLaunch.hidden = true;
    notice("正在准备这份录音，请稍等…");
    let writing;
    try {
      // Safari 要求在点击事件中立即请求写入权限；异步读取放在 ClipboardItem 的 Promise 内。
      const text = base64Audio(take.blob).then((base64) => new Blob([base64], { type: "text/plain" }));
      writing = navigator.clipboard.write([new ClipboardItem({ "text/plain": text })]);
    } catch (_) {
      shortcutTransferBusy = false;
      updateShortcutButtons();
      notice("暂时无法把录音交给快捷指令，请使用下载或其他分享。原录音仍保留着。", true);
      return;
    }
    writing.then(() => {
      // 部分 iPad 会要求再次轻点才能打开其他 App，始终保留一个可手动点击的入口。
      shortcutLaunch.hidden = false;
      notice(`《${take.title}》已准备好。正在打开“语文作业”，请在微信里选择老师并确认发送；若未跳转，点下方“打开语文作业”。`);
      try { openShortcut(); }
      catch (_) { notice("录音已准备好，请点下方“打开语文作业”继续。"); }
    }).catch(() => {
      notice("没有取得剪贴板写入权限，请再点一次“发送到微信”并允许操作。也可以下载后发送。原录音仍在。", true);
    }).finally(() => {
      shortcutTransferBusy = false;
      updateShortcutButtons();
    });
  }

  function notice(text, error = false) {
    message.textContent = text;
    message.dataset.error = String(error);
  }

  function supported() {
    return window.isSecureContext && navigator.mediaDevices &&
      navigator.mediaDevices.getUserMedia && window.MediaRecorder;
  }

  function busy() {
    return phase !== "idle";
  }

  function isHomeworkView() {
    return route.grade === "二上" && route.view === "homework";
  }

  function setPhase(next) {
    phase = next;
    startButton.disabled = busy() || !supported();
    startButton.innerHTML = '<span aria-hidden="true">●</span> ' + (takes.length ? "再录一份" : "开始录音");
    stopButton.disabled = phase !== "recording" && phase !== "requesting";
    stopButton.textContent = phase === "requesting" ? "取消等待" : "■ 停止录音";
    titleInput.disabled = busy();
    consolePanel.dataset.recordingState = phase;
    stateLabel.textContent = {
      idle: takes.length ? "录好了，可以试听和下载" : "准备好，就开始吧",
      requesting: "请允许使用麦克风…",
      recording: "正在录音，慢慢读就好",
      saving: "正在整理录音，请稍等…"
    }[phase];
    root.hidden = !isHomeworkView();
    updateShortcutButtons();
  }

  function clock(seconds) {
    const total = Math.max(0, Math.floor(seconds));
    return String(Math.floor(total / 60)).padStart(2, "0") + ":" + String(total % 60).padStart(2, "0");
  }

  function stamp(time) {
    const date = new Date(time);
    const pad = (v) => String(v).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
  }

  function extension(type) {
    if (/mp4|m4a/i.test(type)) return "m4a";
    if (/ogg/i.test(type)) return "ogg";
    if (/wav/i.test(type)) return "wav";
    return "webm";
  }

  function filename(title, createdAt, type) {
    const safe = title.replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_").slice(0, 60);
    return `语文作业_${stamp(createdAt)}_${safe || "朗读"}.${extension(type)}`;
  }

  function openDatabase() {
    if (!window.indexedDB) return Promise.reject(new Error("本机存储不可用"));
    if (!database) {
      database = new Promise((resolve, reject) => {
        const req = indexedDB.open("ruogu-homework-audio-v1", 1);
        req.onupgradeneeded = () => req.result.createObjectStore("recordings", { keyPath: "id" });
        req.onerror = () => reject(req.error);
        req.onblocked = () => reject(new Error("本机录音存储暂时被占用"));
        req.onsuccess = () => {
          const db = req.result;
          db.onversionchange = () => { db.close(); database = null; };
          resolve(db);
        };
      });
      database.catch(() => { database = null; });
    }
    return database;
  }

  async function store(action, value) {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("recordings", action === "getAll" ? "readonly" : "readwrite");
      const objectStore = tx.objectStore("recordings");
      const req = action === "getAll" ? objectStore.getAll() : objectStore[action](value);
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = () => reject(tx.error || req.error);
      tx.onabort = () => reject(tx.error || new Error("录音没有保存成功"));
    });
  }

  function shareFile(take) {
    return new File([take.blob], take.filename, { type: take.blob.type.split(";")[0], lastModified: take.createdAt });
  }

  function canShare(take) {
    try {
      return Boolean(window.File && navigator.share && navigator.canShare && navigator.canShare({ files: [shareFile(take)] }));
    } catch (_) {
      return false;
    }
  }

  function element(tag, className, text) {
    const node = document.createElement(tag);
    node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  function renderTakes() {
    list.replaceChildren();
    if (!takes.length) {
      list.append(element("p", "homework-empty", "这里会留下你的朗读。录好后，先听一听自己的声音吧。"));
      return;
    }
    takes.sort((a, b) => b.createdAt - a.createdAt).forEach((take) => {
      if (!urls.has(take.id)) urls.set(take.id, URL.createObjectURL(take.blob));
      const url = urls.get(take.id);
      const card = element("article", "homework-take");
      card.append(element("h4", "", take.title));
      const date = new Date(take.createdAt).toLocaleString("zh-CN", { hour12: false });
      const size = take.blob.size >= 1024 * 1024
        ? (take.blob.size / 1024 / 1024).toFixed(1) + " MB"
        : Math.max(1, Math.round(take.blob.size / 1024)) + " KB";
      card.append(element("p", "homework-take-meta", `${date} · ${clock(take.duration)} · ${extension(take.blob.type).toUpperCase()} · ${size}${take.saved ? " · 已存本机" : " · 请立即下载留存"}`));
      const audio = element("audio", "");
      audio.controls = true;
      audio.preload = "metadata";
      audio.src = url;
      audio.setAttribute("aria-label", `试听：${take.title}`);
      audio.addEventListener("play", () => {
        list.querySelectorAll("audio").forEach((other) => { if (other !== audio) other.pause(); });
      });
      card.append(audio);
      const actions = element("div", "homework-take-actions");
      if (canUseShortcut(take)) {
        const wechat = element("button", "homework-button homework-wechat", "发送到微信");
        wechat.type = "button";
        wechat.disabled = shortcutTransferBusy || busy();
        wechat.addEventListener("click", () => sendToWechat(take));
        actions.append(wechat);
      }
      const download = element("a", "homework-button homework-download", "↓ 下载音频");
      download.href = url;
      download.download = take.filename;
      download.addEventListener("click", () => notice("已打开下载。iPad 上可到「文件」→「下载项」查找；若打开了音频预览，可用分享按钮存到“文件”。"));
      actions.append(download);
      if (canShare(take)) {
        const share = element("button", "homework-button", "分享 / 存到文件");
        share.type = "button";
        share.addEventListener("click", async () => {
          try {
            // 必须直接在点击事件中调用，保留 iPad 分享所需的用户操作授权。
            await navigator.share({ files: [shareFile(take)] });
            notice("分享菜单已关闭。请在微信里确认文件是否发出。还可以保留一份下载文件。");
          } catch (err) {
            if (err.name !== "AbortError") notice("这个浏览器暂时无法分享文件，请用「下载音频」保存后，从微信选择文件发送。", true);
          }
        });
        actions.append(share);
      }
      const remove = element("button", "homework-button homework-remove", "删除这份");
      remove.type = "button";
      remove.addEventListener("click", async () => {
        if (!window.confirm(`删除《${take.title}》这份录音？建议先下载留存。`)) return;
        remove.disabled = true;
        try {
          if (take.saved) await store("delete", take.id);
          audio.pause();
          takes.splice(takes.indexOf(take), 1);
          URL.revokeObjectURL(url);
          urls.delete(take.id);
          renderTakes();
          if (!busy()) setPhase("idle");
          notice("已删除这份本机录音。");
        } catch (_) {
          remove.disabled = false;
          notice("暂时无法删除，请稍后再试。录音仍保留着。", true);
        }
      });
      actions.append(remove);
      card.append(actions);
      list.append(card);
    });
  }

  function release(s) {
    if (s.interval) clearInterval(s.interval);
    s.stream.getTracks().forEach((track) => track.stop());
    if (s.wakeLock) s.wakeLock.release().catch(() => {});
  }

  async function finish(s) {
    if (s.finished) return;
    s.finished = true;
    setPhase("saving");
    release(s);
    const type = s.chunks.find((chunk) => chunk.type)?.type || s.recorder.mimeType;
    const blob = new Blob(s.chunks, { type });
    timer.textContent = clock((s.stoppedAt - s.startedAt) / 1000);
    session = null;
    if (!blob.size) {
      setPhase("idle");
      notice("这次没有录到声音。请确认麦克风可用，再试一次。", true);
      return;
    }
    const take = {
      id: window.crypto?.randomUUID ? crypto.randomUUID() : `${s.createdAt}-${Math.random().toString(36).slice(2)}`,
      title: s.title,
      createdAt: s.createdAt,
      duration: Math.max(0, (s.stoppedAt - s.startedAt) / 1000),
      filename: filename(s.title, s.createdAt, blob.type),
      blob,
      saved: true
    };
    try {
      await store("put", take);
    } catch (_) {
      take.saved = false;
    }
    takes.push(take);
    renderTakes();
    setPhase("idle");
    if (!take.saved) notice("录音已生成，但本机存储不足或不可用。请现在下载音频，避免刷新后丢失。", true);
    else if (s.error) notice("录音中途被打断，已保留收到的音频。请先试听，必要时再录一份。", true);
    else notice((s.reason ? s.reason + " " : "") + "录音已保存在本机。先试听，再下载或分享给老师。");
  }

  function stop(reason = "") {
    if (phase === "requesting") {
      requestId++;
      setPhase("idle");
      notice("已取消等待麦克风。准备好后可以重新开始。");
      return;
    }
    if (phase !== "recording" || !session) return;
    const s = session;
    s.reason = reason;
    s.stoppedAt = Date.now();
    setPhase("saving");
    if (s.interval) clearInterval(s.interval);
    if (s.recorder.state !== "inactive") {
      try { s.recorder.stop(); }
      catch (_) { s.error = true; finish(s); }
    }
    // 关闭麦克风；最终音频由 dataavailable → stop 事件按顺序整理。
    s.stream.getTracks().forEach((track) => track.stop());
  }

  async function start() {
    if (busy() || shortcutTransferBusy || !supported()) return;
    shortcutLaunch.hidden = true;
    const id = ++requestId;
    list.querySelectorAll("audio").forEach((audio) => audio.pause());
    setPhase("requesting");
    notice("第一次录音时，请允许这个页面使用麦克风。");
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      if (id !== requestId || document.hidden) {
        stream.getTracks().forEach((track) => track.stop());
        if (id === requestId) {
          setPhase("idle");
          notice("页面已经切到后台。回到本页后，请重新点开始录音。");
        }
        return;
      }
      const types = ["audio/mp4;codecs=mp4a.40.2", "audio/mp4", "audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"];
      let recorder;
      for (const type of types) {
        if (!MediaRecorder.isTypeSupported || MediaRecorder.isTypeSupported(type)) {
          try { recorder = new MediaRecorder(stream, { mimeType: type }); break; } catch (_) { /* 尝试下一种真实支持的格式 */ }
        }
      }
      if (!recorder) recorder = new MediaRecorder(stream);
      const s = {
        recorder, stream, chunks: [], title: titleInput.value.trim() || "语文朗读",
        createdAt: Date.now(), startedAt: Date.now(), stoppedAt: 0, reason: "", wakeLock: null
      };
      session = s;
      recorder.ondataavailable = (event) => { if (event.data.size) s.chunks.push(event.data); };
      recorder.onstop = () => { if (!s.stoppedAt) s.stoppedAt = Date.now(); finish(s); };
      recorder.onerror = () => { s.error = true; stop(); };
      stream.getAudioTracks().forEach((track) => track.addEventListener("ended", () => stop("麦克风已中断，已结束这次录音。"), { once: true }));
      recorder.start(1000);
      timer.textContent = "00:00";
      setPhase("recording");
      notice("正在录音。读完课文和词语后，点「停止录音」。");
      s.interval = setInterval(() => {
        const seconds = (Date.now() - s.startedAt) / 1000;
        timer.textContent = clock(seconds);
        if (seconds >= 20 * 60) stop("已录满20分钟，自动结束并保存。");
      }, 250);
      if (navigator.wakeLock) navigator.wakeLock.request("screen").then((lock) => {
        if (session === s && phase === "recording") s.wakeLock = lock;
        else lock.release().catch(() => {});
      }).catch(() => {});
    } catch (err) {
      if (stream) stream.getTracks().forEach((track) => track.stop());
      if (id !== requestId) return;
      session = null;
      setPhase("idle");
      if (err.name === "NotAllowedError" || err.name === "SecurityError") notice("还没有麦克风权限。请在 Safari 的网站设置中允许麦克风，再点开始录音。已有录音仍在下方。", true);
      else if (err.name === "NotFoundError") notice("没有找到可用麦克风。请检查设备的麦克风后再试。", true);
      else notice("麦克风暂时无法开始录音，请关闭占用麦克风的应用后重试。已有录音仍在下方。", true);
    }
  }

  startButton.addEventListener("click", start);
  stopButton.addEventListener("click", () => stop());
  el("homeworkOpenShortcut").addEventListener("click", () => {
    try { openShortcut(); }
    catch (_) { notice("请确认 iPad 上存在名为“语文作业”的快捷指令，再点一次打开。"); }
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop("刚才离开了页面，已自动结束这次录音。");
  });
  window.addEventListener("pagehide", () => stop());
  window.addEventListener("beforeunload", (event) => {
    if (busy() || takes.some((take) => !take.saved)) {
      event.preventDefault();
      event.returnValue = "";
    }
  });

  window.RUOGU_HOMEWORK = {
    setContext(nextRoute) {
      route = nextRoute;
      if (!isHomeworkView()) {
        stop("已离开录音小站，自动结束这次录音。");
        list.querySelectorAll("audio").forEach((audio) => audio.pause());
      }
      if (!busy() && (!titleInput.value || titleInput.value === autoTitle)) {
        autoTitle = route.lesson || "";
        titleInput.value = autoTitle;
      }
      root.hidden = !isHomeworkView();
    }
  };

  store("getAll").then((stored) => {
    takes.push(...stored.filter((take) => take.blob instanceof Blob && take.blob.size));
    notice(takes.length ? "上次的录音还在这里，可以继续试听、下载或分享。" : "录音只保存在这台设备。录好后，记得下载一份交作业。");
  }).catch(() => {
    notice("本机存储暂时不可用，仍可录音。录好后请立即下载保存。", true);
  }).finally(() => {
    renderTakes();
    setPhase("idle");
    if (!supported()) notice("请用 iPad 的 Safari 打开线上页面录音；这个浏览器暂时不支持麦克风录音。已有录音仍可试听和下载。", true);
  });
})();
