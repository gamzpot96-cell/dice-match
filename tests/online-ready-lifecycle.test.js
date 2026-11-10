const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const load=import('../worker/index.mjs');
function context(){
 const data=new Map();
 return {storage:{get:async key=>data.get(key),put:async(key,value)=>data.set(key,value)},getWebSockets:()=>[]};
}
async function post(obj,path,body={}){
 return obj.fetch(new Request(`https://room.internal/${path}`,{method:'POST',body:JSON.stringify(body)}));
}
async function makeRoom(){
 const {GameRoom}=await load,ctx=context(),room=new GameRoom(ctx,{});
 const host=await(await post(room,'create',{code:'ABC234'})).json();
 const guest=await(await post(room,'join')).json();
 return {room,ctx,host,guest};
}
test('친구 입장만으로 게임이 시작되지 않고, 준비 전에는 행동도 차단',async()=>{
 const {room,host,guest}=await makeRoom();
 const h=await(await post(room,'status',{token:host.token})).json();
 const g=await(await post(room,'status',{token:guest.token})).json();
 assert.equal(h.state,null);assert.equal(g.state,null);
 assert.equal(h.room.phase,'ready');assert.equal(h.room.started,false);
 assert.deepEqual(h.room.ready,{host:false,guest:false});
 const illegal=await post(room,'action',{token:host.token,action:{type:'reroll',revision:0}});
 assert.equal(illegal.status,409);
});
test('경기 준비 및 3초 이내 취소 제한, 준비 취소 이후 재준비',async()=>{
 const {room,ctx,host,guest}=await makeRoom();
 const one=await(await post(room,'ready',{token:host.token,ready:true})).json();
 assert.equal(one.room.ready.host,true);
 assert.equal(one.room.ready.guest,false);
 assert.equal(one.room.startAt,null);
 assert.equal((await post(room,'ready',{token:host.token,ready:false})).status,409);
 const stored=await ctx.storage.get('room');stored.readyAt.host=Date.now()-3500;await ctx.storage.put('room',stored);
 let after=await(await post(room,'ready',{token:host.token,ready:false})).json();
 assert.equal(after.room.ready.host,false);
 assert.equal(after.room.startAt,null);
 after=await(await post(room,'ready',{token:guest.token,ready:true})).json();
 assert.equal(after.room.ready.guest,true);
 assert.equal(after.room.startAt,null);
});
test('두 사람이 모두 준비하면 카운트다운, 종료 전 게임 행동 불허',async()=>{
 const {room,ctx,host,guest}=await makeRoom();
 await post(room,'ready',{token:guest.token,ready:true});
 const both=await(await post(room,'ready',{token:host.token,ready:true})).json();
 assert.equal(both.room.phase,'countdown');
 assert.ok(both.room.startAt>Date.now());
 assert.equal(both.room.started,false);
 assert.equal((await post(room,'action',{token:host.token,action:{type:'reroll',revision:0}})).status,409);
 const stored=await ctx.storage.get('room');stored.startAt=Date.now()-1;await ctx.storage.put('room',stored);
 const after=await(await post(room,'status',{token:host.token})).json();
 assert.equal(after.room.phase,'playing');assert.equal(after.room.started,true);
 assert.equal(after.state.phase,'place');
 assert.ok(after.state.pending.value>=1&&after.state.pending.value<=6);
});
test('한 명이 대기실을 나가면 코드 무효화, 다른 참가자도 접근 불가',async()=>{
 const {room,host,guest}=await makeRoom();
 assert.equal((await post(room,'leave',{token:'incorrect'})).status,401);
 assert.equal((await post(room,'leave',{token:guest.token})).status,200);
 assert.equal((await post(room,'status',{token:host.token})).status,410);
 assert.equal((await post(room,'join')).status,410);
 assert.equal((await post(room,'ready',{token:host.token,ready:true})).status,410);
});
test('대기실 WebSocket 이탈 이벤트도 방을 종료시키지만 진행 중인 게임은 유지',async()=>{
 const {room,host}=await makeRoom();
 await room.webSocketClose({close(){},deserializeAttachment:()=>({phase:'lobby'})},1000,'normal');
 assert.equal((await post(room,'status',{token:host.token})).status,410);
 const active=await makeRoom();
 const record=await active.ctx.storage.get('room');
 record.game={phase:'place'};await active.ctx.storage.put('room',record);
 await active.room.webSocketClose({close(){},deserializeAttachment:()=>({phase:'lobby'})},1000,'normal');
 assert.equal((await post(active.room,'status',{token:active.host.token})).status,200);
});
test('방장만 코드 교체 가능, 기존 코드 폐기, 새 코드 발급',async()=>{
 const {GameRoom,default:worker}=await load;
 const rooms=new Map();
 const env={ROOM:{getByName(code){
  if(!rooms.has(code))rooms.set(code,new GameRoom(context(),{}));
  return {fetch:request=>rooms.get(code).fetch(request)};
 }}};
 const req=(uri,data)=>worker.fetch(new Request('https://dice.example'+uri,{method:'POST',body:JSON.stringify(data||{})}),env);
 const created=await(await req('/rooms',{})).json();
 const old=created.code;
 const guest=await(await req(`/rooms/${old}/join`,{})).json();
 assert.equal((await req(`/rooms/${old}/rotate`,{token:guest.token})).status,403);
 const rotated=await req(`/rooms/${old}/rotate`,{token:created.token});
 assert.equal(rotated.status,201);
 const newer=await rotated.json();
 assert.notEqual(newer.code,old);
 assert.equal(newer.seat,'host');
 assert.equal((await req(`/rooms/${old}/join`,{})).status,410);
 assert.equal((await req(`/rooms/${newer.code}/join`,{})).status,200);
});
test('대기실 UI: 버튼 고정 노출/동일 높이/취소 및 3→2→1→START',()=>{
 const root=path.join(__dirname,'..');
 const html=fs.readFileSync(path.join(root,'online.html'),'utf8');
 const css=fs.readFileSync(path.join(root,'css/online.css'),'utf8');
 const js=fs.readFileSync(path.join(root,'js/online-lobby.js'),'utf8');
 assert.match(html,/id="startOnlineGame" class="online-start" disabled>경기 준비/);
 assert.match(html,/id="leaveRoom"/);
 assert.match(html,/id="rotateCode"/);
 assert.match(css,/\.waiting-room \.waiting-actions button\{[^}]*min-height:54px;width:100%/);
 assert.match(js,/remaining>2600\?'3':remaining>1600\?'2':remaining>600\?'1':'START'/);
 assert.match(js,/ready:!already/);
 assert.match(js,/\.code\+'\/leave'/);
});
