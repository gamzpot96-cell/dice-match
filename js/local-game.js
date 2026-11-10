"use strict";
/* 로컬/AI 공용 UI. 모든 게임 판정은 DiceMatchEngine에서 수행합니다. */
(function () {
  const engine = window.DiceMatchEngine;
  const boardLayout = window.DiceMatchBoardLayout;
  const sound = window.DiceMatchSound;
  const isAiMode = window.location.pathname.endsWith('/ai.html');
  const computer = isAiMode ? window.DiceMatchAI : null;
  const aiPlayer = 1;
  // AI 행동을 충분히 관찰할 수 있도록 단계별로 다른 대기 시간을 적용합니다.
  const AI_THINK_DELAY = 1100;
  const AI_ROLL_REVEAL_MS = 2100;
  const AI_REROLL_REVEAL_MS = 2100;
  const AI_RESULT_REVIEW_MS = 2200;
  const AI_ATTACK_REVIEW_MS = 2900;
  const HUMAN_TURN_REVEAL_MS = 1600;
  const ATTACK_ANIMATION_MS = 820;
  const RESULT_REVEAL_MS = 1000;
  const AI_DIFFICULTY_KEY = 'dice-match-ai-difficulty';
  function loadAiDifficulty() {
    if (!isAiMode) return null;
    const select = document.getElementById('aiDifficulty');
    try {
      const saved = window.localStorage.getItem(AI_DIFFICULTY_KEY);
      if (['easy', 'normal', 'hard'].includes(saved)) select.value = saved;
    } catch (error) {
      // 파일 직접 실행, 개인정보 보호 설정 등의 경우 저장 기능 없이 게임 진행
    }
    return select.value;
  }
  let aiDifficulty = loadAiDifficulty();
  function changeAiDifficulty(nextDifficulty) {
    if (!['easy', 'normal', 'hard'].includes(nextDifficulty)) return;
    aiDifficulty = nextDifficulty;
    try {
      window.localStorage.setItem(AI_DIFFICULTY_KEY, nextDifficulty);
    } catch (error) {
      // 저장을 사용할 수 없어도 현재 경기의 난이도 변경은 정상 동작
    }
    message = `AI 난이도가 ${document.getElementById('aiDifficulty').selectedOptions[0].textContent.split(' · ')[0]}(으)로 변경되었습니다. 다음 AI 행동부터 적용됩니다.`;
  }
  if (isAiMode) {
    document.getElementById('aiDifficulty').addEventListener('change', event => {
      changeAiDifficulty(event.target.value);
    });
  }
  let aiJob = null;
  let humanRollJob = null;
  let humanRollPause = false;
  let attackTimer = null;
  let resultRevealTimer = null;
  let resultRevealScheduled = false;
  let resultVisible = false;
  let gameSequence = 0;
  let attackAnimation = null;
  const isComputerTurn = () => isAiMode && state.currentPlayer === aiPlayer && state.phase !== 'finished';
  const pipPositions = {
    1: [5], 2: [1, 9], 3: [1, 5, 9],
    4: [1, 3, 7, 9], 5: [1, 3, 5, 7, 9], 6: [1, 3, 4, 6, 7, 9]
  };
  const el = id => document.getElementById(id);
  const boardElement = el('gameBoard');
  // 각 대전의 선공은 파랑(0) 또는 빨강(1) 중 무작위로 선택합니다.
  function randomFirstPlayer() {
    return Math.floor(Math.random() * 2);
  }
  let state = null; // 시작하기 전에는 경기 상태와 선공을 생성하지 않습니다.
  let message = '선공자의 시작 실드가 자동으로 나옵니다.';
  let lastAnimatedRoll = null;

  function cancelAiJob() {
    if (aiJob !== null) clearTimeout(aiJob);
    aiJob = null;
    if (humanRollJob !== null) clearTimeout(humanRollJob);
    humanRollJob = null;
    humanRollPause = false;
  }
  function aiStepDelay() {
    if (state.phase === 'roll') return AI_THINK_DELAY;
    if (state.lastAction?.type === 'roll' || state.lastAction?.type === 'choose-reroll') return AI_ROLL_REVEAL_MS;
    if (state.lastAction?.type === 'reroll') return AI_REROLL_REVEAL_MS;
    if (state.lastAction?.type === 'attack') return AI_ATTACK_REVIEW_MS;
    if (state.lastAction?.type === 'place') return AI_RESULT_REVIEW_MS;
    return AI_THINK_DELAY;
  }
  function holdAiResultForHuman(action) {
    // AI가 마지막 주사위를 둔 결과를 관찰할 시간을 확보한 후 사람의 주사위를 공개합니다.
    if (!isAiMode || state.currentPlayer !== 0 || state.phase !== 'roll' ||
        !['place', 'attack'].includes(action?.type)) return;
    humanRollPause = true;
    const sequence = gameSequence;
    humanRollJob = window.setTimeout(() => {
      if (sequence !== gameSequence) return;
      humanRollJob = null;
      humanRollPause = false;
      render();
    }, action.type === 'attack' ? AI_ATTACK_REVIEW_MS : HUMAN_TURN_REVEAL_MS);
  }
  function clearAttackAnimation() {
    if (attackTimer !== null) clearTimeout(attackTimer);
    attackTimer = null;
    attackAnimation = null;
  }
  function queueComputer() {
    if (!isComputerTurn() || aiJob !== null) return;
    const sequence = gameSequence;
    aiJob = window.setTimeout(() => {
      aiJob = null;
      if (sequence !== gameSequence || !isComputerTurn()) return;
      const before = state;
      try {
        if (state.phase === 'roll') {
          state = engine.roll(state);
          message = '컴퓨터가 주사위를 공개했습니다.';
        } else if (state.phase === 'place') {
          if (computer.chooseRerollAction(state, aiDifficulty)) {
            state = engine.reroll(state);
            message = '컴퓨터가 다시 굴리기를 사용했습니다.';
          } else {
            const move = computer.choosePlacement(state, aiDifficulty);
            if (!move) throw new Error('컴퓨터가 선택할 수 있는 배치가 없습니다.');
            state = engine.place(state, move.player, move.line);
            if (state.lastAction?.type === 'attack') {
              startAttackAnimation(state.lastAction, before);
              message = `컴퓨터가 라인 ${move.line + 1}에서 공격했습니다.`;
            } else {
              message = `컴퓨터가 라인 ${move.line + 1}에 주사위를 놓았습니다.`;
            }
          }
        } else if (state.phase === 'choose-reroll') {
          const chooseNew = computer.chooseRerollResult(state, aiDifficulty);
          state = engine.chooseReroll(state, chooseNew);
          message = `컴퓨터가 ${chooseNew ? '새 주사위' : '기존 주사위'}를 선택했습니다.`;
        }
      } catch (error) {
        message = `컴퓨터 동작 오류: ${error.message}`;
        render();
        return;
      }
      sound?.transition(before, state);
      holdAiResultForHuman(state.lastAction);
      render();
    }, aiStepDelay());
  }

  function makeDie(die, player) {
    const element = document.createElement('div');
    element.className = `die ${player === 0 ? 'blue' : 'red'}${die.shield ? ' shield' : ''}`;
    element.title = `${die.value} ${die.shield ? '실드' : '일반'} 주사위`;
    element.setAttribute('aria-label', element.title);
    const pips = document.createElement('span');
    pips.className = 'die-pips';
    pips.setAttribute('aria-hidden', 'true');
    for (const position of pipPositions[die.value]) {
      const pip = document.createElement('i');
      pip.style.gridArea = `${Math.ceil(position / 3)} / ${((position - 1) % 3) + 1}`;
      pips.appendChild(pip);
    }
    element.appendChild(pips);
    return element;
  }

  function scores() { return state.boards.map(board => board.map(engine.scoreLine)); }
  function hasPlacement(player, line) {
    return engine.placementsFor(state).some(p => p.player === player && p.line === line);
  }
  function compareSymbol(left, right) {
    if (left > right) return '>';
    if (left < right) return '<';
    return '=';
  }
  function renderAttackOverlay(halves, line) {
    if (!attackAnimation || attackAnimation.line !== line) return;
    const layer = document.createElement('div');
    layer.className = 'attack-layer';
    const striker = makeDie({ value: attackAnimation.value, shield: false }, attackAnimation.attacker);
    striker.classList.add('attack-fly', attackAnimation.attacker === 0 ? 'from-left' : 'from-right');
    layer.appendChild(striker);
    const removedWrap = document.createElement('div');
    removedWrap.className = `attack-removed ${attackAnimation.defender === 0 ? 'to-left' : 'to-right'} count-${Math.min(attackAnimation.removedDice.length, 3)}`;
    for (const die of attackAnimation.removedDice) {
      const removedDie = makeDie(die, attackAnimation.defender);
      removedDie.classList.add('removed-die');
      removedWrap.appendChild(removedDie);
    }
    layer.appendChild(removedWrap);
    halves.appendChild(layer);
  }
  function renderBoard() {
    boardElement.replaceChildren();
    const lineScores = scores();
    for (let line = 0; line < 3; line += 1) {
      const row = document.createElement('div');
      row.className = 'line-row';
      const halves = document.createElement('div');
      halves.className = 'board-halves';
      const scoreBridge = document.createElement('div');
      scoreBridge.className = 'line-score-bridge';
      scoreBridge.innerHTML = `<span class="score-left">${lineScores[0][line]}</span><span class="score-arrow ${lineScores[0][line] === lineScores[1][line] ? 'tie' : (lineScores[0][line] > lineScores[1][line] ? 'left' : 'right')}">${compareSymbol(lineScores[0][line], lineScores[1][line])}</span><span class="score-right">${lineScores[1][line]}</span>`;
      halves.appendChild(scoreBridge);
      for (let player = 0; player < 2; player += 1) {
        const half = document.createElement('button');
        half.type = 'button';
        half.className = `lane-half ${player === 0 ? 'left' : 'right'}`;
        const dice = state.boards[player][line];
        const available = hasPlacement(player, line) && !isComputerTurn();
        half.disabled = !available;
        half.setAttribute('aria-label', `플레이어 ${player + 1} 라인 ${line + 1}: ${dice.length}개 배치됨${available ? ', 여기를 눌러 주사위 배치' : ''}`);
        if (available) {
          half.classList.add('available');
          half.addEventListener('click', () => perform(() => engine.place(state, player, line), `라인 ${line + 1} 처리 완료`));
        }
        const diceFlow = document.createElement('span');
        diceFlow.className = 'dice-flow';
        for (const group of boardLayout.groupsForLine(dice)) {
          const cluster = document.createElement('span');
          cluster.className = `dice-cluster${group.dice.length > 1 ? ' matched' : ''}`;
          if (group.dice.length > 1) cluster.setAttribute('aria-label', `숫자 ${group.value} ${group.dice.length}개 조합`);
          for (const die of group.dice) cluster.appendChild(makeDie(die, player));
          diceFlow.appendChild(cluster);
        }
        half.appendChild(diceFlow);
        halves.appendChild(half);
      }
      const divider = document.createElement('span');
      divider.className = 'center-divider';
      divider.setAttribute('aria-hidden', 'true');
      halves.insertBefore(divider, halves.children[2]);
      renderAttackOverlay(halves, line);
      row.append(halves);
      boardElement.appendChild(row);
    }
  }

  function renderPendingDice(selectingReroll) {
    for (let p = 0; p < 2; p += 1) {
      const slot = el(`pending${p}`);
      slot.replaceChildren();
      slot.classList.toggle('is-current', Boolean(state.pending && state.currentPlayer === p));
      slot.classList.toggle('is-comparing', selectingReroll && state.currentPlayer === p);
    }
    if (!state.pending || state.phase === 'finished') return;
    const player = state.currentPlayer;
    const slot = el(`pending${player}`);
    const isShield = state.pending.kind === 'start-shield';
    if (selectingReroll) {
      // AI도 리롤 이전/이후의 주사위를 보여줍니다. 단 AI 주사위는 클릭할 수 없습니다.
      // 기존 주사위를 위로 올리고 새 주사위를 아래에 보이되, 버튼은 같은 위치에 유지합니다.
      for (const [useNew, label] of [[false, '기존'], [true, '새 주사위']]) {
        const choice = document.createElement(isComputerTurn() ? 'div' : 'button');
        if (!isComputerTurn()) choice.type = 'button';
        choice.className = 'side-die-choice';
        choice.setAttribute('aria-label', `${label} 주사위 ${useNew ? state.pending.rerollCandidate : state.pending.value} 선택`);
        const dieValue = useNew ? state.pending.rerollCandidate : state.pending.value;
        const dieElement = makeDie({ value: dieValue, shield: isShield }, player);
        if (useNew) dieElement.classList.add('die-enter');
        choice.appendChild(dieElement);
        if (!isComputerTurn()) {
          choice.addEventListener('click', () => perform(() => engine.chooseReroll(state, useNew), `${label} 주사위를 선택했습니다.`));
        }
        slot.appendChild(choice);
      }
      return;
    }
    const dieElement = makeDie({ value: state.pending.value, shield: state.pending.kind !== 'normal' }, player);
    if (state.lastAction?.type === 'roll' && lastAnimatedRoll !== state.lastAction) {
      dieElement.classList.add('die-enter');
      lastAnimatedRoll = state.lastAction;
    }
    slot.appendChild(dieElement);
  }
  function updateRerollButtons() {
    for (let p = 0; p < 2; p += 1) {
      const button = el(p === 0 ? 'rerollButton' : 'rerollButton1');
      const exhausted = state.rerollUsed[p];
      const current = state.currentPlayer === p && state.phase !== 'finished';
      const allowed = current && state.phase === 'place' &&
        ['normal', 'start-shield'].includes(state.pending?.kind) && !exhausted;
      button.classList.remove('is-active', 'is-waiting', 'is-spent', 'is-ai');
      if (isAiMode && p === 1) {
        button.textContent = exhausted ? 'AI 사용 완료' : 'AI 자동 사용';
        button.classList.add('is-ai');
        button.disabled = true;
      } else {
        button.textContent = exhausted ? '주사위 돌리기 (0회)' : '주사위 돌리기 (1회)';
        button.disabled = !allowed;
        button.classList.add(exhausted ? 'is-spent' : allowed ? 'is-active' : 'is-waiting');
      }
    }
  }

  function render() {
    if (state.phase === 'roll' && !isComputerTurn() && !humanRollPause) {
      try {
        const beforeRoll = state;
        state = engine.roll(state);
        sound?.transition(beforeRoll, state);
        message = state.pending.kind === 'start-shield' ? '시작 실드 주사위가 나왔습니다.' : `플레이어 ${state.currentPlayer + 1}의 주사위가 나왔습니다.`;
      } catch (error) {
        message = `자동 굴리기 오류: ${error.message}`;
      }
    }
    const lineScores = scores();
    for (let p = 0; p < 2; p += 1) {
      const firstBadge = el(`first${p}`);
      if (firstBadge) firstBadge.hidden = state.firstPlayer !== p;
      el(`total${p}`).textContent = `${lineScores[p].reduce((sum, val) => sum + val, 0)}`;
      const active = state.phase !== 'finished' && state.currentPlayer === p;
      el(`player${p}`).classList.toggle('active', active);
      el(`turn${p}`).hidden = !active;
      if (isAiMode && p === 1) el(`turn${p}`).textContent = active ? '생각 중' : 'AI';
    }
    const phases = { roll: humanRollPause ? 'AI 배치 결과 확인' : '굴리기 대기', place: '배치할 라인 선택', 'choose-reroll': '리롤 결과 선택', finished: '게임 종료' };
    el('phaseText').textContent = phases[state.phase] || '진행 중';
    updateRerollButtons();
    const selectingReroll = state.phase === 'choose-reroll';
    // 비교 주사위는 하단 패널이 아니라 양쪽 필드 옆 준비 칸에서 선택합니다.
    renderPendingDice(selectingReroll);

    renderBoard();
    renderResult();
    queueComputer();
  }
  function renderResult() {
    const finished = state.phase === 'finished';
    const panel = el('resultPanel');
    panel.hidden = !(finished && resultVisible);
    if (!finished) return;
    // 최초 종료 순간에 한 번만 예약합니다. 다른 UI 갱신으로 타이머가 다시 시작되지 않습니다.
    if (!resultRevealScheduled) {
      resultRevealScheduled = true;
      const sequence = gameSequence;
      resultRevealTimer = window.setTimeout(() => {
        if (sequence !== gameSequence || state.phase !== 'finished') return;
        resultRevealTimer = null;
        resultVisible = true;
        el('resultPanel').hidden = false;
      }, RESULT_REVEAL_MS);
    }
    const result = state.result;
    el('resultHeading').textContent = result.isDraw ? '무승부!' : isAiMode ? (result.winner === 0 ? '승리!' : '컴퓨터 승리!') : `플레이어 ${result.winner + 1} 승리!`;
    el('resultSummary').textContent = `라인 승리 ${result.wins[0]} : ${result.wins[1]} · 총점 ${result.totals[0]} : ${result.totals[1]}`;
    el('resultLines').replaceChildren();
    result.lineScores[0].forEach((point, index) => {
      const row = document.createElement('div');
      row.className = 'result-line';
      row.textContent = `라인 ${index + 1}     플레이어 1: ${point}점 / 플레이어 2: ${result.lineScores[1][index]}점`;
      el('resultLines').appendChild(row);
    });
  }

  function startAttackAnimation(lastAction, beforeState) {
    clearAttackAnimation();
    const defender = 1 - lastAction.player;
    attackAnimation = {
      line: lastAction.line,
      attacker: lastAction.player,
      defender,
      value: lastAction.value,
      removedDice: beforeState.boards[defender][lastAction.line].filter(d => d.value === lastAction.value && !d.shield).map(d => ({ ...d }))
    };
    attackTimer = window.setTimeout(() => {
      clearAttackAnimation();
      render();
    }, ATTACK_ANIMATION_MS);
  }

  function perform(action, fallback) {
    if (isComputerTurn()) return;
    try {
      const before = state;
      state = action();
      sound?.transition(before, state);
      if (state.lastAction?.type === 'attack') {
        startAttackAnimation(state.lastAction, before);
        message = `플레이어 ${state.lastAction.player + 1} 공격! 상대 주사위를 밀어냈습니다.`;
      } else if (state.phase === 'finished') message = '최종 판정 완료';
      else message = fallback;
      render();
    } catch (error) {
      message = `동작 불가: ${error.message}`;
      render();
    }
  }
  for (let p = 0; p < 2; p += 1) {
    el(p === 0 ? 'rerollButton' : 'rerollButton1').addEventListener('click', () => {
      if (p !== state.currentPlayer || isComputerTurn()) return;
      perform(() => engine.reroll(state), '리롤 결과를 선택하세요.');
    });
  }


  function newMatch() {
    cancelAiJob();
    if (resultRevealTimer !== null) clearTimeout(resultRevealTimer);
    resultRevealTimer = null;
    resultRevealScheduled = false;
    resultVisible = false;
    el('resultPanel').hidden = true;
    sound?.stop();
    clearAttackAnimation();
    gameSequence += 1;
    lastAnimatedRoll = null;
    state = engine.newGame(randomFirstPlayer());
    message = '새 게임의 시작 실드가 자동으로 나옵니다.';
    render();
  }
  // Compact sound menu lives in the header and does not change the page height.
  const soundToggle = el('soundToggle');
  const soundMenu = el('soundMenu');
  const soundEnabled = el('soundEnabled');
  const soundVolume = el('soundVolume');
  function refreshSoundMenu() {
    if (!sound) return;
    const options = sound.getSettings();
    soundEnabled.checked = options.enabled;
    soundVolume.value = String(options.volume);
    soundVolume.disabled = !options.enabled;
    el('soundVolumeValue').textContent = `${options.volume}%`;
    soundToggle.textContent = options.enabled ? '♫ 효과음' : '♪ 음소거';
    soundToggle.setAttribute('aria-label', options.enabled ? '효과음 설정 (켜짐)' : '효과음 설정 (꺼짐)');
  }
  soundToggle.addEventListener('click', () => {
    sound?.activate();
    const willOpen = soundMenu.hidden;
    soundMenu.hidden = !willOpen;
    soundToggle.setAttribute('aria-expanded', String(willOpen));
    refreshSoundMenu();
  });
  soundEnabled.addEventListener('change', () => {
    sound?.activate();
    sound?.setEnabled(soundEnabled.checked);
    if (soundEnabled.checked) sound?.play('place', {gain:.5});
    refreshSoundMenu();
  });
  soundVolume.addEventListener('input', () => {
    sound?.activate();
    sound?.setVolume(Number(soundVolume.value));
    refreshSoundMenu();
  });
  document.addEventListener('pointerdown', () => sound?.activate(), {once:true});
  document.addEventListener('keydown', () => sound?.activate(), {once:true});
  document.addEventListener('click', event => {
    if (!soundMenu.hidden && !event.target.closest('.sound-tools')) {
      soundMenu.hidden = true;
      soundToggle.setAttribute('aria-expanded', 'false');
    }
  });
  refreshSoundMenu();
  el('lobbyButton').addEventListener('click', () => el('restartDialog').showModal());
  el('cancelRestart').addEventListener('click', () => el('restartDialog').close());
  el('confirmRestart').addEventListener('click', () => { window.location.assign('./index.html'); });
  el('playAgainButton').addEventListener('click', newMatch);
  el('startMatchButton').addEventListener('click', () => {
    el('matchIntro').hidden = true;
    el('matchContent').hidden = false;
    newMatch();
  }, {once:true});
})();
