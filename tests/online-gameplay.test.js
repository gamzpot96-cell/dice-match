const test=require('node:test');
const assert=require('node:assert/strict');
const modPromise=import('../worker/index.mjs');
function fakeContext(){
 const m=new Map(),sockets=[];
 return {storage:{get:async k=>m.get(k),put:async(k,v)=>m.set(k,v)},getWebSockets:()=>sockets,
   addGameSocket:(code,seat,token)=>sockets.push({deserializeAttachment:()=>({code,seat,token,phase:'game'}),send(){},close(){}})};
}
async function req(room,path,body={}){return room.fetch(new Request(`https://room.internal/${path}`,{method:'POST',body:JSON.stringify(body)}));}
async function ready(){
 const {GameRoom}=await modPromise;const ctx=fakeContext(),room=new GameRoom(ctx,{});
 const host=await(await req(room,'create',{code:'ABC234'})).json();
 const guest=await(await req(room,'join')).json();
 await req(room,'ready',{token:host.token,ready:true});
 await req(room,'ready',{token:guest.token,ready:true});
 const stored=await room.ctx.storage.get('room');
 stored.startAt=Date.now()-1;
 await room.ctx.storage.put('room',stored);
 // Simulate both players entering the game page and establishing their first WebSocket.
 // The server correctly rejects game actions until these connections exist.
 await req(room,'status',{token:host.token});
 ctx.addGameSocket('ABC234','host',host.token);
 ctx.addGameSocket('ABC234','guest',guest.token);
 await room.reconcileConnection(await room.ctx.storage.get('room'));
 return {room,host,guest};
}
test('서버가 선공과 시작 실드를 생성하고 두 명에게 같은 상태 제공',async()=>{
 const {room,host,guest}=await ready();
 const h=await(await req(room,'status',{token:host.token})).json();
 const g=await(await req(room,'status',{token:guest.token})).json();
 assert.deepEqual(h.state,g.state);
 assert.equal(h.revision,0);
 assert.equal(h.state.phase,'place');
 assert.equal(h.state.pending.kind,'start-shield');
 assert.ok(h.state.pending.value>=1&&h.state.pending.value<=6);
});
test('잘못된 토큰, 다른 플레이어 행동, 위조된 점수, 오래된 revision 차단',async()=>{
 const {room,host,guest}=await ready();
 let data=(await(await req(room,'status',{token:host.token})).json());
 const turn=data.state.currentPlayer;
 const current=turn===0?host:guest;
 const wrong=turn===0?guest:host;
 const move={type:'place',player:turn,line:0,revision:0};
 assert.equal((await req(room,'action',{token:'fake',action:move})).status,401);
 assert.equal((await req(room,'action',{token:wrong.token,action:move})).status,403);
 assert.equal((await req(room,'action',{token:current.token,action:{...move,boards:[[[]]],score:999}})).status,200);
 const s=(await(await req(room,'status',{token:current.token})).json());
 assert.equal(s.revision,1);
 assert.equal(s.state.boards[turn][0].length,1);
 assert.equal(s.state.boards[turn][0][0].shield,true);
 assert.equal((await req(room,'action',{token:current.token,action:move})).status,409);
});
test('실드 시작 후 다음 선수의 일반 주사위는 본인 필드만 배치',async()=>{
 const {room,host,guest}=await ready();
 let st=(await(await req(room,'status',{token:host.token})).json()).state;
 const starter=st.currentPlayer;
 const first=starter===0?host:guest;
 await req(room,'action',{token:first.token,action:{type:'place',player:starter,line:0,revision:0}});
 const second=starter===0?guest:host;
 const illegal=await req(room,'action',{token:second.token,action:{type:'place',player:starter,line:1,revision:1}});
 assert.equal(illegal.status,409);
 const legal=await req(room,'action',{token:second.token,action:{type:'place',player:1-starter,line:0,revision:1}});
 assert.equal(legal.status,200);
});
test('리롤 후보는 기존 숫자와 다르고 선택 후에도 서버에서 검증',async()=>{
 const {room,host,guest}=await ready();
 const st=(await(await req(room,'status',{token:host.token})).json()).state;
 const current=st.currentPlayer===0?host:guest;
 const reroll=await(await req(room,'action',{token:current.token,action:{type:'reroll',revision:0}})).json();
 assert.equal(reroll.state.phase,'choose-reroll');
 assert.notEqual(reroll.state.pending.value,reroll.state.pending.rerollCandidate);
 const chosen=await(await req(room,'action',{token:current.token,action:{type:'choose-reroll',chooseNew:true,revision:1}})).json();
 assert.equal(chosen.state.phase,'place');assert.equal(chosen.state.rerollUsed[st.currentPlayer],true);
 assert.equal((await req(room,'action',{token:current.token,action:{type:'reroll',revision:2}})).status,409);
});
test('온라인 화면에 기존 보드와 서버 게임 연결, 대기실 시작 경로',()=>{
 const fs=require('fs'),path=require('path');const root=path.join(__dirname,'..');
 const html=fs.readFileSync(path.join(root,'online-game.html'),'utf8');
 const code=fs.readFileSync(path.join(root,'js/online-game.js'),'utf8');
 assert.match(html,/js\/online-game\.js/);
 assert.match(html,/id="gameBoard"/);
 assert.match(code,/rooms\/\$\{roomAuth.code\}\/action/);
 assert.doesNotMatch(html,/js\/local-game\.js/);
});
