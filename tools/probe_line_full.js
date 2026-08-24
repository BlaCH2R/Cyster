const fs = require('fs');
const J = require('../app/src/engine/json.js');
const dir = 'V:/cytoid storyboarder/项目/测试：delusion/Delusion';
const sb = J.parse(fs.readFileSync(dir + '/storyboard_compiled.json', 'utf8'));
const sp = (sb.sprites || []).filter((s) => {
  const st = s.States && s.States[0];
  return st && st.Path && String(st.Path).toLowerCase().includes('line');
});
const rows = [];
for (const s of sp) {
  const first = s.States[0];
  rows.push({
    id: s.Id,
    nStates: s.States.length,
    first: {
      path: first.Path,
      time: first.Time,
      sx: first.ScaleX,
      sy: first.ScaleY,
      y: first.Y,
      x: first.X,
      layer: first.Layer,
      order: first.Order,
      opacity: first.Opacity,
      color: first.Color,
      fillWidth: first.FillWidth
    }
  });
}
rows.sort((a, b) => (a.first.time || 0) - (b.first.time || 0));
console.log('count', rows.length);
for (const r of rows) console.log(JSON.stringify(r));
