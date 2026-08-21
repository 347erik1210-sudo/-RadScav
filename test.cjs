// test.cjs —— 验证 core.js 纯逻辑（node test.cjs 运行）
const assert = require('assert');
const { rand, rectOverlap, computeDangerRadius, dangerDpsAt, applyHeal } = require('./core.js');

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

console.log('core logic tests passed ✅');
