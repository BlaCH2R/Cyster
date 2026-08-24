const { SAMPLE_ZIP, extract } = require('./level_fixture.js');
const fs = require('fs');
const path = require('path');
const chartMod = require('../app/src/engine/chart.js');
const dir = extract(SAMPLE_ZIP, 'cytoid_typecheck_');
const chart = new chartMod.Chart(fs.readFileSync(path.join(dir, 'chart.base.txt'), 'utf8'), { screenRatio: 16/9 });
const counts = {};
for (const n of chart.notes) counts[n.typeName] = (counts[n.typeName] || 0) + 1;
console.log('type counts:', JSON.stringify(counts));
const intro = {};
for (const n of chart.notes) {
  const k = n.typeName;
  if (!intro[k]) intro[k] = (n.start_time - n.intro_time).toFixed(3);
}
console.log('intro durations by type:', JSON.stringify(intro));
