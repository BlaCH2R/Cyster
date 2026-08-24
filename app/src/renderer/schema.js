// Field schemas for the properties panel, covering every documented StoryBoard field.
(() => {
  const $t = (s) => (window.SBi18n ? window.SBi18n.t(s) : s);
  const Easing = window.SBEngine.easing;
  const Colors = window.SBEngine.colors;

  const EASING_OPTIONS = Easing.EASING_NAMES.map((n) => ({ value: n, label: n }));

  const ALIGN_OPTIONS = [
    'upperLeft', 'upperCenter', 'upperRight',
    'middleLeft', 'middleCenter', 'middleRight',
    'lowerLeft', 'lowerCenter', 'lowerRight'
  ].map((v) => ({ value: v, label: v }));

  const WEIGHT_OPTIONS = ['regular', 'extraLight', 'bold', 'extraBold'].map((v) => ({ value: v, label: v }));

  const UNIT_OPTIONS = [
    { value: 'stagex', label: 'StageX' },
    { value: 'stagey', label: 'StageY' },
    { value: 'notex', label: 'NoteX' },
    { value: 'notey', label: 'NoteY' },
    { value: 'camerax', label: 'CameraX' },
    { value: 'cameray', label: 'CameraY' },
    { value: 'world', label: 'World' }
  ];

  // Z is a depth UnitFloat like in the native engine: the parser accepts any
  // coordinate prefix and converts it (scaleToCanvas=true for stage objects),
  // so the dropdown offers every unit.
  const Z_UNIT_OPTIONS = UNIT_OPTIONS;

  const NOTE_FILL_LABELS = [
    'Click ↑', 'Click ↓', 'Drag ↑', 'Drag ↓',
    'Hold ↑', 'Hold ↓', 'LongHold ↑', 'LongHold ↓',
    'Flick ↑', 'Flick ↓', 'C-Drag ↑', 'C-Drag ↓'
  ];
  // Sentinel for multi-select forms: a field whose value differs across the
  // selected objects renders as "多个数值" and stays read-only.
  const MULTI_VALUE = { __cysterMulti: true };
  // 全帧同步字段：对象级唯一值，任一关键帧修改都同步到整个时间块。
  const SYNC_KEYS = ['path', 'order', 'layer'];
  const isSyncField = (f) => !!(f && SYNC_KEYS.includes(f.key));

  function commonFields() {
    return [
      { key: 'time', label: '时间 (秒)', kind: 'text', placeholder: '数字 或 start:5 / intro:5:0.1' },
      { key: 'easing', label: '缓动', kind: 'select', options: EASING_OPTIONS },
      { key: 'destroy', label: '到达后销毁', kind: 'bool' }
    ];
  }

  function stageFields() {
    return [
      { key: 'x', label: 'X', kind: 'unit', defaultUnit: 'stagex' },
      { key: 'y', label: 'Y', kind: 'unit', defaultUnit: 'stagey' },
      { key: 'z', label: 'Z', kind: 'unit', defaultUnit: 'world' },
      { key: 'rot_x', label: '旋转 X (°)', kind: 'num' },
      { key: 'rot_y', label: '旋转 Y (°)', kind: 'num' },
      { key: 'rot_z', label: '旋转 Z (°)', kind: 'num' },
      { key: 'scale', label: '缩放 (等比)', kind: 'num' },
      { key: 'scale_x', label: '缩放 X', kind: 'num' },
      { key: 'scale_y', label: '缩放 Y', kind: 'num' },
      { key: 'opacity', label: '不透明度', kind: 'num', step: 0.01, min: 0, max: 1 },
      { key: 'width', label: '宽度', kind: 'unit', defaultUnit: 'stagex' },
      { key: 'height', label: '高度', kind: 'unit', defaultUnit: 'stagey' },
      { key: 'layer', label: '图层', kind: 'select', options: [{ value: 0, label: '0 (背景上, Note 下)' }, { value: 1, label: '1 (Note 下, UI 上)' }, { value: 2, label: '2 (最上层)' }] },
      { key: 'order', label: '顺序', kind: 'int' },
      { key: 'fill_width', label: '铺满全屏', kind: 'bool' }
    ];
  }

  const SCHEMAS = {
    sprite: {
      label: 'Sprite 图片',
      fields: [
        ...commonFields(),
        ...stageFields(),
        { key: 'path', label: '图片路径', kind: 'path', filter: ['png', 'jpg', 'jpeg'] },
        { key: 'preserve_aspect', label: '保持比例', kind: 'bool' },
        { key: 'color', label: '颜色', kind: 'color' }
      ]
    },
    text: {
      label: 'Text 文本',
      fields: [
        ...commonFields(),
        ...stageFields(),
        { key: 'text', label: '文本内容', kind: 'textarea' },
        { key: 'size', label: '字号', kind: 'int' },
        { key: 'color', label: '颜色', kind: 'color' },
        { key: 'align', label: '对齐', kind: 'select', options: ALIGN_OPTIONS },
        { key: 'letter_spacing', label: '字间距', kind: 'num', step: 0.5 },
        { key: 'font_weight', label: '字重', kind: 'select', options: WEIGHT_OPTIONS }
      ]
    },
    video: {
      label: 'Video 视频',
      fields: [
        ...commonFields(),
        ...stageFields(),
        { key: 'path', label: '视频路径', kind: 'path', filter: ['mp4', 'webm', 'ogg'] },
        { key: 'color', label: '颜色', kind: 'color' }
      ]
    },
    line: {
      label: 'Line 线段',
      fields: [
        ...commonFields(),
        { key: 'pos', label: '端点列表', kind: 'pos', units: { x: 'notex', y: 'notey', z: 'world' } },
        { key: 'width', label: '线宽', kind: 'unit', defaultUnit: 'world' },
        { key: 'color', label: '颜色', kind: 'color' },
        { key: 'opacity', label: '不透明度', kind: 'num', step: 0.01, min: 0, max: 1 },
        { key: 'layer', label: '图层', kind: 'select', options: [{ value: 0, label: '0' }, { value: 1, label: '1' }, { value: 2, label: '2' }] },
        { key: 'order', label: '顺序', kind: 'int' }
      ]
    },
    controller: {
      label: 'Controller 场景控制器',
      fields: [
        ...commonFields(),
        { key: 'storyboard_opacity', label: 'StoryBoard 不透明度', kind: 'num', step: 0.01, min: 0, max: 1 },
        { key: 'ui_opacity', label: 'UI 不透明度', kind: 'num', step: 0.01, min: 0, max: 1 },
        { key: 'scanline_opacity', label: '扫描线不透明度', kind: 'num', step: 0.01, min: 0, max: 1 },
        { key: 'background_dim', label: '背景遮罩', kind: 'num', step: 0.01, min: 0, max: 1 },
        { key: 'note_opacity_multiplier', label: 'Note 不透明度倍率', kind: 'num', step: 0.01 },
        { key: 'scanline_color', label: '扫描线颜色', kind: 'color' },
        { key: 'note_ring_color', label: 'Note 外圈颜色', kind: 'color' },
        { key: 'note_fill_colors', label: 'Note 填充颜色', kind: 'colors12' },
        { key: 'override_scanline_pos', label: '覆盖扫描线位置', kind: 'bool' },
        { key: 'scanline_pos', label: '扫描线位置', kind: 'unit', defaultUnit: 'notey' },
        { key: 'perspective', label: '相机透视', kind: 'bool' },
        { key: 'fov', label: '视野 FOV', kind: 'num', step: 0.1 },
        { key: 'x', label: '相机 X', kind: 'unit', defaultUnit: 'camerax' },
        { key: 'y', label: '相机 Y', kind: 'unit', defaultUnit: 'cameray' },
        { key: 'z', label: '相机 Z', kind: 'unit', defaultUnit: 'world' },
        { key: 'rot_x', label: '相机旋转 X', kind: 'num' },
        { key: 'rot_y', label: '相机旋转 Y', kind: 'num' },
        { key: 'rot_z', label: '相机旋转 Z', kind: 'num' },
        { key: 'chromatical', label: '色度滤镜', kind: 'bool' },
        { key: 'chromatical_fade', label: '色度-透明度', kind: 'num', step: 0.01, min: 0, max: 1 },
        { key: 'chromatical_intensity', label: '色度-强度', kind: 'num', step: 0.01, min: 0, max: 1 },
        { key: 'chromatical_speed', label: '色度-速度', kind: 'num', step: 0.1, min: 0, max: 3 },
        { key: 'bloom', label: '泛光滤镜', kind: 'bool' },
        { key: 'bloom_intensity', label: '泛光-强度', kind: 'num', step: 0.1, min: 0, max: 5 },
        { key: 'radial_blur', label: '径向模糊滤镜', kind: 'bool' },
        { key: 'radial_blur_intensity', label: '径向模糊-强度', kind: 'num', step: 0.01, min: -0.5, max: 0.5, def: 0.025 },
        { key: 'color_adjustment', label: '色彩调整滤镜', kind: 'bool' },
        { key: 'brightness', label: '亮度', kind: 'num', step: 0.1, min: 0, max: 10, def: 1 },
        { key: 'saturation', label: '饱和度', kind: 'num', step: 0.1, min: 0, max: 10, def: 1 },
        { key: 'contrast', label: '对比度', kind: 'num', step: 0.1, min: 0, max: 10, def: 1 },
        { key: 'color_filter', label: '屏幕颜色滤镜', kind: 'bool' },
        { key: 'color_filter_color', label: '屏幕滤镜颜色', kind: 'color' },
        { key: 'gray_scale', label: '灰度滤镜', kind: 'bool' },
        { key: 'gray_scale_intensity', label: '灰度-强度', kind: 'num', step: 0.01, min: 0, max: 1 },
        { key: 'noise', label: '噪点滤镜', kind: 'bool' },
        { key: 'noise_intensity', label: '噪点-强度', kind: 'num', step: 0.01, min: 0, max: 1, def: 0.235 },
        { key: 'sepia', label: '怀旧滤镜', kind: 'bool' },
        { key: 'sepia_intensity', label: '怀旧-强度', kind: 'num', step: 0.01, min: 0, max: 1 },
        { key: 'dream', label: '梦境滤镜', kind: 'bool' },
        { key: 'dream_intensity', label: '梦境-强度', kind: 'num', step: 0.01, min: 0, max: 1 },
        { key: 'fisheye', label: '鱼眼滤镜', kind: 'bool' },
        { key: 'fisheye_intensity', label: '鱼眼-强度', kind: 'num', step: 0.01, min: 0, max: 1, def: 0.5 },
        { key: 'shockwave', label: '冲击波滤镜', kind: 'bool' },
        { key: 'shockwave_speed', label: '冲击波-速度', kind: 'num', step: 0.1, min: 0, max: 10, def: 1 },
        { key: 'focus', label: '聚焦线滤镜', kind: 'bool' },
        { key: 'focus_size', label: '聚焦-尺寸', kind: 'num', step: 0.1, min: 1, max: 10, def: 1 },
        { key: 'focus_color', label: '聚焦-颜色', kind: 'color' },
        { key: 'focus_speed', label: '聚焦-速度', kind: 'num', step: 0.1, min: 0, max: 30, def: 5 },
        { key: 'focus_intensity', label: '聚焦-强度', kind: 'num', step: 0.01, min: 0, max: 1, def: 0.25 },
        { key: 'glitch', label: '故障滤镜', kind: 'bool' },
        { key: 'glitch_intensity', label: '故障-强度', kind: 'num', step: 0.01, min: 0, max: 1 },
        { key: 'artifact', label: '故障伪影滤镜', kind: 'bool' },
        { key: 'artifact_intensity', label: '伪影-强度', kind: 'num', step: 0.01, min: 0, max: 1 },
        { key: 'artifact_colorisation', label: '伪影-色化', kind: 'num', step: 0.1, min: -10, max: 10 },
        { key: 'artifact_parasite', label: '伪影-寄生', kind: 'num', step: 0.1, min: -10, max: 10 },
        { key: 'artifact_noise', label: '伪影-噪点', kind: 'num', step: 0.1, min: -10, max: 10 },
        { key: 'scanline_smoothing', label: '扫描线平滑', kind: 'bool' },
        { key: 'arcade', label: '街机滤镜', kind: 'bool' },
        { key: 'arcade_intensity', label: '街机-强度', kind: 'num', step: 0.01, min: 0, max: 1, def: 1 },
        { key: 'arcade_interference_size', label: '街机-干扰尺寸', kind: 'num', step: 0.1, min: 0, max: 10, def: 1 },
        { key: 'arcade_interference_speed', label: '街机-干扰速度', kind: 'num', step: 0.1, min: 0, max: 10, def: 0.5 },
        { key: 'arcade_contrast', label: '街机-对比度', kind: 'num', step: 0.1, min: 0, max: 10, def: 1 },
        { key: 'tape', label: '磁带翻转滤镜', kind: 'bool' }
      ]
    },
    note_controller: {
      label: 'Note Controller 音符控制器',
      fields: [
        ...commonFields(),
        { key: 'note', label: 'Note ID', kind: 'int' },
        { key: 'override_x', label: '覆盖 X', kind: 'bool' },
        { key: 'x', label: 'X', kind: 'unit', defaultUnit: 'notex' },
        { key: 'override_y', label: '覆盖 Y', kind: 'bool' },
        { key: 'y', label: 'Y', kind: 'unit', defaultUnit: 'notey' },
        { key: 'override_z', label: '覆盖 Z', kind: 'bool' },
        { key: 'z', label: 'Z', kind: 'unit', defaultUnit: 'world' },
        { key: 'override_rot_x', label: '覆盖旋转 X', kind: 'bool' },
        { key: 'rot_x', label: '旋转 X', kind: 'num' },
        { key: 'override_rot_y', label: '覆盖旋转 Y', kind: 'bool' },
        { key: 'rot_y', label: '旋转 Y', kind: 'num' },
        { key: 'override_rot_z', label: '覆盖旋转 Z', kind: 'bool' },
        { key: 'rot_z', label: '旋转 Z', kind: 'num' },
        { key: 'override_ring_color', label: '覆盖外圈颜色', kind: 'bool' },
        { key: 'ring_color', label: '外圈颜色', kind: 'color' },
        { key: 'override_fill_color', label: '覆盖填充颜色', kind: 'bool' },
        { key: 'fill_color', label: '填充颜色', kind: 'color' },
        { key: 'opacity_multiplier', label: '不透明度倍率', kind: 'num', step: 0.01 },
        { key: 'size_multiplier', label: '大小倍率', kind: 'num', step: 0.01 },
        { key: 'hitbox_multiplier', label: 'hitbox倍率', kind: 'num', step: 0.01 },
        { key: 'x_multiplier', label: 'X 倍率', kind: 'num', step: 0.01 },
        { key: 'y_multiplier', label: 'Y 倍率', kind: 'num', step: 0.01 },
        { key: 'dx', label: 'X 偏移', kind: 'num', step: 0.001 },
        { key: 'dy', label: 'Y 偏移', kind: 'num', step: 0.001, tip: '对于下行的note，您应当在原本的偏移值上+1来实现预期效果（这是一个原生bug）' },
        { key: 'hold_direction', label: 'Hold 方向', kind: 'select', options: [{ value: 1, label: '1 (向上)' }, { value: -1, label: '-1 (向下)' }] },
        { key: 'style', label: 'Hold 样式', kind: 'select', options: [{ value: 1, label: '1 (默认)' }, { value: 2, label: '2 (适用于下落式)' }] }
      ]
    }
  };

  // ---- value helpers ----
  function unitToJson(value, unit, defaultUnit) {
    if (value == null || isNaN(value)) return undefined;
    return unit === defaultUnit ? value : `${unit}:${value}`;
  }

  function unitFromJson(jsonVal, defaultUnit) {
    if (jsonVal == null) return { value: null, unit: defaultUnit };
    if (typeof jsonVal === 'number') return { value: jsonVal, unit: defaultUnit };
    // 对象形式（{value, unit}）：与 propUnitField / engine parseUnitValue 对齐，
    // 拖入创建等流程会直接写入这种结构，此前会被 String() 误解析为 NaN。
    if (typeof jsonVal === 'object') {
      return { value: Number(jsonVal.value), unit: jsonVal.unit || defaultUnit };
    }
    const s = String(jsonVal);
    const i = s.indexOf(':');
    if (i < 0) return { value: parseFloat(s), unit: defaultUnit };
    return { value: parseFloat(s.slice(i + 1)), unit: s.slice(0, i).toLowerCase() };
  }

  // 解析 unit 输入：纯数字沿用当前单位；带坐标系前缀（如 notex:0.8）自动识别；
  // 非法返回 null；空字符串返回 { cleared:true }。
  function parseUnitInput(raw, unitOptions, currentUnit) {
    const s = String(raw == null ? '' : raw).trim();
    if (s === '') return { cleared: true };
    const pm = /^([a-zA-Z]+):(.*)$/.exec(s);
    if (pm) {
      const unit = pm[1].toLowerCase();
      const num = parseFloat(pm[2]);
      if (unitOptions.some((o) => o.value === unit) && Number.isFinite(num)) {
        return { unit, num };
      }
      return null;
    }
    const num = parseFloat(s);
    return Number.isFinite(num) ? { unit: currentUnit, num } : null;
  }

  function colorToHex(c) {
    if (!c) return '#ffffff';
    if (typeof c === 'string') return c;
    return Colors.toHex(c, false);
  }

  // 规范化 hex 颜色输入：接受 #RRGGBB / RRGGBB / #RGB；非法返回 null。
  function normalizeHex(v) {
    let s = String(v || '').trim().replace(/^#/, '');
    if (/^[0-9a-fA-F]{3}$/.test(s)) s = s.split('').map((c) => c + c).join('');
    if (!/^[0-9a-fA-F]{6}$/.test(s)) return null;
    return '#' + s.toLowerCase();
  }

  // 点击颜色色块弹出的“颜色代码”界面：支持直接输入 16 进制代码（#FFFFFF），
  // 也带系统色盘。onApply(hex) 在确定时回调。
  function openColorPopover(anchor, currentHex, onApply) {
    let pop = document.getElementById('colorPop');
    if (!pop) {
      pop = document.createElement('div');
      pop.id = 'colorPop';
      pop.className = 'color-pop hidden';
      pop.innerHTML =
        `<input type="text" class="color-pop-hex" spellcheck="false" placeholder="#RRGGBB">` +
        `<input type="color" class="color-pop-pick" title="系统色盘">` +
        `<div class="color-pop-btns">` +
        `<button type="button" class="color-pop-ok">确定</button>` +
        `<button type="button" class="color-pop-cancel">取消</button>` +
        `</div>`;
      document.body.appendChild(pop);
      const hex = pop.querySelector('.color-pop-hex');
      const pick = pop.querySelector('.color-pop-pick');
      const ok = pop.querySelector('.color-pop-ok');
      const cancel = pop.querySelector('.color-pop-cancel');
      const hide = () => { pop.classList.add('hidden'); pop._cb = null; };
      ok.addEventListener('click', () => {
        const h = normalizeHex(hex.value);
        if (!h) { hex.classList.add('err'); return; }
        const cb = pop._cb;
        hide();
        if (cb) cb(h);
      });
      cancel.addEventListener('click', hide);
      pick.addEventListener('input', () => {
        hex.value = pick.value.toUpperCase();
        hex.classList.remove('err');
      });
      hex.addEventListener('input', () => hex.classList.remove('err'));
      hex.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); ok.click(); }
        else if (e.key === 'Escape') hide();
      });
      pop.addEventListener('mousedown', (e) => e.stopPropagation());
      document.addEventListener('mousedown', function onDoc(ev) {
        if (pop.classList.contains('hidden')) return;
        // 忽略打开瞬间的同一事件，避免刚弹出就被关闭。
        if (pop._openedAt && Date.now() - pop._openedAt < 150) return;
        if (!pop.contains(ev.target)) hide();
      });
    }
    pop._cb = onApply;
    pop._openedAt = Date.now();
    const h = normalizeHex(currentHex) || '#ffffff';
    pop.querySelector('.color-pop-hex').value = h.toUpperCase();
    pop.querySelector('.color-pop-hex').classList.remove('err');
    pop.querySelector('.color-pop-pick').value = h;
    pop.classList.remove('hidden');
    const r = anchor.getBoundingClientRect();
    pop.style.left = Math.max(4, Math.min(window.innerWidth - pop.offsetWidth - 8, r.left)) + 'px';
    pop.style.top = Math.max(4, Math.min(window.innerHeight - pop.offsetHeight - 8, r.bottom + 4)) + 'px';
    pop.querySelector('.color-pop-hex').focus();
    pop.querySelector('.color-pop-hex').select();
  }

  function hexToColor(h) {
    return Colors.parseHex(h || '#ffffff');
  }

  // ---- 字段提示框（圆形 “i” 图标悬停） ----
  let fieldTipEl = null;

  function showFieldTip(anchor, text) {
    if (!fieldTipEl) {
      fieldTipEl = document.createElement('div');
      fieldTipEl.className = 'field-tip-pop';
      document.body.appendChild(fieldTipEl);
    }
    fieldTipEl.textContent = text;
    fieldTipEl.style.display = 'block';
    const ar = anchor.getBoundingClientRect();
    const tr = fieldTipEl.getBoundingClientRect();
    let x = ar.right + 6;
    let y = ar.bottom + 5;
    if (x + tr.width > window.innerWidth - 8) x = Math.max(8, ar.left - tr.width - 6);
    if (y + tr.height > window.innerHeight - 8) y = Math.max(8, ar.top - tr.height - 5);
    fieldTipEl.style.left = x + 'px';
    fieldTipEl.style.top = y + 'px';
  }

  function hideFieldTip() {
    if (fieldTipEl) fieldTipEl.style.display = 'none';
  }

  // 任何按下操作都收起字段提示框（属性面板重绘/切换对象时避免残留）。
  document.addEventListener('pointerdown', hideFieldTip);

  // Render one schema field into a `.field` row (shared by the flat form and
  // the controller option cards).
  function renderField(row, f, state, onChange, readOnly, opts) {
    const label = document.createElement('label');
    label.textContent = f.label;
    // 带提示（tip）的字段：在标签文字后追加圆形 “i” 图标，悬停显示浮现式提示框。
    if (f.tip) {
      const tip = document.createElement('span');
      tip.className = 'field-tip';
      tip.textContent = 'i';
      tip.setAttribute('role', 'tooltip');
      tip.addEventListener('mouseenter', (ev) => showFieldTip(ev.currentTarget, f.tip));
      tip.addEventListener('mouseleave', hideFieldTip);
      label.appendChild(tip);
    }
    // 全帧同步字段（path / order / layer）用黄色标明。
    if (f.key === 'path' || f.key === 'order' || f.key === 'layer') {
      label.classList.add('sync-label');
      const tag = document.createElement('span');
      tag.className = 'sync-tag';
      tag.textContent = 'SYNC';
      label.appendChild(tag);
    }
    row.appendChild(label);
    // 多选时数值有差异的字段：直接在输入框内显示“多个数值”，点击后修改并统一。
    const multi = state[f.key] === MULTI_VALUE;
    // controller 条目：未设置/清空后统一显示为灰色（标签、输入框、占位文字、
    // 颜色块），设置数值后恢复正常显示。
    const raw = state[f.key];
    const unset = !!(opts && opts.unsetGray && !multi &&
      (raw === undefined || raw === null || raw === '' ||
        (Array.isArray(raw) && raw.length === 0)));
    if (unset) row.classList.add('unset');

      if (f.kind === 'bool') {
        const input = document.createElement('input');
        input.type = 'checkbox';
        // 多选有差异时布尔值不做默认勾选（点击后统一为勾选状态）。
        input.checked = multi ? false : !!state[f.key];
        input.addEventListener('change', () => {
          onChange(f.key, input.checked);
        });
        row.appendChild(input);
      } else if (f.kind === 'select') {
        const select = document.createElement('select');
        select.innerHTML = '<option value="">' + (multi ? $t('（多个数值）') : $t('(未设置)')) + '</option>' +
          f.options.map((o) => `<option value="${o.value}">${o.label}</option>`).join('');
        const v = multi ? null : state[f.key];
        if (v != null) {
          const s = String(v);
          const opt = f.options.find((o) => String(o.value) === s) ||
            f.options.find((o) => String(o.value).toLowerCase() === s.toLowerCase());
          if (opt) select.value = String(opt.value);
        }
        select.addEventListener('change', () => {
          onChange(f.key, select.value === '' ? undefined : (typeof f.options[0].value === 'number' ? Number(select.value) : select.value));
        });
        row.appendChild(select);
      } else if (f.kind === 'unit') {
        const uv = unitFromJson(state[f.key], f.defaultUnit);
        const input = document.createElement('input');
        // 文本输入以便支持“notex:0.8”这类带坐标系前缀的写法。
        input.type = 'text';
        input.inputMode = 'decimal';
        input.value = multi ? '' : (uv.value != null ? uv.value : '');
        input.placeholder = multi ? $t('多个数值') : $t('未设置');
        const sel = document.createElement('select');
        sel.className = 'unit';
        const unitOptions = f.key === 'z' ? Z_UNIT_OPTIONS : UNIT_OPTIONS;
        sel.innerHTML = unitOptions.map((o) => `<option value="${o.value}">${o.label}</option>`).join('');
        sel.value = (opts && opts.unitInfo && opts.unitInfo[f.key]) || uv.unit;
        // 输入解析：空值清空；带坐标系前缀（如 notex:0.8）自动切换单位下拉并取
        // 数值；纯数字沿用当前单位；无法解析则还原为当前值。
        const parseInput = (raw) => parseUnitInput(raw, unitOptions, sel.value);
        const apply = () => {
          const r = parseInput(input.value);
          if (r === null) {
            // 无法解析：还原输入框为当前值。
            const cur = unitFromJson(state[f.key], f.defaultUnit);
            input.value = (cur.value != null && Number.isFinite(cur.value)) ? String(cur.value) : '';
            return;
          }
          if (r.cleared) { onChange(f.key, undefined); return; }
          sel.value = r.unit; // 自动切换到检测到的坐标系
          onChange(f.key, unitToJson(r.num, r.unit, f.defaultUnit));
        };
        input.addEventListener('change', apply);
        sel.addEventListener('change', () => {
          const r = parseInput(input.value);
          if (r === null || r.cleared) {
            // 多选/空值：只发“切换单位”信号，由编辑层按各对象当前数值换算。
            onChange(f.key, { __unitChange: sel.value });
          } else {
            onChange(f.key, unitToJson(r.num, sel.value, f.defaultUnit));
          }
        });
        row.appendChild(input);
        row.appendChild(sel);
      } else if (f.kind === 'color') {
        const input = document.createElement('input');
        input.type = 'color';
        const c = multi ? null : state[f.key];
        input.value = colorToHex(c);
        const text = document.createElement('input');
        text.type = 'text';
        if (unset) text.placeholder = $t('未设置');
        else text.value = c && typeof c === 'string' ? c : colorToHex(c);
        if (multi) { text.value = ''; text.placeholder = $t('多个数值'); }
        const apply = () => {
          const raw = text.value.trim();
          // 清空颜色代码：删除该字段（controller 不再输出对应 storyboard 字段）。
          if (opts && opts.clearDeletes && raw === '') { onChange(f.key, undefined); return; }
          const hex = raw || '#ffffff';
          onChange(f.key, hex);
          input.value = Colors.parseHex(hex) ? Colors.toHex(Colors.parseHex(hex), false) : input.value;
        };
        input.addEventListener('input', () => {
          text.value = input.value;
          onChange(f.key, input.value);
        });
        // 点击色块打开“颜色代码”界面（可输入 16 进制代码），替代 Windows
        // 系统色盘；text 输入框仍可直接输入 hex。未设置（unset）时同样可点。
        input.addEventListener('click', (e) => {
          e.preventDefault();
          const cur = text.value && text.value.indexOf('#') === 0 ? text.value : colorToHex(c);
          openColorPopover(input, cur, (hex) => {
            input.value = hex;
            text.value = hex;
            onChange(f.key, hex);
          });
        });
        text.addEventListener('change', apply);
        row.appendChild(input);
        row.appendChild(text);
      } else if (f.kind === 'colors12') {
        // Note 填充颜色：6 行（note 种类）× 2 列（上/下行）纯色块，点击色块
        // 打开“颜色代码”界面（可输入 16 进制代码）。未设置（unset）时仍可
        // 点击，显示游戏默认 12 色（DEFAULT_NOTE_FILL），首次修改写出完整
        // 12 色数组；卡片右上角提供“重置默认颜色”按钮。
        const wrap = document.createElement('div');
        wrap.className = 'fill12-wrap';
        // 每次点击都从 state[f.key] 实时读取，而不是用渲染时的数组快照：
        // 同一面板会话内连续修改多项时，后一次修改会用包含前一次改动的完整
        // 12 色数组重建，避免把已修改的旧项重置回原值。
        const curHex = (i) => {
          const live = state[f.key] || [];
          return (live[i] != null && live[i] !== MULTI_VALUE
            ? colorToHex(live[i])
            : colorToHex(Colors.DEFAULT_NOTE_FILL[i]));
        };
        const KIND_NAMES = ['Click', 'Drag', 'Hold', 'LongHold', 'Flick', 'C-Drag'];
        for (let r = 0; r < 6; r++) {
          const line = document.createElement('div');
          line.className = 'fill12-row';
          const kind = document.createElement('span');
          kind.className = 'fill12-kind';
          kind.textContent = KIND_NAMES[r];
          line.appendChild(kind);
          for (let c = 0; c < 2; c++) {
            const i = r * 2 + c;
            const chip = document.createElement('div');
            chip.className = 'fill12-chip';
            const hex = curHex(i);
            chip.style.background = hex;
            chip.title = KIND_NAMES[r] + ' · ' + $t(c === 0 ? '上行' : '下行') + $t('（点击修改颜色）');
            chip.addEventListener('click', () => {
              // 未设置时从游戏默认色起步；已设置时保留其余项，始终输出完整 12 色，
              // 避免游戏端把缺失项补成黑色。
              openColorPopover(chip, curHex(i), (hex) => {
                const next = Array.from({ length: 12 }, (_, j) => curHex(j));
                next[i] = hex;
                onChange(f.key, next);
                chip.style.background = hex;
              });
            });
            line.appendChild(chip);
          }
          wrap.appendChild(line);
        }
        // 卡片右上角：重置为游戏默认颜色（清空字段 → 未设置态，显示默认色）。
        const reset = document.createElement('button');
        reset.type = 'button';
        reset.className = 'fill12-reset';
        reset.title = $t('重置为游戏默认颜色');
        reset.textContent = '↺ 默认';
        reset.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          onChange(f.key, undefined);
          wrap.querySelectorAll('.fill12-chip').forEach((chip, i) => {
            const hex = colorToHex(Colors.DEFAULT_NOTE_FILL[i]);
            chip.style.background = hex;
          });
        });
        wrap.appendChild(reset);
        row.appendChild(wrap);
      } else if (f.kind === 'pos') {
        row.classList.add('pos-field');
        // Line endpoints as an editable list (like the keyframe list): one
        // row per endpoint, each axis with its own unit dropdown + auto-detection
        // (typing "notex:0.8" switches that axis to NoteX), plus add/delete.
        const wrap = document.createElement('div');
        wrap.className = 'pos-list';
        const posUnits = f.units || { x: 'notex', y: 'notey', z: 'world' };
        if (multi) {
          // 多选合并态：数值不一致时显示“多个数值”占位（不渲染可编辑列表）。
          const head = document.createElement('div');
          head.className = 'pos-head';
          const title = document.createElement('span');
          title.textContent = '端点列表';
          head.appendChild(title);
          wrap.appendChild(head);
          const ph = document.createElement('div');
          ph.className = 'help-text';
          ph.textContent = $t('多个数值');
          wrap.appendChild(ph);
        } else {
          let pts = Array.isArray(state[f.key]) ? state[f.key] : [];
          const apply = (next) => {
            pts = next;
            render();
            onChange(f.key, next);
          };
          const render = () => {
            wrap.innerHTML = '';
            const head = document.createElement('div');
            head.className = 'pos-head';
            const title = document.createElement('span');
            title.textContent = '端点列表 (' + pts.length + ')';
            const add = document.createElement('button');
            add.className = 'mini-btn pos-add';
            add.innerHTML = `${svgIcon('plus', 12, true)}添加端点`;
            add.addEventListener('click', () => apply([...pts, { x: 0, y: 0, z: 0 }]));
            head.appendChild(title);
            head.appendChild(add);
            wrap.appendChild(head);
            const list = document.createElement('div');
            list.className = 'pos-items';
            pts.forEach((p, i) => {
              const rowEl = document.createElement('div');
              rowEl.className = 'pos-item';
              // 端点头：序号 + 删除按钮
              const head = document.createElement('div');
              head.className = 'pos-point-head';
              const idx = document.createElement('span');
              idx.className = 'pos-idx';
              idx.textContent = String(i + 1);
              head.appendChild(idx);
              const del = document.createElement('button');
              del.className = 'pos-del';
              del.innerHTML = svgIcon('close', 12);
              del.title = $t('删除端点');
              del.addEventListener('click', () => apply(pts.filter((_, j) => j !== i)));
              head.appendChild(del);
              rowEl.appendChild(head);
              for (const axis of ['x', 'y', 'z']) {
                const defUnit = posUnits[axis] || 'world';
                const uv = unitFromJson(p[axis], defUnit);
                const axisRow = document.createElement('div');
                axisRow.className = 'pos-axis';
                const lab = document.createElement('label');
                lab.textContent = axis.toUpperCase();
                const inp = document.createElement('input');
                inp.type = 'text';
                inp.inputMode = 'decimal';
                inp.title = axis.toUpperCase();
                inp.value = (uv.value != null && Number.isFinite(uv.value)) ? String(uv.value) : '';
                inp.placeholder = $t('未设置');
                const sel = document.createElement('select');
                sel.className = 'unit';
                sel.title = axis.toUpperCase() + $t(' 坐标系');
                sel.innerHTML = UNIT_OPTIONS.map((o) => `<option value="${o.value}">${o.label}</option>`).join('');
                sel.value = uv.unit;
                const commit = () => {
                  const r = parseUnitInput(inp.value, UNIT_OPTIONS, sel.value);
                  if (r === null) {
                    const cur = unitFromJson(p[axis], defUnit);
                    inp.value = (cur.value != null && Number.isFinite(cur.value)) ? String(cur.value) : '';
                    return;
                  }
                  const next = pts.map((q, j) => {
                    if (j !== i) return q;
                    if (r.cleared) return { ...q, [axis]: undefined };
                    return { ...q, [axis]: unitToJson(r.num, r.unit, defUnit) };
                  });
                  if (!r.cleared) sel.value = r.unit; // 自动切换到检测到的坐标系
                  apply(next);
                };
                inp.addEventListener('change', commit);
                sel.addEventListener('change', () => {
                  // 单位切换（规范版）：由编辑层按该端点当前值做位置保持换算。
                  onChange(f.key, { __posUnitChange: true, index: i, axis, unit: sel.value });
                });
                axisRow.appendChild(lab);
                axisRow.appendChild(inp);
                axisRow.appendChild(sel);
                rowEl.appendChild(axisRow);
              }
              list.appendChild(rowEl);
            });
            wrap.appendChild(list);
          };
          render();
        }
        row.appendChild(wrap);
      } else if (f.kind === 'path') {
        const sel = document.createElement('select');
        const opts = window.SBApp && window.SBApp.assetOptions ? window.SBApp.assetOptions(f.filter) : [];
        const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
        sel.innerHTML = '<option value="">' + (multi ? $t('（多个数值）') : $t('(选择素材)')) + '</option>' + opts.map((o) => {
          const v = o && typeof o === 'object' ? o.value : o;
          const l = o && typeof o === 'object' ? o.label : o;
          return `<option value="${esc(v)}">${esc(l)}</option>`;
        }).join('');
        sel.value = multi ? '' : (state[f.key] || '');
        sel.addEventListener('change', () => onChange(f.key, sel.value || undefined));
        row.appendChild(sel);
      } else if (f.kind === 'textarea') {
        const ta = document.createElement('textarea');
        ta.value = multi ? '多个数值' : (state[f.key] != null ? state[f.key] : '');
        ta.addEventListener('change', () =>
          onChange(f.key, (opts && opts.clearDeletes && ta.value === '') ? undefined : ta.value));
        row.appendChild(ta);
      } else {
        const input = document.createElement('input');
        input.type = f.kind === 'int' ? 'number' : 'text';
        if (f.kind === 'int') input.step = '1';
        if (f.kind === 'num') {
          input.type = 'number';
          input.step = f.step || 'any';
          if (f.min != null) input.min = f.min;
          if (f.max != null) input.max = f.max;
        }
        input.value = multi && f.kind !== 'num' && f.kind !== 'int'
          ? '多个数值'
          : (state[f.key] != null ? state[f.key] : '');
        // 有默认值的强度字段：未设置时提示其默认强度（如“未设置（0.5）”）。
        // 按字段值是否为空判断（不依赖 unsetGray），实时统计面板等
        // showUnset=false 的卡片同样显示该提示。
        const valUnset = !multi && (state[f.key] === undefined || state[f.key] === null || state[f.key] === '');
        input.placeholder = multi && (f.kind === 'num' || f.kind === 'int')
          ? '多个数值'
          : (valUnset && f.def != null ? $t('未设置（') + f.def + $t('）') : (f.placeholder || $t('未设置')));
        input.addEventListener('change', () => {
          if (f.kind === 'num' || f.kind === 'int') {
            onChange(f.key, input.value === '' ? undefined : Number(input.value));
          } else {
            onChange(f.key, (opts && opts.clearDeletes && input.value === '') ? undefined : input.value);
          }
        });
        row.appendChild(input);
        // order 缺省或重复时：追加灰色“（数组顺序）”提示；输入框可直接修改，
        // 重复值由编辑层校验并拒绝。
        if (f.key === 'order' && opts && opts.orderInfo && opts.orderInfo.auto) {
          const span = document.createElement('span');
          span.className = 'order-auto';
          span.textContent = '（' + opts.orderInfo.index + '）';
          row.appendChild(span);
        }
      }
      if (readOnly) {
        row.querySelectorAll('input, select, textarea, button').forEach((el) => { el.disabled = true; });
      }
    }

  // Render a full form for a state object (raw JSON) with the schema.
  // opts.multi renders a merged multi-select form: fields set to MULTI_VALUE
  // 显示“多个数值”提示但仍可输入——输入后统一应用到全部选中对象。
  function renderForm(container, schema, state, onChange, readOnly, opts) {
    container.innerHTML = '';
    for (const f of schema.fields) {
      // 多选编辑时跳过关键帧定位字段（time）；缓动与 destroy 允许统一编辑。
      if (opts && opts.multi && f.key === 'time') continue;
      // 全帧同步字段已在属性页顶部单独渲染，状态表单内不再重复。
      if (opts && opts.excludeSync && isSyncField(f)) continue;
      const row = document.createElement('div');
      row.className = 'field';
      // MULTI_VALUE 字段由 renderField 内联显示“多个数值”并保持可输入。
      renderField(row, f, state, onChange, readOnly, opts);
      container.appendChild(row);
    }
  }

  // 只渲染全帧同步字段（path / order / layer），用于属性页顶部区域。
  function renderSyncForm(container, schema, state, onChange, readOnly, opts) {
    container.innerHTML = '';
    for (const f of schema.fields) {
      if (!isSyncField(f)) continue;
      const row = document.createElement('div');
      row.className = 'field';
      renderField(row, f, state, onChange, readOnly, opts);
      container.appendChild(row);
    }
  }

  // Controller scene options, split into draggable option-block cards. Each
  // card is a self-contained unit (its own toggle when relevant) and can only
  // be referenced by ONE controller track. Non-filter cards are subdivided so
  // every setting can be keyframed independently; filter cards keep their
  // original grouped layout.
  const CONTROLLER_CARDS = [
    // ① 相机/场景：透视开关 + FOV（正交尺寸选项已删除），相机轴/旋转各自独立。
    { key: 'camera_perspective', label: '相机 · 透视 + FOV', toggle: 'perspective', fields: ['fov'] },
    { key: 'camera_x', label: '相机 · X', fields: ['x'] },
    { key: 'camera_y', label: '相机 · Y', fields: ['y'] },
    { key: 'camera_z', label: '相机 · Z', fields: ['z'] },
    { key: 'camera_rot_x', label: '相机 · 旋转 X', fields: ['rot_x'] },
    { key: 'camera_rot_y', label: '相机 · 旋转 Y', fields: ['rot_y'] },
    { key: 'camera_rot_z', label: '相机 · 旋转 Z', fields: ['rot_z'] },
    // ② 不透明度：每个条目拆成独立卡片。
    { key: 'opacity_storyboard', label: 'storyboard不透明度', fields: ['storyboard_opacity'] },
    { key: 'opacity_ui', label: 'UI不透明度', fields: ['ui_opacity'] },
    { key: 'opacity_scanline', label: '扫描线不透明度', fields: ['scanline_opacity'] },
    { key: 'opacity_background', label: '背景遮罩', fields: ['background_dim'] },
    { key: 'opacity_note', label: 'Note不透明度', fields: ['note_opacity_multiplier'] },
    // ③ 扫描线：颜色、覆盖位置开关 + 位置（扫描线平滑卡片已按要求删除）。
    { key: 'scanline_color', label: '扫描线颜色', fields: ['scanline_color'] },
    { key: 'scanline_position', label: '覆盖扫描线位置', toggle: 'override_scanline_pos', fields: ['scanline_pos'] },
    // ④ Note 颜色：两个条目各自独立。
    { key: 'note_ring_color', label: 'Note外圈颜色', fields: ['note_ring_color'] },
    { key: 'note_fill_colors', label: 'Note填充颜色', fields: ['note_fill_colors'] },
    // 滤镜卡片保持原有分组不变。
    { key: 'chromatical', label: '色散滤镜(chromatical)', toggle: 'chromatical', fields: ['chromatical_fade', 'chromatical_intensity', 'chromatical_speed'] },
    { key: 'bloom', label: '泛光(bloom)', toggle: 'bloom', fields: ['bloom_intensity'] },
    { key: 'radial_blur', label: '径向模糊(radial_blur)', toggle: 'radial_blur', fields: ['radial_blur_intensity'] },
    { key: 'color_adjustment', label: '色彩调整(color_adjustment)', toggle: 'color_adjustment', fields: ['brightness', 'saturation', 'contrast'] },
    { key: 'color_filter', label: '颜色滤镜(color_filter)', toggle: 'color_filter', fields: ['color_filter_color'] },
    { key: 'gray_scale', label: '灰度(gray_scale)', toggle: 'gray_scale', fields: ['gray_scale_intensity'] },
    { key: 'noise', label: '噪点(noise)', toggle: 'noise', fields: ['noise_intensity'] },
    { key: 'sepia', label: '怀旧(sepia)', toggle: 'sepia', fields: ['sepia_intensity'] },
    { key: 'artifact', label: '故障伪影(artifact)', toggle: 'artifact', fields: ['artifact_intensity', 'artifact_colorisation', 'artifact_parasite', 'artifact_noise'] },
    { key: 'dream', label: '梦境(dream)', toggle: 'dream', fields: ['dream_intensity'] },
    { key: 'fisheye', label: '鱼眼(fisheye)', toggle: 'fisheye', fields: ['fisheye_intensity'] },
    { key: 'shockwave', label: '冲击波(shockwave)', toggle: 'shockwave', fields: ['shockwave_speed'] },
    { key: 'focus', label: '聚焦线(focus)', toggle: 'focus', fields: ['focus_size', 'focus_color', 'focus_speed', 'focus_intensity'] },
    { key: 'glitch', label: '故障(glitch)', toggle: 'glitch', fields: ['glitch_intensity'] },
    { key: 'arcade', label: '街机(arcade)', toggle: 'arcade', fields: ['arcade_intensity', 'arcade_interference_size', 'arcade_interference_speed', 'arcade_contrast'] },
    { key: 'tape', label: '磁带翻转(tape)', toggle: 'tape', fields: [] }
  ];

  // Controller keyframe editor: one card per option block. Toggling a card's
  // master switch writes an explicit true/false; dragging the card header onto
  // the timeline adds that block at the drop time. opts.owners maps each card
  // key to the controller track that already claims it: cards claimed by a
  // DIFFERENT track are hidden here (each card may only be referenced by one
  // track). A card whose whole option block is unset gets the card-unset class
  // (gray 45-degree diagonal stripes over the entire card).
  function renderControllerCards(container, schema, state, onChange, readOnly, opts) {
    container.innerHTML = '';
    const byKey = new Map(schema.fields.map((f) => [f.key, f]));
    const owners = (opts && opts.owners) || null;
    const selectedId = opts && opts.selectedId;
    // enabledOnly：控制器轨道/关键帧面板，只显示该轨道启用的卡片；否则为
    // 实时统计面板（显示全部卡片，已占用卡片标记并禁止拖拽新建）。
    const enabledOnly = !!(opts && opts.enabledOnly);
    const onCardContextMenu = opts && opts.onCardContextMenu;
    const showUnset = !(opts && opts.showUnset === false);
    // 多选关键帧合并态：禁止拖拽卡片（无单一值可携带），开关显示不确定态。
    const multi = !!(opts && opts.multi);
    const isUnsetVal = (v) => v === undefined || v === null || v === '' ||
      (Array.isArray(v) && v.length === 0);
    let rendered = 0;
    for (const card of CONTROLLER_CARDS) {
      const ownerId = owners ? owners[card.key] : null;
      // 轨道面板：只显示本轨道启用的卡片。
      if (enabledOnly && ownerId !== selectedId) continue;
      const fields = card.fields.map((k) => byKey.get(k)).filter(Boolean);
      const wrap = document.createElement('div');
      wrap.className = 'ctrl-card' + (card.toggle && state[card.toggle] === false ? ' off' : '');
      wrap.dataset.card = card.key;
      if (ownerId != null) wrap.classList.add('owned');
      rendered++;
      // 卡片整体未设置（开关与所有条目都为空）时整卡灰条。
      const cardUnset = () => {
        if (card.toggle && state[card.toggle] !== undefined) return false;
        return !fields.some((f) => !isUnsetVal(state[f.key]));
      };
      if (showUnset) wrap.classList.toggle('card-unset', cardUnset());

      const head = document.createElement('div');
      head.className = 'ctrl-card-head';
      head.draggable = !multi;
      head.title = enabledOnly || ownerId == null
        ? $t('拖动到时间轴/预览画面，把该选项块添加到对应时间')
        : `该卡片已由轨道 ${ownerId} 启用`;
      head.addEventListener('dragstart', (e) => {
        // 实时统计面板中已占用卡片不能拖拽（不能重复启用到新轨道）。
        if (!enabledOnly && ownerId != null) { e.preventDefault(); return; }
        const values = {};
        if (card.toggle) values[card.toggle] = state[card.toggle];
        for (const f of fields) values[f.key] = state[f.key];
        e.dataTransfer.setData('application/x-cytoid-ctrl-card', JSON.stringify({ groupKey: card.key, values }));
        e.dataTransfer.effectAllowed = 'copy';
        e.stopPropagation();
      });
      head.addEventListener('dragend', () => {
        head.classList.remove('dragging');
      });
      head.addEventListener('dragstart', () => head.classList.add('dragging'));

      const grip = document.createElement('span');
      grip.className = 'ctrl-card-grip';
      grip.textContent = '⋮⋮';
      head.appendChild(grip);

      const title = document.createElement('span');
      title.className = 'ctrl-card-title';
      title.textContent = card.label;
      head.appendChild(title);

      if (!enabledOnly && ownerId != null) {
        const tag = document.createElement('span');
        tag.className = 'ctrl-card-owner';
        tag.textContent = '已占用';
        head.appendChild(tag);
      }

      if (card.toggle) {
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.title = card.label + $t(' 开关（关闭时写入显式 false）');
        const multiToggle = multi && state[card.toggle] === MULTI_VALUE;
        cb.checked = multiToggle ? false : !!state[card.toggle];
        cb.indeterminate = multiToggle;
        cb.addEventListener('change', () => {
          onChange(card.toggle, cb.checked);
          wrap.classList.toggle('off', !cb.checked);
          if (showUnset) wrap.classList.toggle('card-unset', cardUnset());
        });
        head.appendChild(cb);
      }
      wrap.appendChild(head);

      if (fields.length) {
        const body = document.createElement('div');
        body.className = 'ctrl-card-body';
        for (const f of fields) {
          const row = document.createElement('div');
          row.className = 'field';
          // controller 输入框清空 = 删除该字段（不输出对应 storyboard 字段）。
          // 清空/重新填写后立即切换整行灰色（标签、输入框、占位文字、颜色块），
          // 不整页重渲染以免打断颜色拖拽等连续输入。
          const onFieldChange = (key, value) => {
            onChange(key, value);
            const unsetNow = isUnsetVal(value);
            row.classList.toggle('unset', unsetNow);
            if (f.kind === 'color') {
              const text = row.querySelector('input[type=text]');
              if (text) text.placeholder = unsetNow ? '未设置' : '';
            }
            if (showUnset) wrap.classList.toggle('card-unset', cardUnset());
          };
          renderField(row, f, state, onFieldChange, readOnly, {
            clearDeletes: true,
            unsetGray: showUnset
          });
          body.appendChild(row);
        }
        wrap.appendChild(body);
      }
      if (onCardContextMenu) {
        wrap.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          e.stopPropagation();
          onCardContextMenu(card, ownerId, e.clientX, e.clientY);
        });
      }
      if (readOnly) {
        wrap.querySelectorAll('input, select, textarea, button').forEach((el) => { el.disabled = true; });
      }
      container.appendChild(wrap);
    }
    if (enabledOnly && !rendered) {
      const empty = document.createElement('div');
      empty.className = 'help-text';
      empty.textContent = '该轨道尚未启用任何属性卡片：回到预览空白处或使用对象库 + 号添加controller轨道。';
      container.appendChild(empty);
    }
    // 轨道面板底部：给当前轨道分配一个或多个新的属性卡片（与卡片等宽）。
    if (enabledOnly && opts.onAddCard) {
      const add = document.createElement('button');
      add.type = 'button';
      add.className = 'ctrl-card-add';
      add.textContent = '+ 添加controller属性';
      add.title = $t('给该轨道分配一个或多个新的属性卡片');
      add.addEventListener('click', () => opts.onAddCard());
      container.appendChild(add);
    }
  }

  function toast(msg, isError) {
    if (window.SBApp && window.SBApp.toast) window.SBApp.toast(msg, isError);
  }

  const api = { SCHEMAS, renderForm, renderSyncForm, renderControllerCards, CONTROLLER_CARDS, unitToJson, unitFromJson, colorToHex, hexToColor, NOTE_FILL_LABELS, EASING_OPTIONS, MULTI_VALUE, showFieldTip, hideFieldTip };
  window.SBSchema = api;
})();
