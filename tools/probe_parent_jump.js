// Probe: verifies the "跳转至父对象属性" context-menu item on the parent_id
// input. Loads EffectsTest, selects sprite_1 (parent_id = parent_$note),
// right-clicks the input, checks the menu, clicks the item and verifies the
// selection jumps to the carrier object's property panel.
const { app, BrowserWindow } = require("electron");
const fs = require("fs");
const path = require("path");
const os = require("os");
app.setPath("userData", fs.mkdtempSync(path.join(os.tmpdir(), "cytoid_sb_pj_")));
require(path.join(__dirname, "..", "app", "main.js"));

const OUT_JSON = path.join(__dirname, "probe_parent_jump_out.json");
const DIR = "V:/cytoid storyboarder/项目/测试：效果/EffectsTest";

function buildInfo() {
  const ctr = JSON.parse(fs.readFileSync(path.join(DIR, "parent_note_to_sprite.ctr"), "utf8"));
  const level = JSON.parse(fs.readFileSync(path.join(DIR, "level.json"), "utf8"));
  const chartPath = "chart.base.txt";
  const charts = [{
    type: "easy", path: chartPath,
    content: fs.readFileSync(path.join(DIR, chartPath), "utf8"),
    storyboardPath: "storyboard.json",
    storyboardContent: fs.readFileSync(path.join(DIR, "storyboard.json"), "utf8")
  }];
  const files = [];
  for (const name of fs.readdirSync(DIR)) {
    const st = fs.statSync(path.join(DIR, name));
    if (st.isFile()) files.push({ name, size: st.size });
  }
  return {
    info: { level, levelDir: DIR, files, charts },
    config: { projectPath: path.join(DIR, "parent_note_to_sprite.ctr"), config: ctr }
  };
}

app.whenReady().then(async () => {
  const timer = setTimeout(() => {
    fs.writeFileSync(OUT_JSON, JSON.stringify({ fatal: "timeout" }));
    app.exit(1);
  }, 150000);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  try {
    await sleep(2000);
    const win = BrowserWindow.getAllWindows()[0];
    win.setSize(1560, 920);
    await sleep(600);
    const b = buildInfo();
    await win.webContents.executeJavaScript(
      `window.__sb.loadLevelInfo(${JSON.stringify(b.info)}, ${JSON.stringify(b.config)})`);
    await sleep(4000);
    await win.webContents.executeJavaScript(
      `document.getElementById('modalMask').classList.add('hidden')`);

    const out = await win.webContents.executeJavaScript(`(() => {
      const __ = window.__sb;
      const openMenu = (objId) => {
        __.selectObject(objId, null);
        const input = document.getElementById('fParentId');
        if (!input) return { hasInput: false };
        input.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 10, clientY: 10 }));
        return {
          hasInput: true,
          items: [...document.querySelectorAll('#contextMenu .cm-item')].map((el) => el.textContent)
        };
      };
      const r1 = openMenu('sprite_1');
      const jumpItem = [...document.querySelectorAll('#contextMenu .cm-item')]
        .find((el) => el.textContent === '跳转至父对象属性');
      const clicked = !!jumpItem;
      if (jumpItem) jumpItem.click();
      return {
        sprite1ParentId: __.state.storyboard.sprites.find(o => o.id === 'sprite_1').parent_id,
        menu1: r1,
        carrierHidesUseSelector: !(r1.items || []).includes('在parent_id中使用note选择器'),
        carrierKeepsJump: (r1.items || []).includes('跳转至父对象属性'),
        jumpItemFound: clicked,
        selectedAfterJump: __.state.selectedObjId,
        propHasCarrierId: document.getElementById('propBody')
          ? document.getElementById('propBody').textContent.indexOf('parent_$note') >= 0 : false,
        // 无 parent_id 的对象不应出现该选项
        noParent: (() => {
          const o = (__.state.storyboard.sprites || []).find(s => !s.parent_id);
          if (!o) return { found: false };
          const r = openMenu(o.id);
          return { found: true, hasJump: (r.items || []).indexOf('跳转至父对象属性') >= 0 };
        })(),
        // 普通（非载体）父对象：应保留“在parent_id中使用note选择器”
        nonCarrier: (() => {
          const st = __.state.storyboard;
          const spr = st.sprites.find(o => o.id === 'sprite_1');
          const oldPid = spr.parent_id;
          const txt = { id: 't_parent', text: 'x', time: 0, x: 0 };
          st.texts = st.texts || [];
          st.texts.push(txt);
          spr.parent_id = 't_parent';
          const r = openMenu('sprite_1');
          spr.parent_id = oldPid;
          st.texts = st.texts.filter(t => t !== txt);
          return {
            hasUseSelector: (r.items || []).includes('在parent_id中使用note选择器'),
            items: r.items
          };
        })()
      };
    })()`);
    out.ok = true;
    fs.writeFileSync(OUT_JSON, JSON.stringify(out, null, 2));
  } catch (err) {
    fs.writeFileSync(OUT_JSON, JSON.stringify({ ok: false, error: String(err && err.stack || err) }, null, 2));
  } finally {
    clearTimeout(timer);
    app.exit(0);
  }
});
