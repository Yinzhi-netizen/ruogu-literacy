// 若谷识字 · 小人大战（双入口共享成长版）
// 只读 totalStars / RUOGU_WEAPONS / 神兵解锁；只把对战偏好写入 profile.duel。

(function () {
  const STATE = window.RUOGU_STATE;
  const WS = window.RUOGU_WEAPON_SYSTEM;
  const WEAPONS = window.RUOGU_WEAPONS || [];

  const CUTOUT = "./Ruogu Painting/cutouts/";
  const CHARS = [
    { id: "hero", name: "若谷侠", file: "1_cutout.png", hp: 120, power: 10 },
    { id: "vine", name: "缠藤怪", file: "2_cutout.png", hp: 112, power: 9 },
    { id: "square", name: "方脸怪", file: "4_cutout.png", hp: 116, power: 10 },
    { id: "dot", name: "圆点怪", file: "5_cutout.png", hp: 108, power: 11 },
    { id: "echo", name: "回声石怪", file: "6_cutout.png", hp: 128, power: 8 },
    { id: "redking", name: "红怪王", file: "10_cutout.png", hp: 136, power: 12 }
  ];

  const MOVES = [
    { id: "charge", icon: "冲", name: "冲", damage: 12, cls: "charge" },
    { id: "smash", icon: "砸", name: "砸", damage: 15, cls: "smash" },
    { id: "spin", icon: "旋", name: "旋", damage: 13, cls: "spin" },
    { id: "kick", icon: "踢", name: "飞踢", damage: 14, cls: "kick" },
    { id: "combo", icon: "连", name: "连打", damage: 18, cls: "combo" },
    { id: "dodge", icon: "闪", name: "闪", damage: 0, cls: "dodge", shield: 10 },
    { id: "guard", icon: "挡", name: "挡", damage: 0, cls: "guard", shield: 18 },
    { id: "beam", icon: "波", name: "发光波", damage: 14, cls: "beam", fx: "beam" },
    { id: "qiankun", icon: "圈", name: "乾坤圈", damage: 10, cls: "bind", bind: true, fx: "ring" },
    { id: "wind", icon: "风", name: "芭蕉风", damage: 13, cls: "beam", fx: "beam" },
    { id: "fall", icon: "降", name: "神兵天降", damage: 22, cls: "ultimate" },
    { id: "director", icon: "令", name: "导演令", damage: 20, cls: "ultimate" }
  ];

  let runtime = null;

  function ensureDuel() {
    const p = STATE.active();
    if (!p.duel) {
      p.duel = {
        leftChar: "hero",
        rightChar: "redking",
        leftWeapon: "",
        rightWeapon: "",
        wins: { left: 0, right: 0 },
        updatedAt: 0
      };
      STATE.save();
    }
    return p.duel;
  }

  function unlockedWeapons() {
    const count = WS.unlockedWeaponCount();
    const unlocked = WEAPONS.slice(0, Math.max(0, count));
    return unlocked.length ? unlocked : WEAPONS.slice(0, 1);
  }

  function weaponById(id) {
    const list = unlockedWeapons();
    return list.find((w) => w.id === id) || list[0] || { id: "fist", name: "小拳头", mark: "拳", power: 30, image: "" };
  }

  function charById(id) {
    return CHARS.find((c) => c.id === id) || CHARS[0];
  }

  function persist() {
    const duel = ensureDuel();
    duel.leftChar = runtime.left.charId;
    duel.rightChar = runtime.right.charId;
    duel.leftWeapon = runtime.left.weaponId;
    duel.rightWeapon = runtime.right.weaponId;
    duel.updatedAt = Date.now();
    STATE.save();
  }

  function initRuntime() {
    const duel = ensureDuel();
    const list = unlockedWeapons();
    const leftWeapon = weaponById(duel.leftWeapon || (list[0] && list[0].id));
    const rightWeapon = weaponById(duel.rightWeapon || (list[list.length - 1] && list[list.length - 1].id));
    const leftChar = charById(duel.leftChar);
    const rightChar = charById(duel.rightChar);
    runtime = {
      locked: false,
      left: { charId: leftChar.id, weaponId: leftWeapon.id, hp: leftChar.hp, maxHp: leftChar.hp, shield: 0, bound: false },
      right: { charId: rightChar.id, weaponId: rightWeapon.id, hp: rightChar.hp, maxHp: rightChar.hp, shield: 0, bound: false }
    };
  }

  function renderDuel(stage) {
    if (!runtime) initRuntime();
    const duel = ensureDuel();
    const weapons = unlockedWeapons();
    const weaponHint = weapons.length
      ? `已解锁神兵 ${weapons.length}/${WEAPONS.length}，来自若谷原来的星星和碎片`
      : "还没有解锁神兵，先用小拳头试打";

    stage.innerHTML = `
      <article class="duel-card">
        <div class="duel-head">
          <div>
            <p class="prompt">小人大战 · 共享成长</p>
            <h2>若谷导演台</h2>
            <span>${weaponHint}</span>
          </div>
          <div class="duel-record">左 ${duel.wins.left || 0} · 右 ${duel.wins.right || 0}</div>
        </div>
        <div class="duel-layout">
          ${renderPanel("left", weapons)}
          <section class="duel-stage" id="duelStage">
            <div class="duel-score">
              ${renderHp("left")}
              <strong>战</strong>
              ${renderHp("right")}
            </div>
            <div class="duel-arena">
              <div class="duel-sun"></div>
              <div class="duel-ground"></div>
              ${renderFighter("left")}
              ${renderFighter("right")}
              <span class="duel-impact" id="duelImpact"></span>
              <span class="duel-damage" id="duelDamage"></span>
            </div>
            <div class="duel-line" id="duelLine">普通出招不改星星；后面再加识字蓄力。</div>
          </section>
          ${renderPanel("right", weapons)}
        </div>
        <div class="duel-actions">
          <button class="soft-button" data-duel-action="swap">左右换人</button>
          <button class="primary-button" data-duel-action="reset">重新开始</button>
        </div>
      </article>
    `;
    bind(stage);
  }

  function renderPanel(side, weapons) {
    const label = side === "left" ? "左手" : "右手";
    const state = runtime[side];
    return `
      <aside class="duel-panel ${side}">
        <div class="duel-panel-title"><strong>${label}小人</strong><span>${charById(state.charId).name}</span></div>
        <select data-duel-select="${side}-char">
          ${CHARS.map((c) => `<option value="${c.id}" ${c.id === state.charId ? "selected" : ""}>${c.name}</option>`).join("")}
        </select>
        <select data-duel-select="${side}-weapon">
          ${weapons.map((w) => `<option value="${w.id}" ${w.id === state.weaponId ? "selected" : ""}>${w.name}</option>`).join("")}
        </select>
        <div class="duel-moves">
          ${MOVES.map((m) => `<button data-duel-move="${side}:${m.id}" title="${m.name}"><span>${m.icon}</span><b>${m.name}</b></button>`).join("")}
        </div>
      </aside>
    `;
  }

  function renderHp(side) {
    const st = runtime[side];
    const pct = Math.max(0, Math.round((st.hp / st.maxHp) * 100));
    return `<div class="duel-hp ${side}"><span>${charById(st.charId).name}</span><i><em style="width:${pct}%"></em></i><small>${st.hp}/${st.maxHp}</small></div>`;
  }

  function renderFighter(side) {
    const st = runtime[side];
    const c = charById(st.charId);
    const w = weaponById(st.weaponId);
    const weaponImg = w.image ? `<img class="duel-weapon" src="${w.image}" alt="">` : "";
    return `
      <div class="duel-fighter ${side} idle" id="duel-${side}">
        ${weaponImg}
        <img class="duel-sprite" src="${CUTOUT + c.file}" alt="${c.name}">
      </div>
    `;
  }

  function bind(stage) {
    stage.querySelectorAll("[data-duel-select]").forEach((select) => {
      select.addEventListener("change", () => {
        const [side, kind] = select.dataset.duelSelect.split("-");
        if (kind === "char") {
          runtime[side].charId = select.value;
          const c = charById(select.value);
          runtime[side].maxHp = c.hp;
          runtime[side].hp = c.hp;
        } else {
          runtime[side].weaponId = select.value;
        }
        persist();
        renderDuel(stage);
      });
    });

    stage.querySelectorAll("[data-duel-move]").forEach((button) => {
      button.addEventListener("click", () => {
        const [side, moveId] = button.dataset.duelMove.split(":");
        doMove(stage, side, moveId);
      });
    });

    stage.querySelector("[data-duel-action='reset']").addEventListener("click", () => {
      runtime = null;
      renderDuel(stage);
    });
    stage.querySelector("[data-duel-action='swap']").addEventListener("click", () => {
      const left = { ...runtime.left };
      runtime.left = { ...runtime.right };
      runtime.right = left;
      persist();
      renderDuel(stage);
    });
  }

  function doMove(stage, side, moveId) {
    if (runtime.locked) return;
    const attacker = runtime[side];
    const targetSide = side === "left" ? "right" : "left";
    const target = runtime[targetSide];
    const move = MOVES.find((m) => m.id === moveId) || MOVES[0];
    const fighter = stage.querySelector(`#duel-${side}`);
    const victim = stage.querySelector(`#duel-${targetSide}`);
    const line = stage.querySelector("#duelLine");
    const char = charById(attacker.charId);
    const weapon = weaponById(attacker.weaponId);

    if (attacker.bound) {
      attacker.bound = false;
      line.textContent = `${char.name}挣脱束缚，可以继续演了。`;
      return;
    }

    runtime.locked = true;
    fighter.classList.remove("idle");
    fighter.classList.add(move.cls, "acting");

    setTimeout(() => {
      let damage = Math.max(0, Math.round(move.damage + (move.damage ? char.power * 0.7 + weapon.power / 14 + Math.random() * 4 : 0)));
      if (target.shield) {
        const blocked = Math.min(target.shield, damage);
        damage = Math.max(0, damage - blocked);
        target.shield = 0;
      }
      if (move.shield) attacker.shield = move.shield;
      if (move.bind) target.bound = true;
      target.hp = Math.max(0, target.hp - damage);
      if (damage) victim.classList.add("hurt");
      showHit(stage, targetSide, damage || move.shield || 0, move.shield);
      line.textContent = `${side === "left" ? "左手" : "右手"} ${char.name} 用「${move.name}」${damage ? `打出 ${damage} 点` : "摆出架势"}。`;
      refreshDuel(stage);
    }, move.cls === "ultimate" ? 460 : 260);

    setTimeout(() => {
      fighter.classList.remove("acting", "charge", "smash", "spin", "kick", "combo", "dodge", "guard", "beam", "bind", "ultimate");
      victim.classList.remove("hurt");
      fighter.classList.add("idle");
      if (target.hp <= 0) {
        win(stage, side);
      } else {
        runtime.locked = false;
      }
    }, move.cls === "ultimate" ? 920 : 660);
  }

  function refreshDuel(stage) {
    stage.querySelector(".duel-score").innerHTML = `${renderHp("left")}<strong>战</strong>${renderHp("right")}`;
  }

  function showHit(stage, side, amount, guard) {
    const impact = stage.querySelector("#duelImpact");
    const damage = stage.querySelector("#duelDamage");
    const x = side === "left" ? "28%" : "72%";
    impact.style.left = x;
    damage.style.left = x;
    damage.textContent = guard ? `护 ${amount}` : `-${amount}`;
    damage.classList.remove("show");
    impact.classList.remove("show");
    void impact.offsetWidth;
    impact.classList.add("show");
    damage.classList.add("show");
  }

  function win(stage, side) {
    runtime.locked = true;
    const duel = ensureDuel();
    if (!duel.wins) duel.wins = { left: 0, right: 0 };
    duel.wins[side] = (duel.wins[side] || 0) + 1;
    STATE.save();
    stage.querySelector("#duelLine").textContent = `${side === "left" ? "左手" : "右手"}获胜！星星和神兵记录没有被改动。`;
    stage.querySelector(`#duel-${side}`).classList.add("win");
  }

  window.RUOGU_DUEL_SYSTEM = { renderDuel };
})();
