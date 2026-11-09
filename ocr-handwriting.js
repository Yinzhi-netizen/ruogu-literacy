// 若谷识字 · 听写手写板 + OCR + 离线兜底
// 依赖：state-store.js、progress.js
// 用法：RUOGU_OCR.renderDictation(stage, word, handlers)
//   handlers = { onSuccess(word, reason), onError(word), onPickNext() }

(function () {
  const OCR_KEY_STORE = "ruogu-ocr-key";
  const BRUSH_KEY = "ruogu-brush-width";
  const MIN_BRUSH = 4;
  const MAX_BRUSH = 28;
  const DEFAULT_BRUSH = 12;
  const REQUEST_TIMEOUT = 25000;

  function hasApiKey() {
    return Boolean(localStorage.getItem(OCR_KEY_STORE));
  }

  function clampBrush(v) {
    if (!Number.isFinite(v)) return DEFAULT_BRUSH;
    return Math.min(MAX_BRUSH, Math.max(MIN_BRUSH, Math.round(v)));
  }

  function loadBrush() {
    return clampBrush(parseInt(localStorage.getItem(BRUSH_KEY) || "", 10));
  }

  function renderDictation(stage, word, handlers) {
    if (!word || !word.word) {
      stage.innerHTML = `
        <article class="challenge dictation-card">
          <div class="level-badge">听写关 · +10 星</div>
          <div class="feedback">这个范围里暂时没有「会写词」，换个范围试试。</div>
        </article>`;
      return;
    }
    // 测试模式：没有看答案/重写，不会只能跳过，结果计入评分
    const examMode = Boolean(handlers && handlers.examMode);
    const apiReady = hasApiKey();
    const n = Math.max(1, word.word.length);   // 字数 = 田字格数
    const cell = 360;
    const padW = n * cell;
    const padH = cell;
    const multiClass = n > 1 ? " multi" : "";
    const ratioStyle = n > 1 ? `style="--pad-ratio:${n} / 1"` : "";
    const brush = loadBrush();
    const erasers = Array.from({ length: n }, (_, i) =>
      `<button class="cell-eraser" data-erase-cell="${i}" disabled>🧽 ${n > 1 ? "擦第" + (i + 1) + "个" : "擦掉"}</button>`
    ).join("");
    stage.innerHTML = `
      <article class="challenge dictation-card">
        <div class="level-badge">${examMode ? "测试 · 听写题" : "听写关 · +10 星"}</div>
        <button class="target listen-target" data-action="speak"><img src="./assets/icons/icon_speak.png" alt="" class="speak-icon"><span>听词语</span></button>
        <div class="dictation-pinyin py">${word.pinyin}</div>
        <div class="pad-zone${multiClass}">
          <div class="brush-bar">
            <span class="brush-label">笔</span>
            <input type="range" class="brush-slider" min="${MIN_BRUSH}" max="${MAX_BRUSH}" step="1" value="${brush}" aria-label="笔刷粗细" />
            <span class="brush-preview"><i></i></span>
          </div>
          <canvas class="handwrite-pad${multiClass}" ${ratioStyle} width="${padW}" height="${padH}" data-cells="${n}" aria-label="手写区域"></canvas>
          <div class="cell-erasers" style="--cells:${n}">${erasers}</div>
        </div>
        <div class="ocr-status" hidden></div>
        <div class="actions three-actions">
          <button class="soft-button" data-action="undo" disabled>↩ 撤销上一笔</button>
          <button class="soft-button" data-action="clear">全部擦掉</button>
          ${examMode
            ? `<button class="soft-button" data-action="examSkip">不会，下一题 →</button>`
            : `<button class="soft-button" data-action="peekAnswer">👀 看答案</button>`}
        </div>
        <div class="actions single-action">
          <button class="primary-button" data-action="submitOcr">提交识别</button>
        </div>
        <div class="ocr-settings" hidden>
          <input type="password" class="ocr-key-input" placeholder="输入 ocr.space API Key" />
          <button class="soft-button ocr-save-btn" style="min-height:36px;font-size:14px;">保存</button>
          <small><a href="https://ocr.space/ocrapi/freekey" target="_blank">免费获取 API Key</a></small>
        </div>
        ${apiReady
          ? `<button class="ocr-toggle ocr-toggle-mini" data-action="toggleOcrSettings" title="修改 API Key">⚙️</button>`
          : `<button class="ocr-toggle" data-action="toggleOcrSettings">⚙️ 设置 API Key（首次使用）</button>`}
        <div class="feedback">${examMode
          ? "测试中没有提示哦。听词语，写出来，写完点「提交识别」。"
          : "听词语，在方框里手写这个词。写错一个字，点那一格下面的「擦」就行。"}</div>
      </article>
    `;
    setupHandwritingPad(stage, word, handlers);
  }

  // 只画田字格，不改 ctx 的默认笔触（每一笔自己带粗细）
  function drawGrid(canvas, ctx) {
    const cells = parseInt(canvas.dataset.cells || "1", 10);
    const cw = canvas.width / cells;
    const h = canvas.height;
    ctx.save();
    ctx.strokeStyle = "rgba(143, 29, 29, 0.22)";
    ctx.lineWidth = 2;
    for (let i = 0; i < cells; i++) {
      const x0 = i * cw;
      ctx.strokeRect(x0 + 3, 3, cw - 6, h - 6);
      ctx.save();
      ctx.setLineDash([10, 10]);
      ctx.beginPath();
      ctx.moveTo(x0 + cw / 2, 4); ctx.lineTo(x0 + cw / 2, h - 4);
      ctx.moveTo(x0 + 4, h / 2); ctx.lineTo(x0 + cw - 4, h / 2);
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }

  function setupHandwritingPad(stage, word, handlers) {
    const canvas = stage.querySelector(".handwrite-pad");
    const ocrStatus = stage.querySelector(".ocr-status");
    const feedback = stage.querySelector(".feedback");
    const slider = stage.querySelector(".brush-slider");
    const previewDot = stage.querySelector(".brush-preview i");
    const undoBtn = stage.querySelector("[data-action='undo']");
    const eraserBtns = Array.from(stage.querySelectorAll("[data-erase-cell]"));
    const ctx = canvas.getContext("2d");
    const cells = parseInt(canvas.dataset.cells || "1", 10);
    const cellWidth = canvas.width / cells;

    // 每一笔记下它落在哪一格、用多粗的笔，擦某一格＝把那一格的笔画扔掉后重画
    let strokes = [];
    let current = null;
    let brush = loadBrush();
    let activeId = null;      // 正在画的 pointerId
    let activeType = null;    // "pen" / "touch" / "mouse"
    let submitting = false;
    let completed = false;
    const onSuccess = handlers.onSuccess;
    handlers = { ...handlers, onSuccess(...args) {
      if (completed) return;
      completed = true;
      stage.querySelector("[data-action='submitOcr']").disabled = true;
      onSuccess(...args);
    } };

    function setStrokeStyle(width) {
      ctx.lineWidth = width;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#111111";
    }

    function drawStroke(s) {
      ctx.save();
      setStrokeStyle(s.width);
      if (s.points.length === 1) {
        // 点一下＝一个圆点，不然什么都看不见
        ctx.beginPath();
        ctx.arc(s.points[0].x, s.points[0].y, s.width / 2, 0, Math.PI * 2);
        ctx.fillStyle = "#111111";
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.moveTo(s.points[0].x, s.points[0].y);
        for (let i = 1; i < s.points.length; i++) ctx.lineTo(s.points[i].x, s.points[i].y);
        ctx.stroke();
      }
      ctx.restore();
    }

    function syncButtons() {
      undoBtn.disabled = strokes.length === 0;
      eraserBtns.forEach((btn) => {
        const idx = parseInt(btn.dataset.eraseCell, 10);
        btn.disabled = !strokes.some((s) => s.cell === idx);
      });
    }

    function redrawAll() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawGrid(canvas, ctx);
      strokes.forEach(drawStroke);
      syncButtons();
    }

    function clearPad() {
      strokes = [];
      current = null;
      redrawAll();
      ocrStatus.hidden = true;
    }

    function eraseCell(idx) {
      strokes = strokes.filter((s) => s.cell !== idx);
      redrawAll();
    }

    function undoStroke() {
      strokes.pop();
      redrawAll();
    }

    function point(event) {
      const rect = canvas.getBoundingClientRect();
      const touch = event.touches ? event.touches[0] : event;
      return {
        x: ((touch.clientX - rect.left) / rect.width) * canvas.width,
        y: ((touch.clientY - rect.top) / rect.height) * canvas.height
      };
    }

    function cellOf(x) {
      return Math.min(cells - 1, Math.max(0, Math.floor(x / cellWidth)));
    }

    function beginStroke(p) {
      if (submitting || completed) return;
      current = { cell: cellOf(p.x), width: brush, points: [p] };
      strokes.push(current);
    }

    function extendStroke(p) {
      if (!current) return;
      const prev = current.points[current.points.length - 1];
      current.points.push(p);
      // 实时只画新的一小段，比整张重画流畅
      ctx.save();
      setStrokeStyle(current.width);
      ctx.beginPath();
      ctx.moveTo(prev.x, prev.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      ctx.restore();
    }

    function endStroke() {
      if (current && current.points.length === 1) redrawAll();  // 补上那个圆点
      current = null;
      activeId = null;
      activeType = null;
      syncButtons();
    }

    // 丢掉正在画的这一笔（手掌先落、笔后到时用）
    function dropCurrent() {
      if (!current) return;
      const i = strokes.indexOf(current);
      if (i >= 0) strokes.splice(i, 1);
      current = null;
      activeId = null;
      activeType = null;
      redrawAll();
    }

    // ---- 输入：优先用 Pointer Events（能分辨 Apple Pencil 和手掌）----
    if (window.PointerEvent) {
      canvas.addEventListener("pointerdown", (e) => {
        if (activeId !== null) {
          // 已经在画了：只有 Apple Pencil 能抢过来（手掌先搭上、笔随后落下的情况）
          if (e.pointerType === "pen" && activeType !== "pen") dropCurrent();
          else return;                                  // 其余新触点一律无视＝防掌压
        }
        e.preventDefault();
        activeId = e.pointerId;
        activeType = e.pointerType;
        if (canvas.setPointerCapture) {
          try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* 忽略 */ }
        }
        beginStroke(point(e));
      });

      canvas.addEventListener("pointermove", (e) => {
        if (activeId === null || e.pointerId !== activeId) return;
        e.preventDefault();
        extendStroke(point(e));
      });

      const finish = (e) => {
        if (activeId === null || e.pointerId !== activeId) return;
        endStroke();
      };
      canvas.addEventListener("pointerup", finish);
      canvas.addEventListener("pointercancel", finish);
      window.addEventListener("pointerup", finish);
    } else {
      // 老浏览器兜底：还是原来的鼠标 + 单点触摸
      let drawing = false;
      const start = (e) => { e.preventDefault(); drawing = true; beginStroke(point(e)); };
      const move = (e) => { if (!drawing) return; e.preventDefault(); extendStroke(point(e)); };
      const stop = () => { if (!drawing) return; drawing = false; endStroke(); };
      canvas.addEventListener("mousedown", start);
      canvas.addEventListener("mousemove", move);
      window.addEventListener("mouseup", stop);
      canvas.addEventListener("touchstart", (e) => { if (!drawing) start(e); }, { passive: false });
      canvas.addEventListener("touchmove", move, { passive: false });
      canvas.addEventListener("touchend", stop);
    }

    // ---- 笔刷粗细 ----
    function applyBrush(v, persist) {
      brush = clampBrush(v);
      previewDot.style.width = brush + "px";
      previewDot.style.height = brush + "px";
      if (persist) localStorage.setItem(BRUSH_KEY, String(brush));
    }
    applyBrush(brush, false);
    slider.addEventListener("input", () => applyBrush(parseInt(slider.value, 10), false));
    slider.addEventListener("change", () => applyBrush(parseInt(slider.value, 10), true));

    redrawAll();

    // 让 bindRetry 之类的外部按钮也能清空笔画记录
    canvas.__pad = { clearPad, redrawAll, eraseCell, undoStroke };

    eraserBtns.forEach((btn) => {
      btn.addEventListener("click", () => eraseCell(parseInt(btn.dataset.eraseCell, 10)));
    });
    undoBtn.addEventListener("click", undoStroke);

    const playPrompt = () => window.RUOGU_UI.speak(`${word.word}。${word.word}。`);
    stage.querySelector("[data-action='speak']").addEventListener("click", playPrompt);
    stage.querySelector("[data-action='clear']").addEventListener("click", clearPad);

    // 看答案：不给星（测试模式没有这个按钮，换成「不会，下一题」）
    const peekBtn = stage.querySelector("[data-action='peekAnswer']");
    if (peekBtn) {
      peekBtn.addEventListener("click", () => {
        ocrStatus.hidden = false;
        ocrStatus.className = "ocr-status ocr-warn";
        ocrStatus.innerHTML = `
          <div class="fallback-check">
            <p>正确答案：<strong style="font-size:28px;">${word.word}</strong> <span class="py">（${word.pinyin}）</span></p>
            <p class="hit-hint">看过答案就换一个吧，这一次不算得星哦。</p>
            <div class="actions two-actions">
              <button class="primary-button" data-action="peekNext">换一个词</button>
            </div>
          </div>
        `;
        stage.querySelector("[data-action='peekNext']").addEventListener("click", () => handlers.onPickNext());
      });
    }

    // 测试模式：不会只能跳过，这题算错
    const examSkipBtn = stage.querySelector("[data-action='examSkip']");
    if (examSkipBtn) {
      examSkipBtn.addEventListener("click", () => handlers.onPickNext());
    }

    // OCR 设置
    stage.querySelector("[data-action='toggleOcrSettings']").addEventListener("click", () => {
      const panel = stage.querySelector(".ocr-settings");
      panel.hidden = !panel.hidden;
    });

    stage.querySelector(".ocr-save-btn").addEventListener("click", () => {
      const input = stage.querySelector(".ocr-key-input");
      const key = input.value.trim();
      if (key) {
        localStorage.setItem(OCR_KEY_STORE, key);
        stage.querySelector(".ocr-settings").hidden = true;
        feedback.textContent = "API Key 已保存，现在可以提交识别了。";
        feedback.classList.add("glow");
        feedback.addEventListener("animationend", () => feedback.classList.remove("glow"), { once: true });
      }
    });

    // 提交识别
    const submitBtn = stage.querySelector("[data-action='submitOcr']");
    submitBtn.addEventListener("click", async () => {
      if (submitting || completed) return;
      if (!strokes.length) {
        ocrStatus.hidden = false;
        ocrStatus.className = "ocr-status ocr-warn";
        ocrStatus.textContent = "先在方框里写好，再点提交识别。";
        return;
      }
      endStroke();
      submitting = true;
      const controls = Array.from(stage.querySelectorAll("button, input"));
      const wasDisabled = controls.map((el) => el.disabled);
      controls.forEach((el) => { el.disabled = true; });
      ocrStatus.hidden = false;
      ocrStatus.className = "ocr-status";
      ocrStatus.setAttribute("aria-busy", "true");
      ocrStatus.innerHTML = "<span class='ocr-spinner'></span> 正在识别你写的字，请稍等…";
      feedback.textContent = "";

      try {
        const imageBlob = await captureCanvas(canvas);
        const result = await recognizeCharacter(imageBlob);
        // 切换了关卡或题目以后，旧请求不能改新题、记错题或加星。
        if (!canvas.isConnected || stage.querySelector(".handwrite-pad") !== canvas) return;
        if (result.error === "no_key") {
          offerManualPass(stage, word, canvas, handlers, "还没设置识别用的 API Key。");
        } else if (result.error) {
          showServiceProblem(result);
        } else {
          completed = handleRecognitionResult(stage, result.text, word, canvas, handlers) === true;
        }
      } catch (err) {
        if (canvas.isConnected && stage.querySelector(".handwrite-pad") === canvas) {
          showServiceProblem({ error: "image_error" });
        }
      } finally {
        submitting = false;
        ocrStatus.removeAttribute("aria-busy");
        controls.forEach((el, i) => { el.disabled = wasDisabled[i]; });
        submitBtn.disabled = completed;
      }
    });

    function showServiceProblem(result) {
      const reasons = {
        network_error: "暂时连不上识别服务。",
        timeout: "识别服务这次等得有点久。",
        quota_exceeded: "识别服务暂时达到使用上限。",
        auth_error: "识别服务的设置需要家长检查一下。",
        image_error: "这次没能准备好识别图片。"
      };
      ocrStatus.className = "ocr-status ocr-warn";
      ocrStatus.innerHTML = `
        <div class="fallback-check">
          <p></p>
          <p class="hit-hint">你写的字还在，不用擦掉。这次没有算错，也没有扣星。</p>
          <div class="actions two-actions">
            <button class="soft-button" data-action="retryService">再试识别</button>
            <button class="soft-button" data-action="selfCheck">自己对一对</button>
          </div>
        </div>`;
      ocrStatus.querySelector("p").textContent = reasons[result.error] || "识别服务暂时没能完成。";
      stage.querySelector("[data-action='retryService']").addEventListener("click", () => submitBtn.click());
      stage.querySelector("[data-action='selfCheck']").addEventListener("click", () => {
        offerManualPass(stage, word, canvas, handlers, "识别服务暂时不可用。");
      });
    }

    setTimeout(playPrompt, 260);
  }

  function captureCanvas(canvas) {
    return new Promise(function (resolve) {
      const fullCanvas = document.createElement("canvas");
      fullCanvas.width = canvas.width;
      fullCanvas.height = canvas.height;
      const fctx = fullCanvas.getContext("2d");
      fctx.fillStyle = "#ffffff";
      fctx.fillRect(0, 0, fullCanvas.width, fullCanvas.height);
      fctx.drawImage(canvas, 0, 0);
      const scale = Math.min(1, 800 / fullCanvas.width);
      let target = fullCanvas;
      if (scale < 1) {
        target = document.createElement("canvas");
        target.width = Math.round(fullCanvas.width * scale);
        target.height = Math.round(fullCanvas.height * scale);
        const sctx = target.getContext("2d");
        sctx.drawImage(fullCanvas, 0, 0, target.width, target.height);
      }
      target.toBlob(resolve, "image/png");
    });
  }

  async function recognizeCharacter(blob) {
    const apiKey = localStorage.getItem(OCR_KEY_STORE);
    if (!apiKey) return { error: "no_key" };
    if (!blob) return { error: "image_error" };

    const formData = new FormData();
    formData.append("file", blob, "handwrite.png");
    formData.append("apikey", apiKey);
    formData.append("language", "chs");
    formData.append("OCREngine", "3");
    formData.append("isOverlayRequired", "false");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
    try {
      const res = await fetch("https://api.ocr.space/parse/image", {
        method: "POST",
        body: formData,
        signal: controller.signal
      });
      const raw = await res.text();
      let data;
      try {
        data = JSON.parse(raw);
      } catch (e) {
        return serviceError(res.status);
      }
      const pages = Array.isArray(data && data.ParsedResults) ? data.ParsedResults : [];
      const code = Number(data && data.OCRExitCode);
      if (res.ok && (code === 1 || code === 2) && pages.length) {
        const parsed = pages.filter((page) => page && typeof page.ParsedText === "string" &&
          (page.FileParseExitCode == null || Number(page.FileParseExitCode) === 1));
        if (!parsed.length) return serviceError(res.status, apiErrorMessage(data));
        const text = parsed.map((page) => page.ParsedText.trim()).join("\n");
        return { success: true, text };
      }
      return serviceError(res.status, apiErrorMessage(data));
    } catch (e) {
      return { error: controller.signal.aborted ? "timeout" : "network_error" };
    } finally {
      clearTimeout(timeout);
    }
  }

  function apiErrorMessage(data) {
    if (!data || typeof data !== "object") return "";
    const values = [data.ErrorMessage, data.ErrorDetails, data.message, data.error];
    if (Array.isArray(data.ParsedResults)) {
      data.ParsedResults.forEach((page) => {
        if (page) values.push(page.ErrorMessage, page.ErrorDetails);
      });
    }
    return values.flat().filter((v) => typeof v === "string" && v.trim()).join("; ").slice(0, 500);
  }

  function serviceError(status, message = "") {
    let error = "service_unavailable";
    if (status === 401 || status === 403 || /(?:api.?key|apikey).*(?:invalid|expired|not valid)/i.test(message)) error = "auth_error";
    else if (status === 429 || /rate.?limit|quota|limit.*exceed|too many requests/i.test(message)) error = "quota_exceeded";
    else if (status === 408 || status === 504 || /timed?\s*out|timeout/i.test(message)) error = "timeout";
    // 不把服务端原文插入页面：它可能是 HTML、内部信息或未经转义的用户文本。
    return { error, httpStatus: status };
  }

  function handleRecognitionResult(stage, recognizedText, word, canvas, handlers) {
    const ocrStatus = stage.querySelector(".ocr-status");
    const cleaned = (recognizedText || "").replace(/\s/g, "");
    const target = word.word;
    const exact = cleaned.includes(target);
    const allChars = target.length > 1 && [...target].every((c) => cleaned.includes(c));

    if (exact || allChars) {
      ocrStatus.className = "ocr-status ocr-ok";
      ocrStatus.textContent = `识别成功：${cleaned} ✓`;
      handlers.onSuccess(word, "听写成功");
      return true;
    }

    // 测试模式：不能重写也不能看答案，这题算错直接下一题
    if (handlers.examMode) {
      ocrStatus.className = "ocr-status ocr-warn";
      ocrStatus.innerHTML = `
        <div class="fallback-check">
          <p>识别结果：<strong>${escapeText(cleaned || "（空白）")}</strong></p>
          <p class="hit-hint">测试里没有重写机会哦，这题算错，考完评估里会看到它。</p>
          <div class="actions single-action">
            <button class="primary-button" data-action="examFailNext">知道了，下一题 →</button>
          </div>
        </div>
      `;
      stage.querySelector("[data-action='examFailNext']").addEventListener("click", () => handlers.onPickNext());
      return;
    }

    // 没写对：记录一次会写错误，只能重写或看答案
    if (handlers.onError) handlers.onError(word);
    const hitCount = cleaned ? [...new Set(target)].filter((c) => cleaned.includes(c)).length : 0;
    ocrStatus.className = "ocr-status ocr-warn";
    ocrStatus.innerHTML = `
      <div class="fallback-check">
        <p>识别结果：<strong>${escapeText(cleaned || "（空白）")}</strong>，要写的是「${target}」</p>
        <p class="hit-hint">${cleaned ? (hitCount > 0 ? `认出了 ${hitCount}/${target.length} 个字，写歪的那一格单独擦掉重写就好。` : "写得不太清楚，再写一次试试。") : "还没写呢，先在方框里写一下。"}</p>
        <div class="actions two-actions">
          <button class="soft-button" data-action="retryManual">全部重写</button>
          <button class="soft-button" data-action="peekAnswerInline">👀 看答案</button>
        </div>
      </div>
    `;
    bindRetry(stage, word, canvas, handlers);
    bindPeekInline(stage, word, handlers);
  }

  function escapeText(text) {
    return text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  }

  // 离线/无 Key 兜底：允许若谷诚实自评通过
  function offerManualPass(stage, word, canvas, handlers, reasonText) {
    const ocrStatus = stage.querySelector(".ocr-status");
    ocrStatus.hidden = false;
    ocrStatus.className = "ocr-status ocr-warn";

    // 测试模式离线：只留诚实自评两个出口，不能重写、不能提前看答案
    if (handlers.examMode) {
      ocrStatus.innerHTML = `
        <div class="fallback-check">
          <p>${reasonText}若谷自己对一下：</p>
          <p>要写的是「<strong style="font-size:28px;">${word.word}</strong>」<span class="py">（${word.pinyin}）</span></p>
          <div class="actions two-actions">
            <button class="soft-button" data-action="examFailNext">没写对，下一题 →</button>
            <button class="primary-button" data-action="manualPass">我写对了</button>
          </div>
          <p class="hit-hint">点「我写对了」要诚实哦～写对了才点。</p>
        </div>
      `;
      const passBtn = stage.querySelector("[data-action='manualPass']");
      if (passBtn) {
        passBtn.addEventListener("click", () => {
          passBtn.disabled = true;
          handlers.onSuccess(word, "听写成功（离线自评）");
        }, { once: true });
      }
      stage.querySelector("[data-action='examFailNext']").addEventListener("click", () => handlers.onPickNext());
      return;
    }

    ocrStatus.innerHTML = `
      <div class="fallback-check">
        <p>${reasonText}若谷自己对一下：</p>
        <p>要写的是「<strong style="font-size:28px;">${word.word}</strong>」<span class="py">（${word.pinyin}）</span></p>
        <div class="actions three-actions">
          <button class="soft-button" data-action="retryManual">全部重写</button>
          <button class="soft-button" data-action="peekAnswerInline">👀 看答案</button>
          <button class="primary-button" data-action="manualPass">我写对了，+10 星</button>
        </div>
        <p class="hit-hint">点「我写对了」要诚实哦～写对了才点。</p>
      </div>
    `;
    bindRetry(stage, word, canvas, handlers);
    bindPeekInline(stage, word, handlers);
    const passBtn = stage.querySelector("[data-action='manualPass']");
    if (passBtn) {
      passBtn.addEventListener("click", () => {
        passBtn.disabled = true;
        handlers.onSuccess(word, "听写成功（离线自评）");
      }, { once: true });
    }
  }

  function bindRetry(stage, word, canvas, handlers) {
    const btn = stage.querySelector("[data-action='retryManual']");
    if (!btn) return;
    btn.addEventListener("click", () => {
      const canvasEl = stage.querySelector(".handwrite-pad");
      if (canvasEl && canvasEl.__pad) {
        canvasEl.__pad.clearPad();
        return;
      }
      const ctx = canvasEl.getContext("2d");
      ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
      drawGrid(canvasEl, ctx);
      const ocrStatus = stage.querySelector(".ocr-status");
      if (ocrStatus) ocrStatus.hidden = true;
    });
  }

  function bindPeekInline(stage, word, handlers) {
    const btn = stage.querySelector("[data-action='peekAnswerInline']");
    if (!btn) return;
    btn.addEventListener("click", () => {
      const ocrStatus = stage.querySelector(".ocr-status");
      ocrStatus.innerHTML = `
        <div class="fallback-check">
          <p>正确答案：<strong style="font-size:28px;">${word.word}</strong> <span class="py">（${word.pinyin}）</span></p>
          <p class="hit-hint">看过答案就换一个吧，这一次不算得星哦。</p>
          <div class="actions two-actions">
            <button class="primary-button" data-action="peekNextInline">换一个词</button>
          </div>
        </div>
      `;
      stage.querySelector("[data-action='peekNextInline']").addEventListener("click", () => handlers.onPickNext());
    });
  }

  // 注意：全局名用 RUOGU_DICTATION，避免与 grade1-words.js 的 RUOGU_OCR（识字库数据）冲突
  window.RUOGU_DICTATION = {
    renderDictation,
    captureCanvas,
    recognizeCharacter
  };
})();
