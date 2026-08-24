const fs = require('fs');
const p = 'V:\\cytoid storyboarder\\项目\\测试：企鹅\\銀河鉄道のペンギン\\storyboard_base.json';
const jmod = require('V:/cytoid storyboarder/app/src/engine/json.js');
const sb = jmod.parse(fs.readFileSync(p, 'utf8'));
const raw = fs.readFileSync(p, 'utf8');
console.log('--- raw parent_id / wave lines ---');
raw.split('\n').forEach((l, i) => {
  if (/parent_id|wave/i.test(l)) console.log((i + 1) + ': ' + l.trim());
});
console.log('--- parsed objects with parent/target ---');
for (const key of ['sprites', 'texts', 'videos', 'lines']) {
  for (const o of (sb[key] || [])) {
    if (o.parent_id != null || o.target_id != null) {
      console.log(key, 'id=', o.id, 'parent_id=', o.parent_id, 'target_id=', o.target_id);
    }
    if (o.id && String(o.id).includes('$note')) {
      console.log(key, 'id=', o.id, 'parent_id=', o.parent_id, 'target_id=', o.target_id, 'note=', o.note);
    }
    if (o.id && /wave/i.test(String(o.id))) {
      console.log(key, 'id=', o.id, 'parent_id=', o.parent_id, 'target_id=', o.target_id,
        'note=', o.note, 'time=', JSON.stringify(o.time));
    }
  }
}
