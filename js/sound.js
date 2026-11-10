/* Dice Match original synthesized sound effects; no external audio samples. */
(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.DiceMatchSound = api;
})(typeof globalThis !== 'undefined' ? globalThis : null, function (root) {
  'use strict';
  const files = Object.freeze({
    appear: 'dice-appear.mp3', reroll: 'dice-reroll.mp3',
    place: 'dice-place.mp3', hit: 'dice-hit.mp3',
    fall: 'dice-fall.mp3', shield: 'shield-gain.mp3',
    finish: 'game-finish.mp3'
  });
  const settingsKey = 'dice-match-sfx-settings-v1';
  const clamp = value => Math.min(100, Math.max(0, Number(value) || 0));
  let enabled = true;
  let volume = 55;
  let unlocked = false;
  const active = new Set();
  const lastPlayed = new Map();
  let timers = new Set();
  try {
    if (root?.localStorage) {
      const raw = root.localStorage.getItem(settingsKey);
      if (raw) {
        const s = JSON.parse(raw);
        if (typeof s.enabled === 'boolean') enabled = s.enabled;
        if (Number.isFinite(s.volume)) volume = clamp(s.volume);
      }
    }
  } catch (_) { /* Storage denied; sound still works. */ }
  function save() {
    try { root?.localStorage?.setItem(settingsKey, JSON.stringify({enabled, volume})); } catch (_) { /* Optional. */ }
  }
  function stop() {
    for (const audio of active) { try { audio.pause(); audio.currentTime = 0; } catch (_) {} }
    active.clear();
    for (const timer of timers) root?.clearTimeout?.(timer);
    timers.clear();
  }
  function activate() { unlocked = true; }
  function play(name, options = {}) {
    if (!enabled || !unlocked || !(name in files) || !root?.Audio) return false;
    const now = Date.now();
    // Prevent accidental duplicate playback from the same event/render.
    if (now - (lastPlayed.get(name) || 0) < 70) return false;
    lastPlayed.set(name, now);
    try {
      const audio = new root.Audio('assets/sounds/' + files[name]);
      audio.volume = (volume / 100) * (typeof options.gain === 'number' ? Math.max(0,Math.min(1,options.gain)) : 1);
      active.add(audio);
      const cleanup = () => active.delete(audio);
      audio.addEventListener('ended', cleanup, {once:true});
      audio.addEventListener('error', cleanup, {once:true});
      const promise = audio.play();
      if (promise?.catch) promise.catch(cleanup); // Browser autoplay restriction or missing file.
      return true;
    } catch (_) { return false; }
  }
  function later(name, ms) {
    if (!root?.setTimeout || !enabled || !unlocked) return;
    const timer = root.setTimeout(() => { timers.delete(timer); play(name); }, ms);
    timers.add(timer);
  }
  function setEnabled(value) { enabled = Boolean(value); if (!enabled) stop(); save(); }
  function setVolume(value) {
    volume = clamp(value);
    for (const audio of active) audio.volume = volume / 100;
    save();
  }
  function getSettings() { return {enabled, volume, unlocked}; }
  // A before/after engine transition determines effects; no game logic is changed.
  function transition(before, after) {
    const action = after?.lastAction;
    if (!action || before === after) return;
    if (action.type === 'roll') play('appear');
    if (action.type === 'reroll') play('appear', {gain:.6});
    if (action.type === 'choose-reroll') play('appear', {gain:.6});
    if (action.type === 'place') play(action.shield ? 'shield' : 'place');
    if (action.type === 'attack') {
      play('hit');
      later('fall', 360);  // Approximate the board's existing 820 ms attack animation.
    }
    if (after.phase === 'finished' && before.phase !== 'finished') later('finish', action.type === 'attack' ? 850 : 340);
  }
  return { files, activate, play, stop, transition, getSettings, setEnabled, setVolume };
});
