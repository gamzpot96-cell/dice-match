const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const load=import('../worker/index.mjs');
async function setup(){
 const {GameRoom}=await load;
 const db=new Map(),sockets=[];
 const ctx={storage:{get:async k=>db.get(k),put:async(k,v)=>db.set(k,v),setAlarm:async()=>{}},getWebSockets:()=>sockets,acceptWebSocket:ws=>sockets.push(ws)};
 const handler=new GameRoom(ctx,{});
 const req=(name,data)=>handler.fetch(new Request('https://room.internal/'+name,{method:'POST',body:JSON.stringify(data||{})}));
 const host=await(await req('create',{code:'ABC234'})).json();
 const guest=await(await req('join',{})).json();
 const socket=(seat,token)=>({deserializeAttachment:()=>({code:'ABC234',seat,token,phase:'game'}),send(){},close(){}});
 const room=await db.get('room');room.game={phase:'place',currentPlayer:0,boards:[[[],[],[]],[[],[],[]]],rerollUsed:[false,false],pending:{kind:'normal',value:1},firstPlayer:0};room.revision=3;room.gameConnectionsReady=true;
 await db.set('room',room);
 sockets.push(socket('host',host.token),socket('guest',guest.token));
 return {db,sockets,handler,req,host,guest,socket};
}
test('host and guest have distinct 16-character private recovery keys (not in public room)',async()=>{
 const f=await setup();
 assert.match(f.host.recoveryKey,/^[A-HJ-NP-Z2-9]{16}$/);
 assert.match(f.guest.recoveryKey,/^[A-HJ-NP-Z2-9]{16}$/);
 assert.notEqual(f.host.recoveryKey,f.guest.recoveryKey);
 assert.equal(JSON.stringify(f.host.room).includes(f.host.recoveryKey),false);
});
test('cannot use normal room join to take an occupied seat',async()=>{
 const f=await setup();const response=await f.req('join',{});
 assert.equal(response.status,409);
});
test('correct secret restores same guest seat after disconnect without resetting game',async()=>{
 const f=await setup();const guestWs=f.sockets.pop();await f.handler.webSocketClose(guestWs,1000,'disconnected');
 const response=await f.req('recover',{recoveryKey:f.guest.recoveryKey});assert.equal(response.status,200);
 const result=await response.json();assert.equal(result.seat,'guest');assert.equal(result.token,f.guest.token);assert.equal(result.revision,3);
 f.sockets.push(f.socket('guest',f.guest.token));await f.handler.reconcileConnection(await f.db.get('room'));
 const room=await f.db.get('room');assert.equal(room.disconnect,null);assert.equal(room.game.phase,'place');assert.equal(room.revision,3);
});
test('room code or wrong seat recovery code cannot impersonate disconnected guest',async()=>{
 const f=await setup();await f.handler.webSocketClose(f.sockets.pop(),1000,'disconnected');
 assert.equal((await f.req('recover',{recoveryKey:'ABCDEFGHJKLMNPQR'})).status,403);
 assert.equal((await f.req('recover',{recoveryKey:f.host.recoveryKey})).status,409);
 assert.equal((await f.req('recover',{recoveryKey:'ABC234'})).status,400);
});
test('cannot recover when player is still online',async()=>{
 const f=await setup();assert.equal((await f.req('recover',{recoveryKey:f.guest.recoveryKey})).status,409);
});
test('expired or forfeit match cannot be revived with correct secret',async()=>{
 const f=await setup();await f.handler.webSocketClose(f.sockets.pop(),1000,'disconnected');
 let room=await f.db.get('room');room.disconnect.deadline=Date.now()-1;await f.db.set('room',room);
 const response=await f.req('recover',{recoveryKey:f.guest.recoveryKey});assert.equal(response.status,410);
 assert.equal((await f.db.get('room')).game.phase,'finished');
});
test('recovery remains unavailable before initial game connections',async()=>{
 const f=await setup();const room=await f.db.get('room');room.gameConnectionsReady=false;await f.db.set('room',room);
 assert.equal((await f.req('recover',{recoveryKey:f.guest.recoveryKey})).status,409);
});
test('lobby and game display recovery key; lobby has dedicated recover flow',()=>{
 const dir=path.join(__dirname,'..');
 const lobby=fs.readFileSync(path.join(dir,'online.html'),'utf8');
 const script=fs.readFileSync(path.join(dir,'js/online-lobby.js'),'utf8');
 const html=fs.readFileSync(path.join(dir,'online-game.html'),'utf8');
 assert.match(lobby,/id="recoverMatch"/);assert.match(lobby,/id="activeRecoveryKey"/);
 assert.match(script,/\/recover/);assert.match(html,/id="gameRecoveryKey"/);
});
test('public Worker /recover route forwards authenticated return request',async()=>{
 const {default:worker,GameRoom}=await load;
 const room=new GameRoom({storage:{get:async()=>undefined,put:async()=>{}},getWebSockets:()=>[]},{});
 let called='';
 const env={ROOM:{getByName:()=>({fetch:async request=>{
   called=new URL(request.url).pathname;
   const data=await request.json();
   assert.equal(data.recoveryKey,'ABCDEFGHJKLMNPQR');
   return new Response(JSON.stringify({seat:'guest'}),{status:200});
 }})}};
 const response=await worker.fetch(new Request('https://example.test/rooms/ABC234/recover',{method:'POST',body:JSON.stringify({recoveryKey:'ABCDEFGHJKLMNPQR'})}),env);
 assert.equal(response.status,200);assert.equal(called,'/recover');
 assert.equal((await response.json()).seat,'guest');
});
