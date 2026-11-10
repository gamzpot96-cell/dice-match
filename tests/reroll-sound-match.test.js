const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../js/sound.js'), 'utf8');
test('리롤 시작과 두 주사위 중 선택은 같은 효과음과 음량을 사용한다', () => {
  assert.match(source, /if \(action\.type === 'reroll'\) play\('appear', \{gain:\.6\}\)/);
  assert.match(source, /if \(action\.type === 'choose-reroll'\) play\('appear', \{gain:\.6\}\)/);
  assert.doesNotMatch(source, /if \(action\.type === 'reroll'\) play\('reroll'\)/);
});
