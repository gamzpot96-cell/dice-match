const test = require('node:test');
const assert = require('node:assert/strict');
const engine = require('../js/engine/game.js');
const ai = require('../js/ai.js');
const fs = require('node:fs');
const path = require('node:path');
function prepared(value = 4) {
  const state = engine.newGame();
  state.firstShieldPending = false;
  state.currentPlayer = 1;
  return engine.roll(state, () => (value - 1) / 6);
}
test('비슷한 점수의 배치가 여러 개일 때 보통 AI는 선택을 다양화한다', () => {
  const state = prepared();
  const results = new Set([0.01, 0.28, 0.54, 0.85].map(r => ai.choosePlacement(state, 'normal', () => r).line));
  assert.ok(results.size >= 2, '선택지가 유사한데도 같은 라인만 선택함');
});
test('어려움 AI도 동등한 선택지 사이에서는 다른 수를 고른다', () => {
  const state = prepared();
  const results = new Set([0.01, 0.4, 0.9].map(r => ai.choosePlacement(state, 'hard', () => r).line));
  assert.ok(results.size >= 2);
});
test('AI 선택은 항상 게임 엔진이 허용하는 배치다', () => {
  const state = prepared(5);
  state.boards[1][2] = [engine.die(1),engine.die(2),engine.die(3)];
  for (const difficulty of ai.DIFFICULTIES) for (const r of [0,0.2,0.5,0.99]) {
    const move = ai.choosePlacement(state, difficulty, () => r);
    assert.ok(engine.placementsFor(state).some(p => p.player === move.player && p.line === move.line));
  }
});
test('AI 개선 후에도 시작 실드 공용 리롤 및 공격 보상 리롤 금지를 유지한다', () => {
  const s = engine.roll(engine.newGame(), () => 0);
  assert.equal(s.pending.kind, 'start-shield');
  assert.equal(ai.chooseRerollAction(s, 'normal'), true);
  const used = engine.reroll(s, () => 0.5);
  assert.equal(used.rerollUsed[0], true);
  used.phase = 'place';
  used.pending.kind = 'reward-shield';
  assert.equal(ai.chooseRerollAction(used, 'hard'), false);
});
test('짙은 원목 테마 및 통짜 라인/실드 테두리 규칙 유지', () => {
  const css = fs.readFileSync(path.join(__dirname, '../css/game.css'), 'utf8');
  assert.match(css, /Dark walnut tabletop/);
  assert.match(css, /\.center-divider/);
  assert.match(css, /\.dice-cluster\.matched/);
  assert.match(css, /\.die\.shield\{border:3px solid var\(--pip\)/);
});
