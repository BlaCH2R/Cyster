// Verify the controller option-card UI: cards render per option group, the
// master toggle writes an explicit false when switched off, and dragging a
// card onto the timeline adds that block as a keyframe at the drop time.
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { SAMPLE_ZIP, extract } = require('./level_fixture.js');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_cards_')));
require(path.join(__dirname, '..', 'app', 'main.js'));

const PLAYER = extract(SAMPLE_ZIP, 'cytoid_cards_');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_cards_proj_'));
const CTR_PATH = path.join(TMP, 'CardsTest.ctr');

app.whenReady().then(async () => {
  setTimeout(() => { console.log('FATAL TIMEOUT'); app.exit(1); }, 90000);
  await new Promise((r) => setTimeout(r, 2000));
  const win = BrowserWindow.getAllWindows()[0];

  const created = await win.webContents.executeJavaScript(`(async () => {
    const res = await window.sbAPI.projectCreate({
      projectPath: ${JSON.stringify(CTR_PATH)},
      name: 'CardsTest',
      music: ${JSON.stringify(path.join(PLAYER, 'music.ogg'))},
      chart: ${JSON.stringify(path.join(PLAYER, 'chart.base.txt'))},
      background: ${JSON.stringify(path.join(PLAYER, 'bg.jpg'))},
      storyboard: ${JSON.stringify(path.join(PLAYER, 'storyboard_base.json'))}
    });
    await window.__sb.loadLevelInfo(res.info, { projectPath: res.projectPath, config: res.config });
    return true;
  })()`);
  if (!created) throw new Error('project create/load failed');

  const out = await win.webContents.executeJavaScript(`(async () => {
    const S = window.__sb.state;
    S.storyboard = { sprites: [], texts: [], videos: [], lines: [], controllers: [], note_controllers: [], templates: {} };
    const ctl = { id: 'ctl_cards', time: 0, states: [{ time: 0, bloom: true }] };
    S.storyboard.controllers.push(ctl);
    S.selectedObjId = 'ctl_cards';
    S.selectedKeyIdx = 0;
    window.__sb.refreshAll();
    await new Promise((r) => setTimeout(r, 120));

    const cards = document.querySelectorAll('#stateForm .ctrl-card');
    const cardCount = cards.length;
    const bloomCard = document.querySelector('#stateForm .ctrl-card[data-card="bloom"]');
    const hasBloomCard = !!bloomCard;
    const bloomCheckbox = bloomCard && bloomCard.querySelector('.ctrl-card-head input[type=checkbox]');

    // Toggle the bloom master switch OFF: must write an explicit false.
    if (bloomCheckbox && bloomCheckbox.checked) {
      bloomCheckbox.click();
      await new Promise((r) => setTimeout(r, 80));
    }
    const offVal = { bloom: ctl.states[0].bloom, hasKey: 'bloom' in ctl.states[0] };

    // Keyframe-level controls in the section header: easing select + destroy.
    const easingSel = document.querySelector('#kfEasing');
    const easingOpts = easingSel ? easingSel.options.length : 0;
    if (easingSel) {
      easingSel.value = 'easeoutquad';
      easingSel.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise((r) => setTimeout(r, 80));
    }
    const easingAfter = ctl.states[0].easing;
    const destroyCb = document.querySelector('#kfDestroy');
    if (destroyCb && !destroyCb.checked) {
      destroyCb.click();
      await new Promise((r) => setTimeout(r, 80));
    }
    const destroyAfter = { val: ctl.states[0].destroy, hasKey: 'destroy' in ctl.states[0] };

    // Drag the card onto the timeline at t=10 (bloom currently off).
    const content = document.querySelector('#tlContent');
    const head = bloomCard.querySelector('.ctrl-card-head');
    const rect = content.getBoundingClientRect();
    const pxPerSec = window.__sb.timeline.pxPerSec || 60;
    const dropAt = (t) => {
      const dt = new DataTransfer();
      head.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: dt }));
      // timeFromEvent 的映射：x = clientX - rect.left，time = x / pxPerSec。
      const clientX = rect.left + t * pxPerSec;
      content.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt, clientX }));
      content.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt, clientX }));
    };
    dropAt(10);
    await new Promise((r) => setTimeout(r, 120));
    const dropped10 = (ctl.states || []).find((s) => Math.abs(s.time - 10) < 1e-6);
    const dropOff = dropped10 ? { bloom: dropped10.bloom, hasKey: 'bloom' in dropped10, time: dropped10.time } : null;

    // The form was re-rendered after the drop and now binds to the new
    // keyframe (t=10). Turn the (live) card ON and drag again at t=12.
    const liveBloomCard = document.querySelector('#stateForm .ctrl-card[data-card="bloom"]');
    const liveCheckbox = liveBloomCard && liveBloomCard.querySelector('.ctrl-card-head input[type=checkbox]');
    const liveHead = liveBloomCard && liveBloomCard.querySelector('.ctrl-card-head');
    const beforeOn = { bloom: ctl.states[0].bloom, k0: ctl.states[0] && ctl.states[0].time };
    if (liveCheckbox && !liveCheckbox.checked) liveCheckbox.click();
    await new Promise((r) => setTimeout(r, 80));
    const afterOnClick = {
      k0: ctl.states[0] && ctl.states[0].bloom,
      k1: ctl.states[1] && ctl.states[1].bloom,
      hasKey: ctl.states[1] && 'bloom' in ctl.states[1]
    };
    const dropAt2 = (t) => {
      const dt = new DataTransfer();
      liveHead.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: dt }));
      const clientX = rect.left + t * pxPerSec;
      content.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt, clientX }));
      content.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt, clientX }));
    };
    dropAt2(12);
    await new Promise((r) => setTimeout(r, 120));
    const dropped12 = (ctl.states || []).find((s) => Math.abs(s.time - 12) < 1e-6);
    const dropOn = dropped12 ? { bloom: dropped12.bloom, hasKey: 'bloom' in dropped12, time: dropped12.time } : null;

    const compiled = JSON.parse(window.__sb.storyboardCompiledJson());
    const cOut = compiled.controllers.find((c) => c.Id === 'ctl_cards');
    return { cardCount, hasBloomCard, offVal, easingOpts, easingAfter, destroyAfter, beforeOn, afterOnClick, dropOff, dropOn, compiled: cOut && cOut.States };
  })()`);

  const result = {
    cardCount: out.cardCount,
    hasBloomCard: out.hasBloomCard,
    toggleOff: out.offVal,
    easingOpts: out.easingOpts,
    easingAfter: out.easingAfter,
    destroyAfter: out.destroyAfter,
    beforeOn: out.beforeOn,
    afterOnClick: out.afterOnClick,
    dropOff: out.dropOff,
    dropOn: out.dropOn,
    compiled: out.compiled,
    ok: out.cardCount >= 1 && out.hasBloomCard === true &&
      out.offVal && out.offVal.hasKey === true && out.offVal.bloom === false &&
      out.easingOpts > 0 && out.easingAfter === 'easeoutquad' &&
      out.destroyAfter && out.destroyAfter.hasKey === true && out.destroyAfter.val === true &&
      out.dropOff && out.dropOff.hasKey === true && out.dropOff.bloom === false &&
      out.dropOn && out.dropOn.hasKey === true && out.dropOn.bloom === true
  };
  fs.writeFileSync(path.join(__dirname, 'probe_controller_cards_out.json'), JSON.stringify(result, null, 2));
  console.log('CARDS_SUMMARY:', JSON.stringify(result));
  app.exit(0);
}).catch((e) => {
  fs.writeFileSync(path.join(__dirname, 'probe_controller_cards_out.json'), JSON.stringify({ error: String(e && e.message || e) }));
  console.log('FAIL:', e && e.message || e);
  app.exit(1);
});
