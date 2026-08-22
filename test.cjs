// test.cjs —— 验证 core.js 纯逻辑（node test.cjs 运行）
const assert = require('assert');
const { rand, rectOverlap, computeDangerRadius, dangerDpsAt, applyHeal, topBoard, insertScore } = require('./core.js');

// rand 落在范围内
for (let i = 0; i < 1000; i++) {
  const v = rand(0, 10);
  assert.ok(v >= 0 && v <= 10, 'rand 越界: ' + v);
}

// 矩形重叠
assert.strictEqual(rectOverlap(0, 0, 10, 5, 0, 10), true, '应重叠');
assert.strictEqual(rectOverlap(0, 0, 10, 100, 0, 10), false, '应不重叠');

// 危险区增长 + 封顶
assert.strictEqual(computeDangerRadius(30, 8, 5, 200), 70, '增长错误');
assert.strictEqual(computeDangerRadius(30, 8, 1000, 200), 200, '未封顶');

// 掉血梯度：区外为 0，区内为正
assert.strictEqual(dangerDpsAt(999, 50, 26), 0, '区外应不掉血');
assert.ok(dangerDpsAt(0, 50, 26) > dangerDpsAt(40, 50, 26) > 0, '区内伤害梯度错误');

// 回血封顶
assert.strictEqual(applyHeal(80, 25, 100), 100, '回血不应超上限');
assert.strictEqual(applyHeal(50, 25, 100), 75, '回血计算错误');

// 排行榜：排序 + 截断
assert.deepStrictEqual(topBoard([{score:10},{score:50},{score:30}], 2).map(e => e.score), [50, 30], 'topBoard 排序截断错误');

// 排行榜：插入并排名
const r = insertScore([{score:50},{score:30}], {score:40, date:'08-22'}, 3);
assert.deepStrictEqual(r.board.map(e => e.score), [50, 40, 30], '插入排序错误');
assert.strictEqual(r.rank, 2, '名次计算错误');

// 排行榜：未进榜返回 null
const r2 = insertScore([{score:100},{score:90}], {score:5}, 2);
assert.strictEqual(r2.rank, null, '未进榜应返回 null');

// 排行榜：分数门槛（低于 300 不插入，榜单不变）
const r3 = insertScore([{score:400},{score:350}], {score:299, date:'08-22'}, 8, 300);
assert.deepStrictEqual(r3.board.map(e => e.score), [400, 350], '低于门槛不应插入');
assert.strictEqual(r3.rank, null, '低于门槛 rank 应为 null');
const r4 = insertScore([{score:400},{score:350}], {score:300, date:'08-22'}, 8, 300);
assert.strictEqual(r4.rank, 3, '刚好等于门槛应计入');
assert.deepStrictEqual(r4.board.map(e => e.score), [400, 350, 300], '达到门槛应插入并排序');

console.log('core logic tests passed ✅');
