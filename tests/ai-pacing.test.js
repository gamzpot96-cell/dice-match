const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const src = fs.readFileSync(path.join(__dirname, '../js/local-game.js'), 'utf8');
const ms = name => Number(src.match(new RegExp(`const ${name} = (\\d+);`))?.[1]);

test('AI 주사위 공개와 리롤 선택에 충분한 관찰 시간을 확보한다', () => {
  assert.ok(ms('AI_ROLL_REVEAL_MS') >= 1800);
  assert.ok(ms('AI_REROLL_REVEAL_MS') >= 1800);
  assert.match(src, /function aiStepDelay\(\)/);
  assert.match(src, /\}, aiStepDelay\(\)\)/);
});
test('공격과 배치 결과를 볼 시간을 주고 공격 애니메이션을 먼저 마친다', () => {
  assert.ok(ms('AI_ATTACK_REVIEW_MS') > ms('ATTACK_ANIMATION_MS') + 1000);
  assert.ok(ms('AI_RESULT_REVIEW_MS') >= 1800);
  assert.ok(ms('HUMAN_TURN_REVEAL_MS') >= 1200);
  assert.match(src, /holdAiResultForHuman\(state\.lastAction\)/);
  assert.match(src, /!humanRollPause/);
});
test('AI 리롤 시에도 두 주사위를 보여주되 사람이 클릭할 수 없다', () => {
  assert.match(src, /if \(selectingReroll\) \{/);
  assert.match(src, /document\.createElement\(isComputerTurn\(\) \? 'div' : 'button'\)/);
  assert.match(src, /if \(!isComputerTurn\(\)\) \{\s*choice\.addEventListener/);
});
test('새 경기 시작 시 예약된 AI·사람 공개 타이머를 취소한다', () => {
  assert.match(src, /if \(humanRollJob !== null\) clearTimeout\(humanRollJob\)/);
  assert.match(src, /function newMatch\(\) \{\s*cancelAiJob\(\)/);
});
