const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const load=import('../worker/index.mjs');
function fixture(){
 const db=new Map();const sockets=[];let alarmAt=null;
 const ctx={storage:{get:async k=>db.get(k),put:async(k,v)=>db.set(k,v),setAlarm:async t=>{alarmAt=t}},getWebSockets:()=>sockets,acceptWebSocket:ws=>sockets.push(ws)};
 const ws=(seat,token,phase='game')=>({deserializeAttachment:()=>({code:'ABC234',seat,token,phase}),send(){},close(){}});
 return {db,sockets,ctx,ws,getAlarm:()=>alarmAt};
}
async function build(){
 const {GameRoom}=await load;
 const f=fixture();const room=new GameRoom(f.ctx,{});
 const req=(route,body)=>room.fetch(new Request('https://room.internal/'+route,{method:'POST',body:JSON.stringify(body||{})}));
 const host=await (await req('create',{code:'ABC234'})).json();
 const guest=await (await req('join',{})).json();
 let saved=await f.db.get('room');
 saved.game={phase:'place',currentPlayer:0,boards:[ [[],[],[]], [[],[],[]] ],rerollUsed:[false,false],pending:{kind:'normal',value:1},firstPlayer:0};saved.revision=1;saved.gameConnectionsReady=true;
 await f.db.set('room',saved);
 f.sockets.push(f.ws('host',host.token),f.ws('guest',guest.token));
 return {...f,room,req,host,guest};
}
test('상대방 이탈 시 60초 제한 및 행동 정지, 서버 알람 예약',async()=>{
 const f=await build();const disconnected=f.sockets.pop();await f.room.webSocketClose(disconnected,1000,'left');
 const saved=await f.db.get('room');assert.equal(saved.disconnect.seat,'guest');
 assert.ok(saved.disconnect.deadline-Date.now()>59000);assert.equal(f.getAlarm(),saved.disconnect.deadline);
 const response=await f.req('action',{token:f.host.token,action:{type:'reroll',revision:1}});
 assert.equal(response.status,409);assert.match((await response.json()).error,/일시 정지/);
 const status=await(await f.req('status',{token:f.host.token})).json();assert.equal(status.room.disconnect.seat,'guest');
});
test('60초 이내 복귀하면 기존 게임과 revision 유지',async()=>{
 const f=await build();await f.room.webSocketClose(f.sockets.pop(),1000,'left');
 f.sockets.push(f.ws('guest',f.guest.token));
 await f.room.reconcileConnection(await f.db.get('room'));
 const room=await f.db.get('room');assert.equal(room.disconnect,null);assert.equal(room.game.phase,'place');assert.equal(room.revision,1);
});
test('60초 후 생존자가 접속해 있으면 부전승, 재접속으로 결과 변경 불가',async()=>{
 const f=await build();await f.room.webSocketClose(f.sockets.pop(),1000,'left');
 let saved=await f.db.get('room');saved.disconnect.deadline=Date.now()-1;await f.db.set('room',saved);
 // Late reconnect must not erase a forfeit after the deadline.
 f.sockets.push(f.ws('guest',f.guest.token));
 await f.room.reconcileConnection(await f.db.get('room'));
 saved=await f.db.get('room');assert.equal(saved.game.phase,'finished');assert.equal(saved.game.result.forfeit,true);
 assert.equal(saved.game.result.winner,0);assert.equal(saved.outcome.absent,'guest');
 assert.equal((await f.req('action',{token:f.guest.token,action:{type:'reroll',revision:2}})).status,409);
});
test('양쪽 모두 오프라인 상태로 타임아웃이면 부전승 없이 종료',async()=>{
 const f=await build();await f.room.webSocketClose(f.sockets.pop(),1000,'left');
 f.sockets.splice(0);let saved=await f.db.get('room');saved.disconnect.deadline=Date.now()-1;await f.db.set('room',saved);
 await f.room.alarm();saved=await f.db.get('room');assert.equal(saved.closed,true);assert.equal(saved.outcome,undefined);
});
test('웹 UI에 중앙 타이머와 부전승 텍스트가 있고 버튼은 paused 동안 비활성',()=>{
 const root=path.join(__dirname,'..');
 const html=fs.readFileSync(path.join(root,'online-game.html'),'utf8');
 const js=fs.readFileSync(path.join(root,'js/online-game.js'),'utf8');
 assert.match(html,/id="disconnectOverlay"/);assert.match(js,/!disconnect && !sending/);
 assert.match(js,/disconnectRemaining/);assert.match(js,/부전승/);
});
test('먼저 나간 사람이 돌아오고 다른 플레이어가 떠나면 대기 대상을 갱신',async()=>{
 const f=await build();await f.room.webSocketClose(f.sockets.pop(),1000,'left');
 const before=(await f.db.get('room')).disconnect;
 f.sockets.splice(0);f.sockets.push(f.ws('guest',f.guest.token));
 await f.room.reconcileConnection(await f.db.get('room'));
 const saved=await f.db.get('room');
 assert.equal(before.seat,'guest');assert.equal(saved.disconnect.seat,'host');
 assert.ok(saved.disconnect.deadline>=before.deadline);
});

