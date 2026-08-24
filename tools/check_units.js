const fs = require('fs');
const path = require('path');
const ChartMod = require('../app/src/engine/chart.js');
const dir = 'V:/cytoid storyboarder/项目/测试：robotic girl/ロボティックガール';
const chartText = fs.readFileSync(path.join(dir, 'chart.base.txt'), 'utf8');
const chart = new ChartMod.Chart(chartText, { screenRatio: 16 / 9 });
console.log('baseSize:', chart.baseSize, 'model.size:', chart.model && chart.model.size);
for (const v of [0, 0.25, 0.75, 1]) {
  console.log(`x(${v})=${chart.convertChartXToScreenX(v).toFixed(3)} y(${v})=${chart.convertChartYToScreenY(v).toFixed(3)}`);
}
// Note 1456 timing
const n = chart.noteById(1456);
if (n) console.log('note1456: start=', n.start_time, 'intro=', n.intro_time, 'end=', n.end_time);
const n23 = chart.noteById(1123);
if (n23) console.log('note1123: type=', n23.type, 'start=', n23.start_time, 'end=', n23.end_time, 'x=', n23.x, 'y=', n23.y, 'worldX=', n23.worldX, 'worldY=', n23.worldY);
