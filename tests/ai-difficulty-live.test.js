const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');

test('난이도 변경은 즉시 AI 판단 변수에 적용되며 새 게임을 요구하지 않는다', () => {
  const script = fs.readFileSync(path.join(root, 'js/local-game.js'), 'utf8');
  assert.match(script, /addEventListener\('change',\s*event\s*=>\s*\{\s*changeAiDifficulty\(event\.target\.value\)/);
  assert.match(script, /aiDifficulty\s*=\s*nextDifficulty/);
  assert.match(script, /computer\.choosePlacement\(state, aiDifficulty\)/);
  assert.match(script, /computer\.chooseRerollAction\(state, aiDifficulty\)/);
  assert.match(script, /computer\.chooseRerollResult\(state, aiDifficulty\)/);
  assert.doesNotMatch(script, /if \(isAiMode\) aiDifficulty = el\('aiDifficulty'\)\.value/);
});

test('선택한 난이도를 저장하고 다시 페이지를 열면 복원한다', () => {
  const script = fs.readFileSync(path.join(root, 'js/local-game.js'), 'utf8');
  assert.match(script, /localStorage\.getItem\(AI_DIFFICULTY_KEY\)/);
  assert.match(script, /localStorage\.setItem\(AI_DIFFICULTY_KEY, nextDifficulty\)/);
  assert.match(script, /\['easy', 'normal', 'hard'\]\.includes\(saved\)/);
  assert.match(script, /select\.value = saved/);
  const html = fs.readFileSync(path.join(root, 'ai.html'), 'utf8');
  assert.match(html, /즉시 적용되며 새로고침 후에도 유지됩니다/);
});
