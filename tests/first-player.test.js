const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const engine = require('../js/engine/game.js');
const root = path.join(__dirname, '..');

test('파랑과 빨강 모두 선공할 수 있고 시작 실드는 해당 플레이어의 보드에만 배치된다', () => {
  for (const first of [0, 1]) {
    let state = engine.newGame(first);
    assert.equal(state.currentPlayer, first);
    assert.equal(state.firstPlayer, first);
    state = engine.roll(state, () => 0.3);
    assert.equal(state.pending.kind, 'start-shield');
    assert.deepEqual(engine.placementsFor(state).map(p => p.player), [first, first, first]);
    state = engine.place(state, first, 0);
    assert.equal(state.boards[first][0][0].shield, true);
    assert.equal(state.currentPlayer, 1 - first);
    state = engine.roll(state, () => 0.5);
    assert.equal(state.pending.kind, 'normal');
  }
});

test('로컬·AI 대전 모두 시작과 새 게임에서 선공을 무작위 선택한다', () => {
  const ui = fs.readFileSync(path.join(root, 'js/local-game.js'), 'utf8');
  assert.match(ui, /function randomFirstPlayer\(\)/);
  assert.match(ui, /Math\.floor\(Math\.random\(\) \* 2\)/);
  assert.equal((ui.match(/engine\.newGame\(randomFirstPlayer\(\)\)/g) || []).length, 1);
  assert.match(ui, /let state = null/);
  assert.match(ui, /el\('startMatchButton'\)\.addEventListener\('click'/);
  for (const htmlName of ['game.html', 'ai.html']) {
    const html = fs.readFileSync(path.join(root, htmlName), 'utf8');
    assert.match(html, /id="first0"/);
    assert.match(html, /id="first1"/);
  }
});
