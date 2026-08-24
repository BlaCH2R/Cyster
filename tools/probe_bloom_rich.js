const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_bl_')));
require(path.join(__dirname, '..', 'app', 'main.js'));
const LEVEL = 'V:\\cytoid storyboarder\\项目\\测试：nc-follow\\NcFollow';
function buildInfo(dir, sb) {
  const level = JSON.parse(fs.readFileSync(path.join(dir, 'level.json'), 'utf8'));
  const charts = (level.charts || []).map((c) => ({
    type: c.type, path: c.path,
    content: fs.readFileSync(path.join(dir, c.path), 'utf8'),
    storyboardPath: 'storyboard.json',
    storyboardContent: sb
  }));
  const files = [];
  for (const name of fs.readdirSync(dir)) {
    const st = fs.statSync(path.join(dir, name));
    if (st.isFile()) files.push({ name, size: st.size });
  }
  return { level, levelDir: dir, files, charts };
}
const SB = JSON.stringify({
  controllers: [{ id: 'fx', states: [{ time: 0, bloom: true, bloom_intensity: 1.2 }] }],
  texts: [{ id: 't', states: [{ time: 0, text: 'GLOW', size: 56, color: '#ffffff', opacity: 1, x: 0, y: 0, align: 'middleCenter', font_weight: 'bold' }] }],
  sprites: [], videos: [], lines: [], note_controllers: [], templates: {}
});
const SB_NOBLOOM = JSON.stringify({
  controllers: [],
  texts: [{ id: 't', states: [{ time: 0, text: 'GLOW', size: 56, color: '#ffffff', opacity: 1, x: 0, y: 0, align: 'middleCenter', font_weight: 'bold' }] }],
  sprites: [], videos: [], lines: [], note_controllers: [], templates: {}
});
app.whenReady().then(async () => {
  setTimeout(() => app.exit(1), 60000);
  await new Promise((r) => setTimeout(r, 2500));
  const win = BrowserWindow.getAllWindows()[0];
  win.setSize(1560, 920);
  await new Promise((r) => setTimeout(r, 800));
  const info = buildInfo(LEVEL, SB);
  const infoNB = buildInfo(LEVEL, SB_NOBLOOM);
  const out = await win.webContents.executeJavaScript(`(async () => {
    try {
      const pv = window.__sb.preview;
      const grab = async (rich) => {
        if (rich) window.__sbBloomDebug = [];
        pv.richEffects = rich;
        pv.markDirty();
        pv.render();
        const url = document.querySelector('#previewCanvas').toDataURL('image/png');
        const img = pv.ctx.getImageData(0, 0, pv.canvas.width, pv.canvas.height).data;
        // max brightness of the center band (the text area)
        const W = pv.canvas.width, H = pv.canvas.height;
        let mx = 0, bright = 0;
        for (let y = Math.floor(H*0.35); y < Math.floor(H*0.65); y++) {
          for (let x = Math.floor(W*0.25); x < Math.floor(W*0.75); x++) {
            const i = (y*W + x) * 4;
            const v = img[i] + img[i+1] + img[i+2];
            if (v > mx) mx = v;
            if (v > 600) bright++;
          }
        }
        return { rich, max: mx, brightPx: bright, url, debug: rich ? window.__sbBloomDebug : [] };
      };
      const loadInfo = async (inf) => {
        await window.__sb.loadLevelInfo(inf);
        await new Promise((r) => setTimeout(r, 1000));
        pv.setTime(0, false);
      };
      await loadInfo(${JSON.stringify(info)});
      const a = await grab(false); // fallback bloom
      const b = await grab(true);  // rich bloom
      await loadInfo(${JSON.stringify(infoNB)});
      const c = await grab(false); // fallback no bloom
      const d = await grab(true);  // rich no bloom
      return {
        fbBloom: { max: a.max, brightPx: a.brightPx }, richBloom: { max: b.max, brightPx: b.brightPx },
        fbPlain: { max: c.max, brightPx: c.brightPx }, richPlain: { max: d.max, brightPx: d.brightPx },
        fbBloomUrl: a.url, richBloomUrl: b.url, fbPlainUrl: c.url, richPlainUrl: d.url,
        sbGl: window.SBGlUsed, debug: b.debug
      };
    } catch (e) { return { error: String(e.message || e) }; }
  })()`);
  const crypto = require('crypto');
  const h = (b) => crypto.createHash('sha256').update(b).digest('hex').slice(0, 16);
  if (out && out.fbBloomUrl) {
    const dec = (u) => Buffer.from(u.split(',')[1], 'base64');
    fs.writeFileSync('V:/cytoid storyboarder/tools/bloom_rich_off.png', dec(out.fbBloomUrl));
    fs.writeFileSync('V:/cytoid storyboarder/tools/bloom_rich_on.png', dec(out.richBloomUrl));
    fs.writeFileSync('V:/cytoid storyboarder/tools/bloom_rich_fb_plain.png', dec(out.fbPlainUrl));
    fs.writeFileSync('V:/cytoid storyboarder/tools/bloom_rich_rich_plain.png', dec(out.richPlainUrl));
    (out.debug || []).forEach((d, i) => {
      if (d.url) fs.writeFileSync(`V:/cytoid storyboarder/tools/bloom_rich_${i}_${d.label}.png`, dec(d.url));
    });
  }
  console.log('BLOOM_RICH_SUMMARY:', JSON.stringify(out && out.fbBloomUrl ? {
    fbBloom: out.fbBloom, richBloom: out.richBloom, fbPlain: out.fbPlain, richPlain: out.richPlain,
    sbGl: out.sbGl,
    debug: (out.debug || []).map((d) => ({ label: d.label, cur: d.cur, len: d.url ? d.url.length : 0 })),
    richBloomBrightDelta: out.richBloom.brightPx - out.richPlain.brightPx,
    fbSha: h(Buffer.from(out.fbBloomUrl.split(',')[1], 'base64')),
    richSha: h(Buffer.from(out.richBloomUrl.split(',')[1], 'base64'))
  } : out));
  // app.exit() can hang on this machine once WebGL render targets exist;
  // force a hard exit after writing results.
  process.exit(0);
}).catch((e) => { console.log('FAIL:', e); app.exit(1); });
