// 验证 drag / C-drag 连接线透明度跟随“时间上后者”note 的透明度
// （note_controller opacity_multiplier 覆盖 × 全局 note_opacity_multiplier）：
//  - 改后一个 drag note 的透明度 → 连接线 alpha 同步缩放
//  - 只改前一个 drag note 的透明度 → 连接线 alpha 不变
//  - C-drag 链同样生效
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { SAMPLE_ZIP, extract } = require('./level_fixture.js');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_dlo_')));
require(path.join(__dirname, '..', 'app', 'main.js'));

const PLAYER = extract(SAMPLE_ZIP, 'cytoid_dlo_');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_dlo_proj_'));
const CTR_PATH = path.join(TMP, 'Dlo.ctr');
const OUT = path.join(__dirname, 'probe_drag_line_opacity_out.json');

app.whenReady().then(async () => {
  setTimeout(() => { console.log('FATAL TIMEOUT'); app.exit(1); }, 90000);
  await new Promise((r) => setTimeout(r, 2000));
  const win = BrowserWindow.getAllWindows()[0];
  win.setSize(1400, 950);
  await new Promise((r) => setTimeout(r, 500));

  await win.webContents.executeJavaScript(`(async () => {
    const res = await window.sbAPI.projectCreate({
      projectPath: ${JSON.stringify(CTR_PATH)},
      name: 'Dlo',
      music: ${JSON.stringify(path.join(PLAYER, 'music.ogg'))},
      chart: ${JSON.stringify(path.join(PLAYER, 'chart.base.txt'))},
      background: null,
      storyboard: null
    });
    await window.__sb.loadLevelInfo(res.info, { projectPath: res.projectPath, config: res.config });
    const S = window.__sb.state;
    S.storyboard = { sprites: [], texts: [], videos: [], lines: [], controllers: [], note_controllers: [], templates: {} };
    window.__sb.refreshAll();
    return true;
  })()`);
  await new Promise((r) => setTimeout(r, 600));

  const R = await win.webContents.executeJavaScript(`(async () => {
    const out = {};
    const pv = window.__sb.preview;
    const ch = pv.chart;
    // 找 drag（type 3）链：头节点带 next_id
    const chain = (() => {
      for (const n of ch.notes) {
        if (n.type === 3 && n.next_id > 0 && ch.noteMap[n.next_id]) {
          const to = ch.noteMap[n.next_id];
          if (to.start_time > n.start_time) return { from: n, to };
        }
      }
      return null;
    })();
    const cchain = (() => {
      for (const n of ch.notes) {
        if (n.type === 6 && n.next_id > 0 && ch.noteMap[n.next_id]) {
          const to = ch.noteMap[n.next_id];
          if (to.start_time > n.start_time) return { from: n, to };
        }
      }
      return null;
    })();
    out.dragChain = chain ? { from: chain.from.id, to: chain.to.id } : null;
    out.cdragChain = cchain ? { from: cchain.from.id, to: cchain.to.id } : null;
    const tFor = (pair) => {
      const a = pair.from, b = pair.to;
      return Math.max(a.start_time, b.start_time) * 0.5 + Math.min(a.start_time, b.start_time) * 0.5;
    };
    const baseAlpha = (pair, t) => pv.dragLineAlpha(pair.from, pair.to, t, 1);
    if (chain) {
      const t = tFor(chain);
      const base = baseAlpha(chain, t);
      // 给“时间上后者”（to）加 opacity_multiplier 覆盖 0.2
      const S = window.__sb.state;
      S.storyboard.note_controllers.push({ id: 'nc_later', note: chain.to.id, time: 0, opacity_multiplier: 0.2 });
      pv.setStoryboard(S.storyboard);
      pv.evaluate(t);
      out.dragBase = Number(base.toFixed(4));
      out.dragWithLaterOverride = Number(baseAlpha(chain, t).toFixed(4));
      out.dragExpected = Number((base * 0.2).toFixed(4));
      // 移除覆盖，只改“前一个”（from）
      S.storyboard.note_controllers.pop();
      S.storyboard.note_controllers.push({ id: 'nc_earlier', note: chain.from.id, time: 0, opacity_multiplier: 0.2 });
      pv.setStoryboard(S.storyboard);
      pv.evaluate(t);
      out.dragWithEarlierOverride = Number(baseAlpha(chain, t).toFixed(4));
    }
    if (cchain) {
      const t = tFor(cchain);
      const base = baseAlpha(cchain, t);
      const S = window.__sb.state;
      S.storyboard.note_controllers = [];
      S.storyboard.note_controllers.push({ id: 'nc_clater', note: cchain.to.id, time: 0, opacity_multiplier: 0.3 });
      pv.setStoryboard(S.storyboard);
      pv.evaluate(t);
      out.cdragBase = Number(base.toFixed(4));
      out.cdragWithLaterOverride = Number(baseAlpha(cchain, t).toFixed(4));
      out.cdragExpected = Number((base * 0.3).toFixed(4));
    }
    return out;
  })()`);

  const out = { R };
  out.ok = !!(
    R.dragChain && R.cdragChain &&
    R.dragBase > 0.8 && R.dragWithLaterOverride === R.dragExpected &&
    R.dragWithEarlierOverride === R.dragBase &&
    R.cdragBase > 0.8 && R.cdragWithLaterOverride === R.cdragExpected
  );
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
  console.log('DLO:', JSON.stringify(out));
  process.exit(0);
}).catch((e) => {
  fs.writeFileSync(OUT, JSON.stringify({ fatal: String(e && e.stack || e) }));
  console.log('FATAL:', e && e.stack || e);
  process.exit(1);
});
