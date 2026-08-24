const fs = require('fs');
const DIR = '项目/测试：效果/EffectsTest';
const s = fs.readFileSync(DIR + '/storyboard.json', 'utf8');
const sb = JSON.parse(s);
console.log('compiled:', sb.compiled, 'ncs:', (sb.note_controllers || []).length,
  'sprites:', (sb.sprites || []).length, 'texts:', (sb.texts || []).length);
console.log('含 t_parent:', s.includes('t_parent'));
console.log('含 888:', s.includes('888'), '| 999 出现次数:', (s.match(/999/g) || []).length);
const sp1 = (sb.sprites || []).filter((x) => String(x.Id || '').indexOf('sprite_1') === 0);
console.log('sprite_1 相关条目数:', sp1.length,
  '| ParentId 样例:', sp1.slice(0, 3).map((x) => x.ParentId).join(','));
console.log('有 _cyster:', !!sb._cyster);
console.log('文件大小:', s.length);
// 与 1.2.cytoidlevel 包内 storyboard 对比（若存在）
const fs2 = require('fs');
const zlib = require('zlib');
const b = fs.readFileSync(DIR + '/1.2.cytoidlevel');
console.log('cytoidlevel 大小:', b.length, 'zip头:', b[0], b[1]);
