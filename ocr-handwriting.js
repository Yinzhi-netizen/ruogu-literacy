// 若谷识字 · 听写手写板 + OCR + 离线兜底
// 依赖：state-store.js、progress.js
// 用法：RUOGU_OCR.renderDictation(stage, word, handlers)
//   handlers = { onSuccess(word, reason), onError(word), onPickNext() }

(function () {
  const OCR_KEY_STORE = "ruogu-ocr-key";

  function hasApiKey() {
    return Boolean(localStorage.getItem(OCR_KEY_STORE));
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
    const apiReady = hasApiKey();
    const n = Math.max(1, word.word.length);   // 字数 = 田字格数
    const cell = 360;
    const padW = n * cell;
    const padH = cell;
    const multiClass = n > 1 ? " multi" : "";
    const ratioStyle = n > 1 ? `style="--pad-ratio:${n} / 1"` : "";
    stage.innerHTML = `
      <article class="challenge dictation-card">
        <div class="level-badge">听写关 · +10 星</div>
        <button class="target listen-target" data-action="speak"><img src="./assets/icons/icon_speak.png" alt="" class="speak-icon"><span>听词语</span></button>
        <div class="dictation-pinyin py">${word.pinyin}</div>
        <canvas class="handwrite-pad${multiClass}" ${ratioStyle} width="${padW}" height="${padH}" data-cells="${n}" aria-label="手写区域"></canvas>
        <div class="ocr-status" hidden></div>
        <div class="actions three-actions">
          <button class="soft-button" data-action="clear">擦掉重写</button>
          <button class="soft-button" data-action="peekAnswer">👀 看答案</button>
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
        <div class="feedback">听词语，在方框里手写这个词，然后点「提交识别」。</div>
      </article>
    `;
    setupHandwritingPad(stage, word, handlers);
  }

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
    ctx.lineWidth = 26;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#111111";
  }

  function setupHandwritingPad(stage, word, handlers) {
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

    function clearPad() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawGrid(canvas, ctx);
      ocrStatus.hidden = true;
    }

    drawGrid(canvas, ctx);

    canvas.addEventListener("mousedown", startDraw);
    canvas.addEventListener("mousemove", moveDraw);
    window.addEventListener("mouseup", stopDraw);
    canvas.addEventListener("touchstart", startDraw, { passive: false });
    canvas.addEventListener("touchmove", moveDraw, { passive: false });
    canvas.addEventListener("touchend", stopDraw);

    const playPrompt = () => window.RUOGU_UI.speak(`${word.word}。${word.word}。`);
    stage.querySelector("[data-action='speak']").addEventListener("click", playPrompt);
    stage.querySelector("[data-action='clear']").addEventListener("click", clearPad);

    // 看答案：不给星
    stage.querySelector("[data-action='peekAnswer']").addEventListener("click", () => {
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
    stage.querySelector("[data-action='submitOcr']").addEventListener("click", async () => {
      ocrStatus.hidden = false;
      ocrStatus.className = "ocr-status";
      ocrStatus.innerHTML = "<span class='ocr-spinner'></span> 正在识别你写的字...";
      feedback.textContent = "";

      const imageBlob = await captureCanvas(canvas);
      const result = await recognizeCharacter(imageBlob);

      if (result.error === "no_key") {
        // 无 Key：走离线自评兜底
        offerManualPass(stage, word, canvas, handlers, "还没设置识别用的 API Key。");
        return;
      }
      if (result.error === "network_error") {
        // 断网：走离线自评兜底
        offerManualPass(stage, word, canvas, handlers, "现在没有网络，识别不了。");
        return;
      }
      if (result.error === "recognition_failed") {
        ocrStatus.className = "ocr-status ocr-warn";
        ocrStatus.innerHTML = `识别失败：${result.apiMessage || "未知错误"}。请重试或擦掉重新写。`;
        return;
      }

      handleRecognitionResult(stage, result.text, word, canvas, handlers);
    });

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
      target.toBlob(function (blob) {
        resolve(blob);
      }, "image/png");
    });
  }

  async function recognizeCharacter(blob) {
    const apiKey = localStorage.getItem(OCR_KEY_STORE);
    if (!apiKey) return { error: "no_key" };

    const formData = new FormData();
    formData.append("file", blob, "handwrite.png");
    formData.append("apikey", apiKey);
    formData.append("language", "chs");
    formData.append("OCREngine", "3");
    formData.append("isOverlayRequired", "false");

    try {
      const res = await fetch("https://api.ocr.space/parse/image", {
        method: "POST",
        body: formData
      });
      const raw = await res.text();
      let data;
      try {
        data = JSON.parse(raw);
      } catch (e) {
        return { error: "recognition_failed", apiMessage: "Non-JSON response: " + raw.slice(0, 200) };
      }
      if ((data.OCRExitCode === 1 || data.OCRExitCode === 2) && data.ParsedResults && data.ParsedResults.length) {
        const text = data.ParsedResults[0].ParsedText ? data.ParsedResults[0].ParsedText.trim() : "";
        return { success: true, text };
      }
      const errMsg = data.ErrorMessage || data.ErrorDetails || "API returned exit code " + (data.OCRExitCode || "unknown");
      return { error: "recognition_failed", apiMessage: errMsg };
    } catch (e) {
      return { error: "network_error", apiMessage: e.message };
    }
  }

  function handleRecognitionResult(stage, recognizedText, word, canvas, handlers) {
    const ocrStatus = stage.querySelector(".ocr-status");
    const cleaned = (recognizedText || "").replace(/\s/g, "");
    const target = word.word;
    const exact = cleaned.includes(target);
    const allChars = target.length > 1 && [...target].every((c) => cleaned.includes(c));

    if (exact || allChars) {
      ocrStatus.className = "ocr-status ocr-ok";
      ocrStatus.innerHTML = `识别成功：${cleaned} ✓`;
      handlers.onSuccess(word, "听写成功");
      return;
    }

    // 没写对：记录一次会写错误，只能重写或看答案
    if (handlers.onError) handlers.onError(word);
    const hitCount = cleaned ? [...new Set(target)].filter((c) => cleaned.includes(c)).length : 0;
    ocrStatus.className = "ocr-status ocr-warn";
    ocrStatus.innerHTML = `
      <div class="fallback-check">
        <p>识别结果：<strong>${cleaned || "（空白）"}</strong>，要写的是「${target}」</p>
        <p class="hit-hint">${cleaned ? (hitCount > 0 ? `认出了 ${hitCount}/${target.length} 个字，再仔细写一次试试。` : "写得不太清楚，再写一次试试。") : "还没写呢，先在方框里写一下。"}</p>
        <div class="actions two-actions">
          <button class="soft-button" data-action="retryManual">再写一次</button>
          <button class="soft-button" data-action="peekAnswerInline">👀 看答案</button>
        </div>
      </div>
    `;
    bindRetry(stage, word, canvas, handlers);
    bindPeekInline(stage, word, handlers);
  }

  // 离线/无 Key 兜底：允许若谷诚实自评通过
  function offerManualPass(stage, word, canvas, handlers, reasonText) {
    const ocrStatus = stage.querySelector(".ocr-status");
    ocrStatus.hidden = false;
    ocrStatus.className = "ocr-status ocr-warn";
    ocrStatus.innerHTML = `
      <div class="fallback-check">
        <p>${reasonText}若谷自己对一下：</p>
        <p>要写的是「<strong style="font-size:28px;">${word.word}</strong>」<span class="py">（${word.pinyin}）</span></p>
        <div class="actions three-actions">
          <button class="soft-button" data-action="retryManual">再写一次</button>
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
      passBtn.addEventListener("click", () => handlers.onSuccess(word, "听写成功（离线自评）"));
    }
  }

  function bindRetry(stage, word, canvas, handlers) {
    const btn = stage.querySelector("[data-action='retryManual']");
    if (!btn) return;
    btn.addEventListener("click", () => {
      const canvasEl = stage.querySelector(".handwrite-pad");
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
