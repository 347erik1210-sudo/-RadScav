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

// 排行榜：按分数降序排序并截断到 max
function topBoard(scores, max) {
  return scores.slice().sort((a, b) => b.score - a.score).slice(0, max);
}

// 将本局成绩插入榜单，返回新榜单与本局名次（未进榜返回 null）
// entry 形如 { score, date }；元素为浅拷贝引用，indexOf 可定位本局
// minScore > 0 时，低于门槛的成绩不插入榜单（rank 为 null）
function insertScore(scores, entry, max, minScore) {
  if (minScore != null && entry.score < minScore) {
    return { board: scores.slice(), rank: null };
  }
  const board = topBoard(scores.concat([entry]), max);
  const idx = board.indexOf(entry);
  return { board, rank: idx >= 0 ? idx + 1 : null };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { rand, rectOverlap, computeDangerRadius, dangerDpsAt, applyHeal, topBoard, insertScore };
}
