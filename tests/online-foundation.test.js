const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const protocol = require('../js/online-protocol.js');
test('방 코드 정규화와 유효성 검사', () => {
  assert.equal(protocol.normalizeRoomCode(' ab c234 '), 'ABC234');
  assert.equal(protocol.isRoomCode('ABC234'), true);
  for (const code of ['ABCI34', 'ABC034', 'ABC13X', 'ABC', '', 'ABC2+4']) assert.equal(protocol.isRoomCode(code), false, code);
});
test('발급용 코드는 규칙을 만족한다', () => {
  for (let n = 0; n < 32; n++) assert.equal(protocol.isRoomCode(protocol.createRoomCode(new Uint8Array(6).fill(n))), true);
});
test('배치, 리롤, 리롤 결과 메시지 형식 검사', () => {
  assert.equal(protocol.validateAction({type:'place', version:0, player:0,line:2}), true);
  assert.equal(protocol.validateAction({type:'place', version:0, player:0,line:3}), false);
  assert.equal(protocol.validateAction({type:'reroll', version:1}), true);
  assert.equal(protocol.validateAction({type:'choose-reroll', version:1,chooseNew:false}), true);
  assert.equal(protocol.validateAction({type:'choose-reroll', version:1,chooseNew:'false'}), false);
  assert.equal(protocol.validateAction({type:'place', version:-1,player:1,line:0}), false);
});
test('온라인 대기실은 서버에 연결하기 전 방 만들기를 비활성화한다', () => {
  const html = fs.readFileSync(path.join(__dirname,'../online.html'),'utf8');
  assert.match(html, /서버 연결 확인 중/);
  assert.match(html, /id="createRoom" type="button" disabled/);
});
