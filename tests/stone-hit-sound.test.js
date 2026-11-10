const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

test('공격 효과음은 확정된 -7dB 돌 충돌음과 정확히 일치', () => {
  const p = path.join(__dirname, '../assets/sounds/dice-hit.mp3');
  const audio = fs.readFileSync(p);
  const hash = crypto.createHash('sha256').update(audio).digest('hex');
  assert.equal(hash, 'c80c4b07c440519177fb7f4badcf7a0631f1681d36e686e2bec1da1378069ca5');
  assert.ok(audio.length > 1000);
});
