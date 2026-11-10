const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const css = fs.readFileSync(path.join(__dirname, '../css/game.css'), 'utf8');

test('라인 보드 최대 너비를 540px로 제한한다', () => {
  assert.match(css, /Board compact v1\.5/);
  assert.match(css, /width: min\(100%, 540px\)/);
});
test('라인 높이를 줄이면서 모바일 너비 100%는 유지한다', () => {
  assert.match(css, /min-height: 76px/);
  assert.match(css, /@media \(max-width: 620px\)/);
  assert.match(css, /\.line-row \{ width: 100%/);
});
