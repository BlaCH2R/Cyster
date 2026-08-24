const fs = require('fs');
const J = require('../app/src/engine/json.js');
const dir = 'V:/cytoid storyboarder/项目/测试：delusion/Delusion';
const sb = J.parse(fs.readFileSync(dir + '/storyboard_base.json', 'utf8'));
const sp = (sb.sprites || []).filter((s) => s.path && String(s.path).toLowerCase().includes('line.png'));
console.log('raw line.png sprites:', sp.length);
for (const s of sp) {
  console.log(JSON.stringify({
    id: s.id, path: s.path, x: s.x, y: s.y, scale_x: s.scale_x, scale_y: s.scale_y,
    color: s.color, opacity: s.opacity, time: s.time, layer: s.layer, order: s.order,
    states: (s.states || []).map((st) => ({ t: st.time, sx: st.scale_x, sy: st.scale_y, o: st.opacity, c: st.color, d: st.destroy }))
  }));
}
