const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
for (const page of ['ai.html', 'game.html', 'online-game.html']) {
  test(`${page}: 하단 현황판 없이 게임판 아래에 작은 로비 버튼과 확인창`, () => {
    const html = read(page);
    assert.doesNotMatch(html, /class="control-panel"|id="instruction"|id="gameNotice"|id="restartButton"/);
    assert.doesNotMatch(html, /class="board-title-actions"/);
    assert.match(html, /class="lobby-bottom-actions"/);
    assert.match(html, /id="lobbyButton"[^>]*>로비로 나가기/);
    assert.match(html, /로비로 나가시겠습니까\?/);
    assert.match(html, /id="cancelRestart"/);
    assert.match(html, /id="confirmRestart"[^>]*>로비로 나가기/);
    assert.ok(html.indexOf('id="lobbyButton"') > html.indexOf('id="resultPanel"'));
    assert.ok(html.indexOf('id="lobbyButton"') < html.indexOf('</main>'));
  });
}
for (const code of ['js/local-game.js', 'js/online-game.js']) {
  test(`${code}: 로비 이동 전 확인, 취소 가능, 기존 하단 요소 접근 없음`, () => {
    const source = read(code);
    assert.match(source, /el\('lobbyButton'\)\.addEventListener\('click', \(\) => el\('restartDialog'\)\.showModal\(\)\)/);
    assert.match(source, /el\('cancelRestart'\)\.addEventListener\('click', \(\) => el\('restartDialog'\)\.close\(\)\)/);
    assert.match(source, /el\('confirmRestart'\)\.addEventListener\('click', (?:async )?\(\) => \{/);
    assert.match(source, /window\.location\.assign\('\.\/index\.html'\)/);
    assert.doesNotMatch(source, /getElementById\('gameNotice'\)|el\('instruction'\)|el\('gameNotice'\)|el\('restartButton'\)/);
  });
}
test('AI/로컬 결과 오버레이의 재대전 기능은 유지됨', () => {
  assert.match(read('js/local-game.js'), /el\('playAgainButton'\)\.addEventListener\('click', newMatch\)/);
  assert.match(read('css/game.css'), /\.result-overlay \{\s*position: absolute/);
});
