const test = require('node:test');
const assert = require('node:assert/strict');
const engine = require('../js/engine/game.js');
const ai = require('../js/ai.js');
const die = (value, shield = false) => engine.die(value, shield);
function prepare(value, boards) {
  const state = engine.newGame(1);
  state.firstShieldPending = false;
  state.phase = 'place';
  state.pending = { kind: 'normal', value, rerollCandidate: null };
  state.boards = boards;
  return state;
}
test('어려움 AI는 상대의 다음 눈 가능성을 고려해 배치를 다르게 평가한다', () => {
  const state = prepare(2, [
    [[die(4)], [], []],
    [[die(2, true), die(3)], [], [die(5)]]
  ]);
  // 기존 즉시점수 평가에서는 빈 두 번째 라인을 선택했으나,
  // 상대의 다음 응수를 고려하면 첫 번째 라인을 선호합니다.
  assert.deepEqual(ai.choosePlacement(state, 'hard', () => 0), { player: 1, line: 0 });
});
test('한 턴 앞 평가에서도 원본 데이터와 합법적인 배치 규칙을 유지한다', () => {
  const state = prepare(5, [
    [[die(5), die(2)], [die(6)], [die(3, true)]],
    [[die(5, true)], [die(2), die(3)], []]
  ]);
  const original = JSON.stringify(state);
  for (const rng of [0, 0.3, 0.8, 0.999]) {
    const move = ai.choosePlacement(state, 'hard', () => rng);
    assert.ok(engine.placementsFor(state).some(x => x.player === move.player && x.line === move.line));
  }
  assert.equal(JSON.stringify(state), original);
});
test('쉬움과 보통 난이도의 기존 행동은 유지한다', () => {
  const state = prepare(5, [
    [[], [], [die(5), die(5)]],
    [[], [], []]
  ]);
  assert.deepEqual(ai.choosePlacement(state, 'normal', () => 0), { player: 1, line: 2 });
  assert.ok(engine.placementsFor(state).some(x => {
    const move = ai.choosePlacement(state, 'easy', () => 0.5);
    return x.player === move.player && x.line === move.line;
  }));
});
