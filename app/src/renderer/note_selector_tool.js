// 独立进程窗口（note_selector.html）的编辑器逻辑。
// 通过 window.sbAPI.nsCall 与主渲染进程通信（getContext/apply/highlight/pick/writeTime）。
const $ = (s) => document.querySelector(s);
const LABELS = { 0: 'Click', 1: 'Hold', 2: 'LongHold', 3: 'Drag头', 4: 'Drag子', 5: 'Flick', 6: 'CDrag头', 7: 'CDrag子' };
let ctx = null;
// 已绑定对象 id：合并时间块复选框只在刚绑定/刚应用时随上下文同步，避免未提交
// 的勾选被拾取刷新覆盖。
// 初始值用 undefined 区分“尚未初始化”，保证首次打开（未绑定）时应用默认值。
let lastBoundId = undefined;

function hitIds(sel) {
  if (!ctx || !ctx.notes) return [];
  const types = sel.type == null ? [0, 1, 2, 3, 4, 5, 6, 7] : (Array.isArray(sel.type) ? sel.type : [Number(sel.type)]);
  const start = sel.start == null ? -2147483648 : sel.start;
  const end = sel.end == null ? 2147483647 : sel.end;
  return ctx.notes
    .filter((n) => types.includes(n.type) && start <= n.id && end >= n.id)
    .filter((n) => sel.min_x == null || sel.min_x <= n.x)
    .filter((n) => sel.max_x == null || sel.max_x >= n.x)
    .filter((n) => sel.direction == null || sel.direction === n.direction)
    .map((n) => n.id);
}

function readSel() {
  const sel = {};
  const types = Array.from(document.querySelectorAll('#nsTypes input:checked')).map((el) => Number(el.dataset.t));
  if (types.length && types.length < 8) sel.type = types;
  const num = (id) => { const v = $(id).value.trim(); return v === '' ? null : Number(v); };
  const start = num('#nsStart'), end = num('#nsEnd');
  if (start != null) sel.start = start;
  if (end != null) sel.end = end;
  const dir = $('#nsDir').value;
  if (dir !== '') sel.direction = Number(dir);
  const minX = num('#nsMinX'), maxX = num('#nsMaxX');
  if (minX != null) sel.min_x = minX;
  if (maxX != null) sel.max_x = maxX;
  return sel;
}

function updateHit() {
  // 列表模式：预览只突出显示被列表拾取到的 note（取消拾取后对应失去高亮）。
  const isList = !!(ctx && ctx.target && Array.isArray(ctx.target.note));
  let ids;
  if (isList) {
    ids = (ctx.target.note || []).map((n) => Number(n)).filter((n) => Number.isFinite(n));
  } else {
    const sel = readSel();
    ids = Object.keys(sel).length ? hitIds(sel) : (ctx ? ctx.notes.map((n) => n.id) : []);
  }
  $('#nsHit').textContent = ids.length + ' 个 note';
  window.sbAPI.nsCall('highlight', [ids]);
}

function buildTypes() {
  $('#nsTypes').innerHTML = [0, 1, 2, 3, 4, 5, 6, 7].map((t) =>
    `<label><input type="checkbox" data-t="${t}">${LABELS[t]}</label>`).join('');
  $('#nsTypes').querySelectorAll('input').forEach((cb) => cb.addEventListener('change', updateHit));
}

function fillFrom(sel) {
  if (!sel || typeof sel !== 'object' || Array.isArray(sel)) return;
  const ts = Array.isArray(sel.type) ? sel.type.map(Number) : (sel.type != null ? [Number(sel.type)] : []);
  $('#nsTypes').querySelectorAll('input').forEach((cb) => { cb.checked = ts.includes(Number(cb.dataset.t)); });
  $('#nsStart').value = sel.start != null ? sel.start : '';
  $('#nsEnd').value = sel.end != null ? sel.end : '';
  $('#nsDir').value = sel.direction != null ? String(sel.direction) : '';
  $('#nsMinX').value = sel.min_x != null ? sel.min_x : '';
  $('#nsMaxX').value = sel.max_x != null ? sel.max_x : '';
}

async function load() {
  ctx = await window.sbAPI.nsCall('getContext');
  if (!ctx || !ctx.hasProject) {
    $('#nsStatus').textContent = '请先在主窗口打开项目';
    return;
  }
  $('#nsStatus').textContent = ctx.target
    ? '绑定对象：' + ctx.target.id + (ctx.target.type ? '（' + ctx.target.type + '）' : '')
    : '未绑定对象：应用时写入当前选中的 note 集合';
  buildTypes();
  const isList = !!(ctx.target && Array.isArray(ctx.target.note));
  $('#nsFilterArea').style.display = isList ? 'none' : '';
  $('#nsListRow').style.display = isList ? '' : 'none';
  $('#nsToFilter').style.display = isList ? '' : 'none';
  $('#nsApply').style.display = '';
  $('#nsToggleAll').style.display = isList ? 'none' : '';
  const boundId = ctx.target ? ctx.target.id : null;
  if (boundId !== lastBoundId) {
    // 新编辑器（未绑定对象）默认合并时间块开启；绑定已有对象时按对象状态同步。
    $('#nsMerge').checked = ctx.target ? !!(ctx.target.merge) : true;
    lastBoundId = boundId;
  }
  $('#nsPick').textContent = ctx.pickActive ? '停止拾取' : '手动拾取note';
  if (isList) {
    renderList(ctx.target.note);
    $('#nsStatus').textContent = '手动列表模式：' + ctx.target.note.length + ' 个 note（点击“应用”后生效）';
    updateHit();
    return;
  }
  if (ctx.target && ctx.target.note) {
    fillFrom(ctx.target.note);
  } else {
    // 新选择器：初始不做任何类型勾选（空条件 = 不限类型）。
    $('#nsTypes').querySelectorAll('input').forEach((cb) => { cb.checked = false; });
  }
  updateHit();
}

