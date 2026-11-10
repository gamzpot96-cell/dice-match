const test = require('node:test');
const assert = require('node:assert/strict');
const game = require('../js/engine/game.js');
const r = n => () => (n - 1) / 6;
const as = (values, shield = false) => values.map(n => game.die(n, shield));
function start() {
  let s = game.newGame();
  s = game.roll(s, r(2));
  s = game.place(s, 0, 0);
  return s;
}
test('점수 v1.1: 같은 숫자 1/2/3개, 혼합 및 실드 조합', () => {
  assert.equal(game.scoreLine(as([4])), 4);
  assert.equal(game.scoreLine(as([4, 4])), 12);
  assert.equal(game.scoreLine(as([4, 4, 4])), 20);
  assert.equal(game.scoreLine(as([5, 5, 5])), 25);
  assert.equal(game.scoreLine(as([6, 6, 6])), 30);
  assert.equal(game.scoreLine([game.die(2), game.die(2, true), game.die(6)]), 12);
});
test('선공자 첫 턴은 실드만 자기 보드에 놓고 후공으로 넘김', () => {
  let s = game.newGame(1);
  s = game.roll(s, r(3));
  assert.equal(s.pending.kind, 'start-shield');
  assert.deepEqual(game.placementsFor(s).map(p => p.player), [1, 1, 1]);
  assert.equal(s.rerollUsed[1], false);
  s = game.place(s, 1, 2);
  assert.deepEqual(s.boards[1][2], [game.die(3, true)]);
  assert.equal(s.currentPlayer, 0);
  assert.equal(s.phase, 'roll');
});
test('공격은 같은 라인의 동일 숫자 일반 주사위를 전부 제거, 공격 주사위도 남지 않음', () => {
  let s = start();
  s.boards[0][1] = [game.die(5), game.die(5), game.die(5, true)];
  s = game.roll(s, r(5));
  s = game.place(s, 1, 1, r(4));
  assert.equal(s.lastAction.removed, 2);
  assert.deepEqual(s.boards[0][1], [game.die(5, true)]);
  assert.deepEqual(s.boards[1][1], []);
  assert.equal(s.pending.kind, 'reward-shield');
  assert.equal(s.pending.value, 4);
  assert.equal(s.currentPlayer, 1);
  s = game.place(s, 0, 1);
  assert.deepEqual(s.boards[0][1], [game.die(5, true), game.die(4, true)]);
  assert.equal(s.currentPlayer, 0);
});
test('일반 주사위를 빈칸에 놓으면 다음 턴으로 넘어감', () => {
  let s = start();
  s = game.roll(s, r(6));
  s = game.place(s, 1, 0);
  assert.deepEqual(s.boards[1][0], [game.die(6)]);
  assert.equal(s.currentPlayer, 0);
});
test('리롤 1회만: 기존/새 눈 선택 및 보상 실드 리롤 금지', () => {
  let s = start();
  s = game.roll(s, r(1));
  s = game.reroll(s, r(6));
  assert.equal(s.phase, 'choose-reroll');
  s = game.chooseReroll(s, false);
  assert.equal(s.pending.value, 1);
  assert.throws(() => game.reroll(s, r(5)));
  s = game.place(s, 1, 0);
  s = game.roll(s, r(3));
  s = game.place(s, 0, 1);
  s = game.roll(s, r(4));
  assert.throws(() => game.reroll(s, r(6)));
});
test('라인에 빈칸이 없으면 해당 라인 공격 불가', () => {
  let s = start();
  s.boards[1][1] = as([1, 2, 3]);
  s.boards[0][1] = as([5]);
  s = game.roll(s, r(5));
  assert.throws(() => game.place(s, 1, 1, r(6)));
});
test('자기 보드가 가득 차면 건너뛰고 빈칸이 있는 상대에게 턴', () => {
  let s = start();
  s.boards[0] = [as([1,2,3]),as([1,2,3]),as([1,2,3])];
  s = game.roll(s, r(4));
  s = game.place(s, 1, 0);
  assert.equal(s.currentPlayer, 1);
  assert.equal(s.phase, 'roll');
});
test('양쪽 보드가 전부 찬 경우 턴 완료 뒤 종료', () => {
  let s = start();
  s.boards[0] = [as([1,2,3]),as([1,2,3]),as([1,2,3])];
  s.boards[1] = [as([2,3]),as([1,2,3]),as([1,2,3])];
  s = game.roll(s, r(6));
  s = game.place(s, 1, 0);
  assert.equal(s.phase, 'finished');
  assert.ok(s.result);
});
test('실드 배치는 공격을 연쇄 발생시키지 않음', () => {
  let s = start();
  s.boards[0][0].push(game.die(5));
  s = game.roll(s, r(5));
  s = game.place(s, 1, 0, r(5));
  s = game.place(s, 0, 0);
  assert.deepEqual(s.boards[0][0], [game.die(2, true), game.die(5, true)]);
});
test('최종 승리 우선순위: 라인승 > 총점 > 최고라인 > 무승부', () => {
  const s = game.newGame();
  s.boards[0] = [as([6]),as([6]),as([1])];
  s.boards[1] = [as([5]),as([5]),as([5])];
  assert.equal(game.resultFor(s).winner, 0);
  s.boards[0] = [as([6]),as([1]),as([3])];
  s.boards[1] = [as([1]),as([6]),as([2])];
  assert.equal(game.resultFor(s).winner, 0);
  s.boards[0] = [as([6]),as([1]),as([3])];
  s.boards[1] = [as([5]),as([2]),as([3])];
  assert.equal(game.resultFor(s).winner, 0);
  s.boards[1] = [as([1]),as([6]),as([3])];
  assert.equal(game.resultFor(s).isDraw, true);
});
test('원본 상태를 직접 변경하지 않음', () => {
  const state = start();
  const original = JSON.stringify(state);
  game.roll(state, r(3));
  assert.equal(JSON.stringify(state), original);
});

test('선공자 시작 실드 리롤은 공용 기회 1회를 사용하고 일반 턴에서 다시 사용할 수 없음', () => {
  let s = game.newGame();
  s = game.roll(s, r(2));
  s = game.reroll(s, r(6));
  assert.equal(s.rerollUsed[0], true);
  s = game.chooseReroll(s, true);
  assert.equal(s.pending.value, 6);
  s = game.place(s, 0, 1);
  assert.equal(s.boards[0][1][0].value, 6);
  s = game.roll(s, r(3));
  s = game.place(s, 1, 0);
  s = game.roll(s, r(4));
  assert.throws(() => game.reroll(s, r(5)), /이미 사용/);
});
test('시작 실드 리롤을 아끼면 나중에 일반 주사위에서 사용 가능', () => {
  let s = game.newGame();
  s = game.roll(s, r(1));
  s = game.place(s, 0, 0);
  s = game.roll(s, r(2));
  s = game.place(s, 1, 0);
  s = game.roll(s, r(1));
  s = game.reroll(s, r(5));
  assert.equal(s.rerollUsed[0], true);
});
test('공격 보상 실드에는 남은 리롤 기회가 있어도 사용할 수 없음', () => {
  let s = game.newGame();
  s = game.roll(s, r(2));
  s = game.place(s, 0, 0);
  s.boards[0][1] = [game.die(5)];
  s = game.roll(s, r(5));
  s = game.place(s, 1, 1, r(3));
  assert.equal(s.pending.kind, 'reward-shield');
  assert.throws(() => game.reroll(s, r(4)), /시작 실드/);
});
