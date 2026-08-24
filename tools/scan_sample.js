const fs = require('fs');
const os = require('os');
const path = require('path');
const jmod = require('V:/cytoid storyboarder/app/src/engine/json.js');
const dir = path.join(os.tmpdir(), 'cytoid_sample_scan');
const p = path.join(dir, 'storyboard_base.json');
const raw = fs.readFileSync(p, 'utf8');
console.log('--- raw wave/parent_id/template lines ---');
raw.split('\n').forEach((l, i) => {
  if (/parent_id|wave|template|\$note/i.test(l)) console.log((i + 1) + ': ' + l.trim());
});
const sb = jmod.parse(raw);
console.log('--- parsed objects with parent/target/id-wave ---');
for (const key of ['sprites', 'texts', 'videos', 'lines', 'note_controllers']) {
  for (const o of (sb[key] || [])) {
    if (o.parent_id != null || o.target_id != null || (o.id && /wave/i.test(String(o.id)))) {
      console.log(key, JSON.stringify({ id: o.id, parent_id: o.parent_id, target_id: o.target_id, note: o.note, template: o.template }).slice(0, 120));
    }
  }
}
