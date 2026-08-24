// 验证 Note 填充颜色卡片：
//  1) 6 行 × 2 列纯色块（按 note 种类分行、上/下行分列），色块上无文本
//  2) 未设置（默认未启用）时可点击编辑，显示游戏默认色
//  3) 点击色块弹出“颜色代码”界面，支持输入 16 进制代码；确定后写完整 12 色数组
//  4) 导出的 compiled NoteFillColors 长度 12
//  5) 无取色按钮；右上角有“重置默认颜色”按钮，点击清空字段并恢复默认色显示
//  6) 其余单色颜色卡片（scanline_color 等）点击色块同样弹出 hex 输入界面
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { SAMPLE_ZIP, extract } = require('./level_fixture.js');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_fc_')));
require(path.join(__dirname, '..', 'app', 'main.js'));

const PLAYER = extract(SAMPLE_ZIP, 'cytoid_fc_');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cytoid_sb_fc_proj_'));
const CTR_PATH = path.join(TMP, 'FillColors.ctr');
const OUT = path.join(__dirname, 'probe_fill_colors_out.json');

app.whenReady().then(async () => {
  setTimeout(() => { console.log('FATAL TIMEOUT'); app.exit(1); }, 120000);
  await new Promise((r) => setTimeout(r, 2000));
  const win = BrowserWindow.getAllWindows()[0];
  win.setSize(1400, 950);
  await new Promise((r) => setTimeout(r, 500));

  await win.webContents.executeJavaScript(`(async () => {
    const res = await window.sbAPI.projectCreate({
      projectPath: ${JSON.stringify(CTR_PATH)},
      name: 'FillColors',
      music: ${JSON.stringify(path.join(PLAYER, 'music.ogg'))},
      chart: ${JSON.stringify(path.join(PLAYER, 'chart.base.txt'))},
      background: ${JSON.stringify(path.join(PLAYER, 'bg.jpg'))},
      storyboard: ${JSON.stringify(path.join(PLAYER, 'storyboard_base.json'))}
    });
    await window.__sb.loadLevelInfo(res.info, { projectPath: res.projectPath, config: res.config });
    return true;
  })()`);

  const out = await win.webContents.executeJavaScript(`(async () => {
    const R = {};
    const SB = window.SBEngine;
    const container = document.createElement('div');
    container.id = 'fcTest';
    document.body.appendChild(container);
    let changed = null;
    window.SBSchema.renderControllerCards(container, window.SBSchema.SCHEMAS.controller, {},
      (k, v) => { changed = { k, v }; }, false, {
        owners: { note_fill_colors: 'ctl_x' },
        selectedId: 'ctl_x',
        enabledOnly: true,
        onAddCard: () => {}
      });
    const card = container.querySelector('.ctrl-card[data-card="note_fill_colors"]');
    R.cardFound = !!card;
    R.cardUnset = !!(card && card.classList.contains('card-unset'));
    const chips = Array.from(card ? card.querySelectorAll('.fill12-chip') : []);
    R.chipCount = chips.length;
    R.rows = Array.from(card ? card.querySelectorAll('.fill12-row') : []).length;
    R.rowChips = Array.from(card ? card.querySelectorAll('.fill12-row') : []).map((r) => r.querySelectorAll('.fill12-chip').length);
    R.kinds = Array.from(card ? card.querySelectorAll('.fill12-kind') : []).map((k) => k.textContent);
    R.texts = chips.map((c) => c.textContent);
    R.backgrounds = chips.map((c) => c.style.background);
    // 未设置时第一个 chip 应为游戏默认 click 上行色 #35a7ff
    R.chip0Bg = chips[0] ? chips[0].style.background : null;
    R.hasEyedropper = !!card.querySelector('.eyedropper-btn');
    const resetBtn = card.querySelector('.fill12-reset');
    R.hasReset = !!resetBtn;
    R.resetLabel = resetBtn ? resetBtn.textContent : null;
    // 点击第一个色块 → 弹出颜色代码界面 → 输入 hex → 确定
    chips[0].dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    await new Promise((r) => setTimeout(r, 60));
    const pop = document.getElementById('colorPop');
    R.popShown = !!(pop && !pop.classList.contains('hidden'));
    R.popHexValue = pop ? pop.querySelector('.color-pop-hex').value : null;
    if (pop) {
      const hexIn = pop.querySelector('.color-pop-hex');
      hexIn.value = '#ff0000';
      pop.querySelector('.color-pop-ok').dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    }
    await new Promise((r) => setTimeout(r, 60));
    R.changedKey = changed && changed.k;
    R.changedLen = changed && Array.isArray(changed.v) ? changed.v.length : -1;
    R.changed0 = changed && changed.v[0];
    R.changed1 = changed && changed.v[1];
    R.changedLast = changed && changed.v[11];
    R.chip0BgAfter = chips[0] ? chips[0].style.background : null;
    // 回归：同一面板会话内连续修改两个色块时，先改的颜色不能被后一次修改
    // 重置（此前 curHex 用渲染时的数组快照，第二次改动会覆盖第一次）。
    {
      let seqChanged = null;
      // 模拟 app.js 的 onStateChange：写回同一个 state 对象（setStateField）。
      const seqState = {};
      const c3 = document.createElement('div');
      document.body.appendChild(c3);
      window.SBSchema.renderControllerCards(c3, window.SBSchema.SCHEMAS.controller, seqState,
        (k, v) => { seqChanged = { k, v }; if (v === undefined) delete seqState[k]; else seqState[k] = v; }, false, {
          owners: { note_fill_colors: 'ctl_seq' },
          selectedId: 'ctl_seq',
          enabledOnly: true,
          onAddCard: () => {}
        });
      const seqChips = Array.from(c3.querySelectorAll('.fill12-chip'));
      const setChip = async (i, hex) => {
        seqChips[i].dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        await new Promise((r) => setTimeout(r, 60));
        const pop = document.getElementById('colorPop');
        if (!pop) return false;
        pop.querySelector('.color-pop-hex').value = hex;
        pop.querySelector('.color-pop-ok').dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        await new Promise((r) => setTimeout(r, 60));
        return true;
      };
      await setChip(0, '#ff0000');
      await setChip(1, '#00ff00');
      const def2 = window.SBSchema.colorToHex(window.SBEngine.colors.DEFAULT_NOTE_FILL[2]);
      R.seqLen = seqChanged && Array.isArray(seqChanged.v) ? seqChanged.v.length : -1;
      R.seq0 = seqChanged && seqChanged.v[0];
      R.seq1 = seqChanged && seqChanged.v[1];
      R.seq2 = seqChanged && seqChanged.v[2];
      R.seqOk = !!(seqChanged && seqChanged.v[0] === '#ff0000' && seqChanged.v[1] === '#00ff00' && seqChanged.v[2] === def2);
    }
    // 导出的 compiled NoteFillColors 长度 12（用改色后的数组）
    const ctl = { id: 'ctl_fc', time: 0, states: [{ time: 0, note_fill_colors: changed.v }] };
    window.__sb.state.storyboard.controllers = window.__sb.state.storyboard.controllers || [];
    window.__sb.state.storyboard.controllers.push(ctl);
    const compiled = JSON.parse(window.__sb.storyboardCompiledJson());
    const c = (compiled.controllers || []).find((x) => x.Id === 'ctl_fc');
    R.compiledFillLen = c && c.States && c.States[0] ? (c.States[0].NoteFillColors || []).length : -1;
    // 重置按钮：清空字段并恢复默认色显示
    resetBtn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    R.afterResetKey = changed && changed.k;
    R.afterResetVal = changed && changed.v;
    R.afterResetBg = chips[0] ? chips[0].style.background : null;

    // 6) 其余单色颜色卡片：点击色块同样弹出 hex 输入界面
    let changed2 = null;
    const c2 = document.createElement('div');
    document.body.appendChild(c2);
    window.SBSchema.renderControllerCards(c2, window.SBSchema.SCHEMAS.controller, {},
      (k, v) => { changed2 = { k, v }; }, false, { owners: {}, enabledOnly: false, showUnset: true });
    const scCard = c2.querySelector('.ctrl-card[data-card="scanline_color"]');
    const scColorInput = scCard ? scCard.querySelector('.field input[type=color]') : null;
    R.scFound = !!scColorInput;
    if (scColorInput) {
      scColorInput.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      await new Promise((r) => setTimeout(r, 60));
      const pop2 = document.getElementById('colorPop');
      R.scPopShown = !!(pop2 && !pop2.classList.contains('hidden'));
      if (pop2) {
        const hexIn = pop2.querySelector('.color-pop-hex');
        hexIn.value = '#abcdef';
        pop2.querySelector('.color-pop-ok').dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      }
      await new Promise((r) => setTimeout(r, 60));
    }
    R.scChanged = changed2;
    return R;
  })()`);

  out.ok = !!(
    out.cardFound && out.chipCount === 12 && out.rows === 6 &&
    out.rowChips.every((n) => n === 2) &&
    out.kinds.join(',') === 'Click,Drag,Hold,LongHold,Flick,C-Drag' &&
    out.texts.every((t) => t === '') &&
    out.chip0Bg === 'rgb(53, 167, 255)' &&
    !out.hasEyedropper && out.hasReset && out.resetLabel === '↺ 默认' &&
    out.popShown && out.popHexValue === '#35A7FF' &&
    out.changedKey === 'note_fill_colors' && out.changedLen === 12 &&
    out.changed0 === '#ff0000' && out.changed1 === '#ff5964' &&
    out.changedLast === '#39e59e' &&
    out.seqOk && out.seqLen === 12 && out.seq0 === '#ff0000' && out.seq1 === '#00ff00' &&
    out.chip0BgAfter === 'rgb(255, 0, 0)' &&
    out.afterResetKey === 'note_fill_colors' && out.afterResetVal === undefined &&
    out.afterResetBg === 'rgb(53, 167, 255)' &&
    out.compiledFillLen === 12 &&
    out.scFound && out.scPopShown &&
    out.scChanged && out.scChanged.k === 'scanline_color' && out.scChanged.v === '#abcdef'
  );
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
  console.log('FILL_COLORS:', JSON.stringify(out));
  app.exit(0);
}).catch((e) => {
  fs.writeFileSync(OUT, JSON.stringify({ fatal: String(e && e.stack || e) }));
  console.log('FATAL:', e && e.stack || e);
  app.exit(1);
});
