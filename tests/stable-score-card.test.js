const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const css = fs.readFileSync(path.join(__dirname, '../css/game.css'), 'utf8');
test('턴 표시와 선공 배지의 숨김 상태에서도 자리 유지', () => {
  assert.match(css, /v1\.9: 턴\/선공/);
  assert.match(css, /\.player-side-info \.turn-indicator\[hidden\]/);
  assert.match(css, /\.player-side-info \.first-indicator\[hidden\]/);
  assert.match(css, /visibility: hidden/);
  assert.match(css, /grid-template-rows: 30px 19px 19px/);
});
test('PC와 모바일에서 카드 높이 고정', () => {
  assert.match(css, /height: 100px/);
  assert.match(css, /height: 92px/);
});
