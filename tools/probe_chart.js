const fs = require('fs');
const path = require('path');
const chartMod = require('../app/src/engine/chart.js');
const storyboardMod = require('../app/src/engine/storyboard.js');
const J = require('../app/src/engine/json.js');
const { SAMPLE_ZIP, extract } = require('./level_fixture.js');
const playerDir = extract(SAMPLE_ZIP, 'cytoid_probe_');
const chartText = fs.readFileSync(path.join(playerDir, 'chart.base.txt'), 'utf8');
const chart = new chartMod.Chart(chartText, { screenRatio: 16/9 });
console.log('pages:', chart.model.page_list.length, 'notes:', chart.notes.length, 'endTime:', chart.endTime);
for (const t of [0, 10, 50, 80, 100, 120, 140, 160, 170, 175, 180, 182, 183.5]) {
  let vis = 0, nan = 0;
  for (const n of chart.notes) {
    const clear = (n.type===1||n.type===4) ? n.end_time : n.start_time;
    if (t >= n.intro_time && t <= clear) vis++;
    if (!isFinite(n.intro_time) || !isFinite(n.start_time) || !isFinite(n.end_time)) nan++;
  }
  const sy = chart.getScannerPositionY(t);
  const scan = isFinite(sy) ? sy.toFixed(2) : 'NaN';
  console.log('t='+t, 'visible='+vis, 'nanTimes='+nan, 'scanY='+scan);
}
// tempo zones
console.log('tempo_list:', JSON.stringify(chart.model.tempo_list.slice(0,6)));
// check pages near the end
const pages = chart.model.page_list;
console.log('last pages:', JSON.stringify(pages.slice(-3).map(p=>({s:p.start_tick,e:p.end_tick,dir:p.scan_line_direction,st:p.start_time,et:p.end_time}))));
// NaN times?
let bad = chart.notes.filter(n => !isFinite(n.start_time) || !isFinite(n.intro_time));
console.log('notes with NaN times:', bad.length, bad.slice(0,5).map(n=>n.id));