// 手动列表模式：直接列出 [] 内的 note ID 与类型。
function renderList(ids) {
  const map = new Map((ctx.notes || []).map((n) => [n.id, n]));
  $('#nsList').innerHTML = ids.length
    ? ids.map((id) => {
        const n = map.get(Number(id));
        const type = n ? (LABELS[n.type] || ('类型 ' + n.type)) : '未知';
        return `<div class="ns-list-item"><span>#${id}</span><span class="ns-list-type">${type}</span></div>`;
      }).join('')
    : '<div class="ns-list-item" style="color:#888">（空列表）</div>';
}

async function apply() {
  // 应用前重新拉取最新上下文：拾取/草稿修改后 load() 是异步的，直接用旧 ctx
  // 提交会把编辑前的列表/条件写回对象（大谱面下 getContext 较慢时必现，
  // 表现为"应用无效、重开恢复编辑前状态"）。这里强制以最新草稿为准。
  const c = await window.sbAPI.nsCall('getContext');
  if (!c || !c.hasProject) {
    $('#nsStatus').textContent = '未打开项目';
    return;
  }
  ctx = c;
  const isList = !!(ctx.target && Array.isArray(ctx.target.note));
  const sel = isList ? (ctx.target.note || []) : readSel();
  const merge = $('#nsMerge').checked;
  const r = await window.sbAPI.nsCall('apply', [{ id: ctx.target ? ctx.target.id : null, note: sel, merge }]);
  $('#nsStatus').textContent = (r && r.ok) ? '已应用：' + JSON.stringify(r.note) : ('应用失败：' + ((r && r.msg) || '未知错误'));
  lastBoundId = null; // 应用后从已提交状态重新同步（含 merge）
  load();
}

window.sbAPI.nsCall('getContext').then((c) => { ctx = c; load(); });

['#nsStart', '#nsEnd', '#nsMinX', '#nsMaxX'].forEach((id) => $(id).addEventListener('input', updateHit));
$('#nsDir').addEventListener('change', updateHit);
$('#nsApply').addEventListener('click', apply);
$('#nsToggleAll').addEventListener('click', () => {
  const cbs = Array.from($('#nsTypes').querySelectorAll('input'));
  const allChecked = cbs.length > 0 && cbs.every((cb) => cb.checked);
  if (allChecked) {
    cbs.forEach((cb) => { cb.checked = false; });
    ['#nsStart', '#nsEnd', '#nsMinX', '#nsMaxX'].forEach((id) => { $(id).value = ''; });
    $('#nsDir').value = '';
  } else {
    cbs.forEach((cb) => { cb.checked = true; });
  }
  updateHit();
});
$('#nsPick').addEventListener('click', async () => {
  await window.sbAPI.nsCall('pick', [!(ctx && ctx.pickActive)]);
  load();
});
// 切换至选择器默认（筛选）样式：把 note 从 [] 数组改为 {}（命中全部），并清空列表内容。
$('#nsToFilter').addEventListener('click', async () => {
  if (!ctx || !ctx.target) return;
  const r = await window.sbAPI.nsCall('draft', [{ note: {} }]);
  $('#nsStatus').textContent = (r && r.ok)
    ? '已切换至筛选样式草稿（点击“应用”生效）'
    : ('切换失败：' + ((r && r.msg) || '未知错误'));
  load();
});
$('#nsWriteTime').addEventListener('click', async () => {
  const r = await window.sbAPI.nsCall('writeTime', [{ expr: $('#nsTimeExpr').value }]);
  $('#nsStatus').textContent = (r && r.ok) ? '已写入时间表达式' : ('写入失败：' + ((r && r.msg) || ''));
});

// 主窗口推送：预览拾取到 note / 点击了时间输入框。
window.sbAPI.nsOnPicked((p) => {
  if (p && p.targetId && ctx && ctx.target && p.targetId === ctx.target.id) load();
  else if (p) $('#nsStatus').textContent = '已拾取 note ' + p.noteId + '（共 ' + p.count + ' 个）';
});
window.sbAPI.nsOnMessage((m) => {
  if (m && m.type === 'time-target') {
    $('#nsTimeRow').style.display = '';
    $('#nsStatus').textContent = '时间模式：将写入对象 ' + m.id + ' 的时间输入框';
  } else if (m && m.type === 'note-target') {
    // 点击属性面板的 Note 输入框：切换到该对象已使用的 note 选择器。
    $('#nsTimeRow').style.display = 'none';
    // 进入新的选择器编辑（含未绑定创建）：同步合并时间块默认值并强制按 ctx
    // 重新同步，保证新选择器初始即勾选“合并时间块”。
    if (m.merge !== undefined) {
      $('#nsMerge').checked = !!m.merge;
      lastBoundId = undefined;
    }
    $('#nsStatus').textContent = 'Note 模式：已绑定对象 ' + m.id + ' 的 note 选择器';
    load();
  }
});
window.addEventListener('beforeunload', () => {
  window.sbAPI.nsCall('pick', [false]);
  window.sbAPI.nsCall('discard', []);
});
