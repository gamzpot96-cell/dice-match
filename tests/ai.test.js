const test = require('node:test');
const assert = require('node:assert/strict');
const game = require('../js/engine/game.js');
const ai = require('../js/ai.js');
const die = (value, shield = false) => game.die(value, shield);
const fixed = x => () => x;
function prepared(value = 5) {
  const state = game.newGame();
  state.firstShieldPending = false;
  state.currentPlayer = 1;
  return game.roll(state, fixed((value - 1) / 6));
}
test('AI 난이도 3종 제공 및 유효하지 않은 난이도 거부', () => {
  assert.deepEqual(ai.DIFFICULTIES, ['easy','normal','hard']);
  assert.throws(() => ai.choosePlacement(prepared(), 'invalid'));
});
test('쉬움 AI: 유효한 라인만 선택하고 난수로 선택', () => {
  const state = prepared();
  state.boards[1][1] = [die(1),die(2),die(3)];
  const move = ai.choosePlacement(state, 'easy', fixed(0.9));
  assert.ok(game.placementsFor(state).some(p => p.player === move.player && p.line === move.line));
  assert.notEqual(move.line, 1);
});
test('보통 AI: 공격할 수 있으면 공격할 수 있는 라인 우선', () => {
  const state = prepared(5);
  state.boards[0][2] = [die(5),die(5)];
  const choice = ai.choosePlacement(state, 'normal', fixed(0));
  assert.deepEqual(choice, {player:1,line:2});
});
test('어려움 AI: 높은 점수 유리한 자리 우선', () => {
  const state = prepared(6);
  state.boards[1][0] = [die(6),die(6)];
  const choice = ai.choosePlacement(state, 'hard', fixed(0));
  assert.deepEqual(choice, {player:1,line:0});
});
test('보상 실드: 상대 보드에 놓을 수도 있음', () => {
  const state = prepared();
  state.pending = {kind:'reward-shield',value:1,rerollCandidate:null};
  const choice = ai.choosePlacement(state,'hard',fixed(0));
  assert.ok(game.placementsFor(state).some(p => p.player===choice.player && p.line===choice.line));
});
test('보통 AI 리롤: 작은 눈만 리롤, 사용했다면 다시 사용하지 않음', () => {
  const s = prepared(1);
  assert.equal(ai.chooseRerollAction(s,'normal'),true);
  s.rerollUsed[1] = true;
  assert.equal(ai.chooseRerollAction(s,'normal'),false);
  s.rerollUsed[1] = false;
  s.pending.kind = 'reward-shield';
  assert.equal(ai.chooseRerollAction(s,'normal'),false);
});
test('AI 리롤 선택: 기존 눈과 새 눈을 평가', () => {
  let state = prepared(1);
  state = game.reroll(state, fixed(5/6));
  assert.equal(ai.chooseRerollResult(state,'normal'),true);
  assert.equal(ai.chooseRerollResult(state,'hard'),true);
});
test('AI 판단은 원본 게임 상태를 변경하지 않음', () => {
  const state = prepared(4);
  const before = JSON.stringify(state);
  ai.choosePlacement(state,'hard',fixed(0));
  ai.chooseRerollAction(state,'hard');
  assert.equal(JSON.stringify(state),before);
});
