const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(root,p),'utf8');

test('전체 밝은 나무 배경 복원, 어두운 나무는 세 라인에만 적용', () => {
  const theme = read('css/theme.css');
  const css = read('css/game.css');
  assert.doesNotMatch(theme, /Walnut table background/);
  assert.match(theme, /linear-gradient\(115deg,#b78856,#a46f40 55%,#be915d\)/);
  assert.match(css, /Board surface v1\.3/);
  assert.match(css, /\.line-row\{\s*background:[\s\S]*?#86502d,#65371e 62%,#4d2815/);
  assert.match(css, /\.board-frame\{\s*background:[\s\S]*?#efd5aa,#d7ad76/);
});

test('AI·로컬 리롤 비교는 별도 하단 박스 없이 준비 칸 안에 만든다', () => {
  for (const file of ['game.html','ai.html']) {
    const html = read(file);
    for (const id of ['pending0','pending1']) assert.match(html,new RegExp(`id="${id}"`));
    assert.doesNotMatch(html,/id="rerollChoice"/);
  }
  const ui=read('js/local-game.js');
  assert.match(ui,/side-die-choice/);
  assert.match(ui,/engine\.chooseReroll\(state, useNew\)/);
  assert.match(ui,/state\.pending\.rerollCandidate/);
  assert.match(ui,/state\.pending\.kind === 'start-shield'/);
});

test('라인은 주사위 3개씩 들어갈 폭으로 줄이고 중앙 점수 브리지를 사용한다', () => {
  const css = read('css/game.css');
  assert.match(css, /width:min\(100%,560px\)/);
  assert.match(css, /line-score-bridge/);
  assert.match(css, /score-arrow/);
  const ui = read('js/local-game.js');
  assert.match(ui, /compareSymbol/);
  assert.match(ui, /line-score-bridge/);
});

test('플레이어별 현재 주사위 슬롯과 공격 밀쳐내기 애니메이션이 있다', () => {
  for (const file of ['game.html', 'ai.html']) {
    const html = read(file);
    assert.match(html, /id="pending0"/);
    assert.match(html, /id="pending1"/);
  }
  const css = read('css/game.css');
  for (const token of ['attack-layer', 'attack-fly', 'attack-removed', 'attackFromLeft', 'scatterRight']) {
    assert.match(css, new RegExp(token));
  }
  const ui = read('js/local-game.js');
  assert.match(ui, /renderPendingDice/);
  assert.match(ui, /startAttackAnimation/);
  assert.match(ui, /removedDice/);
});
