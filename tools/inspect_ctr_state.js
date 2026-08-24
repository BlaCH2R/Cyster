const fs = require('fs');
const p = '项目/测试：效果/EffectsTest/parent_note_to_sprite.ctr';
const ctr = JSON.parse(fs.readFileSync(p, 'utf8'));
const ed = (ctr.editor && ctr.editor.difficulties) || {};
console.log('ctr keys:', Object.keys(ctr).join(','));
console.log('editor top keys:', Object.keys(ctr.editor || {}).join(','));
for (const [chart, bucket] of Object.entries(ed)) {
  console.log('==', chart, '==');
  console.log(' lockedIds:', JSON.stringify(bucket.lockedIds || []));
  console.log(' hiddenObjects:', JSON.stringify(Object.keys(bucket.hiddenObjects || {})));
  console.log(' groupHidden:', JSON.stringify(bucket.groupHidden || {}));
  console.log(' manualImages:', JSON.stringify(bucket.manualImages || []));
  console.log(' parentCarriers:', JSON.stringify(bucket.parentCarriers || {}));
  console.log(' controllerCards:', JSON.stringify(bucket.controllerCards || {}));
  console.log(' noteSelectorMerge:', JSON.stringify(bucket.noteSelectorMerge || {}));
  console.log(' hasTimeline:', !!bucket.timeline, '| hasNoteTimeTokens:', !!bucket.noteTimeTokens);
  const meta = bucket.noteSelectorMeta || {};
  for (const [k, v] of Object.entries(meta)) {
    console.log(' meta', k, '=> notes:', (v.notes || []).length,
      '| 含0:', (v.notes || []).includes(0), '| 含21:', (v.notes || []).includes(21));
  }
}
console.log('updated_at:', ctr.updated_at);
