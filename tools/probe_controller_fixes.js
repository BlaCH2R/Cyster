// 验证三个修复：
//  1) 点击 controller 时间周期段不再跳转播放头到首个关键帧
//  2) 同轨道多选 controller 关键帧时提供缓动选项，修改应用到全部选中关键帧
//  3) drag头/Cdrag头清除特效固定在其原始位置（不跟随链滑动）
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { SAMPLE_ZIP, extract } = require('./level_fixture.js');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_cf_')));
require(path.join(__dirname, '..', 'app', 'main.js'));

const PLAYER = extract(SAMPLE_ZIP, 'cytoid_cf_');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_cf_proj_'));
const CTR_PATH = path.join(TMP, 'CtrlFixes.ctr');
const OUT = path.join(__dirname, 'probe_controller_fixes_out.json');

app.whenReady().then(async () => {
  setTimeout(() => { console.log('FATAL TIMEOUT'); app.exit(1); }, 120000);
  await new Promise((r) => setTimeout(r, 2000));
  const win = BrowserWindow.getAllWindows()[0];
  win.setSize(1400, 950);
  await new Promise((r) => setTimeout(r, 500));

  await win.webContents.executeJavaScript(`(async () => {
    const res = await window.sbAPI.projectCreate({
      projectPath: ${JSON.stringify(CTR_PATH)},
      name: 'CtrlFixes',
      music: ${JSON.stringify(path.join(PLAYER, 'music.ogg'))},
      chart: ${JSON.stringify(path.join(PLAYER, 'chart.base.txt'))},
      background: ${JSON.stringify(path.join(PLAYER, 'bg.jpg'))},
      storyboard: ${JSON.stringify(path.join(PLAYER, 'storyboard_base.json'))}
    });
    await window.__sb.loadLevelInfo(res.info, { projectPath: res.projectPath, config: res.config });
    return true;
  })()`);

  const out = await win.webContents.executeJavaScript(`(async () => {
    const S = window.__sb.state;
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const R = {};

    // 1) 点击 controller 周期段不跳播放头
    const ctlSeg = { id: 'ctl_seg', time: 0, states: [{ time: 5, storyboard_opacity: 1 }, { time: 10, storyboard_opacity: 0.5 }] };
    S.storyboard.controllers = [ctlSeg];
    window.__sb.refreshAll();
    window.__sb.setTime(3, false);
    await sleep(150);
    const seg = document.querySelector('.lane-seg');
    const before = window.__sb.preview.time;
    if (seg) {
      const r = seg.getBoundingClientRect();
      seg.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, clientX: r.left + 4, clientY: r.top + 2, button: 0 }));
      await sleep(120);
      document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
    }
    const after = window.__sb.preview.time;
    R.segFound = !!seg;
    R.segTimeBefore = before;
    R.segTimeAfter = after;
    R.segNoJump = before === after;
    R.segSelected = S.selectedObjId === 'ctl_seg';

    // 2) 同轨道多选 controller 关键帧 → 缓动选项
    S.selectedObjId = 'ctl_seg';
    S.selectedIds = ['ctl_seg'];
    S.selectedKfs = [{ objId: 'ctl_seg', index: 0 }, { objId: 'ctl_seg', index: 1 }];
    window.__sb.renderProperties();
    await sleep(120);
    const easingSel = document.querySelector('#propBody #multiKfEasing');
    R.easingSelFound = !!easingSel;
    R.easingSelOptions = easingSel ? Array.from(easingSel.options).map((o) => o.value).filter(Boolean) : [];
    if (easingSel) {
      easingSel.value = 'easeinoutquad';
      easingSel.dispatchEvent(new Event('change', { bubbles: true }));
      await sleep(120);
    }
    const ctl2 = S.storyboard.controllers.find((c) => c.id === 'ctl_seg');
    R.easingApplied = (ctl2.states || []).every((st) => st.easing === 'easeinoutquad');

    // 3) drag头清除特效固定在原始位置
    const ch = S.chart;
    const dragHead = ch.notes.find((n) => n.type === 3);
    R.dragHeadFound = !!dragHead;
    if (dragHead) {
      window.__sb.preview.setTime(dragHead.start_time + 0.3, false);
      const info = window.__sb.preview.ctxInfo();
      const orig = window.__sb.preview.noteScreenPos(dragHead, info);
      const follow = window.__sb.preview.notePos(dragHead, info);
      const cv = document.querySelector('#previewCanvas');
      const ctx = cv.getContext('2d');
      const arcs = [];
      const origArc = ctx.arc.bind(ctx);
      ctx.arc = (x, y, rad, a0, a1) => { arcs.push({ x, y, rad }); return origArc(x, y, rad, a0, a1); };
      window.__sb.preview.drawClearEffects(ctx, info, dragHead.start_time + 0.3);
      ctx.arc = origArc;
      const hit = arcs.length ? arcs[0] : null;
      R.effectPos = hit ? { x: hit.x, y: hit.y } : null;
      R.origPos = { x: orig.x, y: orig.y };
      R.followPos = { x: follow.x, y: follow.y };
      R.effectAtOrigin = hit
        ? Math.hypot(hit.x - orig.x, hit.y - orig.y) < 2
        : false;
      R.effectFollows = hit
        ? Math.hypot(hit.x - follow.x, hit.y - follow.y) < 2
        : false;
    }
    return R;
  })()`);

  out.ok = !!(
    out.segFound && out.segNoJump && out.segSelected &&
    out.easingSelFound && out.easingSelOptions.length >= 10 && out.easingApplied &&
    out.dragHeadFound && out.effectAtOrigin && !out.effectFollows
  );
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
  console.log('CTRL_FIXES:', JSON.stringify(out));
  app.exit(0);
}).catch((e) => {
  fs.writeFileSync(OUT, JSON.stringify({ fatal: String(e && e.stack || e) }));
  console.log('FATAL:', e && e.stack || e);
  app.exit(1);
});
