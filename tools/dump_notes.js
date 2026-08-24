const fs = require('fs');
const cmod = require('V:/cytoid storyboarder/app/src/engine/chart.js');
const text = fs.readFileSync('V:\\cytoid storyboarder\\项目\\测试：nc-follow\\NcFollow\\chart.base.txt', 'utf8');
const ch = new cmod.Chart(text, { screenRatio: 16 / 9 });
for (let i = 0; i < 8; i++) {
  const n = ch.noteById(i);
  if (n) {
    console.log('note', i, 'type=', n.type, 'start=', +n.start_time.toFixed(3), 'end=', +n.end_time.toFixed(3),
      'intro=', +n.intro_time.toFixed(3), 'worldX=', +n.worldX.toFixed(3), 'worldY=', +n.worldY.toFixed(3),
      'chartY=', +n.chartY.toFixed(3));
  }
}
