// 验证：在原有首个关键帧之前创建新关键帧后拖动，该关键帧不再消失/错乱；
// 以及拖动一个较晚关键帧越过 K0 到更早位置时，拖动仍正确跟随。
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { SAMPLE_ZIP, extract } = require('./level_fixture.js');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_dkf_')));
require(path.join(__dirname, '..', 'app', 'main.js'));
const PLAYER = extract(SAMPLE_ZIP, 'cytoid_dkf_');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_dkf_proj_'));
const CTR_PATH = path.join(TMP, 'DKF.ctr');
const OUT = path.join(__dirname, 'probe_drag_early_kf_out.json');

app.whenReady().then(async () => {
  setTimeout(() => { console.log('FATAL TIMEOUT'); app.exit(1); }, 90000);
  await new Promise((r) => setTimeout(r, 2000));
  const win = BrowserWindow.getAllWindows()[0];
  win.setSize(1400, 950);
  await new Promise((r) => setTimeout(r, 500));
  await win.webContents.executeJavaScript(`(async () => {
    const res = await window.sbAPI.projectCreate({
      projectPath: ${JSON.stringify(CTR_PATH)},
      name: 'DKF', music: ${JSON.stringify(path.join(PLAYER, 'music.ogg'))},
      chart: ${JSON.stringify(path.join(PLAYER, 'chart.base.txt'))}, background: null, storyboard: null
    });
    await window.__sb.loadLevelInfo(res.info, { projectPath: res.projectPath, config: res.config });
    const S = window.__sb.state;
    S.storyboard = { sprites: [], texts: [], videos: [], lines: [], controllers: [], note_controllers: [], templates: {} };
    S.storyboard.sprites.push({
      id: 'spr', path: 'octa.png', time: 10, x: { unit: 'notex', value: 0.5 }, y: { unit: 'notey', value: 0.5 },
      opacity: 1, layer: 2, order: 0, preserve_aspect: true
    });
    window.__sb.refreshAll();
    window.dispatchEvent(new Event('resize'));
    return true;
  })()`);
  await new Promise((r) => setTimeout(r, 1000));

  const R = await win.webContents.executeJavaScript(`(async () => {
    const out = {};
    const S = window.__sb.state;
    const obj = () => S.storyboard.sprites.find((o) => o.id === 'spr');
    const tl = window.__sb.timeline;
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const dump = (tag) => ({
      tag, time: obj().time,
      states: (obj().states || []).map((s) => s.time),
      tlKfs: (window.__sb.timeline.objects.find((o) => o.id === 'spr') || {}).keyframes
        ? window.__sb.timeline.objects.find((o) => o.id === 'spr').keyframes.map((k) => ({ i: k.index, t: k.time }))
        : null
    });
    const dragKf = async (kfIdx, px) => {
      const el = document.querySelector('#tlScroll .kf[data-id="spr"][data-kf="' + kfIdx + '"]');
      if (!el) return { ok: false };
      const rect = el.getBoundingClientRect();
      const startX = rect.left + rect.width / 2;
      const startY = rect.top + rect.height / 2;
      el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, clientX: startX, clientY: startY, button: 0 }));
      await sleep(100);
      document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: startX + px / 2, clientY: startY }));
      await sleep(120);
      document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: startX + px, clientY: startY }));
      await sleep(120);
      document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: startX + px, clientY: startY }));
      await sleep(400);
      return { ok: true };
    };

    // 场景 A：K0@10，播放头 5 添加新关键帧（应被提升为新 K0），拖动 K0 到 7
    out.a_start = dump('a_start');
    window.__sb.setTime(5, false);
    await sleep(200);
    window.__sb.selectObject('spr', -1);
    await sleep(200);
    document.getElementById('btnAddKf').click();
    await sleep(400);
    out.a_afterAdd = dump('a_afterAdd');
    // 此时新增关键帧应是 K0（index -1）
    out.a_newIsK0 = Math.abs(obj().time - 5) < 1e-9;
    const aDrag = await dragKf(-1, 2 * tl.pxPerSec);
    out.a_dragOk = aDrag.ok;
    out.a_afterDrag = dump('a_afterDrag');
    out.a_movedToPlayheadTarget = Math.abs(obj().time - 7) < 1e-6;

    // 场景 B：K0@5，states=[10]，把 K1 拖到 K0（5）之前（越过 K0），应正确跟随
    obj().time = 5;
    obj().states = [{ time: 10, opacity: 1 }];
    window.__sb.refreshAll();
    await sleep(300);
    out.b_start = dump('b_start');
    const bDrag = await dragKf(0, -6 * tl.pxPerSec); // 从 10 拖到约 4
    out.b_dragOk = bDrag.ok;
    out.b_afterDrag = dump('b_afterDrag');
    // 越过后被拖的关键帧应成为新的 K0（时间 ≈ 4），旧 K0 降为关键帧
    const bKfs = (out.b_afterDrag.tlKfs || []).map((k) => k.t);
    out.b_newK0IsDragged = Math.abs(obj().time - 4) < 1e-6;
    out.b_hasMovedKf = bKfs.some((t) => t < 5 && t > 2);
    out.b_stillTwoKfs = bKfs.length === 2;
    return out;
  })()`);

  const out = { R };
  out.ok = !!(
    R.a_afterAdd && R.a_newIsK0 &&
    R.a_afterDrag && R.a_movedToPlayheadTarget && R.a_afterDrag.tlKfs.length === 2 &&
    R.b_afterDrag && R.b_newK0IsDragged && R.b_hasMovedKf && R.b_stillTwoKfs
  );
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
  console.log('DKF:', JSON.stringify(out));
  process.exit(0);
}).catch((e) => {
  fs.writeFileSync(OUT, JSON.stringify({ fatal: String(e && e.stack || e) }));
  console.log('FATAL:', e && e.stack || e);
  process.exit(1);
});
