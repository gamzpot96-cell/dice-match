'use strict';
/* Online lobby: server-authoritative room lifecycle, two-sided readiness and countdown. */
const $ = id => document.getElementById(id);
const codeInput=$('roomCode'), roomHint=$('roomHint');
const recoveryRoomCode=$('recoveryRoomCode'), recoveryKeyInput=$('recoveryKey');
const ROOM_STORAGE_KEY='dice-match-room';
// A normal browser keeps the private seat token across closed tabs.
// Incognito deliberately clears localStorage when its last private window closes.
function saveRoomAuth(auth){
 const value=JSON.stringify(auth);
 sessionStorage.setItem(ROOM_STORAGE_KEY,value);
 try{localStorage.setItem(ROOM_STORAGE_KEY,value);}catch{}
}
function clearRoomAuth(){
 sessionStorage.removeItem(ROOM_STORAGE_KEY);
 try{localStorage.removeItem(ROOM_STORAGE_KEY);}catch{}
}
function savedRoomAuth(){
 try{return sessionStorage.getItem(ROOM_STORAGE_KEY)||localStorage.getItem(ROOM_STORAGE_KEY);}catch{return sessionStorage.getItem(ROOM_STORAGE_KEY);}
}

const base=(window.DICE_MATCH_SERVER_URL||'').trim().replace(/\/$/,'');
let connection=null, credentials=null, online=false, busy=false, roomState=null;
let timer=null, clockOffset=0, navigating=false, countdownChecking=false;
function status(heading,message){$('serverStatus').textContent=heading;$('serverHint').textContent=message;}
function syncButtons(){
 $('createRoom').disabled=!online||busy||!!credentials;
 $('joinRoom').disabled=!online||busy||!!credentials||!DiceMatchOnlineProtocol.isRoomCode(codeInput.value);
 $('recoverMatch').disabled=!online||busy||!!credentials||!DiceMatchOnlineProtocol.isRoomCode(recoveryRoomCode.value)||!/^[A-HJ-NP-Z2-9]{16}$/.test(recoveryKeyInput.value);
}
function stopTimer(){if(timer!==null)clearInterval(timer);timer=null;$('countdownOverlay').hidden=true;}
function clearConnection(){if(connection){connection.onmessage=null;connection.onclose=null;connection.onerror=null;connection.close();connection=null;}}
function resetRoom(notice='방을 나왔습니다. 새 방을 만들거나 다른 방에 참여하세요.'){
 stopTimer();clearConnection();credentials=null;roomState=null;clearRoomAuth();recoveryKeyInput.value='';
 $('entryGrid').hidden=false;$('recoveryEntry').hidden=false;$('waitingRoom').hidden=true;$('copyCode').textContent='코드 복사';
 $('startOnlineGame').disabled=true;$('startOnlineGame').textContent='경기 준비';
 status('대기실로 돌아왔습니다',notice);syncButtons();
}
async function countdownTick(){
 if(!roomState?.startAt||!credentials)return;
 const remaining=roomState.startAt-(Date.now()-clockOffset);
 const word=remaining>2600?'3':remaining>1600?'2':remaining>600?'1':'START';
 $('countdownText').textContent=word;
 $('countdownOverlay').hidden=false;
 if(remaining<=0&&!countdownChecking){
   // Server confirms countdown completion before we close the lobby WebSocket.
   // Otherwise a slightly fast browser clock could close the room prematurely.
   countdownChecking=true;
   try{
     const response=await call('/rooms/'+credentials.code+'/status',{token:credentials.token});
     if(response.state && response.room.phase==='playing'){
       navigating=true;stopTimer();window.location.assign('./online-game.html');
     }
   }catch(error){
     if(/종료된 방|존재하지 않는 방/.test(error.message))resetRoom(error.message);
   }finally{countdownChecking=false;}
 }
}
function drawReady(room){
 const seat=credentials.seat,peer=seat==='host'?'guest':'host';
 const ready=Boolean(room.ready?.[seat]), otherReady=Boolean(room.ready?.[peer]);
 $('startOnlineGame').hidden=false;
 $('startOnlineGame').disabled=true;
 $('rotateCode').hidden=seat!=='host';
 $('rotateCode').disabled=busy||Boolean(room.startAt);
 if(room.startAt){
   $('startOnlineGame').textContent='경기 시작 준비 완료';
   $('presenceLabel').textContent='양쪽 모두 준비 완료! 경기가 곧 시작됩니다.';
   if(!timer)timer=setInterval(countdownTick,150);
   countdownTick();return;
 }
 stopTimer();
 if(!ready){
   $('startOnlineGame').textContent='경기 준비';
   $('startOnlineGame').disabled=busy||room.phase!=='ready';
   $('presenceLabel').textContent=room.phase==='waiting'?'친구가 입장하기를 기다리는 중입니다.':
     otherReady?'상대방이 준비되었습니다. 경기 준비를 눌러 주세요.':
     room.connected[peer]?'상대방 접속 중 · 경기 준비를 눌러 주세요.':'친구가 입장했습니다. 접속을 기다리는 중입니다.';
 }else{
   const canCancel=(Date.now()-clockOffset)-(room.readyAt?.[seat]||0)>=3000;
   $('startOnlineGame').textContent=canCancel?'준비 취소':'준비 중…';
   $('startOnlineGame').disabled=busy||!canCancel;
   $('presenceLabel').textContent=canCancel?'준비 완료 · 상대방을 기다리는 중입니다. 준비를 취소할 수 있습니다.':
     '준비 완료 · 상대방을 기다리는 중입니다. 3초 후 준비 취소 가능';
   if(!timer)timer=setInterval(()=>drawReady(roomState),200);
 }
}
function displayRoom(room){
 if(!credentials||!room)return;
 if(room.phase==='closed'){resetRoom('상대방이 대기실을 나가 방이 종료되었습니다. 새 방을 생성해 주세요.');return;}
 if(room.serverNow)clockOffset=Date.now()-room.serverNow;
 roomState=room;
 $('entryGrid').hidden=true;$('recoveryEntry').hidden=true;$('waitingRoom').hidden=false;
 $('activeCode').textContent=room.code;
 $('activeRecoveryKey').textContent=credentials.recoveryKey||'이전 버전에서 생성된 방';
 $('copyRecoveryKey').disabled=!credentials.recoveryKey;
 $('seatLabel').textContent=credentials.seat==='host'?'내 역할: 방장':'내 역할: 참여자';
 drawReady(room);
}
async function call(path,body){
 const response=await fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body||{})});
 const data=await response.json().catch(()=>({error:'서버 응답을 해석할 수 없습니다.'}));
 if(!response.ok)throw new Error(data.error||'서버 요청에 실패했습니다.');
 return data;
}
function connect(){
 clearConnection();
 const wsUrl=base.replace(/^http/,'ws')+'/rooms/'+credentials.code+'/ws';
 connection=new WebSocket(wsUrl,['dice-match',credentials.token]);
 connection.onmessage=event=>{
   try{const data=JSON.parse(event.data);
     if(data.type==='room-closed'){resetRoom(data.reason||'상대방이 대기실을 떠나 방이 종료됐습니다.');return;}
     if(data.type==='presence')displayRoom(data.room);
   }catch{}
 };
 connection.onclose=()=>{if(credentials&&!navigating)resetRoom('대기실 연결이 종료되어 기존 초대 코드를 폐기했습니다. 새 방을 생성해 주세요.');};
 connection.onerror=()=>{if(credentials)$('presenceLabel').textContent='연결 오류가 발생했습니다. 잠시 후 상태를 확인하세요.';};
}
async function enter(run){
 busy=true;syncButtons();
 try{
   const result=await run();
   credentials={code:result.code,seat:result.seat,token:result.token,recoveryKey:result.recoveryKey};
   saveRoomAuth(credentials);
   if(result.room.phase==='playing'){navigating=true;window.location.assign('./online-game.html');return;}
   displayRoom(result.room);connect();status('서버 연결됨','온라인 대기실에 접속했습니다.');
 }catch(error){status('요청 실패',error.message);}
 finally{busy=false;syncButtons();}
}
codeInput.addEventListener('input',()=>{
 codeInput.value=DiceMatchOnlineProtocol.normalizeRoomCode(codeInput.value).slice(0,6);
 roomHint.textContent=DiceMatchOnlineProtocol.isRoomCode(codeInput.value)?'입장할 수 있는 코드 형식입니다.':'영문 대문자와 숫자 6자리 (I, O, 0, 1 제외)';syncButtons();
});
// The return form never invokes /join: the server must authenticate the original seat.
function normalizeRecoveryInput(input,max){input.value=DiceMatchOnlineProtocol.normalizeRoomCode(input.value).slice(0,max);syncButtons();}
recoveryRoomCode.addEventListener('input',()=>normalizeRecoveryInput(recoveryRoomCode,6));
recoveryKeyInput.addEventListener('input',()=>normalizeRecoveryInput(recoveryKeyInput,16));
$('recoverMatch').addEventListener('click',()=>enter(async()=>{
 const code=recoveryRoomCode.value;
 const result=await call('/rooms/'+code+'/recover',{recoveryKey:recoveryKeyInput.value});
 if(result.room.phase!=='playing')throw new Error('진행 중인 경기가 아닙니다.');
 return result;
}));
$('copyRecoveryKey').addEventListener('click',async()=>{
 try{await navigator.clipboard.writeText(credentials.recoveryKey);$('copyRecoveryKey').textContent='복사됨';}
 catch{$('copyRecoveryKey').textContent='코드를 선택해 복사하세요.';}
});
$('createRoom').addEventListener('click',()=>enter(()=>call('/rooms',{})));
$('joinRoom').addEventListener('click',()=>enter(()=>call('/rooms/'+codeInput.value+'/join',{})));
$('copyCode').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(credentials.code);$('copyCode').textContent='복사됨';}catch{$('copyCode').textContent='코드: '+credentials.code;}});
$('leaveRoom').addEventListener('click',async()=>{
 if(!credentials||busy)return;busy=true;
 try{await call('/rooms/'+credentials.code+'/leave',{token:credentials.token});}
 catch(error){status('나가기 확인',error.message);}
 finally{resetRoom('대기실에서 나왔습니다. 이전 초대 코드는 더 이상 사용할 수 없습니다.');busy=false;}
});
$('rotateCode').addEventListener('click',async()=>{
 if(!credentials||credentials.seat!=='host'||busy)return;
 busy=true;$('rotateCode').disabled=true;
 try{
   const result=await call('/rooms/'+credentials.code+'/rotate',{token:credentials.token});
   clearConnection();stopTimer();
   credentials={code:result.code,seat:'host',token:result.token,recoveryKey:result.recoveryKey};
   saveRoomAuth(credentials);
   displayRoom(result.room);connect();status('초대 코드 갱신','이전 코드는 폐기되었습니다. 새로운 코드를 친구에게 알려주세요.');
 }catch(error){status('코드 갱신 실패',error.message);}
 finally{busy=false;if(roomState)drawReady(roomState);}
});
$('startOnlineGame').addEventListener('click',async()=>{
 if(!credentials||busy||!roomState||roomState.startAt)return;
 const seat=credentials.seat,already=Boolean(roomState.ready?.[seat]);
 const allowed=already?(Date.now()-clockOffset)-(roomState.readyAt?.[seat]||0)>=3000:roomState.phase==='ready';
 if(!allowed)return;
 busy=true;drawReady(roomState);
 try{const result=await call('/rooms/'+credentials.code+'/ready',{token:credentials.token,ready:!already});displayRoom(result.room);}
 catch(error){status('경기 준비 실패',error.message);}
 finally{busy=false;if(roomState)drawReady(roomState);}
});
$('startMatchButton').addEventListener('click',async()=>{
 $('matchIntro').hidden=true;$('matchContent').hidden=false;
 if(!/^https?:\/\//.test(base)){status('서버 주소 미설정','js/online-config.js에 배포된 Cloudflare Workers 주소를 입력해야 사용할 수 있습니다.');return;}
 try{
   const response=await fetch(base+'/health');if(!response.ok)throw Error();
   const data=await response.json();if(data.phase!=='gameplay')throw Error();
   online=true;status('서버 연결 가능','온라인 방 생성과 경기 진행을 지원합니다.');
   const saved=savedRoomAuth();
   if(saved){try{
     const auth=JSON.parse(saved);if(!DiceMatchOnlineProtocol.isRoomCode(auth.code))throw Error();
     const result=await call('/rooms/'+auth.code+'/status',{token:auth.token});
     if(result.state?.phase==='finished')throw Error('종료된 경기입니다.');
     credentials=auth;saveRoomAuth(auth);displayRoom(result.room);connect();
     if(result.room.phase==='playing'){navigating=true;window.location.assign('./online-game.html');}
   }catch{clearRoomAuth();}}
   syncButtons();
 }catch{status('서버 연결 실패','서버 주소 또는 네트워크 상태를 확인하세요. 실제 서버에 연결하기 전에는 방을 만들 수 없습니다.');}
});
