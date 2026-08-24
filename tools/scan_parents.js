const fs = require('fs');
const path = require('path');
const root = 'V:\\cytoid storyboarder\\项目';
const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.json$/.test(e.name) && !/compiled/.test(e.name)) files.push(p);
  }
})(root);
const seen = new Map();
const examples = [];
for (const f of files) {
  let sb;
  try { sb = JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { continue; }
  for (const key of ['sprites', 'texts', 'videos', 'lines']) {
    for (const o of (sb[key] || [])) {
      const pid = o.parent_id, tid = o.target_id;
      if (pid != null || tid != null) {
        const k = (pid != null ? 'parent=' + pid : 'target=' + tid) + ' kind=' + key;
        seen.set(k, (seen.get(k) || 0) + 1);
        if (examples.length < 12 && o.id) {
          examples.push({ file: f.replace(root, ''), key, id: o.id,
            s0: JSON.stringify((o.states || [])[0] || {}).slice(0, 140) });
        }
      }
    }
  }
}
console.log('--- patterns ---');
for (const [k, n] of seen) console.log(n, 'x', k);
console.log('--- examples ---');
for (const e of examples) console.log(JSON.stringify(e));
