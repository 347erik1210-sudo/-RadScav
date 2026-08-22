// game.js —— 渲染与交互层（依赖 core.js 提供的全局函数）
(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;

  const scoreEl = document.getElementById('score');
  const timeEl = document.getElementById('time');
  const hpFill = document.getElementById('hpfill');
  const overlay = document.getElementById('overlay');
  const overlayTitle = document.getElementById('overlay-title');
  const overlayBody = document.getElementById('overlay-body');
  const startBtn = document.getElementById('start-btn');
  const boardEl = document.getElementById('board');

  const STATE = { READY: 0, PLAYING: 1, OVER: 2 };
  const DURATION = 60;     // 秒
  const SCRAP_COUNT = 8;   // 场上保持的废料数
  const SCRAP_SCORE = 10;
  const SPECIAL_RATE = 0.25;  // 特殊金色废料概率（得分 ×2，更贴近辐射区）
  const MEDKIT_COUNT = 2;  // 场上保持的回血道具数
  const MEDKIT_HEAL = 25;  // 每个回血量
  const MEDKIT_SIZE = 16;
  const MAX_HP = 100;
  const BOARD_KEY = 'radscav_board';  // 本地排行榜存储键
  const BOARD_MAX = 10;               // 榜单保留条数
  const BOARD_MIN_SCORE = 300;        // 计入榜单的最低分数门槛

  // 道具系统：血包固定 + 问号随机道具（开盲盒，效果未知）
  const DANGER_BASE_R = 36;  // 辐射区基础半径（reset 用）
  const PU_COUNT = 3;        // 场上保持的问号道具数
  const PU_SIZE = 16;
  // 随机效果池（除血包外的全部效果）
  const PU_POOL = ['boost', 'multi', 'neutral', 'trap', 'slow', 'poison'];
  const PU_LABEL = {
    boost: '加速！移速×1.8', multi: '分数翻倍！×2', neutral: '辐射中和！半径减半',
    trap: '陷阱！-30 分', slow: '减速！移速×0.5', poison: '中毒！持续掉血'
  };
  const BOOST_DUR = 4;   const BOOST_MULT = 1.8;  // 加速
  const MULTI_DUR = 5;   const MULTI_FACTOR = 2;  // 分数翻倍
  const SLOW_DUR = 3;    const SLOW_MULT = 0.5;   // 减速
  const POISON_DUR = 4;  const POISON_DPS = 8;    // 中毒（每秒掉血）
  const TRAP_PENALTY = 30;                        // 陷阱扣分（≈3 块普通废料）

  let state = STATE.READY;
  let score = 0, hp = 100, timeLeft = DURATION, elapsed = 0, lastTs = 0;
  let collected = 0; // 本局收集废料总数（含特殊，用于结算显示）
  let player, scraps, medkits, powerups, danger, keys = {};
  let boostLeft = 0, multiLeft = 0, slowLeft = 0, poisonLeft = 0; // 增益/减益剩余时间（秒）
  let lastMsg = '', lastMsgLeft = 0; // 最近开到的随机效果提示

  function reset() {
    score = 0; hp = 100; timeLeft = DURATION; elapsed = 0; collected = 0;
    player = { x: W / 2, y: H - 60, size: 20, speed: 2.5 };
    danger = { cx: rand(120, W - 120), cy: rand(120, H - 120), r: DANGER_BASE_R, growth: 9, maxR: Math.min(W, H) * 0.46 };
    scraps = [];
    medkits = [];
    powerups = [];
    boostLeft = 0; multiLeft = 0; slowLeft = 0; poisonLeft = 0;
    lastMsg = ''; lastMsgLeft = 0;
    for (let i = 0; i < SCRAP_COUNT; i++) scraps.push(spawnScrap());
    for (let i = 0; i < MEDKIT_COUNT; i++) medkits.push(spawnMedkit());
    for (let i = 0; i < PU_COUNT; i++) powerups.push(spawnPowerup());
    updateHud();
    renderBoard();
  }

  function spawnScrap() {
    // 普通废料偏向危险区边缘；特殊金色废料更贴近辐射区中心（越深回报越高，风险也越高）
    const special = Math.random() < SPECIAL_RATE;
    let x, y;
    if (special) {
      // 特殊废料：100% 落在危险区内部（0.25~0.8×r），越靠近中心越稀有
      const ang = rand(0, Math.PI * 2);
      const dist = danger.r * rand(0.25, 0.8);
      x = danger.cx + Math.cos(ang) * dist;
      y = danger.cy + Math.sin(ang) * dist;
    } else if (Math.random() < 0.55) {
      // 普通废料：55% 偏向危险区边缘（0.9~1.3×r）
      const ang = rand(0, Math.PI * 2);
      const dist = danger.r * rand(0.9, 1.3);
      x = danger.cx + Math.cos(ang) * dist;
      y = danger.cy + Math.sin(ang) * dist;
    } else {
      x = rand(20, W - 20);
      y = rand(20, H - 20);
    }
    x = Math.max(20, Math.min(W - 20, x));
    y = Math.max(20, Math.min(H - 20, y));
    return { x, y, size: special ? 16 : 14, special };
  }

  // 回血道具：偏向安全区（距危险区中心较远的环形区域），强化"冒险后回安全区补血"的权衡
  function spawnMedkit() {
    let x, y, ok = false, tries = 0;
    do {
      x = rand(30, W - 30);
      y = rand(30, H - 30);
      const dist = Math.hypot(x - danger.cx, y - danger.cy);
      ok = dist > danger.r * 1.35;
      tries++;
    } while (!ok && tries < 12);
    return { x, y, size: MEDKIT_SIZE };
  }

  // 问号随机道具：全图均匀随机生成，不设区域偏好
  function spawnPowerup() {
    return { x: rand(20, W - 20), y: rand(20, H - 20), size: PU_SIZE, type: 'mystery' };
  }

  // 应用随机效果（除血包外的全部效果）
  function applyEffect(t) {
    if (t === 'boost') boostLeft = BOOST_DUR;
    else if (t === 'multi') multiLeft = MULTI_DUR;
    else if (t === 'neutral') danger.r = danger.r / 2;
    else if (t === 'trap') score = Math.max(0, score - TRAP_PENALTY);
    else if (t === 'slow') slowLeft = SLOW_DUR;
    else if (t === 'poison') poisonLeft = POISON_DUR;
    lastMsg = PU_LABEL[t] || '';
    lastMsgLeft = 2;
  }

  function start() {
    reset();
    state = STATE.PLAYING;
    overlay.style.display = 'none';
    lastTs = performance.now();
  }

  function gameOver() {
    state = STATE.OVER;
    const { board, rank } = insertScore(loadBoard(), { score: score, date: todayStamp() }, BOARD_MAX, BOARD_MIN_SCORE);
    saveBoard(board);
    overlayTitle.textContent = '时间到 / 阵亡';
    let rankLine;
    if (score < BOARD_MIN_SCORE) rankLine = '未达 ' + BOARD_MIN_SCORE + ' 分，未计入榜单　';
    else rankLine = rank ? ('本局名次 <b>#' + rank + '</b>　') : '未进榜（榜单已满）　';
    overlayBody.innerHTML = '本次得分 <b>' + score + '</b>　（收集废料 ' + collected + ' 个）<br>' + rankLine + '核心循环：探索 → 风险决策 → 回报';
    startBtn.textContent = '再玩一次';
    renderBoard(rank);
    overlay.style.display = 'flex';
  }

  function update(dt) {
    // 移动
    let dx = 0, dy = 0;
    if (keys['arrowleft'] || keys['a']) dx -= 1;
    if (keys['arrowright'] || keys['d']) dx += 1;
    if (keys['arrowup'] || keys['w']) dy -= 1;
    if (keys['arrowdown'] || keys['s']) dy += 1;
    if (dx && dy) { dx *= 0.707; dy *= 0.707; }
    const sp = player.speed
      * (boostLeft > 0 ? BOOST_MULT : 1)
      * (slowLeft > 0 ? SLOW_MULT : 1);
    player.x = Math.max(10, Math.min(W - 10, player.x + dx * sp));
    player.y = Math.max(10, Math.min(H - 10, player.y + dy * sp));

    // 增益/减益计时
    if (boostLeft > 0) boostLeft = Math.max(0, boostLeft - dt);
    if (multiLeft > 0) multiLeft = Math.max(0, multiLeft - dt);
    if (slowLeft > 0) slowLeft = Math.max(0, slowLeft - dt);
    if (poisonLeft > 0) poisonLeft = Math.max(0, poisonLeft - dt);
    if (lastMsgLeft > 0) lastMsgLeft = Math.max(0, lastMsgLeft - dt);

    // 危险区扩张
    elapsed += dt;
    timeLeft -= dt;
    danger.r = computeDangerRadius(danger.r, danger.growth, dt, danger.maxR);

    // 伤害判定（危险区 + 中毒持续掉血）
    const dist = Math.hypot(player.x - danger.cx, player.y - danger.cy);
    hp -= dangerDpsAt(dist, danger.r, 26) * dt;
    if (poisonLeft > 0) hp -= POISON_DPS * dt;

    // 收集废料（特殊金色 ×2；翻倍状态再 ×2）
    for (let i = scraps.length - 1; i >= 0; i--) {
      if (rectOverlap(player.x, player.y, player.size, scraps[i].x, scraps[i].y, scraps[i].size)) {
        const base = scraps[i].special ? SCRAP_SCORE * 2 : SCRAP_SCORE;
        score += base * (multiLeft > 0 ? MULTI_FACTOR : 1);
        collected++;
        scraps[i] = spawnScrap();
      }
    }

    // 拾取回血道具
    for (let i = medkits.length - 1; i >= 0; i--) {
      if (rectOverlap(player.x, player.y, player.size, medkits[i].x, medkits[i].y, medkits[i].size)) {
        hp = applyHeal(hp, MEDKIT_HEAL, MAX_HP);
        medkits[i] = spawnMedkit();
      }
    }

    // 拾取问号随机道具：开盲盒，随机获得一种效果
    for (let i = powerups.length - 1; i >= 0; i--) {
      if (rectOverlap(player.x, player.y, player.size, powerups[i].x, powerups[i].y, powerups[i].size)) {
        const t = PU_POOL[Math.floor(Math.random() * PU_POOL.length)];
        applyEffect(t);
        powerups[i] = spawnPowerup();
      }
    }

    if (hp <= 0) { hp = 0; gameOver(); }
    if (timeLeft <= 0) { timeLeft = 0; gameOver(); }
    updateHud();
  }

  function updateHud() {
    scoreEl.textContent = score;
    timeEl.textContent = Math.ceil(timeLeft) + 's';
    hpFill.style.width = hp + '%';
    hpFill.style.background = hp > 40 ? '#3ad07a' : (hp > 20 ? '#e0b341' : '#e0503a');
  }

  // 本地排行榜读写（容错，localStorage 不可用时降级为空；低于门槛的历史记录自动过滤）
  function loadBoard() {
    try {
      const raw = localStorage.getItem(BOARD_KEY);
      if (!raw) return [];
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr)) return [];
      return arr.filter(e => e && typeof e.score === 'number' && e.score >= BOARD_MIN_SCORE);
    } catch (e) { return []; }
  }
  function saveBoard(board) {
    try { localStorage.setItem(BOARD_KEY, JSON.stringify(board)); } catch (e) {}
  }
  function todayStamp() {
    const d = new Date();
    const p = n => String(n).padStart(2, '0');
    return p(d.getMonth() + 1) + '-' + p(d.getDate());
  }
  function renderBoard(thisRank) {
    const board = loadBoard();
    const title = '本地排行榜 · TOP ' + BOARD_MAX + '（' + BOARD_MIN_SCORE + ' 分以上）';
    if (!board.length) {
      boardEl.innerHTML = '<div class="board-title">' + title + '（暂无记录，快来抢占第一）</div>';
      return;
    }
    let html = '<div class="board-title">' + title + '</div><ol class="board-list">';
    board.forEach((e, i) => {
      const me = (thisRank && thisRank === i + 1) ? ' me' : '';
      html += '<li class="board-row' + me + '"><span class="rk">' + (i + 1) + '</span>'
        + '<span class="sc">' + e.score + '</span>'
        + '<span class="dt">' + (e.date || '') + '</span></li>';
    });
    html += '</ol>';
    boardEl.innerHTML = html;
  }

  function render() {
    ctx.fillStyle = '#0e1116';
    ctx.fillRect(0, 0, W, H);

    // 危险区（颜色随半径加深）
    const intensity = 0.10 + (danger.r / danger.maxR) * 0.30;
    ctx.fillStyle = 'rgba(224,80,58,' + intensity.toFixed(3) + ')';
    ctx.beginPath();
    ctx.arc(danger.cx, danger.cy, danger.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(224,80,58,0.7)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // 废料（普通=黄色方块；特殊=金色菱形+白描边，得分 ×2 且更贴近辐射区）
    for (const s of scraps) {
      ctx.save();
      if (s.special) {
        ctx.translate(s.x, s.y);
        ctx.rotate(Math.PI / 4);
        ctx.fillStyle = '#ffd24a';
        ctx.fillRect(-s.size / 2, -s.size / 2, s.size, s.size);
        ctx.strokeStyle = '#fff3c4';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(-s.size / 2, -s.size / 2, s.size, s.size);
      } else {
        ctx.fillStyle = '#e6c84f';
        ctx.fillRect(s.x - s.size / 2, s.y - s.size / 2, s.size, s.size);
      }
      ctx.restore();
    }

    // 回血道具（绿色十字）
    for (const m of medkits) {
      ctx.fillStyle = '#3ad07a';
      const cx = m.x, cy = m.y, t = m.size / 2.6, w = m.size / 3.4;
      ctx.fillRect(cx - t, cy - w / 2, t * 2, w);
      ctx.fillRect(cx - w / 2, cy - t, w, t * 2);
    }

    // 问号随机道具（开盲盒，效果未知）
    for (const p of powerups) {
      ctx.fillStyle = '#cfd8e3';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#070a0f';
      ctx.font = 'bold 15px system-ui';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('?', p.x, p.y);
    }

    // 玩家
    ctx.fillStyle = '#5ab4ff';
    ctx.fillRect(player.x - player.size / 2, player.y - player.size / 2, player.size, player.size);

    // 增益状态（蓝，顶部第一行）
    let posTxt = '';
    if (boostLeft > 0) posTxt += '加速 ' + boostLeft.toFixed(1) + 's  ';
    if (multiLeft > 0) posTxt += '翻倍 ' + multiLeft.toFixed(1) + 's';
    if (posTxt) {
      ctx.fillStyle = '#5ab4ff';
      ctx.font = 'bold 14px system-ui';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(posTxt, W / 2, 8);
    }
    // 减益状态（红，顶部第二行）
    let negTxt = '';
    if (slowLeft > 0) negTxt += '减速 ' + slowLeft.toFixed(1) + 's  ';
    if (poisonLeft > 0) negTxt += '中毒 ' + poisonLeft.toFixed(1) + 's';
    if (negTxt) {
      ctx.fillStyle = '#e0503a';
      ctx.font = 'bold 14px system-ui';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(negTxt, W / 2, 28);
    }
    // 最近开到的随机效果提示（白，顶部第三行）
    if (lastMsgLeft > 0 && lastMsg) {
      ctx.fillStyle = '#e6edf3';
      ctx.font = 'bold 16px system-ui';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(lastMsg, W / 2, 48);
    }
  }

  function loop(ts) {
    const dt = Math.min((ts - lastTs) / 1000, 0.05);
    lastTs = ts;
    if (state === STATE.PLAYING) update(dt);
    render();
    requestAnimationFrame(loop);
  }

  window.addEventListener('keydown', e => { keys[e.key.toLowerCase()] = true; });
  window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
  startBtn.addEventListener('click', start);

  reset();
  requestAnimationFrame(loop);
})();
