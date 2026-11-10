const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

for (const page of ['ai.html', 'game.html']) {
  test(`${page}: 결과 카드는 게임판 내부에 있고 한 번만 존재함`, () => {
    const html = read(page);
    assert.equal((html.match(/id="resultPanel"/g) || []).length, 1);
    assert.ok(html.indexOf('id="resultPanel"') > html.indexOf('class="legend"'));
    assert.doesNotMatch(html, /class="control-panel"/);
    assert.match(html, /id="playAgainButton"/);
  });
}
test('경기 종료 1000ms 후 표시하며 새 게임 시작 시 대기 타이머 취소', () => {
  const js = read('js/local-game.js');
  assert.match(js, /const RESULT_REVEAL_MS = 1000/);
  assert.match(js, /if \(!resultRevealScheduled\)/);
  assert.match(js, /window\.setTimeout\(\(\) => \{/);
  assert.match(js, /\}, RESULT_REVEAL_MS\)/);
  assert.match(js, /if \(resultRevealTimer !== null\) clearTimeout\(resultRevealTimer\)/);
  assert.match(js, /resultRevealScheduled = false/);
});
test('결과 오버레이가 게임판 내 절대 위치로 문서 높이에 영향 없고 숨김 처리됨', () => {
  const css = read('css/game.css');
  assert.match(css, /\.result-overlay \{\s*position: absolute/);
  assert.match(css, /\.result-overlay\[hidden\] \{ display: none; \}/);
  assert.match(css, /\.board-frame \{ position: relative; \}/);
});
