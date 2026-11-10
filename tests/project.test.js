const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('STEP 1 메인 화면과 CSS 및 JS 파일이 존재한다', () => {
  for (const filename of ['index.html', 'css/theme.css', 'css/home.css', 'js/home.js', 'docs/rules.md']) {
    assert.ok(fs.existsSync(path.join(__dirname, '..', filename)), filename);
  }
});

test('세 가지 대전 모드 버튼이 있다', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  for (const mode of ['ai', 'local', 'online']) {
    assert.ok(html.includes(`data-mode="${mode}"`));
  }
});

test('STEP 3 로컬 게임 페이지와 스타일 및 UI 스크립트가 있다', () => {
  for (const filename of ['game.html', 'css/game.css', 'js/local-game.js', 'js/engine/game.js']) {
    assert.ok(fs.existsSync(path.join(__dirname, '..', filename)), filename);
  }
  const html = fs.readFileSync(path.join(__dirname, '..', 'game.html'), 'utf8');
  for (const name of ['gameBoard', 'rerollButton', 'pending0', 'pending1', 'resultPanel', 'restartDialog', 'lobbyButton']) {
    assert.ok(html.includes(`id="${name}"`), name);
  }
});

test('로컬 대전 연결과 공통 효과음 엔진 유지', () => {
  const home = fs.readFileSync(path.join(__dirname, '..', 'js/home.js'), 'utf8');
  assert.match(home, /selectedMode === "local"/);
  assert.match(home, /game\.html/);
  const gameUi = fs.readFileSync(path.join(__dirname, '..', 'js/local-game.js'), 'utf8');
  assert.match(gameUi, /DiceMatchEngine/);
  assert.match(gameUi, /DiceMatchSound/);
});


test('STEP 4 AI 페이지와 난이도 선택 및 메인 메뉴 연결', () => {
  for (const filename of ['ai.html', 'js/ai.js']) {
    assert.ok(fs.existsSync(path.join(__dirname, '..', filename)), filename);
  }
  const html = fs.readFileSync(path.join(__dirname, '..', 'ai.html'), 'utf8');
  assert.match(html, /id="aiDifficulty"/);
  assert.match(html, /js\/ai\.js/);
  assert.match(html, /js\/local-game\.js/);
  const home = fs.readFileSync(path.join(__dirname, '..', 'js/home.js'), 'utf8');
  assert.match(home, /selectedMode === "ai"/);
  assert.match(home, /ai\.html/);
  const sharedUi = fs.readFileSync(path.join(__dirname, '..', 'js/local-game.js'), 'utf8');
  assert.match(sharedUi, /queueComputer/);
  assert.match(sharedUi, /sound\?\.transition/);
});

test('사람/AI 대전 화면에 수동 주사위 굴리기 버튼이 없다', () => {
  for (const file of ['game.html', 'ai.html']) {
    const html = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
    assert.doesNotMatch(html, /id="rollButton"/);
  }
  const ui = fs.readFileSync(path.join(__dirname, '..', 'js/local-game.js'), 'utf8');
  assert.match(ui, /state\.phase === 'roll' && !isComputerTurn\(\)/);
  assert.match(ui, /state = engine\.roll\(state\)/);
});
