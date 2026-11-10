const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const engine = require('../js/engine/game.js');
const ai = require('../js/ai.js');

function rewardShieldState(value) {
  const state = engine.newGame(0);
  state.currentPlayer = 1;
  state.firstShieldPending = false;
  state.phase = 'place';
  state.pending = { kind: 'reward-shield', value, rerollCandidate: null };
  return state;
}

test('새 주사위 강조는 준비칸에만 적용하고 배치된 주사위에는 적용하지 않음', () => {
  const css = fs.readFileSync(path.join(__dirname, '../css/game.css'), 'utf8');
  assert.doesNotMatch(css, /\.die\s*\{\s*animation\s*:\s*appear/);
  assert.match(css, /\.side-pending\s+\.die\.die-enter\s*\{\s*animation\s*:\s*dieEnter/);
  assert.match(css, /\.attack-fly\.from-left\s*\{[^}]*animation\s*:/);
  assert.match(css, /\.attack-removed\.to-right\s*\{[^}]*animation\s*:/);
});

test('AI 보상 실드 1은 빈 상대 보드의 칸을 차단하는 선택을 선호', () => {
  for (const difficulty of ['normal', 'hard']) {
    const state = rewardShieldState(1);
    const before = JSON.stringify(state);
    const move = ai.choosePlacement(state, difficulty, () => 0);
    assert.equal(move.player, 0);
    assert.equal(JSON.stringify(state), before);
  }
});

test('AI 보상 실드 1은 상대가 높은 주사위로 채운 라인을 방해', () => {
  const state = rewardShieldState(1);
  state.boards[0][0] = [engine.die(5), engine.die(6)];
  const move = ai.choosePlacement(state, 'hard', () => 0);
  assert.deepEqual(move, { player: 0, line: 0 });
});

test('높은 실드나 상대 조합 완성은 상황에 따라 자기 보드가 유리', () => {
  const high = rewardShieldState(6);
  assert.equal(ai.choosePlacement(high, 'hard', () => 0).player, 1);
  const matching = rewardShieldState(1);
  matching.boards[0][0] = [engine.die(1), engine.die(1)];
  const choice = ai.choosePlacement(matching, 'hard', () => 0);
  assert.notDeepEqual(choice, { player: 0, line: 0 });
});
