/* Generated from js/engine/game.js; authoritative gameplay rules. */
export const engine = (() => {
  'use strict';
  const LINES = 3;
  const CAPACITY = 3;

  function die(value, shield = false) {
    if (!Number.isInteger(value) || value < 1 || value > 6) throw new Error('주사위 숫자는 1~6이어야 합니다.');
    return { value, shield: Boolean(shield) };
  }

  function clone(state) {
    return {
      ...state,
      boards: state.boards.map(board => board.map(line => line.map(d => ({ ...d })))),
      rerollUsed: [...state.rerollUsed],
      pending: state.pending ? { ...state.pending } : null,
      result: state.result ? { ...state.result, lineScores: state.result.lineScores.map(a => [...a]), wins: [...state.result.wins], totals: [...state.result.totals], maxLines: [...state.result.maxLines] } : null,
      lastAction: state.lastAction ? { ...state.lastAction } : null
    };
  }

  function scoreLine(line) {
    const counts = new Map();
    for (const d of line) counts.set(d.value, (counts.get(d.value) || 0) + 1);
    let score = 0;
    for (const [value, count] of counts) {
      if (count > CAPACITY) throw new Error('한 라인에 주사위를 3개 이상 둘 수 없습니다.');
      score += value * (count === 3 ? 5 : count === 2 ? 3 : 1);
    }
    return score;
  }

  function boardFull(board) { return board.every(line => line.length === CAPACITY); }
  function bothFull(state) { return state.boards.every(boardFull); }
  function availableLines(board) { return board.map((line, i) => line.length < CAPACITY ? i : -1).filter(i => i !== -1); }
  function placementsFor(state) {
    if (!state.pending || state.phase !== 'place') return [];
    const targets = state.pending.kind === 'start-shield' || state.pending.kind === 'normal' ? [state.currentPlayer] : [0, 1];
    return targets.flatMap(player => availableLines(state.boards[player]).map(line => ({ player, line })));
  }
  function rollValue(rng = Math.random) {
    const value = rng();
    if (!Number.isFinite(value) || value < 0 || value >= 1) throw new Error('난수 함수는 0 이상 1 미만의 숫자를 반환해야 합니다.');
    return Math.floor(value * 6) + 1;
  }
  function requirePhase(state, phase) {
    if (state.phase !== phase) throw new Error(`현재 단계(${state.phase})에서는 ${phase} 동작을 할 수 없습니다.`);
  }
  function resultFor(state) {
    const lineScores = state.boards.map(board => board.map(scoreLine));
    const wins = [0, 0];
    for (let i = 0; i < LINES; i += 1) {
      if (lineScores[0][i] > lineScores[1][i]) wins[0] += 1;
      if (lineScores[1][i] > lineScores[0][i]) wins[1] += 1;
    }
    const totals = lineScores.map(scores => scores.reduce((sum, value) => sum + value, 0));
    const maxLines = lineScores.map(scores => Math.max(...scores));
    let winner = null;
    for (const candidates of [wins, totals, maxLines]) {
      if (candidates[0] !== candidates[1]) { winner = candidates[0] > candidates[1] ? 0 : 1; break; }
    }
    return { winner, isDraw: winner === null, lineScores, wins, totals, maxLines };
  }
  function settle(state) {
    const next = clone(state);
    next.pending = null;
    if (bothFull(next)) {
      next.phase = 'finished';
      next.result = resultFor(next);
      return next;
    }
    next.currentPlayer = 1 - state.currentPlayer;
    // 현재 플레이어의 모든 라인이 가득 차면 일반 주사위 턴은 건너뜁니다.
    if (boardFull(next.boards[next.currentPlayer])) next.currentPlayer = 1 - next.currentPlayer;
    next.phase = 'roll';
    return next;
  }
  function newGame(firstPlayer = 0) {
    if (![0, 1].includes(firstPlayer)) throw new Error('선공자는 0 또는 1이어야 합니다.');
    return {
      version: '1.2',
      boards: Array.from({ length: 2 }, () => Array.from({ length: LINES }, () => [])),
      currentPlayer: firstPlayer,
      firstPlayer,
      phase: 'roll',
      firstShieldPending: true,
      rerollUsed: [false, false],
      pending: null,
      result: null,
      lastAction: null
    };
  }
  function roll(state, rng) {
    requirePhase(state, 'roll');
    const next = clone(state);
    const kind = next.firstShieldPending ? 'start-shield' : 'normal';
    next.pending = { kind, value: rollValue(rng), rerollCandidate: null };
    next.phase = 'place';
    next.lastAction = { type: 'roll', kind, value: next.pending.value };
    return next;
  }
  function reroll(state, rng) {
    requirePhase(state, 'place');
    if (!['normal', 'start-shield'].includes(state.pending.kind)) throw new Error('리롤은 일반 주사위 또는 선공자의 시작 실드에만 사용할 수 있습니다.');
    if (state.rerollUsed[state.currentPlayer]) throw new Error('리롤 기회를 이미 사용했습니다.');
    const next = clone(state);
    next.rerollUsed[state.currentPlayer] = true;
    // 기존 눈을 제외한 5가지 결과 중 균등하게 하나를 선택합니다.
    const originalValue = next.pending.value;
    const draw = rng === undefined ? Math.random() : rng();
    if (!Number.isFinite(draw) || draw < 0 || draw >= 1) throw new Error('난수 함수는 0 이상 1 미만의 숫자를 반환해야 합니다.');
    const index = Math.floor(draw * 5) + 1;
    next.pending.rerollCandidate = index >= originalValue ? index + 1 : index;
    next.phase = 'choose-reroll';
    next.lastAction = { type: 'reroll', original: next.pending.value, candidate: next.pending.rerollCandidate };
    return next;
  }
  function chooseReroll(state, chooseNew) {
    requirePhase(state, 'choose-reroll');
    if (typeof chooseNew !== 'boolean') throw new Error('새 숫자 선택 여부는 true/false입니다.');
    const next = clone(state);
    if (chooseNew) next.pending.value = next.pending.rerollCandidate;
    next.pending.rerollCandidate = null;
    next.phase = 'place';
    next.lastAction = { type: 'choose-reroll', value: next.pending.value };
    return next;
  }
  function place(state, targetPlayer, lineIndex, rng) {
    requirePhase(state, 'place');
    if (!Number.isInteger(lineIndex) || lineIndex < 0 || lineIndex >= LINES || ![0, 1].includes(targetPlayer)) throw new Error('잘못된 배치 대상입니다.');
    if (!placementsFor(state).some(p => p.player === targetPlayer && p.line === lineIndex)) throw new Error('이 라인에는 주사위를 배치할 수 없습니다.');
    const next = clone(state);
    const value = next.pending.value;
    const kind = next.pending.kind;
    if (kind === 'normal') {
      const opponent = 1 - next.currentPlayer;
      const enemyLine = next.boards[opponent][lineIndex];
      const removed = enemyLine.filter(d => d.value === value && !d.shield).length;
      if (removed > 0) {
        // 공격용 일반 주사위는 이 칸에 남지 않고, 적 일반 주사위만 제거합니다.
        next.boards[opponent][lineIndex] = enemyLine.filter(d => !(d.value === value && !d.shield));
        next.pending = { kind: 'reward-shield', value: rollValue(rng), rerollCandidate: null };
        next.lastAction = { type: 'attack', player: next.currentPlayer, line: lineIndex, value, removed, shieldValue: next.pending.value };
        next.phase = 'place';
        // 두 보드에 빈칸이 없는 예외 상황. 실드 배치를 건너뛰고 턴 종료.
        if (placementsFor(next).length === 0) return settle(next);
        return next;
      }
      next.boards[targetPlayer][lineIndex].push(die(value));
      next.lastAction = { type: 'place', player: targetPlayer, line: lineIndex, value, shield: false };
      return settle(next);
    }
    next.boards[targetPlayer][lineIndex].push(die(value, true));
    next.lastAction = { type: 'place', player: targetPlayer, line: lineIndex, value, shield: true, kind };
    if (kind === 'start-shield') next.firstShieldPending = false;
    return settle(next);
  }
  return { newGame, roll, reroll, chooseReroll, place, die, scoreLine, resultFor, availableLines, placementsFor, boardFull, bothFull };
})();
