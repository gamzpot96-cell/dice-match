/* Dice Match: 외부 API 없는 난이도별 전략 AI. 게임 규칙은 엔진에만 존재합니다. */
(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./engine/game.js') : root.DiceMatchEngine);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.DiceMatchAI = api;
})(typeof globalThis !== 'undefined' ? globalThis : null, function (engine) {
  'use strict';
  const DIFFICULTIES = ['easy', 'normal', 'hard'];
  function validateDifficulty(difficulty) {
    if (!DIFFICULTIES.includes(difficulty)) throw new Error('알 수 없는 AI 난이도입니다.');
  }
  function random(rng) {
    const n = rng();
    if (!Number.isFinite(n) || n < 0 || n >= 1) throw new Error('난수 함수가 올바르지 않습니다.');
    return n;
  }
  function scores(state) { return state.boards.map(board => board.map(engine.scoreLine)); }
  function sign(n) { return n > 0 ? 1 : n < 0 ? -1 : 0; }
  function evaluateBoard(state, actor, difficulty) {
    const other = 1 - actor;
    const values = scores(state);
    let result = 0;
    for (let line = 0; line < 3; line += 1) {
      const own = values[actor][line], enemy = values[other][line];
      const gap = own - enemy;
      const ownDice = state.boards[actor][line];
      const enemyDice = state.boards[other][line];
      const weight = difficulty === 'hard' ? 1.35 : 1;
      result += weight * (own - enemy);
      // 최종 승패가 라인 승리 수를 우선하므로 점수 선두에 가치 부여.
      result += sign(gap) * (difficulty === 'hard' ? 9 : 4);
      // 확실한 승리뿐 아니라 접전과 아직 빈칸이 있는 라인도 고려.
      if (difficulty === 'hard' && gap !== 0) result += sign(gap) * Math.min(Math.abs(gap), 8) * 0.45;
      if (difficulty === 'hard') {
        const freeOwn = 3 - ownDice.length;
        const freeEnemy = 3 - enemyDice.length;
        result += freeOwn * 0.45 - freeEnemy * 0.45;
        for (const die of ownDice) {
          if (!die.shield && enemyDice.some(d => d.value === die.value && !d.shield)) result -= die.value * 0.28;
          if (die.shield) result += 1.1; // 안정적으로 남는 실드의 가치
        }
      }
    }
    return result;
  }
  // 공격 보상 실드는 공격하지 않으며 어느 플레이어의 보드에나 둘 수 있습니다.
  // 일반 배치의 '현재 라인 우세' 평가를 그대로 사용하면 낮은 실드(특히 1)도
  // 자기 보드에 놓아 임시로 앞서려는 경향이 생깁니다. 보상 실드만 따로 평가합니다.
  function estimateRewardShield(state, move, difficulty) {
    const actor = state.currentPlayer;
    const rival = 1 - actor;
    const value = state.pending.value;
    const target = state.boards[move.player][move.line];
    const beforeScore = engine.scoreLine(target);
    const afterScore = engine.scoreLine([...target, engine.die(value, true)]);
    const scoreGain = afterScore - beforeScore;
    const same = target.filter(d => d.value === value).length;
    if (move.player === actor) {
      // 자신의 점수 및 확실한 같은 숫자 조합 강화.
      return scoreGain * 1.5 + same * (difficulty === 'hard' ? 3 : 2) + 1.0;
    }
    // 상대 보드의 빈칸 하나를 영구적으로 차지하므로, 낮은 숫자를
    // 높은 숫자 옆에 두면 상대가 고득점 주사위를 추가할 기회를 줄입니다.
    const higher = target.filter(d => d.value > value).length;
    const blocking = 4 + target.length * 1.4 + higher * 1.3;
    // 상대에게 조합을 완성해 점수를 크게 주는 선택은 강하게 회피.
    const matchingPenalty = same * (difficulty === 'hard' ? 3 : 2);
    // 3도 비교적 낮은 보상 실드이므로 안전한 방해 배치에 가산점을 줍니다.
    // 1~2는 아래 choosePlacement에서 안전한 상대 칸을 더 강하게 우선합니다.
    const lowShieldBlockBonus = value === 3 && same === 0 ? 5 : 0;
    return blocking - scoreGain * 1.5 - matchingPenalty + lowShieldBlockBonus;
  }
  function estimate(state, move, difficulty) {
    if (state.pending.kind === 'reward-shield') {
      return estimateRewardShield(state, move, difficulty);
    }
    const actor = state.currentPlayer;
    const before = evaluateBoard(state, actor, difficulty);
    // 공격 보상 실드 수는 아직 미정이므로 고정값에 지나치게 의존하지 않음.
    const afterState = engine.place(state, move.player, move.line, () => 0.4);
    let value = evaluateBoard(afterState, actor, difficulty) - before;
    const attacked = afterState.lastAction?.type === 'attack';
    if (attacked) {
      value += 7 + afterState.lastAction.removed * 3;
      // 다음 단계에서 실드를 반드시 배치할 수 있는 선택권도 가치가 있음.
      value += difficulty === 'hard' ? 3 : 1;
    }
    if (state.pending.kind === 'normal' && !attacked && difficulty === 'hard') {
      const own = state.boards[actor][move.line];
      const same = own.filter(d => d.value === state.pending.value).length;
      value += same * 1.6;
    }
    return value;
  }
  // 어려움 AI: 상대가 다음 턴에 1~6 가운데 어떤 눈을 얻을지 모르므로
  // 여섯 가능성을 모두 검사하고, 각 경우 상대의 가장 유리한 합법적 수를 평가합니다.
  // 미래의 난수(공격 보상 실드)는 예측하지 않고, 공격 직후의 상태만 반영합니다.
  function nextTurnRisk(afterMove, actor) {
    if (afterMove.phase !== 'roll' || afterMove.currentPlayer === actor) return 0;
    const opponent = 1 - actor;
    const before = evaluateBoard(afterMove, opponent, 'hard');
    let totalBestGain = 0;
    for (let value = 1; value <= 6; value += 1) {
      const rolled = engine.roll(afterMove, () => (value - 0.5) / 6);
      const legal = engine.placementsFor(rolled);
      if (!legal.length) continue;
      let bestGain = 0;
      for (const reply of legal) {
        const outcome = engine.place(rolled, reply.player, reply.line, () => 0.4);
        // 공격 직후 생긴 실드는 아직 배치되지 않았으므로 그 이득은 보수적으로 평가합니다.
        const gain = evaluateBoard(outcome, opponent, 'hard') - before;
        const isAttack = outcome.lastAction?.type === 'attack';
        const adjusted = gain + (isAttack ? 3 : 0);
        if (adjusted > bestGain) bestGain = adjusted;
      }
      totalBestGain += bestGain;
    }
    return totalBestGain / 6;
  }
  function evaluateHardPlacement(state, move) {
    const immediate = estimate(state, move, 'hard');
    if (state.pending.kind !== 'normal') return immediate;
    const afterMove = engine.place(state, move.player, move.line, () => 0.4);
    // 리스크가 실제로 커지는 곳을 방어하되, 당장 좋은 공격을 무조건 포기하지는 않습니다.
    return immediate - nextTurnRisk(afterMove, state.currentPlayer) * 0.55;
  }
  function choosePlacement(state, difficulty = 'normal', rng = Math.random) {
    validateDifficulty(difficulty);
    if (state.phase !== 'place') throw new Error('배치 단계에서만 AI가 수를 선택할 수 있습니다.');
    const moves = engine.placementsFor(state);
    if (!moves.length) return null;
    if (difficulty === 'easy') return moves[Math.floor(random(rng) * moves.length)];
    // 낮은 보상 실드(1~2)는 자기 조합으로 소액을 얻는 것보다
    // 상대 보드의 칸을 영구적으로 막는 용도를 우선합니다.
    // 상대의 같은 숫자와 합쳐 점수를 올려 주는 라인은 안전한 방해 칸에서 제외합니다.
    // 안전한 상대 칸이 하나도 없을 때만 자기 필드 등 전체 합법 수를 비교합니다.
    const lowRewardShield = state.pending.kind === 'reward-shield' && state.pending.value <= 2;
    const safeOpponentMoves = lowRewardShield
      ? moves.filter(move => move.player !== state.currentPlayer &&
          !state.boards[move.player][move.line].some(d => d.value === state.pending.value))
      : [];
    const consideredMoves = safeOpponentMoves.length ? safeOpponentMoves : moves;
    const ranked = consideredMoves.map(move => ({ move, score: difficulty === 'hard'
      ? evaluateHardPlacement(state, move) : estimate(state, move, difficulty) }));
    const best = Math.max(...ranked.map(item => item.score));
    // 보통은 우세한 선택들 사이에서 다양하게, 어려움은 아주 비슷한 강수 사이에서 선택.
    const margin = difficulty === 'hard' ? 2.2 : 6;
    const candidates = ranked.filter(item => item.score >= best - margin);
    // 최상위 선택을 선호하는 가중 추첨: 매번 같은 라인만 고르는 패턴 완화.
    const temperature = difficulty === 'hard' ? 1.4 : 3.2;
    const weights = candidates.map(item => Math.exp((item.score - best) / temperature));
    const sum = weights.reduce((s, w) => s + w, 0);
    let ticket = random(rng) * sum;
    for (let i = 0; i < candidates.length; i++) {
      ticket -= weights[i];
      if (ticket < 0) return candidates[i].move;
    }
    return candidates[candidates.length - 1].move;
  }
  function chooseRerollAction(state, difficulty = 'normal') {
    validateDifficulty(difficulty);
    if (state.phase !== 'place' || !['normal', 'start-shield'].includes(state.pending?.kind) || state.rerollUsed[state.currentPlayer]) return false;
    if (difficulty === 'easy') return false;
    if (difficulty === 'normal') return state.pending.value <= 2;
    const moves = engine.placementsFor(state);
    if (!moves.length) return false;
    const maxScore = Math.max(...moves.map(move => estimate(state, move, 'hard')));
    // 초반에 좋은 눈을 굳이 다시 굴리지 않고, 선택지가 좋지 않을 때 리롤을 아낌없이 활용.
    return maxScore < 5 && state.pending.value <= 4;
  }
  function chooseRerollResult(state, difficulty = 'normal') {
    validateDifficulty(difficulty);
    if (state.phase !== 'choose-reroll') throw new Error('리롤 선택 단계가 아닙니다.');
    if (difficulty !== 'hard') return state.pending.rerollCandidate >= state.pending.value;
    const originalState = engine.chooseReroll(state, false);
    const candidateState = engine.chooseReroll(state, true);
    const best = s => Math.max(...engine.placementsFor(s).map(move => estimate(s, move, 'hard')));
    return best(candidateState) > best(originalState);
  }
  return { DIFFICULTIES, choosePlacement, chooseRerollAction, chooseRerollResult };
});
