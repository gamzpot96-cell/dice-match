const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const theme=fs.readFileSync(path.join(__dirname,'../css/theme.css'),'utf8');
const game=fs.readFileSync(path.join(__dirname,'../css/game.css'),'utf8');
test('Gmarket Sans Medium and Bold are declared, with fallback',()=>{
  assert.match(theme,/GmarketSansMedium\.woff/);
  assert.match(theme,/GmarketSansBold\.woff/);
  assert.match(theme,/font-family:"Gmarket Sans",system-ui/);
});
test('only total score is reduced to medium weight',()=>{
  assert.match(game,/\.player-card \.player-side-info > strong \{/);
  assert.match(game,/font-size: 24px;\s*font-weight: 500/);
  assert.match(game,/font-variant-numeric: tabular-nums/);
});
