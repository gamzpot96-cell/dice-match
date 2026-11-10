import { engine } from './engine.mjs';
/* STEP 6-3: Durable Object authoritative gameplay and realtime broadcasts. */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_RE = /^[A-HJ-NP-Z2-9]{6}$/;
const MAX_AGE_MS = 6 * 60 * 60 * 1000;
const MAX_BODY_BYTES = 1024;
const ACTION_TYPES = new Set(['place', 'reroll', 'choose-reroll']);
const READY_CANCEL_MS = 3000;
const COUNTDOWN_MS = 3600;
const RECONNECT_MS = 60_000;
function randomValue(){const b=crypto.getRandomValues(new Uint32Array(1))[0];return b/4294967296;}
function playerForSeat(seat){return seat==='host'?0:1;}
function validAction(a){
 if(!a || typeof a!=='object'|| !ACTION_TYPES.has(a.type) || !Number.isSafeInteger(a.revision)||a.revision<0)return false;
 if(a.type==='place')return [0,1].includes(a.player)&&Number.isInteger(a.line)&&a.line>=0&&a.line<3;
 if(a.type==='choose-reroll')return typeof a.chooseNew==='boolean';
 return true;
}

function json(body, status=200) { return new Response(JSON.stringify(body), {status,headers:{'content-type':'application/json;charset=utf-8','cache-control':'no-store','access-control-allow-origin':'*','access-control-allow-headers':'content-type','access-control-allow-methods':'GET,POST,OPTIONS'}}); }
function secureCode() { const bytes = crypto.getRandomValues(new Uint8Array(6)); return Array.from(bytes,b=>ALPHABET[b & 31]).join(''); }
function secureToken(){ return crypto.randomUUID()+crypto.randomUUID(); }
// 80-bit per-seat recovery secret; the 6-character invitation code alone never authorizes re-entry.
function secureRecoveryKey(){ const bytes=crypto.getRandomValues(new Uint8Array(16)); return Array.from(bytes,b=>ALPHABET[b & 31]).join(''); }
const RECOVERY_KEY_RE = /^[A-HJ-NP-Z2-9]{16}$/;
function cleanCode(value){return typeof value==='string'? value.trim().toUpperCase():'';}
async function readBody(request) {
  if (Number(request.headers.get('content-length')||0) > MAX_BODY_BYTES) throw new Error('요청이 너무 큽니다.');
  const text = await request.text();
  if(text.length > MAX_BODY_BYTES) throw new Error('요청이 너무 큽니다.');
  return JSON.parse(text);
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method==='OPTIONS') return new Response(null,{status:204,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'content-type','access-control-allow-methods':'GET,POST,OPTIONS'}});
    if (url.pathname==='/health' && request.method==='GET') return json({ok:true,phase:'gameplay'});
    if (!env.ROOM) return json({error:'서버 ROOM 설정이 없습니다.'},503);
    if (url.pathname==='/rooms' && request.method==='POST') {
      // Cryptographic room codes, collision checks in the target Durable Object.
      for(let i=0;i<8;i++) {
        const code=secureCode();
        const stub=env.ROOM.getByName(code);
        const response=await stub.fetch(new Request('https://room.internal/create',{method:'POST',body:JSON.stringify({code})}));
        if(response.status===409) continue;
        return withCors(response);
      }
      return json({error:'방 코드를 발급하지 못했습니다. 다시 시도해 주세요.'},503);
    }
    const match=url.pathname.match(/^\/rooms\/([A-Za-z0-9]{6})(?:\/(join|recover|status|action|ws|ready|leave|rotate))?$/);
    if(!match || !CODE_RE.test(match[1])) return json({error:'유효한 6자리 방 코드가 아닙니다.'},400);
    const code=match[1]; const operation=match[2];
    const stub=env.ROOM.getByName(code);
    if(operation==='rotate' && request.method==='POST') {
      let data;try{data=await readBody(request);}catch{return json({error:'올바른 요청이 아닙니다.'},400);}
      const identity=await stub.fetch(new Request('https://room.internal/status',{method:'POST',body:JSON.stringify({token:data.token})}));
      if(!identity.ok)return withCors(identity);
      const info=await identity.json();
      if(info.seat!=='host'||info.room.started||info.room.phase==='countdown')return json({error:'대기실 방장만 코드를 변경할 수 있습니다.'},403);
      for(let i=0;i<8;i++){
        const newCode=secureCode();if(newCode===code)continue;
        const newStub=env.ROOM.getByName(newCode);
        const created=await newStub.fetch(new Request('https://room.internal/create',{method:'POST',body:JSON.stringify({code:newCode})}));
        if(created.status===409)continue;
        if(!created.ok)return withCors(created);
        const closed=await stub.fetch(new Request('https://room.internal/leave',{method:'POST',body:JSON.stringify({token:data.token})}));
        if(!closed.ok)return withCors(closed);
        return withCors(created);
      }
      return json({error:'새 초대 코드를 발급하지 못했습니다.'},503);
    }
    if(['ready','leave'].includes(operation) && request.method==='POST') {
      try{const data=await readBody(request);return withCors(await stub.fetch(new Request('https://room.internal/'+operation,{method:'POST',body:JSON.stringify(data)})));}
      catch{return json({error:'올바른 요청이 아닙니다.'},400);}
    }
    if(operation==='join' && request.method==='POST') return withCors(await stub.fetch(new Request('https://room.internal/join',{method:'POST'})));
    if(operation==='recover' && request.method==='POST') {
      try { const data=await readBody(request);return withCors(await stub.fetch(new Request('https://room.internal/recover',{method:'POST',body:JSON.stringify(data)}))); }
      catch { return json({error:'올바른 복귀 요청이 아닙니다.'},400); }
    }
    if(operation==='status' && request.method==='POST') {
      try {
        const data=await readBody(request);
        return withCors(await stub.fetch(new Request('https://room.internal/status',{method:'POST',body:JSON.stringify(data)})));
      } catch {return json({error:'올바른 인증 요청이 아닙니다.'},400);}
    }
    if(operation==='action' && request.method==='POST') {
      try {
        const data=await readBody(request);
        return withCors(await stub.fetch(new Request('https://room.internal/action',{method:'POST',body:JSON.stringify(data)})));
      } catch {return json({error:'올바른 행동 요청이 아닙니다.'},400);}
    }
    if(operation==='ws' && request.method==='GET' && request.headers.get('upgrade')?.toLowerCase()==='websocket') {
      // Token is supplied in the WebSocket subprotocol, not URL (avoids access-log query leaks).
      const protocol=request.headers.get('sec-websocket-protocol')||'';
      const parts=protocol.split(',').map(x=>x.trim());
      if(parts.length!==2 || parts[0]!=='dice-match' || !/^[a-z0-9-]{60,80}$/i.test(parts[1])) return json({error:'접속 인증이 필요합니다.'},401);
      return stub.fetch(new Request('https://room.internal/ws',{headers:{Upgrade:'websocket','Sec-WebSocket-Protocol':protocol}}));
    }
    return json({error:'지원하지 않는 요청입니다.'},404);
  }
};
function withCors(response) {
  const headers=new Headers(response.headers);
  headers.set('access-control-allow-origin','*'); headers.set('access-control-allow-headers','content-type'); headers.set('cache-control','no-store');
  return new Response(response.body,{status:response.status,headers});
}
export class GameRoom {
  constructor(ctx, env){ this.ctx=ctx;this.env=env; }
  async getRoom(){return await this.ctx.storage.get('room');}
  async saveRoom(room){await this.ctx.storage.put('room',room);}
  publicView(room){
    const phase=room.closed?'closed':room.game?'playing':room.startAt?'countdown':room.guestToken?'ready':'waiting';
    return {code:room.code,createdAt:room.createdAt,phase,connected:this.connectedSeats(room),started:Boolean(room.game),
      ready:{host:Boolean(room.readyAt?.host),guest:Boolean(room.readyAt?.guest)},
      readyAt:room.readyAt||{host:0,guest:0},startAt:room.startAt||null,serverNow:Date.now(),
      disconnect:room.disconnect||null, outcome:room.outcome||null, gameConnectionsReady:Boolean(room.gameConnectionsReady)};
  }
  async ensureGame(room){
    if(!room.game && room.startAt && Date.now()>=room.startAt && !room.closed){
      room.game=engine.roll(engine.newGame(randomValue()<.5?0:1),randomValue);
      room.revision=0;await this.saveRoom(room);
    }
    return room;
  }
  async reconcileConnection(room, closingSocket=null) {
    if (!room.game || room.game.phase==='finished') return room;
    const connected=this.connectedSeats(room, closingSocket);
    // A finished lobby countdown is not an actual disconnect. Wait until both
    // players establish their first game-page WebSocket connection.
    if(!room.gameConnectionsReady){
      if(connected.host && connected.guest){
        room.gameConnectionsReady=true;
        await this.saveRoom(room);
        this.broadcast(room);
      }
      return room;
    }
    if (room.disconnect && Date.now()>=room.disconnect.deadline) {
      const absent=room.disconnect.seat;
      // If both peers went offline, the game ends without declaring a winner.
      const survivor=absent==='host'?'guest':'host';
      const winner=connected[survivor]?playerForSeat(survivor):null;
      if(winner===null){
        room.closed=true;room.closedReason='두 플레이어 모두 재접속하지 않아 경기가 종료되었습니다.';
        room.disconnect=null;await this.saveRoom(room);
        this.broadcast(room,{type:'room-closed',reason:room.closedReason});
      } else {
        const result=engine.resultFor(room.game);
        room.game={...room.game,phase:'finished',result:{...result,winner,isDraw:false,forfeit:true,forfeitSeat:absent}};
        room.outcome={type:'forfeit',winner,absent};room.disconnect=null;
        room.revision=(room.revision||0)+1;
        await this.saveRoom(room);
        this.broadcast(room,{type:'game-state',state:room.game,revision:room.revision});
      }
      return room;
    }
    if(connected.host && connected.guest) {
      if(room.disconnect){room.disconnect=null;await this.saveRoom(room);this.broadcast(room);}
      return room;
    }
    // If the absent participant returns while the other is now offline,
    // start a fresh timer for the currently absent seat.
    if(room.disconnect && connected[room.disconnect.seat] && !connected[room.disconnect.seat==='host'?'guest':'host']) {
      room.disconnect={seat:room.disconnect.seat==='host'?'guest':'host',deadline:Date.now()+RECONNECT_MS};
      await this.saveRoom(room);
      if(this.ctx.storage.setAlarm)await this.ctx.storage.setAlarm(room.disconnect.deadline);
      this.broadcast(room);
      return room;
    }
    if(!room.disconnect) {
      const seat=!connected.host?'host':'guest';
      room.disconnect={seat,deadline:Date.now()+RECONNECT_MS};
      await this.saveRoom(room);
      if(this.ctx.storage.setAlarm)await this.ctx.storage.setAlarm(room.disconnect.deadline);
      this.broadcast(room);
    }
    return room;
  }
  async alarm(){
    let room=await this.getRoom();
    if(room && !room.closed && room.disconnect)await this.reconcileConnection(room);
  }
  async closeRoom(room,reason){
    room.closed=true;room.closedReason=reason;
    await this.saveRoom(room);
    this.broadcast(room,{type:'room-closed',reason});
    for(const ws of this.ctx.getWebSockets())try{ws.close(4001,reason);}catch{}
  }
  connectedSeats(room, closingSocket=null){
    const seats=new Set();
    for(const ws of this.ctx.getWebSockets()) {
      // A close callback can run before the runtime removes the socket from its registry.
      if(ws===closingSocket || (typeof ws.readyState==='number' && ws.readyState!==1))continue;
      const attachment=ws.deserializeAttachment();
      // Lobby WebSockets may still be closing while the game page connects.
      if(room.game && attachment?.phase==='lobby')continue;
      if(attachment?.code===room.code && room[attachment.seat+'Token']===attachment.token) seats.add(attachment.seat);
    }
    return {host:seats.has('host'),guest:seats.has('guest')};
  }
  async fetch(request){
    const url=new URL(request.url);
    let room=await this.getRoom();
    if(url.pathname==='/create' && request.method==='POST') {
      if(room) return json({error:'이미 존재하는 방 코드입니다.'},409);
      let code;try{({code}=await request.json());}catch{return json({error:'잘못된 요청입니다.'},400);}
      if(!CODE_RE.test(code)) return json({error:'잘못된 방 코드입니다.'},400);
      room={code,createdAt:Date.now(),hostToken:secureToken(),hostRecoveryKey:secureRecoveryKey(),guestToken:null,readyAt:{host:0,guest:0},startAt:null,closed:false};
      await this.saveRoom(room);
      return json({code,seat:'host',token:room.hostToken,recoveryKey:room.hostRecoveryKey,room:this.publicView(room)},201);
    }
    if(!room) return json({error:'존재하지 않는 방입니다.'},404);
    if(room.closed)return json({error:'종료된 방입니다. 새 방을 만들어 주세요.'},410);
    if(Date.now()-room.createdAt>MAX_AGE_MS) return json({error:'방 유효 시간이 만료되었습니다.'},410);
    if(url.pathname==='/join' && request.method==='POST') {
      if(room.guestToken) return json({error:'이미 두 사람이 입장한 방입니다.'},409);
      room={...room,guestToken:secureToken(),guestRecoveryKey:secureRecoveryKey(),readyAt:{host:0,guest:0},startAt:null};await this.saveRoom(room);
      this.broadcast(room);
      return json({code:room.code,seat:'guest',token:room.guestToken,recoveryKey:room.guestRecoveryKey,room:this.publicView(room)},200);
    }
    if(url.pathname==='/recover' && request.method==='POST') {
      let data;try{data=await request.json();}catch{return json({error:'잘못된 복귀 요청입니다.'},400);}
      const key=typeof data?.recoveryKey==='string'?data.recoveryKey.trim().toUpperCase():'';
      if(!RECOVERY_KEY_RE.test(key))return json({error:'복귀 코드는 16자리입니다.'},400);
      room=await this.ensureGame(room);
      if(!room.game || !room.gameConnectionsReady)return json({error:'진행 중인 경기에서만 복귀할 수 있습니다.'},409);
      // Reconcile before accepting recovery, so a late request cannot reverse a forfeit.
      room=await this.reconcileConnection(room);
      if(room.closed || room.game.phase==='finished')return json({error:'이미 종료된 경기입니다.'},410);
      const seat=key===room.hostRecoveryKey?'host':key===room.guestRecoveryKey?'guest':null;
      if(!seat)return json({error:'방 코드 또는 플레이어별 복귀 코드가 올바르지 않습니다.'},403);
      if(!room.disconnect || room.disconnect.seat!==seat || Date.now()>=room.disconnect.deadline)
        return json({error:'현재 복귀할 수 없는 상태입니다. 기존 게임 화면을 확인하세요.'},409);
      return json({code:room.code,seat,token:room[seat+'Token'],recoveryKey:key,room:this.publicView(room),state:room.game,revision:room.revision||0});
    }
    if(url.pathname==='/leave' && request.method==='POST'){
      let data;try{data=await request.json();}catch{return json({error:'잘못된 요청입니다.'},400);}
      const seat=this.auth(room,data?.token);if(!seat)return json({error:'접근 권한이 없습니다.'},401);
      if(room.game){
        if(room.game.phase==='finished')return json({ok:true,finished:true});
        // An explicit exit is a forfeit; closing a tab is only a temporary disconnect.
        const winner=playerForSeat(seat==='host'?'guest':'host');
        const result=engine.resultFor(room.game);
        room.game={...room.game,phase:'finished',result:{...result,winner,isDraw:false,forfeit:true,forfeitSeat:seat}};
        room.disconnect=null;room.outcome={type:'forfeit',winner,absent:seat};
        room.revision=(room.revision||0)+1;
        await this.saveRoom(room);
        this.broadcast(room,{type:'game-state',state:room.game,revision:room.revision});
        return json({ok:true,finished:true});
      }
      await this.closeRoom(room,'상대방이 대기실에서 나갔습니다. 새 방을 생성해 주세요.');
      return json({ok:true,closed:true});
    }
    if(url.pathname==='/ready' && request.method==='POST'){
      let data;try{data=await request.json();}catch{return json({error:'잘못된 요청입니다.'},400);}
      const seat=this.auth(room,data?.token);if(!seat)return json({error:'접근 권한이 없습니다.'},401);
      if(!room.guestToken)return json({error:'상대방이 아직 입장하지 않았습니다.'},409);
      if(room.game||room.startAt)return json({error:'이미 경기가 시작되고 있습니다.'},409);
      if(typeof data.ready!=='boolean')return json({error:'준비 여부가 올바르지 않습니다.'},400);
      if(data.ready){room.readyAt[seat] ||= Date.now();}
      else {
        if(!room.readyAt[seat])return json({error:'준비 상태가 아닙니다.'},409);
        if(Date.now()-room.readyAt[seat]<READY_CANCEL_MS)return json({error:'3초 후에 준비를 취소할 수 있습니다.'},409);
        room.readyAt[seat]=0;
      }
      if(room.readyAt.host && room.readyAt.guest)room.startAt=Date.now()+COUNTDOWN_MS;
      await this.saveRoom(room);this.broadcast(room);
      return json({room:this.publicView(room),state:null,revision:0});
    }
    if(url.pathname==='/status' && request.method==='POST') {
      let data;try{data=await request.json();}catch{return json({error:'잘못된 요청입니다.'},400);}
      const seat=this.auth(room,data?.token);
      if(!seat)return json({error:'접근 권한이 없습니다.'},401);
      room=await this.ensureGame(room);
      if(room.disconnect)room=await this.reconcileConnection(room);
      if(room.closed)return json({error:room.closedReason},410);
      return json({seat,room:this.publicView(room),state:room.game||null,revision:room.revision||0});
    }
    if(url.pathname==='/action' && request.method==='POST') {
      let data;try{data=await request.json();}catch{return json({error:'잘못된 요청입니다.'},400);}
      const seat=this.auth(room,data?.token);
      if(!seat)return json({error:'접근 권한이 없습니다.'},401);
      room=await this.ensureGame(room);
      if(room.disconnect)room=await this.reconcileConnection(room);
      if(room.closed)return json({error:room.closedReason},410);
      if(room.disconnect)return json({error:'상대방 재접속을 기다리는 중입니다. 경기가 일시 정지되었습니다.',room:this.publicView(room)},409);
      if(room.game && !room.gameConnectionsReady)return json({error:'양쪽 플레이어의 경기 화면 연결을 기다리고 있습니다.',room:this.publicView(room)},409);
      if(!room.game)return json({error:'두 사람이 준비하고 카운트다운이 끝나야 합니다.'},409);
      if(!validAction(data.action))return json({error:'잘못된 게임 행동입니다.'},400);
      if(data.action.revision!==room.revision)return json({error:'오래된 경기 상태입니다. 최신 상태를 다시 확인하세요.',revision:room.revision},409);
      if(room.game.phase==='finished')return json({error:'이미 종료된 경기입니다.'},409);
      if(room.game.currentPlayer!==playerForSeat(seat))return json({error:'상대방 차례입니다.'},403);
      const before=room.game;let next;
      try {
        if(data.action.type==='reroll')next=engine.reroll(before,randomValue);
        else if(data.action.type==='choose-reroll')next=engine.chooseReroll(before,data.action.chooseNew);
        else next=engine.place(before,data.action.player,data.action.line,randomValue);
        const actionEvent=next.lastAction;
        if(next.phase==='roll')next=engine.roll(next,randomValue);
        room.game=next;room.revision+=1;
        await this.saveRoom(room);
        this.broadcast(room,{type:'game-state',state:room.game,revision:room.revision,actionEvent});
        return json({state:room.game,revision:room.revision,actionEvent});
      }catch(error){return json({error:error.message||'잘못된 동작입니다.'},409);}
    }
    if(url.pathname==='/ws' && request.headers.get('upgrade')?.toLowerCase()==='websocket') {
      const parts=(request.headers.get('sec-websocket-protocol')||'').split(',').map(x=>x.trim());
      const seat=this.auth(room,parts[1]);
      if(parts[0]!=='dice-match'||!seat) return json({error:'접근 권한이 없습니다.'},401);
      const [client,server]=Object.values(new WebSocketPair());
      room=await this.ensureGame(room);
      this.ctx.acceptWebSocket(server);
      server.serializeAttachment({code:room.code,seat,token:parts[1],phase:room.game?'game':'lobby'});
      if(room.game)room=await this.reconcileConnection(room);
      this.broadcast(room);
      if(room.game)server.send(JSON.stringify({type:'game-state',state:room.game,revision:room.revision||0}));
      return new Response(null,{status:101,webSocket:client,headers:{'sec-websocket-protocol':'dice-match'}});
    }
    return json({error:'지원하지 않는 요청입니다.'},404);
  }
  auth(room,token){return typeof token==='string' && token===room.hostToken?'host':(typeof token==='string' && room.guestToken && token===room.guestToken?'guest':null);}
  broadcast(room,extra){
    const message=JSON.stringify({type:'presence',room:this.publicView(room)});
    for(const ws of this.ctx.getWebSockets()) try{ws.send(message);if(extra)ws.send(JSON.stringify(extra));}catch{}
  }
  async webSocketMessage(ws,message){
    try{ws.send(JSON.stringify({type:'error',message:'게임 행동은 인증된 /action 요청으로 처리합니다.'}));}catch{}
  }
  async webSocketClose(ws,code,reason){
    try{ws.close(code,reason);}catch{}
    let room=await this.getRoom();
    if(room && !room.closed)room=await this.ensureGame(room);
    if(room && !room.closed && !room.game){
      // 대기실에서 연결을 끊으면 초대 코드를 폐기합니다. 게임 중에는 재연결을 허용합니다.
      await this.closeRoom(room,'한 플레이어가 대기실 연결을 종료했습니다.');
    }else if(room && !room.closed){
      if(room.game && ws.deserializeAttachment()?.phase!=='lobby')await this.reconcileConnection(room,ws);
      else this.broadcast(room);
    }
  }
  async webSocketError(ws){
    try{ws.close(1011,'연결 오류');}catch{}
    const room=await this.getRoom();if(room && !room.closed){if(room.game && ws.deserializeAttachment()?.phase!=='lobby')await this.reconcileConnection(room,ws);else this.broadcast(room);}
  }
}
