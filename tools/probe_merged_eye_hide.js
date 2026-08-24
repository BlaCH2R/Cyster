// 验证：合并 note 选择器的 stage 对象（sprite/text/video/line）点眼睛隐藏后，
// 预览的隐藏集合包含其编译展开的逐 note 克隆 id，绘制时会被跳过。
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { SAMPLE_ZIP, extract } = require('./level_fixture.js');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_eye_')));
require(path.join(__dirname, '..', 'app', 'main.js'));

const PLAYER = extract(SAMPLE_ZIP, 'cytoid_eye_');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_eye_proj_'));
const CTR_PATH = path.join(TMP, 'Eye.ctr');
const OUT = path.join(__dirname, 'probe_merged_eye_hide_out.json');

app.whenReady().then(async () => {
  setTimeout(() => { console.log('FATAL TIMEOUT'); app.exit(1); }, 90000);
  await new Promise((r) => setTimeout(r, 2000));
  const win = BrowserWindow.getAllWindows()[0];
  win.setSize(1400, 950);
  await new Promise((r) => setTimeout(r, 500));

  await win.webContents.executeJavaScript(`(async () => {
    const res = await window.sbAPI.projectCreate({
      projectPath: ${JSON.stringify(CTR_PATH)},
      name: 'Eye',
      music: ${JSON.stringify(path.join(PLAYER, 'music.ogg'))},
      chart: ${JSON.stringify(path.join(PLAYER, 'chart.base.txt'))},
      background: null,
      storyboard: null
    });
    await window.__sb.loadLevelInfo(res.info, { projectPath: res.projectPath, config: res.config });
    const S = window.__sb.state;
    S.storyboard = { sprites: [], texts: [], videos: [], lines: [], controllers: [], note_controllers: [], templates: {} };
    const mk = (id, group, extra) => {
      const o = {
        id, time: 'intro:$note', note: { start: 0, end: 10 },
        x: { unit: 'notex', value: 0.5 }, y: { unit: 'notey', value: 0.5 },
        opacity: 1, layer: 2, order: 0,
        states: [{ time: 'start:$note', opacity: 0.5 }],
        ...extra
      };
      S.storyboard[group].push(o);
      S.noteSelectorMerge[o.id] = true;
    };
    mk('sprite_1', 'sprites', { path: 'octa.png', preserve_aspect: true });
    mk('text_1', 'texts', { text: 'hi', size: 30 });
    mk('video_1', 'videos', { path: 'video.mp4' });
    mk('line_1', 'lines', { pos: [{ x: 0, y: 0 }, { x: 1, y: 1 }], width: 0.05 });
    S.dirty = true;
    window.__sb.refreshAll();
    return true;
  })()`);
  await new Promise((r) => setTimeout(r, 800));

  const R = await win.webContents.executeJavaScript(`(async () => {
    const out = {};
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    // 初始：合并块存在，克隆 id 出现在编译结果/预览求值里
    const pv = window.__sb.preview;
    pv.setTime(5, false);
    pv.render();
    const compiled = pv.compiled;
    out.compiledCounts = {
      sprites: (compiled && compiled.sprites || []).length,
      texts: (compiled && compiled.texts || []).length,
      videos: (compiled && compiled.videos || []).length,
      lines: (compiled && compiled.lines || []).length,
      noteControllers: (compiled && compiled.noteControllers || []).length
    };
    out.sampleIds = {
      sprites: (compiled && compiled.sprites || []).slice(0, 3).map((s) => s.id),
      texts: (compiled && compiled.texts || []).slice(0, 3).map((s) => s.id)
    };
    out.hasClones = {
      sprite: (compiled.sprites || []).some((s) => /^sprite_1::\\d+$/.test(s.id)),
      text: (compiled.texts || []).some((s) => /^text_1::\\d+$/.test(s.id)),
      video: (compiled.videos || []).some((s) => /^video_1::\\d+$/.test(s.id)),
      line: (compiled.lines || []).some((s) => /^line_1::\\d+$/.test(s.id))
    };
    // 依次点眼睛按钮隐藏四个对象
    const hidden = {};
    for (const id of ['sprite_1', 'text_1', 'video_1', 'line_1']) {
      const item = [...document.querySelectorAll('#objectAddList .oa-item')]
        .find((el) => ((el.querySelector('.oa-nm') || {}).textContent || '').split(' · ')[0] === id);
      if (!item) { hidden[id] = 'no-item'; continue; }
      const eye = item.querySelector('.oa-eye');
      eye.click();
      await sleep(200);
    }
    hidden.objHidden = { ...window.__sb.state.objHidden };
    hidden.hiddenIds = pv.hiddenObjIds ? [...pv.hiddenObjIds].filter((x) => /_(1|sprite|text|video|line)/.test(x)).slice(0, 20) : [];
    hidden.hasCloneIds = {
      sprite: pv.hiddenObjIds && pv.hiddenObjIds.has('sprite_1::0') && pv.hiddenObjIds.has('sprite_1::5'),
      text: pv.hiddenObjIds && pv.hiddenObjIds.has('text_1::0'),
      video: pv.hiddenObjIds && pv.hiddenObjIds.has('video_1::0'),
      line: pv.hiddenObjIds && pv.hiddenObjIds.has('line_1::0')
    };
    out.hidden = hidden;
    return out;
  })()`);

  const out = { R };
  out.ok = !!(
    R.hasClones && R.hasClones.sprite && R.hasClones.text && R.hasClones.video && R.hasClones.line &&
    R.hidden && R.hidden.hasCloneIds &&
    R.hidden.hasCloneIds.sprite && R.hidden.hasCloneIds.text && R.hidden.hasCloneIds.video && R.hidden.hasCloneIds.line
  );
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
  console.log('EYE:', JSON.stringify(out));
  process.exit(0);
}).catch((e) => {
  fs.writeFileSync(OUT, JSON.stringify({ fatal: String(e && e.stack || e) }));
  console.log('FATAL:', e && e.stack || e);
  process.exit(1);
});
