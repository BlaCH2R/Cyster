const chartMod = require('../app/src/engine/chart.js');
const legacy = `PAGE_SIZE 2
PAGE_SHIFT 0
NOTE 1 0 0.5 0
NOTE 2 1 0.2 0
NOTE 3 2 0.8 0.5
LINK 1 2
`;
const chart = new chartMod.Chart(legacy, { screenRatio: 16/9 });
console.log('notes:', chart.notes.map(n => ({id:n.id, type:n.type, page:n.page_index, start:n.start_time.toFixed(3), hold:n.hold_tick})) );
console.log('pages:', chart.model.page_list.map(p => ({dir:p.scan_line_direction, s:p.start_tick, e:p.end_tick, st:p.start_time.toFixed(2), et:p.end_time.toFixed(2)})) );
console.log('music_offset:', chart.model.music_offset, 'endTime:', chart.endTime.toFixed(2));
console.log('scan t=0:', chart.getScannerPositionY(0).toFixed(2), 't=2:', chart.getScannerPositionY(2).toFixed(2), 't=4:', chart.getScannerPositionY(4).toFixed(2));
