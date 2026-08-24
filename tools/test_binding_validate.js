// target_id / parent_id validation per StoryBoard doc + Cytoid source.
const SB = require('V:/cytoid storyboarder/app/src/engine/storyboard.js');
const base = { texts: [], sprites: [], videos: [], lines: [], controllers: [], note_controllers: [], templates: {} };
const results = [];
function check(name, ok) { results.push({ name, ok }); console.log((ok ? 'PASS' : 'FAIL') + ' ' + name); }

// valid same-type target_id (controller without id)
try {
  const c = new SB.StoryboardCompiler({ ...base, sprites: [
    { id: 't', path: 'a.png', time: 0 },
    { target_id: 't', time: 0, y: 10 }
  ] }, null).compile();
  check('valid same-type target_id compiles', c.sprites.length === 2);
} catch (e) { check('valid same-type target_id compiles', false); }

// cross-type target_id must throw
try {
  new SB.StoryboardCompiler({ ...base,
    sprites: [{ id: 's', path: 'a.png', time: 0 }],
    texts: [{ target_id: 's', time: 0, text: 'x' }]
  }, null).compile();
  check('cross-type target_id throws', false);
} catch (e) { check('cross-type target_id throws', true); }

// missing target_id must throw
try {
  new SB.StoryboardCompiler({ ...base, sprites: [{ target_id: 'ghost', time: 0, path: 'a.png' }] }, null).compile();
  check('missing target_id throws', false);
} catch (e) { check('missing target_id throws', true); }

// missing parent_id must throw
try {
  new SB.StoryboardCompiler({ ...base, sprites: [
    { id: 's', path: 'a.png', time: 0 },
    { id: 'c', parent_id: 'ghost', path: 'a.png', time: 0 }
  ] }, null).compile();
  check('missing parent_id throws', false);
} catch (e) { check('missing parent_id throws', true); }

// valid parent_id -> note controller compiles
try {
  new SB.StoryboardCompiler({ ...base,
    note_controllers: [{ id: 'nc_1', note: 5, time: 0, opacity: 0 }],
    sprites: [{ id: 's', parent_id: 'nc_1', path: 'a.png', time: 0 }]
  }, null).compile();
  check('parent_id -> note controller compiles', true);
} catch (e) { check('parent_id -> note controller compiles', false); }

const failed = results.filter((r) => !r.ok).length;
console.log('SUMMARY: ' + (results.length - failed) + '/' + results.length + ' passed');
process.exit(failed ? 1 : 0);
