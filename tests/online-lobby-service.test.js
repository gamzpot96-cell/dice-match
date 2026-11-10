const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
let modPromise=import('../worker/index.mjs');
const fakeContext=()=>{
  const data=new Map();
  return {storage:{get:async key=>data.get(key),put:async(key,value)=>data.set(key,value)},getWebSockets:()=>[]};
};
async function requestRoom(obj,path,body){return obj.fetch(new Request('https://room.internal/'+path,{method:'POST',body:JSON.stringify(body||{})}));}
test('방 생성 → 방장 인증 → 친구 입장 → 두 명 제한',async()=>{
  const {GameRoom}=await modPromise;const room=new GameRoom(fakeContext(),{});
  let r=await requestRoom(room,'create',{code:'ABC234'});assert.equal(r.status,201);
  const host=await r.json();assert.equal(host.seat,'host');assert.match(host.token,/^[a-f0-9-]{72}$/);
  r=await requestRoom(room,'create',{code:'ABC234'});assert.equal(r.status,409);
  r=await requestRoom(room,'status',{token:'invalid'});assert.equal(r.status,401);
  r=await requestRoom(room,'status',{token:host.token});assert.equal((await r.json()).room.phase,'waiting');
  r=await requestRoom(room,'join');assert.equal(r.status,200);const guest=await r.json();
  assert.notEqual(guest.token,host.token);assert.equal(guest.room.phase,'ready');
  r=await requestRoom(room,'join');assert.equal(r.status,409);
  r=await requestRoom(room,'status',{token:guest.token});assert.equal((await r.json()).seat,'guest');
});
test('없는 방은 입장할 수 없고 6자리 코드만 허용',async()=>{
  const {default:worker,GameRoom}=await modPromise;
  const rooms=new Map();const env={ROOM:{getByName(code){if(!rooms.has(code))rooms.set(code,new GameRoom(fakeContext(),{}));return {fetch:request=>rooms.get(code).fetch(request)};}}};
  let r=await worker.fetch(new Request('https://example.test/rooms/ABC234/join',{method:'POST'}),env);assert.equal(r.status,404);
  r=await worker.fetch(new Request('https://example.test/rooms/INVALID/join',{method:'POST'}),env);assert.equal(r.status,400);
  r=await worker.fetch(new Request('https://example.test/health'),env);assert.equal((await r.json()).phase,'gameplay');
  r=await worker.fetch(new Request('https://example.test/rooms',{method:'POST'}),env);assert.equal(r.status,201);
  assert.ok((await r.json()).code.match(/^[A-HJ-NP-Z2-9]{6}$/));
});
test('대기실은 연결 전에 방 생성 불가능하며 실제 게임 가능하다고 표시하지 않음',()=>{
  const html=fs.readFileSync(path.join(root,'online.html'),'utf8');
  const js=fs.readFileSync(path.join(root,'js/online-lobby.js'),'utf8');
  assert.match(html,/id="createRoom" type="button" disabled/);
  assert.match(html,/id="waitingRoom"/);
  assert.match(js,/gameplay/);
  assert.match(html,/id="startOnlineGame"/);
  assert.match(fs.readFileSync(path.join(root,'worker/wrangler.jsonc'),'utf8'),/new_sqlite_classes/);
});
