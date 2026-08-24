const fs = require('fs');
const path = require('path');
const J = require('../app/src/engine/json.js');
const dir = 'V:/cytoid storyboarder/项目/测试：delusion/Delusion';
const sb = J.parse(fs.readFileSync(path.join(dir, 'storyboard_base.json'), 'utf8'));
const lineSprites = (sb.sprites || []).filter(s => s.path && s.path.toLowerCase().includes('line'));
for (const s of lineSprites) {
  console.log('=== sprite ===');
  console.log(JSON.stringify({ id: s.id, path: s.path, width: s.width, height: s.height, preserve_aspect: s.preserve_aspect, fill_width: s.fill_width, scale: s.scale, scale_x: s.scale_x, scale_y: s.scale_y, x: s.x, y: s.y, time: s.time, layer: s.layer, order: s.order, states: (s.states || []).length }, null, 1));
}
// Image dimensions
const PNG = require('../app/src/engine/json.js');
function pngSize(file) {
  const b = fs.readFileSync(file);
  if (b[0] !== 0x89 || b[1] !== 0x50) return null;
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}
console.log('line.png size:', JSON.stringify(pngSize(path.join(dir, 'line.png'))));
console.log('line.jpg size:', JSON.stringify(pngSize(path.join(dir, 'line.jpg'))));

const compiled = J.parse(fs.readFileSync(path.join(dir, 'storyboard_compiled.json'), 'utf8'));
const compSprites = (compiled.sprites || []).filter(s => {
  const st = s.States && s.States[0];
  return st && st.Path && String(st.Path).toLowerCase().includes('line');
});
console.log('=== compiled line sprites ===', compSprites.length);
for (const s of compSprites.slice(0, 4)) {
  const st = s.States[0];
  console.log(JSON.stringify({
    id: s.Id,
    Path: st.Path,
    Width: st.Width,
    Height: st.Height,
    ScaleX: st.ScaleX,
    ScaleY: st.ScaleY,
    PreserveAspect: st.PreserveAspect,
    FillWidth: st.FillWidth,
    Time: st.Time
  }));
}
