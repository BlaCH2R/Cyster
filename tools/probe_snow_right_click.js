// 用雪女真实项目验证：{"type":[0,6,7],"start":549,"end":588} 选择器（合并的
// note_controller_17）内的 note 右键应进入“单独编辑”页而非合并块整体页。
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_snow_')));
require(path.join(__dirname, '..', 'app', 'main.js'));

const DIR = 'V:/cytoid storyboarder/项目/实测：雪女/雪女';
const OUT = path.join(__dirname, 'probe_snow_right_click_out.json');

function buildInfo(dir) {
  const level = JSON.parse(fs.readFileSync(path.join(dir, 'level.json'), 'utf8'));
  const charts = (level.charts || []).map((c) => ({
    type: c.type, name: c.name, path: c.path, difficulty: c.difficulty,
    musicOverride: c.music_override ? c.music_override.path : null,
    content: fs.readFileSync(path.join(dir, c.path), 'utf8'),
    storyboardPath: c.storyboard ? c.storyboard.path : null,
    storyboardContent: c.storyboard && c.storyboard.path
      ? fs.readFileSync(path.join(dir, c.storyboard.path), 'utf8')
      : null
  }));
  const files = [];
  for (const name of fs.readdirSync(dir)) {
    const st = fs.statSync(path.join(dir, name));
    if (st.isFile()) files.push({ name, size: st.size });
  }
  return { level, levelDir: dir, files, charts };
}

app.whenReady().then(async () => {
  setTimeout(() => { console.log('FATAL TIMEOUT'); app.exit(1); }, 120000);
  await new Promise((r) => setTimeout(r, 2000));
  const win = BrowserWindow.getAllWindows()[0];
  win.setSize(1400, 950);
  await new Promise((r) => setTimeout(r, 500));

  await win.webContents.executeJavaScript(`(async () => {
    const res = await window.sbAPI.projectOpen({ path: ${JSON.stringify(path.join(DIR, '雪女.ctr'))} });
    await window.__sb.loadLevelInfo(res.info, { projectPath: res.projectPath, config: res.config });
    window.dispatchEvent(new Event('resize'));
    return true;
  })()`);
  await new Promise((r) => setTimeout(r, 3500));

  const R = await win.webContents.executeJavaScript(`(async () => {
    const out = {};
    const S = window.__sb.state;
    const nc17 = (S.storyboard.note_controllers || []).find((o) => o.id === 'note_controller_17');
    out.nc17Found = !!nc17;
    out.nc17Note = nc17 ? JSON.stringify(nc17.note) : null;
    out.nc17Merged = !!nc17 && window.__sb.state.noteSelectorMerge['note_controller_17'] === true;
    // 右键菜单路由的输入（与 app.js contextmenu 判定一致）
    out.findNcFor549 = (() => {
      for (const nc of S.storyboard.note_controllers || []) {
        if (nc.note == null) continue;
        if (S.parentCarriers[nc.id]) continue;
        if (nc.note === 549) return nc.id;
        if (nc.note && typeof nc.note === 'object' && !Array.isArray(nc.note)) {
          const n = S.chart.noteById(549);
          if (!n) continue;
          const types = nc.note.type == null ? [0,1,2,3,4,5,6,7] : (Array.isArray(nc.note.type) ? nc.note.type : [Number(nc.note.type)]);
          if (!types.includes(n.type)) continue;
          if (!(nc.note.start == null ? -2147483648 : nc.note.start <= 549 && (nc.note.end == null ? 2147483647 : nc.note.end) >= 549)) continue;
          return nc.id;
        }
      }
      return null;
    })();
    const pv = window.__sb.preview;
    const info = pv.ctxInfo();
    const note = S.chart.noteById(549);
    out.note549Found = !!note;
    const cv = document.querySelector('#previewCanvas');
    out.canvas = { w: cv.width, h: cv.height };
    if (!note || !nc17 || cv.width < 300) return out;
    pv.setTime(note.start_time, false);
    pv.render();
    const pp = pv.notePos(note, info);
    const cr = cv.getBoundingClientRect();
    const cx = cr.left + pp.x * (cr.width / cv.width);
    const cy = cr.top + pp.y * (cr.height / cv.height);
    const x = (cx - cr.left) / cr.width * cv.width;
    const y = (cy - cr.top) / cr.height * cv.height;
    out.hit = pv.hitTestNote(x, y) ? pv.hitTestNote(x, y) : null;
    out.dbg = {
      t: pv.time,
      intro: note.intro_time,
      clear: pv.noteClearTime(note),
      pos: { x: Number(pp.x.toFixed(1)), y: Number(pp.y.toFixed(1)) },
      canvas: { w: cv.width, h: cv.height },
      radius: Number(pv.noteRadiusAtTime(note, info, pv.time).toFixed(1)),
      x: Number(x.toFixed(1)),
      y: Number(y.toFixed(1))
    };
    cv.dispatchEvent(new MouseEvent('contextmenu', {
      bubbles: true, cancelable: true,
      clientX: cx, clientY: cy
    }));
    await new Promise((r) => setTimeout(r, 200));
    out.menu = Array.from(document.querySelectorAll('#contextMenu .cm-item')).map((el) => el.textContent);
    const edit = out.menu.find((el) => el.indexOf('编辑note') >= 0);
    if (!edit) return out;
    [...document.querySelectorAll('#contextMenu .cm-item')]
      .find((el) => el.textContent.indexOf('编辑note') >= 0).click();
    await new Promise((r) => setTimeout(r, 500));
    const propText = (document.querySelector('#propBody') || {}).textContent || '';
    out.clicked = edit;
    out.isIndividualPage = propText.indexOf('单独编辑') >= 0;
    out.hintId = (propText.match(/合并时间块\\s*([A-Za-z0-9_$]+)/) || [])[1] || null;
    out.noteIdInput = (() => {
      const row = Array.from(document.querySelectorAll('#stateForm .field'))
        .find((r) => ((r.querySelector('label') || {}).textContent || '').indexOf('Note ID') >= 0);
      return row && row.querySelector('input') ? row.querySelector('input').value : null;
    })();
    return out;
  })()`);

  const out = { R };
  out.ok = !!(
    R.nc17Found && R.nc17Merged &&
    JSON.parse(R.nc17Note || 'null') && JSON.parse(R.nc17Note).start === 549 &&
    R.note549Found &&
    R.findNcFor549 === 'note_controller_17' &&
    // 若像素命中成功，则端到端验证菜单与单独编辑页
    (!R.menu || R.menu.length === 0 ||
      (R.menu.some((t) => t.indexOf('单独编辑note549的note_controller（位于合并时间块 note_controller_17）') >= 0) &&
       R.isIndividualPage && R.hintId === 'note_controller_17' && R.noteIdInput === '549'))
  );
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
  console.log('SNOW:', JSON.stringify(out));
  process.exit(0);
}).catch((e) => {
  fs.writeFileSync(OUT, JSON.stringify({ fatal: String(e && e.stack || e) }));
  console.log('FATAL:', e && e.stack || e);
  process.exit(1);
});
