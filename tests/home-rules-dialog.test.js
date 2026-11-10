const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = p => fs.readFileSync(path.join(__dirname,'..',p),'utf8');
test('규칙 보기는 모달 버튼이고 토글은 사용하지 않음', () => {
 const html=read('index.html');
 assert.match(html, /<button class="rules-open-button" id="openRulesButton"[^>]*>게임 규칙 보기<\/button>/);
 assert.match(html, /<dialog id="rulesDialog" class="rules-dialog"/);
 assert.doesNotMatch(html, /<details[^>]*gameRules|<summary>게임 규칙 보기/);
});
test('규칙 모달 열기 닫기, 바깥 클릭 닫기',()=>{
 const js=read('js/home.js');
 assert.match(js, /openRulesButton.addEventListener\("click", \(\) => rulesDialog.showModal\(\)\)/);
 assert.match(js, /closeRulesButton.addEventListener\("click", \(\) => rulesDialog.close\(\)\)/);
 assert.match(js, /event.target === rulesDialog/);
});
test('규칙 버튼 가운데 정렬과 폰트 크기 조정',()=>{
 const css=read('css/home.css');
 assert.match(css, /\.rules-open-button\{[^}]*justify-content:center;[^}]*font-size:16px;[^}]*text-align:center/s);
 assert.match(css, /\.rules-content\{[^}]*overflow-y:auto/);
});
