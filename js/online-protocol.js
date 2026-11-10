/* STEP 6: 온라인 공통 메시지 검증. 서버 연결 시에도 서버가 최종 판정합니다. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.DiceMatchOnlineProtocol = api;
})(typeof globalThis !== 'undefined' ? globalThis : null, function () {
  'use strict';
  const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const ROOM_CODE_PATTERN = /^[A-HJ-NP-Z2-9]{6}$/;
  const ACTIONS = new Set(['place', 'reroll', 'choose-reroll']);
  function normalizeRoomCode(value) {
    return typeof value === 'string' ? value.replace(/\s+/g, '').toUpperCase() : '';
  }
  function isRoomCode(value) { return ROOM_CODE_PATTERN.test(normalizeRoomCode(value)); }
  function createRoomCode(randomBytes) {
    if (!(randomBytes instanceof Uint8Array) || randomBytes.length < 6) throw new Error('안전한 난수 6바이트가 필요합니다.');
    // 32개 문자 중 6개를 선택하므로 30비트 코드. 인증 토큰으로 사용하지 않습니다.
    return Array.from(randomBytes.slice(0, 6), n => CODE_ALPHABET[n & 31]).join('');
  }
  function validateAction(action) {
    if (!action || typeof action !== 'object' || Array.isArray(action)) return false;
    if (!ACTIONS.has(action.type) || !Number.isSafeInteger(action.version) || action.version < 0) return false;
    if (action.type === 'place') return [0, 1].includes(action.player) && Number.isInteger(action.line) && action.line >= 0 && action.line <= 2;
    if (action.type === 'choose-reroll') return typeof action.chooseNew === 'boolean';
    return true;
  }
  return { normalizeRoomCode, isRoomCode, createRoomCode, validateAction };
});
