const fs = require('fs');
const J = require('../app/src/engine/json.js');
const dir = 'V:/cytoid storyboarder/项目/测试：delusion/Delusion';
const sb = J.parse(fs.readFileSync(dir + '/storyboard_compiled.json', 'utf8'));
console.log('=== sprites (non-line paths) ===');
for (const s of (sb.sprites || [])) {
  const st = s.States && s.States[0];
  if (!st) continue;
  const p = st.Path || '';
  if (String(p).toLowerCase().includes('line')) continue;
  console.log(JSON.stringify({
    id: s.Id, path: p, nStates: s.States.length,
    first: {
      t: st.Time, sx: st.ScaleX, sy: st.ScaleY, w: st.Width, h: st.Height,
      fillWidth: st.FillWidth, color: st.Color, o: st.Opacity, y: st.Y, x: st.X, layer: st.Layer
    }
  }));
}
console.log('=== controllers ===');
for (const c of (sb.controllers || [])) {
  const st = c.States && c.States[0];
  console.log(JSON.stringify({
    id: c.Id, nStates: (c.States || []).length,
    first: st ? { t: st.Time, bg: st.BackgroundDim, bgColor: st.BackgroundColor, color: st.Color, blur: st.Blur, scanO: st.ScannerOpacity, scanColor: st.ScannerColor, noteO: st.NoteOpacity } : null
  }));
}
console.log('=== note_controllers sample ===', (sb.note_controllers || []).length);
