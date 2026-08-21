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

  const STATE = { READY: 0, PLAYING: 1, OVER: 2 };
  const DURATION = 60;     // 秒
  const SCRAP_COUNT = 8;   // 场上保持的废料数
  const SCRAP_SCORE = 10;
  const MEDKIT_COUNT = 2;  // 场上保持的回血道具数
  const MEDKIT_HEAL = 25;  // 每个回血量
  const MEDKIT_SIZE = 16;
  const MAX_HP = 100;

  let state = STATE.READY;
  let score = 0, hp = 100, timeLeft = DURATION, elapsed = 0, lastTs = 0;
  let player, scraps, medkits, danger, keys = {};

  function reset() {
    score = 0; hp = 100; timeLeft = DURATION; elapsed = 0;
    player = { x: W / 2, y: H - 60, size: 20, speed: 4 };
    danger = { cx: rand(120, W - 120), cy: rand(120, H - 120), r: 36, growth: 9, maxR: Math.min(W, H) * 0.46 };
    scraps = [];
    medkits = [];
    for (let i = 0; i < SCRAP_COUNT; i++) scraps.push(spawnScrap());
    for (let i = 0; i < MEDKIT_COUNT; i++) medkits.push(spawnMedkit());
    updateHud();
  }

  function spawnScrap() {
    // 偏向危险区边缘生成，制造"高风险高回报"
    const edge = danger.cx + rand(-1, 1) * danger.r * 1.15;
    let x = rand(20, W - 20);
    let y = rand(20, H - 20);
    if (Math.random() < 0.55) {
      const ang = rand(0, Math.PI * 2);
      const dist = danger.r * rand(0.9, 1.3);
      x = danger.cx + Math.cos(ang) * dist;
      y = danger.cy + Math.sin(ang) * dist;
      x = Math.max(20, Math.min(W - 20, x));
      y = Math.max(20, Math.min(H - 20, y));
    }
    return { x, y, size: 14 };
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

  function start() {
    reset();
    state = STATE.PLAYING;
    overlay.style.display = 'none';
    lastTs = performance.now();
  }

  function gameOver() {
    state = STATE.OVER;
    overlayTitle.textContent = '时间到 / 阵亡';
    overlayBody.innerHTML = '本次得分 <b>' + score + '</b>　（收集废料 ' + (score / SCRAP_SCORE) + ' 个）<br>核心循环：探索 → 风险决策 → 回报';
    startBtn.textContent = '再玩一次';
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
    player.x = Math.max(10, Math.min(W - 10, player.x + dx * player.speed));
    player.y = Math.max(10, Math.min(H - 10, player.y + dy * player.speed));

    // 危险区扩张
    elapsed += dt;
    timeLeft -= dt;
    danger.r = computeDangerRadius(danger.r, danger.growth, dt, danger.maxR);

    // 伤害判定
    const dist = Math.hypot(player.x - danger.cx, player.y - danger.cy);
    hp -= dangerDpsAt(dist, danger.r, 26) * dt;

    // 收集废料
    for (let i = scraps.length - 1; i >= 0; i--) {
      if (rectOverlap(player.x, player.y, player.size, scraps[i].x, scraps[i].y, scraps[i].size)) {
        score += SCRAP_SCORE;
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

    // 废料
    ctx.fillStyle = '#e6c84f';
    for (const s of scraps) {
      ctx.fillRect(s.x - s.size / 2, s.y - s.size / 2, s.size, s.size);
    }

    // 回血道具（绿色十字）
    for (const m of medkits) {
      ctx.fillStyle = '#3ad07a';
      const cx = m.x, cy = m.y, t = m.size / 2.6, w = m.size / 3.4;
      ctx.fillRect(cx - t, cy - w / 2, t * 2, w);
      ctx.fillRect(cx - w / 2, cy - t, w, t * 2);
    }

    // 玩家
    ctx.fillStyle = '#5ab4ff';
    ctx.fillRect(player.x - player.size / 2, player.y - player.size / 2, player.size, player.size);
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
