/* 보드 전용 정렬: 실제 배치 기록은 유지하고 화면 표현만 묶습니다. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.DiceMatchBoardLayout = api;
})(typeof globalThis !== 'undefined' ? globalThis : null, function () {
  'use strict';
  function groupsForLine(dice) {
    const groups = [];
    for (const die of dice) {
      const group = groups.find(item => item.value === die.value);
      if (group) group.dice.push(die);
      else groups.push({ value: die.value, dice: [die] });
    }
    return groups;
  }
  return { groupsForLine };
});
