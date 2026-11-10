const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const css = fs.readFileSync(path.join(__dirname, '../css/game.css'), 'utf8');
const section = css.split('/* v3.6 — 게임판 라인 크기 고정.')[1];

test('주사위 라인과 내부 배치 영역은 고정 높이를 사용한다', () => {
  assert.ok(section, 'v3.6 고정 높이 스타일 누락');
  assert.match(section, /\.board-stage \.line-row\s*\{[^}]*height:\s*116px;[^}]*min-height:\s*116px;[^}]*max-height:\s*116px;/s);
  assert.match(section, /\.board-stage \.board-halves\s*\{[^}]*height:\s*98px;[^}]*max-height:\s*98px;/s);
  assert.match(section, /\.board-stage \.lane-half\s*\{[^}]*height:\s*82px;[^}]*max-height:\s*82px;/s);
});

test('모바일에서도 라인 높이와 내부 배치 영역을 고정한다', () => {
  assert.match(section, /@media\s*\(max-width:\s*620px\)/);
  assert.match(section, /\.board-stage \.line-row\s*\{[^}]*height:\s*96px;[^}]*max-height:\s*96px;/s);
  assert.match(section, /\.board-stage \.board-halves\s*\{[^}]*height:\s*78px;[^}]*max-height:\s*78px;/s);
  assert.match(section, /\.board-stage \.lane-half\s*\{[^}]*height:\s*62px;[^}]*max-height:\s*62px;/s);
});

test('주사위 조합은 줄바꿈 없이 가로로만 배치한다', () => {
  assert.match(section, /\.board-stage \.dice-flow,\s*\.board-stage \.dice-cluster\s*\{[^}]*flex-wrap:\s*nowrap;/s);
});
