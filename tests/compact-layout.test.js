const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const css = fs.readFileSync(path.join(__dirname, '../css/game.css'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '../ai.html'), 'utf8');

test('전체 게임 화면을 압축하면서 기존 보드 540px 제한 유지', () => {
  assert.match(css, /Compact full game layout v1\.6/);
  assert.match(css, /\.game-shell\s*\{[\s\S]*?gap:\s*10px/);
  assert.match(css, /\.line-row\s*\{\s*width:\s*min\(100%,\s*540px\)/);
  assert.match(css, /\.board-frame\s*\{\s*padding:\s*11px 14px 10px/);
});

test('기존 주사위, 난이도, 리롤 선택 컨트롤은 남겨 둔다', () => {
  assert.match(css, /\.lane-half \.die\{width:58px/);
  assert.match(html, /id="aiDifficulty"/);
  for (const id of ['rerollButton', 'rerollButton1', 'pending0', 'pending1', 'gameBoard']) {
    assert.ok(html.includes(`id="${id}"`));
  }
});
