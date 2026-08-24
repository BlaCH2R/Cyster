const chartMod = require('../app/src/engine/chart.js');
const storyboardMod = require('../app/src/engine/storyboard.js');
const J = require('../app/src/engine/json.js');

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log('PASS', name); }
  else { fail++; console.log('FAIL', name); }
}
function close(a, b, eps = 1e-6) { return Math.abs(a - b) < eps; }

// Synthetic chart: 480 ticks = 1 second (tempo value 1e6, time_base 480)
const chartText = JSON.stringify({
  time_base: 480,
  tempo_list: [{ tick: 0, value: 1000000 }],
  page_list: [
    { start_tick: 0, end_tick: 480, scan_line_direction: 1 },
    { start_tick: 480, end_tick: 960, scan_line_direction: -1 },
    { start_tick: 960, end_tick: 1440, scan_line_direction: 1 }
  ],
  note_list: [
    { page_index: 0, type: 0, id: 1, tick: 0, x: 0.5, hold_tick: 0, next_id: 0, is_forward: false },
    { page_index: 0, type: 1, id: 2, tick: 0, x: 0.5, hold_tick: 480, next_id: 0, is_forward: false },
    { page_index: 1, type: 5, id: 3, tick: 480, x: 0.2, hold_tick: 0, next_id: 0, is_forward: false },
    { page_index: 2, type: 0, id: 4, tick: 960, x: 0.8, hold_tick: 0, next_id: 0, is_forward: false }
  ],
  event_order_list: []
});
const chart = new chartMod.Chart(chartText, { screenRatio: 16 / 9 });
ok(close(chart.noteById(1).start_time, 0), 'note1 start=0');
ok(close(chart.noteById(2).end_time, 1), 'note2 (hold) end=1');
ok(close(chart.noteById(3).start_time, 1), 'note3 start=1');

// ---- 1. time string parsing & $note in note controller ----
const sb = J.parse(`
{
  "note_controllers": [
    { "note": 1, "id": "nc_$note", "time": "start:$note", "opacity_multiplier": 0,
      "states": [{ "time": "end:2:0.5", "opacity_multiplier": 1 }] },
    { "note": 4, "id": "nc_$note", "time": 0, "opacity_multiplier": 0 },
    { "note": { "type": [5], "start": 3, "end": 3 }, "id": "flick_ctrl", "override_x": true, "x": 0.25, "time": 0 }
  ],
  "sprites": [
    { "id": "sprite", "path": "a.png", "time": 0, "opacity": 1, "x": 0,
      "states": [
        { "time": ["start:3", "start:4"], "x": 100 },
        { "relative_time": 0.5, "x": 200 },
        { "add_time": 0.25, "x": 300 }
      ]
    },
    { "id": "parent_$note", "path": "b.png", "note": 4, "parent_id": "nc_$note", "time": "start:$note", "opacity": 1 }
  ],
  "controllers": [
    { "time": 0, "background_dim": 0.85, "states": [{ "time": "at:2:0.5", "background_dim": 0.2 }] }
  ]
}`);
const compiled = new storyboardMod.StoryboardCompiler(sb, chart).compile();

const nc = compiled.noteControllers.find((o) => o.id === 'nc_1');
ok(!!nc, 'note controller $note id -> nc_1');
ok(close(nc.states[0].time, 0), 'nc time start:1 -> 0');
ok(close(nc.states[1].time, 1.5), 'nc state end:2:0.5 -> 1.5');

const flicks = compiled.noteControllers.filter((o) => o.id === 'flick_ctrl');
ok(flicks.length === 1 && flicks[0].note === 3, 'selector type [5] start/end selects note 3 only');

const sprite = compiled.sprites.find((o) => o.id === 'sprite');
ok(sprite.states.length === 5, 'sprite states: initial + 2 (time array) + relative + add = 5');
const times = sprite.states.map((s) => s.time);
ok(close(times[1], 1) && close(times[2], 2), 'time array expands to start:3(1) and start:4(2)');
// relative_time chain: last defined time (2) + 0.5 = 2.5
ok(close(times[3], 2.5), 'relative_time -> 2.5');
// add_time chain: last (2.5) + 0.25 = 2.75
ok(close(times[4], 2.75), 'add_time -> 2.75');

const parentSprite = compiled.sprites.find((o) => o.id === 'parent_4');
ok(!!parentSprite && parentSprite.parentId === 'nc_4', 'sprite $note id + parent_id $note');
ok(close(parentSprite.states[0].time, 2), 'sprite time start:4 -> 2');

const ctrl = compiled.controllers[0];
ok(close(ctrl.states[0].time, 0), 'controller initial time 0');
ok(close(ctrl.states[1].time, 0.5), 'at:2:0.5 -> start(0)+(end(2)-start(0))*0.5 = 0.5');

// ---- 2. destroy + evaluation ----
const sb2 = J.parse(`
{
  "sprites": [
    { "id": "a", "path": "a.png", "time": 0, "opacity": 1, "states": [{ "time": 2, "opacity": 0, "destroy": true }] },
    { "id": "child", "path": "b.png", "parent_id": "a", "time": 0, "opacity": 1 }
  ]
}`);
const compiled2 = new storyboardMod.StoryboardCompiler(sb2, chart).compile();
const ev1 = storyboardMod.evaluateStoryboard(compiled2, 1.9);
ok(ev1.sprites.some((r) => r.obj.id === 'a') && ev1.sprites.some((r) => r.obj.id === 'child'), 'before destroy both visible');
const ev2 = storyboardMod.evaluateStoryboard(compiled2, 2.01);
ok(!ev2.sprites.some((r) => r.obj.id === 'a'), 'parent destroyed at 2.01');
ok(!ev2.sprites.some((r) => r.obj.id === 'child'), 'child destroyed with parent');

// ---- 3. easing ----
const easing = require('../app/src/engine/easing.js');
ok(close(easing.fns.easeinquad(0, 10, 0.5), 2.5), 'easeinquad(0,10,0.5)=2.5');
ok(close(easing.fns.easeoutbounce(0, 1, 1), 1), 'easeoutbounce end=1');
ok(close(easing.fns.linear(3, 7, 0.25), 4), 'linear');
ok(close(easing.fns.none(3, 7, 0.5), 3), 'none keeps start');

// ---- 4. comments / trailing commas tolerant parse ----
const loose = J.parse('{"a":1, /* c */ "b":[2,3,], // line\n "c":"x"}');
ok(loose.a === 1 && loose.b.length === 2 && loose.c === 'x', 'tolerant JSON parse');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
