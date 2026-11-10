const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = p => fs.readFileSync(path.join(__dirname,'..',p),'utf8');
for (const file of ['ai.html','game.html','online.html']) {
  test(file + ' 소개 화면과 명시적 시작하기 버튼', () => {
    const html=read(file);
    assert.match(html,/id="matchIntro"/);
    assert.match(html,/id="matchContent" hidden/);
    assert.match(html,/id="startMatchButton"/);
    assert.match(html,/로비로 돌아가기/);
    assert.match(html,/css\/match-intro.css/);
  });
}
test('AI/로컬은 시작 전 경기 상태가 없고 시작하기를 눌렀을 때만 새 경기 생성', () => {
  const js=read('js/local-game.js');
  assert.match(js,/let state = null/);
  assert.match(js,/el\('startMatchButton'\)\.addEventListener\('click'/);
  assert.match(js,/el\('matchContent'\)\.hidden = false;\s*newMatch\(\)/);
  assert.doesNotMatch(js,/el\('playAgainButton'\)\.addEventListener\('click', newMatch\);\s*render\(\)/);
});
test('온라인 대기실 통신은 시작 버튼을 누른 뒤에 시작', () => {
  const js=read('js/online-lobby.js');
  assert.match(js,/\$\('startMatchButton'\)\.addEventListener\('click',async\(\)=>\{/);
  assert.match(js,/\$\('matchContent'\)\.hidden=false/);
});
test('점수 규칙에 예시가 있으며 불필요한 문구가 없음', () => {
  const html=read('index.html');
  assert.match(html,/4가 1개면 4점, 2개면 12점, 3개면 20점/);
  assert.doesNotMatch(html,/실드도 점수와 조합에 포함됩니다/);
});
