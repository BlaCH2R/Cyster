// 复现探针：雪女项目 note 选择器时间块双击全选关键帧失效。
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');

app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cyster_dbl_pw_')));
require(path.join(__dirname, '..', 'app', 'main.js'));

const OUT_JSON = path.join(__dirname, 'dblclick_ns_probe_out.json');
const DIR = 'V:/cytoid storyboarder/项目/实测：雪女/雪女';
const PROJ = DIR + '/雪女.ctr';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function buildInfo() {
  const level = JSON.parse(fs.readFileSync(path.join(DIR, 'level.json'), 'utf8'));
  const chart = level.charts[0];
  return {
    level,
    levelDir: DIR,
    files: fs.readdirSync(DIR).map((n) => ({ name: n, size: fs.statSync(path.join(DIR, n)).size })),
    charts: [{
      type: chart.type,
      name: chart.name || '',
      difficulty: chart.difficulty,
      path: chart.path,
      content: fs.readFileSync(path.join(DIR, chart.path), 'utf8'),
      storyboardPath: chart.storyboard.path,
      storyboardContent: fs.readFileSync(path.join(DIR, chart.storyboard.path), 'utf8')
    }]
  };
}

app.whenReady().then(async () => {
  const hardTimer = setTimeout(() => {
    fs.writeFileSync(OUT_JSON, JSON.stringify({ fatal: 'timeout' }));
    app.exit(1);
  }, 180000);
  const res = { ok: false, error: null };
  try {
    let mainWin = null;
    for (let i = 0; i < 100 && !mainWin; i++) {
      const cand = BrowserWindow.getAllWindows().find((w) => !w.isDestroyed());
      if (cand) mainWin = cand;
      else await sleep(100);
    }
    if (!mainWin) throw new Error('主窗口未创建');
    await mainWin.webContents.executeJavaScript('window.__sb.loadLevelInfo(' + JSON.stringify(buildInfo()) + ')');
    await sleep(3000);

    const stats = await mainWin.webContents.executeJavaScript(`(() => {
      const sb = window.__sb.state.storyboard || {};
      const numeric = (o) => typeof o.time === 'number' &&
        (o.states || []).every((st) => typeof st.time === 'number');
      const plain = (sb.sprites || []).filter((o) => !(o.note && typeof o.note === 'object') && numeric(o));
      const ns = (sb.sprites || []).filter((o) => o.note && typeof o.note === 'object');
      const merged = ns.filter((o) => window.__sb.state.noteSelectorMerge && window.__sb.state.noteSelectorMerge[o.id]);
      const ncs = (sb.note_controllers || []).filter((o) => o.note && typeof o.note === 'object');
      const sample = (id) => {
        const o = (sb.sprites || []).find((x) => x.id === id);
        return o ? {
          time: typeof o.time === 'number' ? o.time : String(o.time).slice(0, 30),
          states: (o.states || []).map((st) => typeof st.time === 'number' ? st.time : String(st.time).slice(0, 24)).slice(0, 3)
        } : null;
      };
      return {
        spriteTotal: (sb.sprites || []).length,
        plain: plain.slice(0, 2).map((o) => o.id),
        ns: ns.slice(0, 3).map((o) => o.id),
        nsMerged: merged.slice(0, 3).map((o) => o.id),
        ncMerged: ncs.slice(0, 3).map((o) => o.id),
        samplePlain: plain[0] ? sample(plain[0].id) : null,
        sampleNs: ns[0] ? sample(ns[0].id) : null
      };
    })()`);
    res.stats = stats;

    // 直接调用 onSelectAllKeyframes，隔离验证 selectAllKeyframes 本身。
    const direct = async (id) => mainWin.webContents.executeJavaScript(`(async () => {
      window.__sb.state.selectedKfs = [];
      window.__sb.state.selectedIds = [];
      const r = window.__sb.timeline.opts.onSelectAllKeyframes('${id}');
      if (r && r.then) await r;
      return {
        selectedIds: window.__sb.state.selectedIds.slice(),
        kfsCount: (window.__sb.state.selectedKfs || []).length,
        kfs: (window.__sb.state.selectedKfs || []).map((k) => k.objId + '::' + k.index).slice(0, 6)
      };
    })()`);
    res.directPlain = stats.plain[0] ? await direct(stats.plain[0]) : null;
    res.directNs = stats.ns[0] ? await direct(stats.ns[0]) : null;
    if (!res.directNs || !res.directNs.kfsCount) {
      throw new Error('note 选择器对象双击全选仍为空: ' + JSON.stringify(res.directNs));
    }

    // 模拟双击：350ms 内对同一 clip 连续两次 mousedown
    const dblClick = async (id) => {
      const r = await mainWin.webContents.executeJavaScript(`(async () => {
        const clip = document.querySelector('.clip[data-id="${id}"]');
        if (!clip) return { found: false };
        const snap = () => ({
          last: window.__sb.timeline._lastClipDown ? { id: window.__sb.timeline._lastClipDown.id, age: Date.now() - window.__sb.timeline._lastClipDown.t } : null,
          ids: window.__sb.state.selectedIds.slice(),
          kfs: (window.__sb.state.selectedKfs || []).length
        });
        const fire = (x, y) => clip.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0, clientX: x, clientY: y }));
        const rect = clip.getBoundingClientRect();
        const x = rect.left + Math.min(20, rect.width / 2);
        const y = rect.top + rect.height / 2;
        window.__sb.state.selectedKfs = [];
        window.__sb.state.selectedIds = [];
        const before = snap();
        fire(x, y);
        await new Promise((r) => setTimeout(r, 80));
        const after1 = snap();
        fire(x, y);
        await new Promise((r) => setTimeout(r, 120));
        const after2 = snap();
        // 真实 dblclick 事件：落在重建后的新元素上，验证事件委托兜底路径。
        clip.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, button: 0, clientX: x, clientY: y }));
        await new Promise((r) => setTimeout(r, 80));
        const after3 = snap();
        return {
          found: true,
          before, after1, after2, after3
        };
      })()`);
      return r;
    };

    if (stats.plain && stats.plain[0]) {
      const r = await dblClick(stats.plain[0]);
      res.plainResult = r;
    }
    if (stats.ns && stats.ns[0]) {
      const r = await dblClick(stats.ns[0]);
      res.nsResult = r;
    }

    // 通过 openProjectFilePath 加载 .ctr（带 noteSelectorMerge 配置），
    // 验证合并时间块的双击全选（选中“最早/最晚”两个展示标记）。
    mainWin.webContents.executeJavaScript('window.__sb.openProjectFilePath(' + JSON.stringify(PROJ) + ')')
      .catch(() => {});
    for (let i = 0; i < 250; i++) {
      const st = await mainWin.webContents.executeJavaScript(`(() => {
        const mask = document.getElementById('modalMask');
        const title = mask && !mask.classList.contains('hidden')
          ? (document.getElementById('modalTitle') || {}).textContent : null;
        return { title, path: window.__sb.state.projectPath };
      })()`);
      if (st.title === '选择难度谱面') {
        await mainWin.webContents.executeJavaScript(
          'document.querySelectorAll("#modalBody .pick-item")[0].click()');
      }
      if (st.path === PROJ) break;
      await sleep(100);
    }
    const mergedState = await mainWin.webContents.executeJavaScript(`(() => {
      const merge = window.__sb.state.noteSelectorMerge || {};
      return { sprite112: !!merge['sprite_112'], nc8: !!merge['note_controller_8'] };
    })()`);
    res.mergedFlags = mergedState;
    res.directMerged = await direct('sprite_112');
    res.dblMerged = await dblClick('sprite_112');
    if (!res.directMerged || res.directMerged.kfsCount !== 2 ||
        (res.dblMerged.after3 && res.dblMerged.after3.kfs !== 2)) {
      throw new Error('合并块双击全选异常: ' + JSON.stringify({ directMerged: res.directMerged, dblMerged: res.dblMerged }));
    }
    // 普通块：dblclick 兜底路径应全选 35 个关键帧（mousedown 路径可能因大谱面
    // 渲染耗时超窗失败，dblclick 必须兜住）。
    if (!res.plainResult || !res.plainResult.after3 || res.plainResult.after3.kfs < 30) {
      throw new Error('普通块 dblclick 全选异常: ' + JSON.stringify(res.plainResult));
    }
    res.ok = true;
  } catch (e) {
    res.error = String(e && (e.stack || e.message) || e);
  }
  clearTimeout(hardTimer);
  fs.writeFileSync(OUT_JSON, JSON.stringify(res, null, 2));
  app.exit(res.ok ? 0 : 1);
});
