const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');

test('라인 번호 없이 세 줄과 중간 원목색 사용',()=>{
 const css=read('css/game.css'), js=read('js/local-game.js');
 assert.match(css,/linear-gradient\(150deg,#bb875b 0%,#a47248 55%,#95633e 100%\)/);
 assert.doesNotMatch(js,/title\.textContent = `라인/);
 assert.match(js,/for \(let line = 0; line < 3; line \+= 1\)/);
});
test('공격 규칙은 유지하며 실드는 테두리만',()=>{
 const css=read('css/game.css'), engine=read('js/engine/game.js');
 assert.match(css,/border:4px solid var\(--pip\)/);
 assert.match(css,/\.die\.shield::after\{content:none\}/);
 assert.match(engine,/!d\.shield/);
});
test('리롤 비교는 고정 높이 준비 칸에서 두 주사위 선택',()=>{
 const js=read('js/local-game.js'),css=read('css/game.css');
 assert.match(js,/side-die-choice/);
 assert.match(js,/engine\.chooseReroll\(state, useNew\)/);
 assert.match(js,/slot\.classList\.toggle\('is-comparing'/);
 assert.match(css,/\.side-pending\{height:146px/);
 assert.match(css,/\.side-die-choice/);
 assert.match(css,/\.side-reroll\{/);
});
test('양쪽 입체 버튼 색, AI 비활성화, 리롤 소진 구분',()=>{
 const css=read('css/game.css'),js=read('js/local-game.js');
 assert.match(css,/\.side-blue \.side-reroll\.is-active\{background:linear-gradient/);
 assert.match(css,/\.side-red \.side-reroll\.is-active\{background:linear-gradient/);
 assert.match(css,/inset 0 -3px 2px/);
 assert.match(js,/isAiMode && p === 1/);
 assert.match(js,/button\.disabled = true/);
 assert.match(js,/state\.rerollUsed\[p\]/);
});
