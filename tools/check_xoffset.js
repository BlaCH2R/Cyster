const fs = require('fs');
const path = require('path');
const SB = require('../app/src/engine/storyboard.js');
const ChartMod = require('../app/src/engine/chart.js');

// 1) Synthetic round trip
const chartText = JSON.stringify({
  format_version: 0, time_base: 480, start_offset_time: 0, music_offset: 0,
  page_list: [{ start_tick: 0, end_tick: 960, scan_line_direction: -1 }],
  note_list: [{ page_index: 0, type: 0, id: 1, tick: 480, x: 0.5, has_sibling: false, hold_tick: 0, next_id: 0, is_forward: false, approach_rate: 1 }],
});
const chart = new ChartMod.Chart(chartText, { screenRatio: 16 / 9 });
const editable = {
  note_controllers: [{ id: 'nc1', note: 1, states: [{ time: 0, dx: -0.3, dy: 0.25 }] }],
};
const compiled = SB.toCompiled(editable, chart);
console.log('compiled nc states:', JSON.stringify(compiled.note_controllers[0].States));
const back = SB.fromCompiled(compiled);
console.log('back nc:', JSON.stringify(back.note_controllers[0]));

// 2) Real robotic girl file
const dir = 'V:/cytoid storyboarder/项目/测试：robotic girl/ロボティックガール';
const sb = JSON.parse(fs.readFileSync(path.join(dir, 'storyboard_compiled.json'), 'utf8'));
const real = SB.fromCompiled(sb);
const withDx = real.note_controllers.filter((n) => n.dx !== undefined || (n.states || []).some((s) => s.dx !== undefined));
console.log('real nc with dx:', withDx.length, withDx.slice(0, 3).map((n) => ({ id: n.id, note: n.note, dx: n.dx, firstStateDx: n.states && n.states[0] && n.states[0].dx })));
const chartText2 = fs.readFileSync(path.join(dir, 'chart.base.txt'), 'utf8');
const chart2 = new ChartMod.Chart(chartText2, { screenRatio: 16 / 9 });
for (const n of withDx.slice(0, 20)) {
  const note = chart2.noteById(n.note);
  if (note) console.log(`note ${n.note}: type=${note.type} start=${note.start_time.toFixed(3)} next=${note.next_id}`);
}
