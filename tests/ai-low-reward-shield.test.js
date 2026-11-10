const test = require('node:test');
const assert = require('node:assert/strict');
const engine = require('../js/engine/game.js');
const ai = require('../js/ai.js');
function reward(value) {
  const state = engine.newGame(0);
  state.currentPlayer = 1;
  state.firstShieldPending = false;
  state.phase = 'place';
  state.pending = { kind: 'reward-shield', value, rerollCandidate: null };
  return state;
}
const die = (value, shield = false) => engine.die(value, shield);

test('보상 실드 2: 자기 필드에 2가 이미 있어도 상대 방해 칸을 우선한다', () => {
  const state = reward(2);
  state.boards[1][0] = [die(2)];
  const original = JSON.stringify(state);
  for (const difficulty of ['normal', 'hard']) {
    for (const rng of [0, 0.23, 0.75, 0.999]) {
      const move = ai.choosePlacement(state, difficulty, () => rng);
      assert.equal(move.player, 0, `${difficulty}: 자기 필드 배치가 선택됨`);
      assert.ok(engine.placementsFor(state).some(m => m.player === move.player && m.line === move.line));
    }
  }
  assert.equal(JSON.stringify(state), original);
});

test('보상 실드 2: 상대 기존 2와 합쳐 점수를 올려주는 칸은 피한다', () => {
  const state = reward(2);
  state.boards[0][0] = [die(2), die(5)];
  state.boards[0][1] = [die(2), die(6)];
  state.boards[0][2] = [die(4), die(6)];
  for (const difficulty of ['normal', 'hard']) for (const rng of [0, 0.7, 0.999]) {
    assert.deepEqual(ai.choosePlacement(state, difficulty, () => rng), { player: 0, line: 2 });
  }
});

test('보상 실드 2: 상대의 안전한 칸이 없으면 기존 합법 수에서 선택한다', () => {
  const state = reward(2);
  state.boards[0] = [[die(2)], [die(2)], [die(2)]];
  for (const difficulty of ['normal', 'hard']) {
    const move = ai.choosePlacement(state, difficulty, () => 0.5);
    assert.ok(engine.placementsFor(state).some(m => m.player === move.player && m.line === move.line));
  }
});

test('보상 실드 3: 상대 칸 방해를 추가 고려하되 강제하지 않는다', () => {
  const state = reward(3);
  const move = ai.choosePlacement(state, 'hard', () => 0);
  assert.ok(engine.placementsFor(state).some(m => m.player === move.player && m.line === move.line));
});
