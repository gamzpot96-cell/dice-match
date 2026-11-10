const test = require('node:test');
const assert = require('node:assert/strict');
const engine = require('../js/engine/game.js');

function startShield(value) {
  let state = engine.newGame(0);
  state = engine.roll(state, () => (value - 0.5) / 6);
  return state;
}

test('시작 실드 리롤은 1~6 모든 경우에서 기존 숫자와 달라야 함', () => {
  for (let original = 1; original <= 6; original++) {
    for (let i = 0; i < 5; i++) {
      const state = engine.reroll(startShield(original), () => (i + 0.5) / 5);
      assert.notEqual(state.pending.rerollCandidate, original);
      assert.ok(state.pending.rerollCandidate >= 1 && state.pending.rerollCandidate <= 6);
      assert.equal(state.pending.kind, 'start-shield');
      assert.equal(state.rerollUsed[0], true);
    }
  }
});

test('각 기존 숫자에 대해 나머지 다섯 숫자를 모두 생성 가능', () => {
  for (let original = 1; original <= 6; original++) {
    const result = new Set();
    for (let i = 0; i < 5; i++) {
      result.add(engine.reroll(startShield(original), () => (i + 0.5) / 5).pending.rerollCandidate);
    }
    assert.deepEqual([...result].sort((a,b) => a-b), [1,2,3,4,5,6].filter(n => n !== original));
  }
});

test('일반 주사위 역시 중복 없이 리롤하며 기존 숫자는 선택 가능', () => {
  let state = startShield(2);
  state = engine.place(state, 0, 0);
  state = engine.roll(state, () => 0); // 후공 일반 주사위 1
  state = engine.reroll(state, () => 0);
  assert.equal(state.pending.value, 1);
  assert.equal(state.pending.rerollCandidate, 2);
  state = engine.chooseReroll(state, false);
  assert.equal(state.pending.value, 1);
  assert.equal(state.rerollUsed[1], true);
});
