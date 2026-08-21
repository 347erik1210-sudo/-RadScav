// core.js —— 纯逻辑层（不依赖 DOM，可单独用 node 测试）
// 用普通 <script> 加载，浏览器里把函数挂到全局；node 里用 module.exports 导出

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

// 轴对齐矩形重叠判定（用中心点 + 边长表示）
function rectOverlap(ax, ay, as, bx, by, bs) {
  return Math.abs(ax - bx) * 2 < (as + bs) && Math.abs(ay - by) * 2 < (as + bs);
}

// 辐射危险区半径随时间增长（带封顶）
function computeDangerRadius(baseR, growthPerSec, elapsedSec, maxR) {
  const r = baseR + growthPerSec * elapsedSec;
  return Math.min(r, maxR);
}

// 危险区对玩家的每秒掉血量（越深入中心越疼）
function dangerDpsAt(dist, dangerR, baseDps) {
  if (dist >= dangerR) return 0;
  return baseDps * (1 - dist / dangerR + 0.4); // 中心附近伤害更高
}

// 回血：不超过上限
function applyHeal(hp, heal, maxHp) {
  return Math.min(maxHp, hp + heal);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { rand, rectOverlap, computeDangerRadius, dangerDpsAt, applyHeal };
}
