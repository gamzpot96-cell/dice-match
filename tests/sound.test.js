const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');

test('7 original synthesized sound assets are valid MP3 files', () => {
  const names = ['dice-appear','dice-reroll','dice-place','dice-hit','dice-fall','shield-gain','game-finish'];
  for (const name of names) {
    const file = fs.readFileSync(path.join(root, `assets/sounds/${name}.mp3`));
    assert.ok(file.byteLength > 1000, name);
    assert.ok(file.slice(0, 3).toString() === 'ID3' || file[0] === 0xff, name);
  }
  assert.ok(fs.existsSync(path.join(root, 'tools/generate_sounds.py')));
  assert.ok(fs.existsSync(path.join(root, 'docs/sound-license.md')));
});

test('both game modes use common sound engine without layout-changing panel', () => {
  for (const file of ['ai.html','game.html']) {
    const html = fs.readFileSync(path.join(root, file), 'utf8');
    assert.match(html, /js\/sound\.js/);
    assert.match(html, /id="soundToggle"/);
    assert.match(html, /id="soundMenu" hidden/);
    assert.doesNotMatch(html, /SOUND OFF/);
  }
  const css = fs.readFileSync(path.join(root, 'css/game.css'), 'utf8');
  assert.match(css, /\.sound-menu\{position:absolute/);
  assert.match(css, /\.sound-menu\[hidden\]\{display:none\}/);
});

test('sound engine handles play, mute, volume and transitions without changing game state', () => {
  const events = [];
  class FakeAudio {
    constructor(src) { this.src = src; this.volume = 0; }
    addEventListener() {}
    play() { events.push(this.src); return Promise.resolve(); }
    pause() {}
  }
  const delays = [];
  const store = new Map();
  const context = { Audio:FakeAudio, localStorage:{getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v)},
    setTimeout:(cb,ms)=>{delays.push({cb,ms});return delays.length;},clearTimeout:()=>{} };
  context.globalThis=context;
  vm.runInNewContext(fs.readFileSync(path.join(root,'js/sound.js'),'utf8'),context);
  const audio=context.DiceMatchSound;
  assert.equal(audio.play('appear'),false); // No autoplay before a user gesture.
  audio.activate();
  const before={phase:'place'}, after={phase:'place',lastAction:{type:'attack'}};
  audio.transition(before,after);
  assert.ok(events.includes('assets/sounds/dice-hit.mp3'));
  assert.ok(delays.some(item=>item.ms===360));
  audio.setEnabled(false);
  assert.equal(audio.play('place'),false);
  audio.setVolume(35);
  assert.equal(audio.getSettings().volume,35);
  assert.equal(JSON.parse(store.get('dice-match-sfx-settings-v1')).enabled,false);
  assert.equal(after.phase,'place');
});
