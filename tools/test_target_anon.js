// Unity assigns a random id to stage objects that omit id, including
// target_id controllers. They must compile and merge onto the target entity
// instead of being dropped from the draw list.
const SB = require('V:/cytoid storyboarder/app/src/engine/storyboard.js');

const src = {
  sprites: [
    { id: 't1', path: 'a.png', time: 0, x: 0, y: -150, width: 90, height: 90, layer: 1, order: 4 },
    { target_id: 't1', time: 0, x: 0, y: -40, opacity: 0.7, layer: 1, order: 4 }
  ],
  texts: [], videos: [], lines: [], controllers: [], note_controllers: [], templates: {}
};

const compiled = new SB.StoryboardCompiler(src, null).compile();
const res = SB.evaluateStoryboard(compiled, 0);
const checks = [];

const drawCount = res.sprites.length;
checks.push(['target_id controller removed from draw list (1 sprite)', drawCount === 1]);
const t1 = res.sprites[0];
checks.push(['t1 merged y = -40', t1 && t1.from.y && t1.from.y.value === -40]);
checks.push(['t1 merged opacity = 0.7', t1 && t1.from.opacity === 0.7]);

let failed = 0;
for (const [name, ok] of checks) {
  console.log((ok ? 'PASS' : 'FAIL') + ' ' + name);
  if (!ok) failed++;
}
console.log('SUMMARY: ' + (checks.length - failed) + '/' + checks.length + ' passed');
process.exit(failed ? 1 : 0);
