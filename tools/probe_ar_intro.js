// Verify per-note approach_rate shortens intro_time (Unity speed formula).
const fs = require('fs');
const cmod = require('V:/cytoid storyboarder/app/src/engine/chart.js');
const p = 'V:\\cytoid storyboarder\\项目\\测试：robotic girl\\ロボティックガール\\chart.base.txt';
const text = fs.readFileSync(p, 'utf8');
const ch = new cmod.Chart(text, { screenRatio: 16 / 9 });
let shown = 0;
for (const n of ch.notes) {
  if (n.approach_rate != null && Number(n.approach_rate) !== 1 && shown < 5) {
    const base = n.start_time - 1.367; // AR=1 speed 1 hypothetical
    console.log('note', n.id, 'type=', n.type, 'ar=', n.approach_rate,
      'start=', +n.start_time.toFixed(3), 'intro=', +n.intro_time.toFixed(3),
      'introShorter=', n.intro_time < n.start_time - 1.367);
    shown++;
  }
}
console.log('notes with AR!=1:', ch.notes.filter((n) => n.approach_rate != null && Number(n.approach_rate) !== 1).length);
