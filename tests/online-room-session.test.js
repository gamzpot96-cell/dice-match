const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const game = fs.readFileSync(path.join(__dirname, '../js/online-game.js'), 'utf8');
const lobby = fs.readFileSync(path.join(__dirname, '../js/online-lobby.js'), 'utf8');

test('경기 종료 스냅샷을 수신하면 이전 방 인증을 제거', () => {
  assert.match(game, /if \(state\.phase === 'finished'\) \{ sessionStorage\.removeItem\('dice-match-room'\)/);
});
test('로비로 나가기 확인 시 이전 방 인증 제거 후 이동', () => {
  assert.match(game, /el\('confirmRestart'\)\.addEventListener\('click',[\s\S]*?sessionStorage\.removeItem\('dice-match-room'\);[\s\S]*?window\.location\.assign\('\.\/index\.html'\)/);
});
test('종료 방 자동 복원 방지, 진행 중인 방 복원 로직 유지', () => {
  assert.match(lobby, /if\(result\.state\?\.phase==='finished'\)throw Error/);
  assert.match(lobby, /credentials=auth;saveRoomAuth\(auth\);displayRoom\(result\.room\);connect\(\)/);
});
test('기존 리롤 동작 유지', () => {
  assert.match(game, /perform\(\{type:'reroll'\}/);
  assert.match(game, /perform\(\{type:'choose-reroll',chooseNew:useNew\}/);
});

test('일반 브라우저는 방 인증을 로컬 저장소에도 보관하고 다시 복구한다', () => {
  assert.match(lobby, /function saveRoomAuth\(auth\)/);
  assert.match(lobby, /localStorage\.setItem\(ROOM_STORAGE_KEY,value\)/);
  assert.match(lobby, /const saved=savedRoomAuth\(\)/);
  assert.match(game, /localStorage\.getItem\('dice-match-room'\)/);
});
test('경기 종료 및 자발적 이탈 시 로컬 인증을 제거한다', () => {
  assert.match(lobby, /function clearRoomAuth\(\)/);
  assert.match(lobby, /localStorage\.removeItem\(ROOM_STORAGE_KEY\)/);
  assert.match(game, /localStorage\.removeItem\('dice-match-room'\)/);
});
test('복귀 코드는 경기 준비 아래 접이식 영역에 둔다', () => {
  const html=fs.readFileSync(path.join(__dirname,'../online.html'),'utf8');
  const actions=html.indexOf('class="waiting-actions"');
  const recovery=html.indexOf('class="recovery-details"');
  assert.ok(actions>=0 && recovery>actions);
  assert.match(html, /<details class="recovery-details">/);
});

test('온라인 연결이 끊어지면 기존 인증으로 자동 재접속한다', () => {
  assert.match(game, /function scheduleReconnect\(\)/);
  assert.match(game, /sock\.onclose=\(\)=>\{[\s\S]*?scheduleReconnect\(\)/);
  assert.match(game, /connectionStopped=true/);
});