test('명시적으로 로비 나가기를 누르면 상대에게 즉시 부전승',async()=>{
 const f=await build();
 const response=await f.req('leave',{token:f.host.token});
 assert.equal(response.status,200);
 const saved=await f.db.get('room');
 assert.equal(saved.game.phase,'finished');
 assert.equal(saved.game.result.forfeit,true);
 assert.equal(saved.game.result.winner,1);
 assert.equal(saved.outcome.absent,'host');
});

// Regression: the runtime can still report a socket while its close handler executes.
test('종료 콜백 중 소켓 목록에 남아 있어도 상대방 이탈을 감지',async()=>{
 const f=await build();
 const closing=f.sockets[f.sockets.length-1];
 await f.room.webSocketClose(closing,1000,'closed tab');
 const saved=await f.db.get('room');
 assert.equal(saved.disconnect?.seat,'guest');
 assert.ok(saved.disconnect.deadline>Date.now());
});
test('소켓 목록에 닫힘 상태로 남아 있는 항목은 연결 인원에서 제외',async()=>{
 const f=await build();
 const guest=f.sockets[f.sockets.length-1];
 guest.readyState=3;
 const connected=f.room.connectedSeats(await f.db.get('room'));
 assert.deepEqual(connected,{host:true,guest:false});
});


test('최초 경기 화면 한 명만 연결되면 재접속 타이머가 시작되지 않는다',async()=>{
 const f=await build();f.sockets.splice(0);
 const saved=await f.db.get('room');saved.gameConnectionsReady=false;await f.db.set('room',saved);
 f.sockets.push(f.ws('host',f.host.token));
 await f.room.reconcileConnection(await f.db.get('room'));
 const after=await f.db.get('room');
 assert.equal(after.disconnect,undefined);assert.equal(after.gameConnectionsReady,false);
 assert.equal(f.getAlarm(),null);
 const response=await f.req('action',{token:f.host.token,action:{type:'reroll',revision:1}});
 assert.equal(response.status,409);assert.match((await response.json()).error,/연결을 기다리고/);
});

test('양쪽 첫 경기 연결 후에만 끊김 타이머를 활성화한다',async()=>{
 const f=await build();f.sockets.splice(0);
 const saved=await f.db.get('room');saved.gameConnectionsReady=false;await f.db.set('room',saved);
 const hostSocket=f.ws('host',f.host.token),guestSocket=f.ws('guest',f.guest.token);
 f.sockets.push(hostSocket);
 await f.room.reconcileConnection(await f.db.get('room'));
 f.sockets.push(guestSocket);
 await f.room.reconcileConnection(await f.db.get('room'));
 assert.equal((await f.db.get('room')).gameConnectionsReady,true);
 assert.equal((await f.db.get('room')).disconnect,undefined);
 await f.room.webSocketClose(guestSocket,1000,'tab closed');
 const after=await f.db.get('room');assert.equal(after.disconnect?.seat,'guest');assert.ok(f.getAlarm());
});

test('기존 대기실 소켓 종료가 게임 시작 직후 재접속 타이머를 작동시키지 않는다',async()=>{
 const f=await build();f.sockets.splice(0);
 const saved=await f.db.get('room');saved.gameConnectionsReady=false;await f.db.set('room',saved);
 const lobbyHost=f.ws('host',f.host.token,'lobby');
 const lobbyGuest=f.ws('guest',f.guest.token,'lobby');
 f.sockets.push(lobbyHost,lobbyGuest);
 await f.room.reconcileConnection(await f.db.get('room'));
 assert.equal((await f.db.get('room')).gameConnectionsReady,false);
 assert.equal((await f.db.get('room')).disconnect,undefined);
 await f.room.webSocketClose(lobbyHost,1000,'navigating to game');
 assert.equal((await f.db.get('room')).disconnect,undefined);
 f.sockets.push(f.ws('host',f.host.token));
 await f.room.reconcileConnection(await f.db.get('room'));
 assert.equal((await f.db.get('room')).disconnect,undefined);
});
