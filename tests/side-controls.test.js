const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
test('양쪽 필드 옆 주사위와 한 줄 버튼, 하단 중복 버튼 없음',()=>{
 for(const name of ['ai.html','game.html']){
  const html=read(name);
  assert.match(html,/class="board-stage"/);
  for(const id of ['pending0','pending1','rerollButton','rerollButton1']) assert.match(html,new RegExp(`id="${id}"`));
  assert.doesNotMatch(html,/다시 굴리기 \(1회\)/);
 }
});
test('리롤 기회 및 AI 비활성 구분, 단순 등장 효과',()=>{
 const js=read('js/local-game.js'),css=read('css/game.css');
 assert.match(js,/updateRerollButtons/);
 assert.match(js,/state\.rerollUsed\[p\]/);
 assert.match(js,/isAiMode && p === 1/);
 assert.match(css,/white-space:nowrap/);
 assert.match(css,/dieEnter \.3s ease-out/);
 assert.doesNotMatch(js,/new Audio\(|AudioContext/);
});
