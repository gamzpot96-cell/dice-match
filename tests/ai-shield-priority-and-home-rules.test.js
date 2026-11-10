const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const engine = require('../js/engine/game.js');
const ai = require('../js/ai.js');
function reward(value=1) {
  const s = engine.newGame(0);
  s.currentPlayer=1; s.firstShieldPending=false;
  s.phase='place'; s.pending={kind:'reward-shield',value,rerollCandidate:null};
  return s;
}
test('실드 1: 자기 필드에 1이 두 개 있어도 안전한 상대 필드를 선택', () => {
  const s=reward();s.boards[1][0]=[engine.die(1),engine.die(1)];
  for(const difficulty of ['normal','hard']) for(const r of [0,0.3,0.7,0.999]) {
    const m=ai.choosePlacement(s,difficulty,()=>r);
    assert.equal(m.player,0);
    assert.ok(!s.boards[0][m.line].some(d=>d.value===1));
  }
});
test('실드 1: 상대 필드에 같은 숫자가 포함된 라인은 피함', () => {
  const s=reward();s.boards[0][0]=[engine.die(1),engine.die(4)];
  s.boards[0][1]=[engine.die(1),engine.die(5)];
  s.boards[0][2]=[engine.die(5),engine.die(6)];
  for(const difficulty of ['normal','hard']) {
    const m=ai.choosePlacement(s,difficulty,()=>0.9);
    assert.deepEqual(m,{player:0,line:2});
  }
});
test('실드 1: 상대의 안전한 라인이 전혀 없으면 가능한 다른 선택 허용', () => {
  const s=reward();
  for(let i=0;i<3;i++) s.boards[0][i]=[engine.die(1)];
  const m=ai.choosePlacement(s,'hard',()=>0);
  assert.ok(engine.placementsFor(s).some(x=>x.player===m.player && x.line===m.line));
});
test('홈에 확정 규칙을 모달로 표시', () => {
  const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
  const css=fs.readFileSync(path.join(__dirname,'../css/home.css'),'utf8');
  assert.match(html,/<dialog id="rulesDialog" class="rules-dialog"/);
  assert.match(html, /3n점, 3개는 5n점/);
  assert.match(html, /보상 실드/);
  assert.match(html, /가장 높은 한 라인 점수/);
  assert.match(css, /\.rules-content\{/);
});
test('실제 공격으로 실드 1을 얻은 직후 상대 필드 배치', () => {
  let s=engine.newGame(1);
  s.firstShieldPending=false;
  s.phase='place';
  s.pending={kind:'normal',value:3,rerollCandidate:null};
  s.boards[0][0]=[engine.die(3)];
  s.boards[1][1]=[engine.die(1),engine.die(1)];
  s=engine.place(s,1,0,()=>0);
  assert.equal(s.lastAction.type,'attack');
  assert.equal(s.pending.kind,'reward-shield');
  assert.equal(s.pending.value,1);
  const move=ai.choosePlacement(s,'hard',()=>0.9);
  assert.equal(move.player,0);
  s=engine.place(s,move.player,move.line);
  assert.ok(s.boards[0][move.line].some(d=>d.shield&&d.value===1));
});
