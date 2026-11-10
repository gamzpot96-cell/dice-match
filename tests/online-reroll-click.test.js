const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const code = fs.readFileSync(path.join(__dirname, '../js/online-game.js'), 'utf8');

test('온라인 리롤 클릭은 AI 턴 조건이 아닌 본인 턴 인증으로 처리한다', () => {
  assert.doesNotMatch(code, /isComputerTurn\(\)/);
  assert.match(code, /if \(p !== state\.currentPlayer \|\| !canAct\(\)\) return;/);
  assert.match(code, /perform\(\{type:'reroll'\}/);
});

test('서버 리롤 요청 및 후보 선택은 모두 연결돼 있다', () => {
  assert.match(code, /perform\(\{type:'choose-reroll',chooseNew:useNew\}/);
  assert.match(code, /state\.phase === 'choose-reroll'/);
});
