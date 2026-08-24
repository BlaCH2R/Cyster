const fs = require('fs');
const path = require('path');
const { SAMPLE_ZIP, extract } = require('./level_fixture.js');
const chartMod = require('../app/src/engine/chart.js');
const storyboardMod = require('../app/src/engine/storyboard.js');

const playerDir = extract(SAMPLE_ZIP, 'cytoid_eng_');
const chartText = fs.readFileSync(path.join(playerDir, 'chart.base.txt'), 'utf8');
const sbText = fs.readFileSync(path.join(playerDir, 'storyboard_base.json'), 'utf8');

const chart = new chartMod.Chart(chartText, { screenRatio: 16 / 9 });
console.log('pages:', chart.model.page_list.length, 'notes:', chart.notes.length, 'endTime:', chart.endTime.toFixed(3));
const n0 = chart.noteById(0);
console.log('note0:', JSON.stringify({ id: n0.id, type: n0.type, start: n0.start_time.toFixed(3), end: n0.end_time.toFixed(3), intro: n0.intro_time.toFixed(3), worldX: n0.worldX.toFixed(3), worldY: n0.worldY.toFixed(3) }));
const n320 = chart.noteById(320);
console.log('note320:', JSON.stringify({ id: n320.id, type: n320.type, start: n320.start_time.toFixed(3), intro: n320.intro_time.toFixed(3) }));

const sbJson = storyboardMod.StoryboardCompiler ? null : null;
const compiler = new storyboardMod.StoryboardCompiler(JSON.parse(JSON.stringify(require('../app/src/engine/json.js').parse(sbText))), chart);
const compiled = compiler.compile();
console.log('compiled counts:', Object.fromEntries(Object.entries(compiled).map(([k, v]) => [k, v.length])));

for (const t of [0, 4.3, 10, 77.25, 120.1875, 150, 200]) {
  const res = storyboardMod.evaluateStoryboard(compiled, t);
  const ctrl = res.controllers[res.controllers.length - 1];
  const sprite = res.sprites[0];
  console.log('t=' + t,
    '| controllers:', res.controllers.length,
    '| sprites:', res.sprites.length,
    '| destroyed:', res.destroyed.size,
    '| bgdim:', ctrl && ctrl.from.background_dim != null ? ctrl.from.background_dim : '-',
    '| sprite0 opacity:', sprite ? (sprite.from.opacity != null ? sprite.from.opacity.toFixed(3) : '-') : '-');
}

// sanity: first sprite eval at 77.25
const res = storyboardMod.evaluateStoryboard(compiled, 77.25);
const zoom = res.sprites.find((r) => r.obj.id === 'zoom_1');
if (zoom) console.log('zoom_1 scale at 77.25:', zoom.from.scale_x);
const waves = res.sprites.filter((r) => r.obj.id && r.obj.id.includes('wave'));
console.log('wave instances at 77.25:', waves.length, 'first id:', waves[0] && waves[0].obj.id);
