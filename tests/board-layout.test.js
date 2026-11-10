const test = require('node:test');
const assert = require('node:assert/strict');
const { groupsForLine } = require('../js/board-layout.js');
const d = (value, shield = false) => ({value, shield});
const values = groups => groups.map(g => g.dice.map(x => x.value));
test('3 → 6 → 3: 먼저 놓인 3의 자리에 중복 그룹 형성', () => {
  assert.deepEqual(values(groupsForLine([d(3), d(6), d(3)])), [[3, 3], [6]]);
});
test('6 → 3 → 3: 첫 6의 자리 보존', () => {
  assert.deepEqual(values(groupsForLine([d(6), d(3), d(3)])), [[6], [3, 3]]);
});
test('실드와 일반 주사위도 같은 숫자면 묶음', () => {
  const groups = groupsForLine([d(3, true), d(6), d(3)]);
  assert.deepEqual(values(groups), [[3,3],[6]]);
  assert.deepEqual(groups[0].dice.map(x => x.shield), [true,false]);
});
test('일반 주사위 제거 후 남은 주사위는 그룹 다시 계산', () => {
  const original = [d(3,true),d(6),d(3)];
  const remaining = original.filter(x => x.shield || x.value !== 3);
  assert.deepEqual(values(groupsForLine(remaining)), [[3],[6]]);
  assert.deepEqual(original.map(x => x.value), [3,6,3]);
});
test('같은 숫자 셋은 한 그룹', () => {
  assert.deepEqual(values(groupsForLine([d(4),d(4,true),d(4)])), [[4,4,4]]);
});
