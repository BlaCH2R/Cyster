(() => {
  const __t = (s) => (window.SBi18n ? window.SBi18n.t(s) : s);
  const SB = window.SBEngine;
  const Schema = window.SBSchema;
  const TimelineMod = window.SBTimeline;

  const TYPE_GROUPS = {
    sprite: 'sprites', text: 'texts', video: 'videos', line: 'lines',
    controller: 'controllers', note_controller: 'note_controllers'
  };
  const GROUP_TYPES = {
    sprites: 'sprite', texts: 'text', videos: 'video', lines: 'line',
    controllers: 'controller', note_controllers: 'note_controller'
  };

  // Solid-color (currentColor) SVG icons replacing emoji everywhere.
  function svgIcon(name, size, inline) {
    const s = size || 14;
    const style = inline
      ? 'display:inline-block;vertical-align:-2px;margin:0 4px'
      : 'display:block;margin:auto';
    const box = (view, body) =>
      `<svg viewBox="${view}" width="${s}" height="${s}" style="${style}" aria-hidden="true">${body}</svg>`;
    const v16 = (body) => box('0 0 16 16', body);
    const v24 = (body) => box('0 0 24 24', body);
    const icons = {
      play: v16('<path fill="currentColor" d="M4 2l10 6-10 6z"/>'),
      pause: v16('<path fill="currentColor" d="M4 2h3v12H4zM9 2h3v12H9z"/>'),
      prev: v16('<path fill="currentColor" d="M4 2h2v12H4zM15 3.2 7.5 8l7.5 4.8z"/>'),
      next: v16('<path fill="currentColor" d="M10 2h2v12h-2zM1 3.2 8.5 8 1 12.8z"/>'),
      magnifier: v16('<circle cx="7" cy="7" r="4.2" fill="none" stroke="currentColor" stroke-width="1.6"/><line x1="10.3" y1="10.3" x2="14" y2="14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>'),
      fullscreen: v16('<path fill="none" stroke="currentColor" stroke-width="1.6" d="M3 6V3h3M10 3h3v3M13 10v3h-3M6 13H3v-3"/>'),
      reset: v24('<path fill="currentColor" d="M17.65 6.35A7.95 7.95 0 1 0 19.73 14h-2.08A5.99 5.99 0 1 1 12 6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>'),
      eye: v16('<path fill="none" stroke="currentColor" stroke-width="1.4" d="M1.5 8S4.5 3.5 8 3.5 14.5 8 14.5 8 11.5 12.5 8 12.5 1.5 8 1.5 8z"/><circle cx="8" cy="8" r="2.2" fill="currentColor"/>'),
      eyeOff: v16('<path fill="none" stroke="currentColor" stroke-width="1.4" d="M1.5 8S4.5 3.5 8 3.5 14.5 8 14.5 8 11.5 12.5 8 12.5 1.5 8 1.5 8z"/><circle cx="8" cy="8" r="2.2" fill="currentColor"/><line x1="2" y1="14" x2="14" y2="2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>'),
      lock: v16('<rect x="4" y="7" width="8" height="6.5" rx="1.2" fill="currentColor"/><path fill="none" stroke="currentColor" stroke-width="1.5" d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2"/>'),
      unlock: v16('<rect x="4" y="7" width="8" height="6.5" rx="1.2" fill="currentColor"/><path fill="none" stroke="currentColor" stroke-width="1.5" d="M5.5 7V5.5a2.5 2.5 0 0 1 4.9-.6"/>'),
      music: v16('<path fill="currentColor" d="M6.5 2.5V11A2.5 2.5 0 1 0 8.5 13.5V5.2l6-1.2v6.3A2.5 2.5 0 1 0 16 12.5V1.5z"/>'),
      file: v16('<path fill="currentColor" d="M4 1h5.5L13 4.5V15H4z"/><path fill="rgba(0,0,0,.22)" d="M9 1v4h4z"/>'),
      folder: v16('<path fill="currentColor" d="M1.5 3h5l1.5 2.2H14.5V13H1.5z"/>'),
      logo: v16('<path fill="currentColor" d="M8 1.2 14.8 8 8 14.8 1.2 8z"/>'),
      plus: v16('<path fill="currentColor" d="M7.5 2h1v5.5H14v1H8.5V14h-1V8.5H2v-1h5.5z"/>'),
      close: v16('<path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" d="M3.2 3.2l9.6 9.6M12.8 3.2L3.2 12.8"/>'),
      chevronDown: v16('<path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" d="M3.5 6 8 10.5 12.5 6"/>'),
      chevronRight: v16('<path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" d="M6 3.5 10.5 8 6 12.5"/>'),
    };
    return icons[name] || '';
  }
  window.svgIcon = svgIcon;

  const state = {
    level: null,
    levelDir: null,
    projectPath: null,
    projectConfig: null,
    chartText: null,
    chartPath: null,
    chart: null,
    musicPath: null,
    storyboard: null,       // raw editable JSON
    storyboardFileName: null,
    files: [],
    manualImages: [],
    manualSizes: {},        // library entry path -> file size
    playing: false,
    selectedObjId: null,
    selectedKeyIdx: null,   // -1 = initial state
    selectedIds: [],        // multi-selected object ids
    selectedKfs: [],        // multi-selected keyframes [{objId,index}]
    selectedLane: null,     // 合并轨道空白处点击：属性面板显示轨道统计（跳转/预览）
    selectedNoteId: null,   // note context for expanded per-note entries
    pendingNote: null,      // clicked note awaiting a note_controller (created on first edit)
    controllerCards: {},    // controllerId -> [cardKey]（该轨道启用的属性卡片，.ctr 持久化）
    noteSelectorMerge: {},  // note_controllerId -> true（选择器子时间块合并为特殊时间块）
    noteSelectorMeta: {},   // 选择器控制器元数据（note 选择器 + $note 时间令牌，.ctr 持久化）
    nsMode: null,           // 独立选择器窗口当前模式：'note'（绑定 Note 输入框）/ 'time'（时间写入）
    parentCarriers: {},     // note_controllerId -> true（$note parent_id 纯 ID 载体，.ctr 持久化）
    selectedKfExpression: null, // 选中以 $note 表达式分组的关键帧（编辑应用到全部同表达式关键帧）
    notePickerActive: false,    // 选择器手动拾取 note 模式
    nsWindowOpen: false,        // note 选择器外部窗口是否打开（打开时无选择器的 stage 对象也显示 Note 输入框）
    chartNoteSig: null,         // 当前谱面的音符签名（start/end/intro/type），用于变更对比
    chartShiftedNotes: new Set(), // 相对旧谱面“同一 ID 但时间/类型错位”的 note id 集合
    nsTimeTarget: null,         // { objId, isK0, frame } 选择器浮窗写入时间的对象帧
    previewEmptyFocus: false, // 预览空白处点击：属性面板显示 controller 实时统计 + 全部卡片
    noteInMergedBlock: null,  // { noteId, blockId }：右键 note 进入其所在合并时间块的整体属性编辑
    keyframesCollapsed: false,
    pickMode: 'note',       // preview left-click selection layer
    lockedIds: new Set(),   // objects excluded from direct (preview) selection
    dirty: false,
    lastSavedAt: null,      // 最后一次保存发生的时间（关闭确认提示用）
    settings: {},
    audioReady: false,
    audioDuration: null,
    volume: 1,
    kfClipboard: [],        // copied keyframes [{objId, time, state}]
    objClipboard: [],       // copied objects [{type, group, obj}]
    propsOnKeyframe: true,  // properties panel shows an editable keyframe (false = read-only interpolation)
    propsExplicitKf: false, // a keyframe was explicitly clicked: show it editable regardless of playhead
    objHidden: {},          // raw object id -> true (hidden in preview)
    groupHidden: {},        // storyboard group key -> true (whole category hidden)
    autoMovedIds: new Set(), // 被自动移动/排序的时间块：临时明黄高亮，下次点击消失
    previewFocused: false,  // 鼠标位于预览画面内（Shift / CapsLock 快捷键生效条件）
    undoStack: [],
    redoStack: []
  };

  const $ = (sel) => document.querySelector(sel);
  const els = {};

  const preview = new window.SBPreview.PreviewRenderer($('#previewCanvas'));
  const timeline = new TimelineMod.Timeline($('#timeline'), {
    onScrub: (t) => {
      setTime(t, false);
    },
    onScrubStart: () => {},
    onScrubEnd: () => {},
    onSelectObject: (id, keyIdx) => selectObject(id, keyIdx),
    onSelectKeyframe: (id, keyIdx, time) => selectKeyframe(id, keyIdx, time),
    onSelectionChange: (sel) => {
      state.selectedIds = sel.ids || [];
      state.selectedKfs = sel.kfs || [];
      renderObjectTree();
      renderProperties();
    },
    onMoveKeyframe: (id, kfIdx, newTime) => moveKeyframe(id, kfIdx, newTime),
    onMoveKeyframes: (items, delta) => moveKeyframes(items, delta),
    onKeyframeDragEnd: () => {
      // Dragging a keyframe can leave obj.states out of chronological order;
      // re-sort (indexes inside the timeline are rebuilt by renderTimeline).
      sortAllObjectStates();
      // 拖动关键帧也可能触发“挤开”：结束时恢复未被占用的原位。
      finalizeLanePushes();
      state.dirty = true;
      renderTimeline();
      renderProperties();
      requestRender();
    },
    onShiftClip: (id, delta) => shiftClip(id, delta),
    onShiftClips: (ids, delta) => shiftClips(ids, delta),
    onResizeClip: (id, side, newTime) => resizeClip(id, side, newTime),
    onTracksOrganized: (lanes) => organizeStageTracks(lanes),
    onOrderLockChange: (orders) => saveLockedOrders(orders),
    onReorderLive: (id, group, laneIndex) => reorderObjectLane(id, group, laneIndex, true),
    onReorderClip: (id, group, laneIndex) => reorderObjectLane(id, group, laneIndex),
    onLaneInfoClick: (laneObjs) => showLaneInfo(laneObjs),
    onMarqueeSelect: (sel, append) => {
      const clipIds = sel.clipIds || [];
      const kfs = sel.kfs || [];
      const ids = clipIds.slice();
      for (const kf of kfs) if (!ids.includes(kf.objId)) ids.push(kf.objId);
      if (append) {
        for (const id of ids) if (!state.selectedIds.includes(id)) state.selectedIds.push(id);
      } else {
        state.selectedIds = ids;
        state.selectedObjId = ids.length && !isNoteEntry(ids[ids.length - 1]) ? ids[ids.length - 1] : null;
        state.selectedKeyIdx = -1;
      }
      state.selectedKfs = kfs.map((k) => ({ objId: k.objId, index: k.index }));
      state.propsExplicitKf = false;
      state.pendingNote = null;
      state.previewEmptyFocus = false;
      // 框选（含关键帧）后退出“合并轨道信息 / controller 实时统计”视图，
      // 让属性界面跳到关键帧/对象编辑。
      state.selectedLane = null;
      renderObjectTree();
      renderProperties();
      timeline.setMultiSelection({ ids: state.selectedIds, kfs: state.selectedKfs });
      updatePreviewHighlight();
    },
    loadThumbnail: (path, cb) => loadThumbnail(path, cb),
    onDragStart: (ids) => {
      snapshot();
      captureLanePushState(ids);
    },
    onDragEnd: () => finalizeLanePushes(),
    onControllerCardDrop: (payload) => addControllerCardAtTime(payload),
    onZoom: () => {},
    onVolume: (v) => {
      state.volume = v;
      if (preview.audio) preview.audio.volume = v;
      // Remember the volume so the next launch does not start at full volume.
      state.settings.volume = v;
      window.sbAPI.setSettings(state.settings).catch(() => {});
    },
    onObjectContextMenu: (id, x, y) => {
      showContextMenu(x, y, [
        { label: '上移一层', action: () => shiftObjectOrder(id, -1) },
        { label: '下移一层', action: () => shiftObjectOrder(id, 1) },
        { label: '在播放头添加关键帧', action: () => addKeyframeToSelectedObjects(id) },
        { label: '复制对象（绝对时间）', action: () => copySelection(false, id) },
        { label: '复制对象（相对播放头）', action: () => copySelection(true, id) },
        { label: '删除对象', action: () => deleteSelection(id), danger: true }
      ]);
    },
    onSelectAllKeyframes: (id) => selectAllKeyframes(id),
    onKeyframeContextMenu: (id, kfIdx, kfTime, x, y) => {
      // Keep an existing multi-selection when the clicked keyframe is part of
      // it, so "复制关键帧" copies the whole selection.
      const rid = splitEntryId(id).rawId;
      const inSel = (state.selectedKfs || []).some((k) => splitEntryId(k.objId).rawId === rid && k.index === kfIdx);
      if (!inSel) selectKeyframe(id, kfIdx, kfTime);
      // Keep the floating detail window hidden while the menu is open so the
      // two never overlap; hideContextMenu() restores it afterwards.
      timeline.suppressKfTooltip(true);
      const items = [
        { label: '复制关键帧', action: () => copyKeyframesToClipboard() },
        { label: '粘贴关键帧至播放头位置', action: () => pasteKeyframesAtPlayhead() }
      ];
      const selCount = (state.selectedKfs || []).length;
      if (selCount > 1) {
        items.push({
          label: __t('删除选中的 ') + selCount + __t(' 个关键帧'),
          action: () => deleteSelection(),
          danger: true
        });
      } else if (kfIdx >= 0) {
        items.push({ label: '删除关键帧', action: () => deleteKeyframeOnly(id, kfIdx), danger: true });
      } else {
        items.push({ label: '删除关键帧', action: () => deleteKeyframeOnly(id, kfIdx), danger: true });
      }
      showContextMenu(x, y, items);
    },
    onTimelineContextMenu: (x, y) => {
      showContextMenu(x, y, [
        { label: '为选中对象添加关键帧', action: () => addKeyframeToSelectedObjects() },
        { label: '粘贴关键帧至播放头位置', action: () => pasteKeyframesAtPlayhead() }
      ]);
    },
    onToggleVisibility: (ids) => toggleObjectsVisibility(ids),
    isObjHidden: (id) => isObjHiddenState(id),
    isLocked: (id) => isLocked(id),
    isAutoMoved: (id) => !!(state.autoMovedIds && state.autoMovedIds.has(splitEntryId(id).rawId)),
    onToggleLock: (id) => toggleLock(id),
    isCategoryLocked: (kind) => isCategoryLocked(kind),
    onToggleCategoryLock: (kind) => toggleCategoryLock(kind),
    onToggleGroupVisibility: (type) => {
      if (type === 'stage') {
        const groups = ['sprites', 'texts', 'videos', 'lines'];
        const anyVisible = groups.some((g) => isGroupVisible(g));
        state.groupHidden = state.groupHidden || {};
        for (const g of groups) state.groupHidden[g] = anyVisible;
        persistProjectState();
        applyVisibility();
        renderObjectAddPanel();
        renderTimeline();
        requestRender();
      } else {
        const group = TYPE_GROUPS[type];
        if (group) toggleGroupVisibility(group);
      }
    },
    isGroupHidden: (type) => {
      if (type === 'stage') return ['sprites', 'texts', 'videos', 'lines'].every((g) => !isGroupVisible(g));
      const group = TYPE_GROUPS[type];
      return group ? !isGroupVisible(group) : false;
    }
  });

  window.SBApp = {
    toast: (msg, isError) => toast(msg, isError),
    assetOptions: (filter) => {
      const paths = [];
      const push = (p) => { if (p && !paths.includes(p)) paths.push(p); };
      for (const f of state.files || []) push(f.name);
      for (const p of state.manualImages || []) push(p);
      const sb = state.storyboard || {};
      for (const o of [...(sb.sprites || []), ...(sb.videos || [])]) {
        if (o && o.path) push(o.path);
        for (const st of (o && o.states) || []) if (st && st.path) push(st.path);
      }
      const filtered = paths.filter((n) => !filter || filter.includes(String(n).split('.').pop().toLowerCase()));
      const labels = assetDisplayLabels(filtered);
      return filtered.map((value, i) => ({ value, label: labels[i] }));
    }
  };

  // Asset library paths: entries may live inside the level (relative paths)
  // or be referenced in place from anywhere (absolute paths, no copies).
  // Same-basename entries get display labels like "a.png" / "a (1).png" while
  // the storyboard's `path` fields keep the real file identity.
  function isAbsPath(p) {
    const s = String(p || '');
    return /^[A-Za-z]:[\\/]/.test(s) || s.startsWith('//') || s.startsWith('/');
  }
  function resolveAssetPath(p) {
    const s = String(p || '').replace(/\\/g, '/');
    if (!s) return '';
    if (isAbsPath(s)) return s;
    return (state.levelDir || '').replace(/\\/g, '/') + '/' + s;
  }
  function assetBasename(p) {
    return String(p || '').split('/').pop() || '';
  }
  // First occurrence of a basename keeps its plain name; later duplicates get
  // " (1)", " (2)", ... before the extension (display-only).
  function assetDisplayLabels(paths) {
    const counts = new Map();
    return paths.map((p) => {
      const base = assetBasename(p);
      const key = base.toLowerCase();
      const n = (counts.get(key) || 0) + 1;
      counts.set(key, n);
      if (n === 1) return base;
      return base.replace(/(\.[^.\\/]+)?$/, (m) => ` (${n - 1})${m || ''}`);
    });
  }

  // Sample-accurate music playback via Web Audio (no HTMLAudioElement latency/drift)
  class MusicPlayer {
    constructor() {
      this.ctx = null;
      this.buffer = null;
      this.source = null;
      this.gain = null;
      this.ready = false;
      this.duration = null;
      this.playing = false;
      this.startCtxTime = 0;
      this.startOffset = 0;
      this.pausedAt = 0;
      this._volume = 1;
    }

    ensureCtx() {
      if (!this.ctx) {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      }
      return this.ctx;
    }

    async load(arrayBuffer) {
      const ctx = this.ensureCtx();
      this.buffer = await ctx.decodeAudioData(arrayBuffer);
      this.duration = this.buffer.duration;
      this.ready = true;
      this.pausedAt = 0;
    }

    async play(fromTime) {
      const ctx = this.ensureCtx();
      if (ctx.state === 'suspended') await ctx.resume();
      if (this.source) {
        try { this.source.stop(); } catch (e) {}
        this.source = null;
      }
      const src = ctx.createBufferSource();
      src.buffer = this.buffer;
      if (!this.gain) {
        this.gain = ctx.createGain();
        this.gain.gain.value = this._volume;
        this.gain.connect(ctx.destination);
      }
      src.connect(this.gain);
      const offset = Math.max(0, Math.min(this.buffer.duration - 0.001, fromTime || 0));
      this.startCtxTime = ctx.currentTime;
      this.startOffset = offset;
      src.start(0, offset);
      this.source = src;
      this.playing = true;
      src.onended = () => {
        if (this.source === src) {
          this.source = null;
          this.playing = false;
          this.pausedAt = this.buffer ? this.buffer.duration : this.pausedAt;
        }
      };
    }

    set volume(v) {
      this._volume = Math.min(1, Math.max(0, v));
      if (this.gain && this.ctx) {
        try { this.gain.gain.value = this._volume; } catch (e) {}
      }
    }

    get volume() {
      return this._volume;
    }

    pause() {
      if (this.source) {
        try { this.source.stop(); } catch (e) {}
        this.source = null;
      }
      if (this.playing) this.pausedAt = this.getTime();
      this.playing = false;
    }

    getTime() {
      if (!this.playing || !this.ctx) return this.pausedAt;
      return this.startOffset + (this.ctx.currentTime - this.startCtxTime);
    }

    get currentTime() {
      return this.getTime();
    }

    set currentTime(t) {
      if (this.playing) this.play(t);
      else this.pausedAt = Math.max(0, t);
    }
  }

  function toast(msg, isError) {
    if (window.SBi18n) msg = window.SBi18n.t(msg);
    const wrap = $('#toastWrap');
    const t = document.createElement('div');
    t.className = 'toast' + (isError ? ' error' : '');
    t.textContent = msg;
    wrap.appendChild(t);
    setTimeout(() => t.remove(), 3200);
  }

  // Undo/redo history: snapshot the storyboard before a discrete edit.
  function snapshot() {
    if (!state.storyboard) return;
    // Cyster 时间轴数据在 .ctr（projectConfig.editor）里，撤销时一并恢复。
    state.undoStack.push(JSON.stringify({
      sb: state.storyboard,
      cc: state.controllerCards || {},
      ed: (state.projectConfig && state.projectConfig.editor) || null
    }));
    if (state.undoStack.length > 120) state.undoStack.shift();
    state.redoStack = [];
  }

  // 撤销/重做提示用：对比前后快照自动生成“做了什么”的描述文本，
  // 无需在每个编辑点手工传描述。before/after 均为 { sb, cc, ed }。
  const EDIT_GROUP_LABEL = {
    sprites: 'Sprite', texts: 'Text', videos: 'Video', lines: 'Line',
    controllers: 'Controller', note_controllers: 'NoteCtrl'
  };
  const EDIT_GROUPS = ['sprites', 'texts', 'videos', 'lines', 'controllers', 'note_controllers'];

  function describeEditChange(before, after) {
    if (!before || !after) return null;
    const added = [];
    const removed = [];
    for (const g of EDIT_GROUPS) {
      const b = new Set((before[g] || []).map((o) => String(o && o.id)).filter(Boolean));
      for (const o of after[g] || []) if (o && o.id != null && !b.has(String(o.id))) added.push({ g, id: String(o.id) });
      const a = new Set((after[g] || []).map((o) => String(o && o.id)).filter(Boolean));
      for (const o of before[g] || []) if (o && o.id != null && !a.has(String(o.id))) removed.push({ g, id: String(o.id) });
    }
    const i18n = window.SBi18n || { t: (s) => s, paren: (s) => '（' + s + '）' };
    const t = (s) => i18n.t(s);
    const paren = (s) => i18n.paren(s);
    const listStr = (arr) => arr.slice(0, 3).map((x) => x.id).join('、') + (arr.length > 3 ? t(' 等') : '');
    const one = (arr, verb) => t(verb) + (EDIT_GROUP_LABEL[arr[0].g] || t('对象')) + paren(arr[0].id);
    const many = (arr, verb) => t(verb) + ' ' + arr.length + ' ' + t('个对象') + paren(listStr(arr));
    if (added.length && removed.length) {
      return t('添加') + ' ' + added.length + ' ' + t('个对象') + '、' + t('删除') + ' ' + removed.length + ' ' + t('个对象');
    }
    if (added.length === 1) return one(added, '添加');
    if (added.length > 1) return many(added, '添加');
    if (removed.length === 1) return one(removed, '删除');
    if (removed.length > 1) return many(removed, '删除');

    // 无增删：逐对象对比，优先识别“仅关键帧数量变化”的添加/删除关键帧。
    let modified = 0;
    let kfDelta = 0;
    const modSample = [];
    for (const g of EDIT_GROUPS) {
      const bm = new Map((before[g] || []).map((o) => [String(o.id), o]));
      for (const o of after[g] || []) {
        const b = bm.get(String(o.id));
        if (!b || JSON.stringify(b) === JSON.stringify(o)) continue;
        modified++;
        if (modSample.length < 3) modSample.push({ g, id: String(o.id) });
        const strip = (x) => { const c = Object.assign({}, x); delete c.states; return JSON.stringify(c); };
        if (strip(b) === strip(o)) kfDelta += (o.states || []).length - (b.states || []).length;
        else kfDelta = 0; // 除关键帧外还有其它属性变化，归为“修改”
      }
    }
    if (modified === 1) {
      const { g, id } = modSample[0];
      const label = EDIT_GROUP_LABEL[g] || '对象';
      if (kfDelta > 0) return t('添加关键帧：') + label + paren(id);
      if (kfDelta < 0) return t('删除关键帧：') + label + paren(id);
      return t('修改：') + label + paren(id);
    }
    if (modified > 1) return t('修改') + ' ' + modified + ' ' + t('个对象的属性/关键帧');
    return null;
  }

  function describeUndoRedo(before, after) {
    if (!before || !after) return null;
    const d = describeEditChange(before.sb, after.sb);
    if (d) return d;
    const t = (s) => (window.SBi18n ? window.SBi18n.t(s) : s);
    if (JSON.stringify(before.ed || null) !== JSON.stringify(after.ed || null)) return t('调整轨道布局/顺序');
    if (JSON.stringify(before.cc || null) !== JSON.stringify(after.cc || null)) return t('修改 Controller 属性卡片');
    return null;
  }

  function undo() {
    if (!state.undoStack.length) { toast('没有可撤销的操作', true); return; }
    const snap = JSON.parse(state.undoStack.pop());
    const desc = describeUndoRedo(
      { sb: snap.sb, ed: snap.ed, cc: snap.cc },
      { sb: state.storyboard, ed: (state.projectConfig && state.projectConfig.editor) || null, cc: state.controllerCards || {} }
    );
    state.redoStack.push(JSON.stringify({
      sb: state.storyboard,
      cc: state.controllerCards || {},
      ed: (state.projectConfig && state.projectConfig.editor) || null
    }));
    state.storyboard = snap.sb;
    state.controllerCards = snap.cc || {};
    if (state.projectConfig) state.projectConfig.editor = snap.ed || {};
    state.dirty = true;
    if (preview.chart) preview.setStoryboard(state.storyboard);
    renderObjectTree();
    renderTimeline();
    renderProperties();
    requestRender();
    // 撤销要真正生效：把恢复后的轨道布局与层级写回 .ctr / storyboard 文件，
    // 避免只是视觉恢复、重开后仍是整理后的状态。
    persistAfterUndo();
    toast((window.SBi18n ? window.SBi18n.t('已撤销：') : '已撤销：') + (desc || (window.SBi18n ? window.SBi18n.t('上一步操作') : '上一步操作')));
  }

  function redo() {
    if (!state.redoStack.length) { toast('没有可重做的操作', true); return; }
    const snap = JSON.parse(state.redoStack.pop());
    const desc = describeUndoRedo(
      { sb: state.storyboard, ed: (state.projectConfig && state.projectConfig.editor) || null, cc: state.controllerCards || {} },
      { sb: snap.sb, ed: snap.ed, cc: snap.cc }
    );
    state.undoStack.push(JSON.stringify({
      sb: state.storyboard,
      cc: state.controllerCards || {},
      ed: (state.projectConfig && state.projectConfig.editor) || null
    }));
    state.storyboard = snap.sb;
    state.controllerCards = snap.cc || {};
    if (state.projectConfig) state.projectConfig.editor = snap.ed || {};
    state.dirty = true;
    if (preview.chart) preview.setStoryboard(state.storyboard);
    renderObjectTree();
    renderTimeline();
    renderProperties();
    requestRender();
    persistAfterUndo();
    toast((window.SBi18n ? window.SBi18n.t('已重做：') : '已重做：') + (desc || (window.SBi18n ? window.SBi18n.t('下一步操作') : '下一步操作')));
  }

  function showContextMenu(x, y, items) {
    const menu = $('#contextMenu');
    menu.innerHTML = '';
    for (const it of items) {
      if (it.sep) {
        const sep = document.createElement('div');
        sep.className = 'cm-sep';
        menu.appendChild(sep);
        continue;
      }
      const el = document.createElement('div');
      el.className = 'cm-item' + (it.danger ? ' danger' : '');
      el.textContent = __t(it.label);
      el.addEventListener('click', () => {
        hideContextMenu();
        if (it.action) it.action();
      });
      menu.appendChild(el);
    }
    menu.classList.remove('hidden');
    const r = menu.getBoundingClientRect();
    menu.style.left = Math.min(window.innerWidth - r.width - 6, Math.max(6, x)) + 'px';
    menu.style.top = Math.min(window.innerHeight - r.height - 6, Math.max(6, y)) + 'px';
  }

  function hideContextMenu() {
    $('#contextMenu').classList.add('hidden');
    if (timeline) timeline.suppressKfTooltip(false);
  }

  function fmtTime(t) {
    return TimelineMod.fmtTime(t);
  }

  // ---------------------------------------------------------------
  // Level / storyboard loading
  // ---------------------------------------------------------------
  // 预览窗口比例解析与读取（视图菜单切换，默认 16:9；顶层定义供加载时使用）。
  function parsePreviewRatio(s) {
    const m = /^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/.exec(String(s || '').trim());
    return m ? Number(m[1]) / Number(m[2]) : 16 / 9;
  }
  function currentPreviewRatio() {
    return (state.settings && state.settings.previewRatio) || 16 / 9;
  }

  async function loadLevelInfo(info, meta) {
    state.level = info.level;
    state.levelDir = info.levelDir;
    state.projectPath = meta && meta.projectPath ? meta.projectPath : null;
    state.projectConfig = meta && meta.config ? meta.config : null;
    state.files = info.files;
    state.levelCharts = info.charts;
    state.chartText = null;
    state.chart = null;
    state.storyboard = null;
    state.storyboardFileName = null;
    state.selectedObjId = null;
    state.selectedKeyIdx = null;
    state.pendingNote = null;
    state.controllerCards = {};
    state.noteSelectorMerge = {};
    state.noteSelectorMeta = {};
    state.parentCarriers = {};
    state.selectedKfExpression = null;
    state.notePickerActive = false;
    state.nsTimeTarget = null;
    state.chartNoteSig = null;
    state.chartShiftedNotes = new Set();
    state.previewEmptyFocus = false;
    state.noteInMergedBlock = null;
    state.objHidden = {};
    state.groupHidden = {};
    state.manualImages = [];
    state.lockedIds = new Set();
    state.tagCollapsed = {};
    state.propsExplicitKf = false;
    state.undoStack = [];
    state.redoStack = [];
    state.playing = false;
    applyEditorState(state.projectConfig && state.projectConfig.editor);
    hideWelcome();
    if (state.projectPath) addRecentProject(state.projectPath);

    // The .cytoidlevel import flow (which always creates a brand-new project)
    // offers a "read the existing StoryBoard" toggle per difficulty. Opening an
    // existing project never shows that toggle: the project's configured
    // storyboard file is authoritative there.
    const isImportLevel = meta && meta.mode === 'import-level';
    let picked;
    if (meta && meta.mode === 'reload-level') {
      // 关卡设置保存后的静默重载：直接选回刚才编辑的难度，不再弹出难度选择框。
      const charts = info.charts || [];
      let chart = null;
      if (meta.reloadIndex != null && charts[meta.reloadIndex]) chart = charts[meta.reloadIndex];
      else if (meta.reloadChartPath) chart = charts.find((c) => c.path === meta.reloadChartPath) || null;
      if (!chart) chart = charts[0] || null;
      picked = chart ? { chart, readStoryboard: !!(chart.storyboardContent || chart.storyboardPath) } : null;
    } else {
      picked = await chooseChart(info.charts, isImportLevel);
    }
    if (!picked || !picked.chart) {
      // The user cancelled the difficulty selection: return to the welcome page.
      showWelcome();
      return;
    }
    const chart = picked.chart;
    await applyPickedChart(chart, picked.readStoryboard === true, isImportLevel);

  }
  // Apply a chosen difficulty to the current session: chart + music + that
  // difficulty's own storyboard (empty if it has none), and keep the project
  // config in sync so another difficulty never reuses this one's storyboard.
  async function applyPickedChart(chart, readStoryboard, isImportLevel) {
    if (state.projectPath) {
      try {
        const sbName = (readStoryboard && chart.storyboardPath) ? chart.storyboardPath : null;
        const res = await window.sbAPI.projectSetEditable({ projectPath: state.projectPath, chart: chart.path, storyboard: sbName });
        if (res) {
          state.projectPath = res.projectPath || state.projectPath;
          state.projectConfig = res.config || state.projectConfig;
        }
      } catch (e) {
        toast(__t('分配 StoryBoard 到该难度失败: ') + e.message, true);
      }
    }
    state.chartPath = chart.path;
    state.musicPath = chart.musicOverride || (state.level && state.level.music && state.level.music.path) || null;
    state.storyboard = null;
    state.storyboardFileName = null;
    if (chart && chart.content) {
      state.chartText = chart.content;
      try {
        state.chart = new SB.chart.Chart(chart.content, { screenRatio: currentPreviewRatio() });
      } catch (e) {
        toast(__t('谱面解析失败: ') + e.message, true);
      }
      if (isImportLevel) {
        // Importing a .cytoidlevel: read the picked difficulty's StoryBoard
        // only when the user enabled "读取已有的storyboard".
        if (readStoryboard && chart.storyboardContent) {
          state.storyboard = parseStoryboardContent(chart.storyboardContent) || { sprites: [], texts: [], videos: [], lines: [], controllers: [], note_controllers: [] };
          state.storyboardFileName = chart.storyboardPath;
        }
      } else if (chart.storyboardContent) {
        // Opening/switching a project: load the PICKED difficulty's own
        // storyboard; another difficulty never reuses the last one's.
        state.storyboard = parseStoryboardContent(chart.storyboardContent) || { sprites: [], texts: [], videos: [], lines: [], controllers: [], note_controllers: [] };
        state.storyboardFileName = chart.storyboardPath;
      }
      if (readStoryboard && !state.storyboard && chart.storyboardContent) {
        // Fallback: the picked difficulty still ships a StoryBoard file.
        state.storyboard = parseStoryboardContent(chart.storyboardContent) || { sprites: [], texts: [], videos: [], lines: [], controllers: [], note_controllers: [] };
        state.storyboardFileName = chart.storyboardPath;
      }
    }
    if (!state.storyboard) newStoryboard();
    // 多难度独立：加载/切换难度时，把内存中的独特功能元数据重置为当前难度
    // 分桶里的那一份（旧版平铺数据按“当前可编辑难度”兼容迁移）。
    applyDifficultyEditorState();
    // 谱面变更对比：以当前难度分桶记录的上一次签名（保存时写入）为基准，
    // 计算“同一 ID 时间/类型错位”的 note 集合（缺失 ID 由 noteMappingLost
    // 另判）；随后把当前谱面签名作为新基准（保存时写回分桶）。
    const bucketSig = difficultyBucketRead() && difficultyBucketRead().chartNoteSig;
    // 基准只取当前项目/难度的分桶签名：避免跨项目/跨难度切换时把上一份谱面
    // 的签名拿来对比，造成假的“谱面变更检测”。
    const prevSig = bucketSig || null;
    state.chartShiftedNotes = computeChartShiftedNotes(prevSig);
    state.chartNoteSig = noteSigFromChart(state.chart);
    // .ctr 里记录的时间表达式：导出 storyboard 时时间已是绝对数值，这里按
    // 项目文件还原成 $note 表达式显示，方便后续编辑。
    const diffEd = difficultyBucketRead();
    if (diffEd && diffEd.noteTimeTokens) {
      applyNoteTimeTokens(state.storyboard, diffEd.noteTimeTokens);
    }
    // 还原 note 选择器控制器：把导出后展开的逐 note 克隆合并回选择器形态。
    if (state.noteSelectorMeta) {
      reconstructNoteSelectors(state.storyboard, state.noteSelectorMeta);
    }
    // 元数据缺失/损坏时自愈：把 id 形如 "前缀::note号" 的孤儿克隆重建为选择器。
    healOrphanSelectorClones(state.storyboard);
    // $note 父载体与引用对象的选择器重算同步：载体曾收缩（真实控制器接管）
    // 而真实控制器被删除后，直接保存会因 parent_id 不存在而失败。
    syncNoteSelectorCarriers();
    // 纯 ID 载体默认以合并时间块显示：旧数据没有合并标记时也补上，避免时间轴
    // 出现 parent_$note::0..N 一长串 per-note 条目。
    for (const nc of (state.storyboard && state.storyboard.note_controllers) || []) {
      if (nc && isParentCarrier(nc.id) && !state.noteSelectorMerge[nc.id]) {
        state.noteSelectorMerge[nc.id] = true;
      }
    }
    normalizeStoryboardIds();
    sortAllObjectStates();
    // 父/目标先于子，保证玩家端生成顺序合法。
    sortStageObjectsParentFirst();
    // 记录故事板文件的最后写入时间作为“最后一次保存”。
    const sbFile = (state.files || []).find((f) => f.name === state.storyboardFileName);
    state.lastSavedAt = sbFile && sbFile.mtimeMs ? new Date(sbFile.mtimeMs) : null;

    // 预览 canvasRatio 跟随选定的窗口比例，loadLevel 用其构造 chart。
    preview.canvasRatio = currentPreviewRatio();
    await preview.loadLevel(state.level, state.levelDir, state.chartText, state.storyboard);
    setupAudio();
    $('#previewEmpty').style.display = 'none';
    $('#previewHint').style.display = 'block';
    $('#previewHint').textContent = __t('模拟实时预览·实际效果以cytoid原生为准');
    const sbCount = state.storyboard
      ? Object.values(TYPE_GROUPS).reduce((n, g) => n + ((state.storyboard[g] || []).length), 0)
      : 0;
    const projName = state.projectConfig ? state.projectConfig.name : '';
    const levelTitle = state.level.title || 'Untitled';
    const shownTitle = projName && projName === levelTitle ? projName : (projName ? `${projName} · ${levelTitle}` : levelTitle);
    $('#statusBar').textContent = `${__t(shownTitle)} · ${__t('对象')} ${sbCount} · ${state.levelDir}`;
    state.dirty = false;
    setTime(0, false);
    refreshAll();
    // 谱面变更检测：原映射失效的 note 选择器/时间块给出提示（时间块与 Note
    // 输入框已标红），提示用户重新处理这些失效内容。
    const lostCount = scanLostNoteMappings();
    if (lostCount) {
      await confirmDialog('检测到谱面变更',
        `${lostCount} ${__t('个 note 选择器/时间块的原映射由于谱面发生变更而失效或受影响，请重新调整这些标红的note列表或调整选择器条件')}`,
        [{ label: '知道了', cls: 'primary' }]);
    }
    updateSwitchDifficultyState();
  }

  // Switch the current project to another difficulty: chart + music + that
  // difficulty's own storyboard (shows the empty storyboard UI if it has none).
  async function switchDifficultyFlow() {
    if (!state.levelCharts || state.levelCharts.length <= 1) { toast('该关卡没有其它难度', true); return; }
    const picked = await chooseChart(state.levelCharts, false);
    if (!picked || !picked.chart) return;
    await applyPickedChart(picked.chart, picked.readStoryboard === true, false);
    updateSwitchDifficultyState();
    toast(__t('已切换到难度: ') + (picked.chart.type || picked.chart.path));
  }

  // Enable/disable the "切换难度" menu item (only when more than one chart).
  function updateSwitchDifficultyState() {
    const entry = document.querySelector('.menu-entry[data-action="switch-difficulty"]');
    if (!entry) return;
    const hasMore = !!(state.levelCharts && state.levelCharts.length > 1);
    entry.classList.toggle('disabled', !hasMore);
  }

  function pickPrimaryChart(charts) {
    if (!charts || !charts.length) return null;
    const withSb = charts.filter((c) => c.storyboardContent || c.storyboardPath);
    const pool = withSb.length ? withSb : charts;
    const order = { extreme: 3, base: 2, hard: 1, easy: 0 };
    const score = (c) => {
      const type = String(c.type || '').toLowerCase();
      return ((order[type] != null ? order[type] : 1) * 1000) + (c.difficulty || 0);
    };
    return pool.slice().sort((a, b) => score(b) - score(a))[0];
  }

  function chooseChart(charts, showSbToggle) {
    if (!charts || !charts.length) return Promise.resolve(null);
    // A level is considered multi-difficulty when its level.json contains more
    // than one of the standard difficulty descriptions (easy / hard / extreme).
    const std = ['easy', 'hard', 'extreme'];
    const stdCount = charts.filter((c) => std.includes(String(c.type || '').toLowerCase())).length;
    const hasSb = (c) => !!(c && (c.storyboardContent || c.storyboardPath));
    if (charts.length <= 1 || stdCount <= 1) {
      const c = charts[0];
      return Promise.resolve({ chart: c, readStoryboard: hasSb(c) });
    }
    return new Promise((resolve) => {
      pendingChartResolve = resolve;
      const done = (v) => {
        pendingChartResolve = null;
        resolve(v);
      };
      const items = charts.map((c, i) => {
        const label = [c.type, c.name, c.difficulty != null ? __t('难度 ') + c.difficulty : '']
          .filter(Boolean)
          .join(' · ') + (c.musicOverride ? '（独立音乐）' : '');
        // Difficulties that ship with a storyboard get a right-aligned toggle
        // to decide whether to read the existing StoryBoard file.
        const toggle = showSbToggle && hasSb(c)
          ? `<label class="pick-sb" title="${__t('读取该难度已有的 StoryBoard 文件')}"><input type="checkbox" data-sb="${i}" checked /> ${__t('读取已有的Storyboard')}</label>`
          : '';
        return `<div class="pick-item" data-i="${i}"><span class="pick-label">${escapeHtml(label)}</span>${toggle}</div>`;
      }).join('');
      const body = `<div class="help-text">${__t('该关卡包含多个难度谱面，请选择要编辑的难度：')}</div><div class="pick-list">${items}</div>`;
      openModal('选择难度谱面', body, [{ label: '取消', cls: '' }], () => {
        // 取消：只关闭选择框；是否回欢迎页由调用方决定（初始加载无难度可选时
        // 才回欢迎页，编辑中切换难度取消应留在编辑器）。
        done(null);
      });
      document.querySelectorAll('#modalBody .pick-item').forEach((el) => {
        el.addEventListener('click', (e) => {
          if (e.target.closest('.pick-sb')) return; // toggle handled separately
          closeModal();
          const c = charts[parseInt(el.dataset.i, 10)];
          const cb = el.querySelector('input[type=checkbox]');
          done({ chart: c, readStoryboard: cb ? cb.checked : hasSb(c) });
        });
        const cb = el.querySelector('input[type=checkbox]');
        if (cb) cb.addEventListener('click', (ev) => ev.stopPropagation());
      });
    });
  }

  async function setupAudio() {
    state.audioReady = false;
    state.audioDuration = null;
    const musicPath = state.musicPath;
    if (!musicPath) return;
    try {
      const full = state.levelDir.replace(/\\/g, '/') + '/' + musicPath;
      const res = await window.sbAPI.readFileBuffer(full);
      const bytes = Uint8Array.from(atob(res.data), (c) => c.charCodeAt(0));
      const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
      const player = new MusicPlayer();
      await player.load(ab);
      // Apply the current volume immediately: a new player defaults to 100%
      // and must pick up the persisted slider value on project switch.
      player.volume = state.volume;
      state.audioReady = player.ready;
      state.audioDuration = player.duration;
      preview.audio = player;
      renderTimeline();
      toast('音乐已就绪（' + player.duration.toFixed(1) + 's）');
    } catch (e) {
      toast(__t('音乐加载失败: ') + e.message, true);
    }
  }

  function musicOffset() {
    // Auto offset read from the chart (Cytoid music_offset), applied during playback
    return (state.chart && state.chart.musicOffset) || 0;
  }

  function newStoryboard() {
    state.storyboard = {
      sprites: [], texts: [], videos: [], lines: [],
      controllers: [], note_controllers: [], templates: {}
    };
    if (!state.storyboardFileName) state.storyboardFileName = state.chart ? `storyboard_${state.chartText ? guessChartType() : 'base'}.json` : 'storyboard_base.json';
    state.dirty = true;
  }

  // Parse storyboard JSON; if it is a CytoidPlayer "compiled" storyboard
  // (fully resolved States / PascalCase fields / numeric easing / Unity
  // colors), convert it back into the editable lowercase format first.
  function parseStoryboardContent(content, opts) {
    const parsed = SB.json.parse(content);
    if (!parsed || typeof parsed !== 'object') return parsed;
    const looksCompiled = parsed.compiled === true ||
      (parsed.controllers && parsed.controllers[0] && parsed.controllers[0].States);
    // 全空 StoryBoard（新建未选择时生成的空白文件）没有可误读的内容，不提示。
    const isEmptySb = !['sprites', 'texts', 'videos', 'lines', 'controllers', 'note_controllers']
      .some((g) => Array.isArray(parsed[g]) && parsed[g].length);
    if (!looksCompiled && !isEmptySb && !(opts && opts.silent)) {
      confirmDialog('警告',
        '该 StoryBoard 不是 compiled格式，Cyster读取时可能出现错误/与原生效果不同，导出/保存时将转换为 compiled 格式',
        [{ label: '知道了', cls: 'primary' }]);
    }
    const sb = looksCompiled ? SB.storyboard.fromCompiled(parsed) : parsed;
    // Controllers with note selectors are split into one independent controller
    // per selected note right at read time, so editing one note's states never
    // affects the others (they no longer share the raw object).
    return expandControllerNoteSelectors(sb);
  }

  // Expand scene controllers that use note selectors ("note":[ids] / $note time
  // tokens) into separate per-note controller objects with absolute times.
  function expandControllerNoteSelectors(sb) {
    if (!sb || !Array.isArray(sb.controllers)) return sb;
    const out = [];
    for (const ctl of sb.controllers) {
      const states = Array.isArray(ctl.states) ? ctl.states : [];
      const hasSel = ctl.note != null || states.some((s) => s.note != null);
      if (!hasSel) { out.push(ctl); continue; }
      const noteIds = new Set();
      const collect = (tok) => {
        if (tok == null) return;
        if (Array.isArray(tok)) { tok.forEach(collect); return; }
        if (typeof tok === 'number') { noteIds.add(tok); return; }
        if (typeof tok === 'object') noteSelectorIds(tok).forEach((id) => noteIds.add(id));
      };
      if (ctl.note != null) collect(ctl.note);
      for (const s of states) collect(s.note);
      if (!noteIds.size) { out.push(ctl); continue; }
      const baseId = ctl.id || 'controller';
      for (const nid of noteIds) {
        const base = {};
        for (const k of Object.keys(ctl)) {
          if (k === 'note' || k === 'states' || k === 'id') continue;
          base[k] = ctl[k];
        }
        if (typeof base.time === 'string') {
          const rt = resolveTimeForNote(base.time, nid);
          if (rt != null) base.time = rt;
        } else if (Array.isArray(base.time)) {
          base.time = base.time.map((t) => (typeof t === 'string' ? (resolveTimeForNote(t, nid) != null ? resolveTimeForNote(t, nid) : t) : t));
        }
        const nc = { id: `${baseId}::n${nid}`, ...base, states: [] };
        for (const s of states) {
          if (!noteSelectorIncludes(s.note, nid)) continue;
          const ns = {};
          for (const k of Object.keys(s)) {
            if (k === 'note') continue;
            if (k === 'time') {
              if (Array.isArray(s.time)) {
                ns.time = s.time.map((t) => (typeof t === 'string' ? (resolveTimeForNote(t, nid) != null ? resolveTimeForNote(t, nid) : t) : t));
              } else if (typeof s.time === 'string') {
                const rt = resolveTimeForNote(s.time, nid);
                ns.time = rt != null ? rt : s.time;
              } else {
                ns.time = s.time;
              }
            } else {
              ns[k] = s[k];
            }
          }
          nc.states.push(ns);
        }
        out.push(nc);
      }
    }
    sb.controllers = out;
    return sb;
  }

  function normalizeStoryboardIds() {
    if (!state.storyboard) return;
    const counters = {};
    for (const [group, type] of Object.entries(GROUP_TYPES)) {
      const list = state.storyboard[group] || [];
      for (const obj of list) {
        if (obj.id == null || obj.id === '') {
          counters[type] = (counters[type] || 0) + 1;
          obj.id = `${type}_auto_${counters[type]}`;
        }
      }
    }
  }

  function guessChartType() {
    if (!state.chartText) return 'base';
    const m = /"type"\s*:\s*"([^"]+)"/.exec(state.chartText);
    return m ? m[1] : 'base';
  }

  function resolveTime(value) {
    if (value == null) return null;
    if (typeof value === 'number') return value;
    // Time arrays are expanded by the storyboard compiler; resolve them
    // element-by-element at the call sites instead of stringifying (which
    // produced garbage like "end:13,start:466:-0.3" -> note 13 + 466).
    if (typeof value !== 'string') return null;
    // 纯数字字符串直接解析（历史数据/粘贴进来的长小数可能以字符串形式落库，
    // 此前 resolveTime 返回 null 会让该关键帧从时间轴消失，形成“无关键帧时间块”）。
    const plain = String(value).trim();
    if (/^-?\d+(\.\d+)?$/.test(plain)) return roundTime(parseFloat(plain));
    const chart = state.chart;
    if (!chart) return null;
    const m = /^(start|end|intro|at):(.+?)(?::(.*))?$/.exec(String(value));
    if (!m) return null;
    let id = parseInt(m[2], 10);
    const off = m[3] ? parseFloat(m[3]) : 0;
    const note = chart.noteById(id);
    if (!note) return null;
    switch (m[1]) {
      case 'intro': return roundTime(note.intro_time + off);
      case 'start': return roundTime(note.start_time + off);
      case 'end': return roundTime(note.end_time + off);
      case 'at': return roundTime(note.start_time + (note.end_time - note.start_time) * off);
    }
    return null;
  }

  // Resolve a time token for rigid block translation. Literal "$note" inside
  // the token is substituted with the object's note id when available, so
  // note-referenced objects can be moved (the resolved value becomes absolute).
  function resolveShiftTime(token, noteId) {
    if (noteId != null && typeof token === 'string' && token.indexOf('$note') >= 0) {
      return resolveTime(token.replace(/\$note/g, String(noteId)));
    }
    return resolveTime(token);
  }

  // ---------------------------------------------------------------
  // Refresh everything
  // ---------------------------------------------------------------
  function refreshAll() {
    if (preview.chart) preview.setStoryboard(state.storyboard);
    applyVisibility();
    updatePreviewHighlight();
    renderAssetList();
    renderObjectAddPanel();
    renderObjectTree();
    renderTimeline();
    renderProperties();
    requestRender();
  }

  function requestRender() {
    preview.render();
  }

  function setTime(t, fromAudio) {
    const nt = Math.max(0, t);
    preview.setTime(nt);
    timeline.setTime(nt);
    $('#timeDisplay').textContent = fmtTime(nt);
    if (!fromAudio) {
      const audio = preview.audio;
      if (audio && !state.playing && state.audioReady && Math.abs(audio.currentTime - (nt - musicOffset())) > 0.1) {
        try { audio.currentTime = nt - musicOffset(); } catch (e) {}
      }
    }
    requestRender();
    refreshPropsIfNeeded();
  }

  // ---------------------------------------------------------------
  // Asset list
  // ---------------------------------------------------------------
  function renderAssetList() {
    const el = $('#assetList');
    el.innerHTML = '';
    // Images are added manually by the user; audio is not part of the asset
    // library anymore. Video is merged into the image category and uses the
    // same manual-add logic.
    // Files referenced by storyboard sprites/videos are auto-added to the
    // library (read-only entries); manually added files come first.
    const manual = state.manualImages || [];
    const refs = [];
    const collectRefs = (list) => {
      for (const o of list || []) {
        if (o && o.path && !manual.includes(o.path) && !refs.includes(o.path)) refs.push(o.path);
        for (const st of (o && o.states) || []) {
          if (st && st.path && !manual.includes(st.path) && !refs.includes(st.path)) refs.push(st.path);
        }
      }
    };
    collectRefs(state.storyboard && state.storyboard.sprites);
    collectRefs(state.storyboard && state.storyboard.videos);
    const fileSize = (name) => {
      const f = (state.files || []).find((x) => x.name === name);
      if (f) return f.size;
      return (state.manualSizes || {})[name] || 0;
    };
    const imgs = manual.map((name) => ({ name, size: fileSize(name), auto: false }))
      .concat(refs.map((name) => ({ name, size: fileSize(name), auto: true })));
    const labels = assetDisplayLabels(imgs.map((f) => f.name));
    imgs.forEach((f, i) => { f.display = labels[i]; });
    const addBtn = document.createElement('button');
    addBtn.className = 'mini-btn';
    addBtn.innerHTML = `${svgIcon('plus', 12, true)}添加素材`;
    addBtn.addEventListener('click', addImageToLibrary);
    el.appendChild(addBtn);
    if (!imgs.length) {
      const empty = document.createElement('div');
      empty.className = 'empty-panel';
      empty.textContent = __t('打开项目后，可通过“添加素材”把图片/视频加入素材库');
      el.appendChild(empty);
      return;
    }
    const section = (title, list, thumb) => {
      if (!list.length) return;
      const h = document.createElement('div');
      h.className = 'group-label';
      h.textContent = title + ' (' + list.length + ')';
      el.appendChild(h);
      for (const f of list) {
        const item = document.createElement('div');
        item.className = 'asset-item';
        if (f.auto) item.className += ' asset-auto';
        if (thumb) {
          const img = document.createElement('img');
          img.className = 'asset-thumb';
          img.dataset.path = f.name;
          el.appendChild(item);
          item.appendChild(img);
        } else {
          const ic = document.createElement('span');
          ic.innerHTML = svgIcon(thumb === false ? 'music' : 'file', 18);
          item.appendChild(ic);
        }
        const nm = document.createElement('span');
        nm.className = 'nm';
        nm.textContent = f.display;
        item.appendChild(nm);
        const sz = document.createElement('span');
        sz.className = 'sz';
        sz.textContent = (f.size / 1024).toFixed(0) + 'KB';
        item.appendChild(sz);
        item.addEventListener('dblclick', () => addSpriteFromAsset(f.name));
        item.title = __t('双击创建 Sprite');
        item.draggable = true;
        item.addEventListener('dragstart', (e) => {
          e.dataTransfer.setData('text/asset-name', f.name);
          e.dataTransfer.effectAllowed = 'copy';
        });
        item.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          showContextMenu(e.clientX, e.clientY, [
            { label: '打开文件', action: () => window.sbAPI.openPath(resolveAssetPath(f.name)) },
            { label: '重新连接文件…', action: () => relinkAsset(f.name) },
            { label: '从素材库删除', action: () => {
              if (f.auto) { toast('该素材被 storyboard 引用，无法从素材库移除', true); return; }
              state.manualImages = (state.manualImages || []).filter((n) => n !== f.name);
              persistProjectState();
              renderAssetList();
              toast(__t('已从素材库移除: ') + f.name);
            } }
          ]);
        });
        el.appendChild(item);
      }
    };
    section('图片', imgs, true);
    // Load image thumbnails lazily
    for (const img of el.querySelectorAll('img.asset-thumb')) {
      loadThumb(img);
    }
  }

  async function addImageToLibrary() {
    if (!state.levelDir) { toast('请先打开项目', true); return; }
    const p = await window.sbAPI.pickFile({
      title: '添加素材',
      filters: [{ name: '图片/视频', extensions: ['png', 'jpg', 'jpeg', 'mp4', 'webm'] }]
    });
    if (!p) return;
    await addAssetByPath(p);
  }

  // 按路径把外部图片/视频加入素材库：主进程会先把文件拷贝进项目文件夹，
  // 素材库始终引用项目文件夹内的副本。
  async function addAssetByPath(p) {
    if (!state.levelDir) { toast('请先打开项目', true); return; }
    try {
      const name = await window.sbAPI.levelAddAsset({ levelDir: state.levelDir, filePath: p });
      if (state.manualImages.includes(name)) {
        toast(__t('该素材已在素材库中: ') + assetBasename(name));
        return;
      }
      state.manualImages.push(name);
      state.manualSizes = state.manualSizes || {};
      if (!(state.files || []).some((f) => f.name === name)) {
        const st = await window.sbAPI.readFileBuffer(resolveAssetPath(name)).catch(() => null);
        if (st) state.manualSizes[name] = st.data.length;
      }
      persistProjectState();
      renderAssetList();
      toast(__t('已添加素材: ') + assetBasename(name));
    } catch (e) {
      toast(__t('添加素材失败: ') + e.message, true);
    }
  }

  // Preset object-category rows in the left panel (the "对象" section), each
  // with a "+" button that creates an object at the current playhead time.
  const OA_GROUPS = [
    ['sprites', 'Sprites 精灵'],
    ['texts', 'Texts 文本'],
    ['lines', 'Lines 线段'],
    ['videos', 'Videos 视频'],
    ['controllers', 'Controllers 控制器'],
    ['note_controllers', 'Note Controllers 音符控制器']
  ];

  function renderObjectAddPanel() {
    const el = $('#objectAddList');
    if (!el) return;
    el.innerHTML = '';
    if (!state.storyboard) {
      el.innerHTML = __t('<div class="empty-panel">打开项目后可在此添加对象</div>');
      return;
    }
    for (const [key, label] of OA_GROUPS) {
      const list = state.storyboard[key] || [];
      const collapsed = !!(state.tagCollapsed || {})[key];
      const isCtrl = key === 'controllers';
      const gHidden = !isCtrl && !isGroupVisible(key);
      const row = document.createElement('div');
      row.className = 'oa-row' + (collapsed ? ' collapsed' : '');
      const eyeHtml = isCtrl ? '' : `<span class="oa-eye${gHidden ? ' off' : ''}" title="${__t(gHidden ? '显示' : '隐藏')}${__t('整个分类')}">${svgIcon(gHidden ? 'eyeOff' : 'eye')}</span>`;
      row.innerHTML = `<span class="oa-caret">${collapsed ? svgIcon('chevronRight', 10) : svgIcon('chevronDown', 10)}</span>${eyeHtml}<span class="oa-name">${escapeHtml(__t(label))}</span><span class="oa-count">${list.length}</span><button class="oa-add" title="${__t('添加')} ${escapeHtml(__t(label))}">${svgIcon('plus', 12)}</button>`;
      row.addEventListener('click', (e) => {
        if (e.target.closest('.oa-add') || e.target.closest('.oa-eye')) return;
        state.tagCollapsed = state.tagCollapsed || {};
        state.tagCollapsed[key] = !state.tagCollapsed[key];
        persistProjectState();
        renderObjectAddPanel();
      });
      if (!isCtrl) {
        row.querySelector('.oa-eye').addEventListener('click', (e) => {
          e.stopPropagation();
          toggleGroupVisibility(key);
        });
      }
      row.querySelector('.oa-add').addEventListener('click', (e) => {
        e.stopPropagation();
        addObjectFromTag(key);
      });
      el.appendChild(row);
      if (collapsed) continue;
      // Expanded: list the objects in this category (click to select).
      const sub = document.createElement('div');
      sub.className = 'oa-items';
      if (!list.length) {
        sub.innerHTML = __t('<div class="oa-empty">（空）</div>');
      } else {
        for (const obj of list) {
          const it = document.createElement('div');
          const oHidden = !isCtrl && isObjHiddenState(obj.id);
          it.className = 'oa-item' + (state.selectedObjId === obj.id ? ' selected' : '') + (oHidden ? ' hidden' : '');
          const nm = (obj.id || '') + (obj.path ? ' · ' + obj.path : '');
          const locked = isLocked(obj.id);
          it.innerHTML = `${isCtrl ? '' : `<span class="oa-eye${oHidden ? ' off' : ''}" title="${oHidden ? '显示' : '隐藏'}对象">${svgIcon(oHidden ? 'eyeOff' : 'eye')}</span>`}<span class="oa-nm">${escapeHtml(nm)}</span><span class="oa-lock${locked ? ' locked' : ''}" title="${locked ? '解锁' : '锁定'}（锁定的对象在预览中不可直接点选）">${svgIcon(locked ? 'lock' : 'unlock')}</span>`;
          it.title = obj.id;
          it.addEventListener('click', (e) => {
            e.stopPropagation();
            if (e.target.closest('.oa-eye') || e.target.closest('.oa-lock')) return;
            selectObject(obj.id, null);
          });
          if (!isCtrl) {
            it.querySelector('.oa-eye').addEventListener('click', (e) => {
              e.stopPropagation();
              toggleObjectVisibility(obj.id);
            });
          }
          it.querySelector('.oa-lock').addEventListener('click', (e) => {
            e.stopPropagation();
            toggleLock(obj.id);
          });
          it.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            showContextMenu(e.clientX, e.clientY, [
              { label: '选择对象', action: () => selectObject(obj.id, null) },
              { label: '复制对象（绝对时间）', action: () => copySelection(false, obj.id) },
              { label: '复制对象（相对播放头）', action: () => copySelection(true, obj.id) },
              { label: '删除对象', action: () => deleteSelection(obj.id), danger: true }
            ]);
          });
          sub.appendChild(it);
        }
      }
      el.appendChild(sub);
    }
  }

  async function relinkAsset(oldName) {
    if (!state.levelDir) return;
    const p = await window.sbAPI.pickFile({
      title: '重新连接素材',
      filters: [{ name: '图片/视频', extensions: ['png', 'jpg', 'jpeg', 'mp4', 'webm'] }]
    });
    if (!p) return;
    try {
      const name = await window.sbAPI.levelAddAsset({ levelDir: state.levelDir, filePath: p });
      if (name === oldName) { toast('所选文件与原素材相同'); return; }
      snapshot();
      // 重新连接是 storyboard 数据层的整体替换：替换精灵/视频对象本体及其
      // 所有关键帧状态里引用旧文件的 path，时间轴缩略图与预览随之实时刷新。
      const relink = (o) => {
        if (o && o.path === oldName) o.path = name;
        for (const st of (o && o.states) || []) {
          if (st.path === oldName) st.path = name;
        }
      };
      for (const o of [...((state.storyboard && state.storyboard.sprites) || []),
                       ...((state.storyboard && state.storyboard.videos) || [])]) {
        relink(o);
      }
      state.manualImages = (state.manualImages || []).filter((n) => n !== oldName);
      if (!state.manualImages.includes(name)) state.manualImages.push(name);
      state.dirty = true;
      persistProjectState();
      refreshAll();
      toast(__t('已重新连接: ') + name);
    } catch (e) {
      toast(__t('重新连接失败: ') + e.message, true);
    }
  }

  async function loadThumb(img) {
    try {
      const full = resolveAssetPath(img.dataset.path);
      const res = await window.sbAPI.readFileBuffer(full);
      const buf = Uint8Array.from(atob(res.data), (c) => c.charCodeAt(0));
      const blob = new Blob([buf], { type: img.dataset.path.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg' });
      img.src = URL.createObjectURL(blob);
    } catch (e) {}
  }

  function addSpriteFromAsset(name) {
    if (!state.storyboard) return;
    snapshot();
    const isVideo = isVideoAsset(name);
    const id = uniqueId(isVideo ? 'video' : 'sprite');
    // 新建对象创建在当前播放头位置，并落在最上层的一条新轨道。
    const top = topStagePlacement();
    const obj = {
      id, path: name, time: preview.time, opacity: 1,
      x: 'stagex:0', y: 'stagey:0',
      layer: top.layer, order: top.order
    };
    if (isVideo) {
      state.storyboard.videos = state.storyboard.videos || [];
      state.storyboard.videos.push(obj);
    } else {
      obj.preserve_aspect = true;
      state.storyboard.sprites = state.storyboard.sprites || [];
      state.storyboard.sprites.push(obj);
    }
    const merged = readCysterStageLanes();
    if (merged) {
      merged.unshift([id]);
      renumberStageLanes(merged);
      setCysterStageLanes(merged);
    }
    state.dirty = true;
    state.selectedObjId = id;
    state.selectedKeyIdx = -1;
    refreshAll();
    toast(__t('已添加 ') + (isVideo ? 'Video' : 'Sprite') + ': ' + name);
  }

  // Drop a library asset onto the preview at a position, creating a sprite
  // with a default 3-second duration (editor-like). Video assets create a
  // Video object instead of a sprite.
  function isVideoAsset(name) {
    return /\.(mp4|webm|mov)$/i.test(String(name || ''));
  }

  function addSpriteFromDrop(name, clientX, clientY) {
    if (!state.storyboard) { toast('请先打开项目', true); return; }
    const canvas = $('#previewCanvas');
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const ch = preview.chart;
    if (!ch) { toast('请先打开项目', true); return; }
    const cx = (clientX - rect.left) / rect.width * canvas.width;
    const cy = (clientY - rect.top) / rect.height * canvas.height;
    const info = preview.ctxInfo();
    const S = info.S, sxF = info.sxF || 1, syF = info.syF || 1;
    const ox = info.ortho != null ? info.ortho : 5;
    const aspect = info.W / info.H;
    // Inverse of worldToPx (screen = center + R*(P - C)): rotate the drop
    // point back into the pre-rotation frame, then add the camera offset.
    const c = Math.cos(info.rotZ || 0), s = Math.sin(info.rotZ || 0);
    const dx = cx - info.W / 2, dy = cy - info.H / 2;
    const worldX = (dx * c + dy * s + (info.camXpx || 0)) / (S * sxF);
    const worldY = (dx * s - dy * c + (info.camYpx || 0)) / (S * syF);
    const ratio = ch.horizontalRatio, base = ch.baseSize, sr = ch.screenRatio;
    const nx = (worldX / (base * sr) + ratio) / (2 * ratio);
    const ny = (worldY - ch.verticalOffset + ch.verticalRatio * base) / (2 * ch.verticalRatio * base);
    // 默认坐标系从 note 改为 stage：把落点（note 场坐标）经 world 换算到
    // 800×600 舞台画布坐标（中心为原点，范围 ±400 / ±300）。
    const sx = ch.convertChartXToScreenX(Math.min(1, Math.max(0, nx))) / (ox * aspect) * 800;
    const sy = ch.convertChartYToScreenY(Math.min(1, Math.max(0, ny))) / ox * 600;
    const t = preview.time;
    snapshot();
    const isVideo = isVideoAsset(name);
    const id = uniqueId(isVideo ? 'video' : 'sprite');
    const obj = {
      id, path: name, time: t,
      x: { unit: 'stagex', value: Math.min(400, Math.max(-400, sx)) },
      y: { unit: 'stagey', value: Math.min(300, Math.max(-300, sy)) },
      opacity: 1,
      layer: 0,
      order: 0,
      states: [{ time: t + 3 }]
    };
    if (isVideo) {
      state.storyboard.videos = state.storyboard.videos || [];
      state.storyboard.videos.push(obj);
    } else {
      obj.preserve_aspect = true;
      state.storyboard.sprites = state.storyboard.sprites || [];
      state.storyboard.sprites.push(obj);
    }
    state.selectedObjId = id;
    state.selectedKeyIdx = -1;
    state.dirty = true;
    refreshAll();
    toast(__t('已创建 ') + (isVideo ? 'Video' : 'Sprite') + __t('（3 秒）: ') + name);
  }

  function uniqueId(type) {
    const group = TYPE_GROUPS[type];
    const list = state.storyboard ? state.storyboard[group] || [] : [];
    let i = list.length + 1;
    let id;
    do {
      id = `${type}_${i++}`;
    } while (list.some((o) => o.id === id));
    return id;
  }

  // ---------------------------------------------------------------
  // Object tree
  // ---------------------------------------------------------------
  function allObjects() {
    if (!state.storyboard) return [];
    const out = [];
    for (const [group, type] of Object.entries(GROUP_TYPES)) {
      for (const obj of state.storyboard[group] || []) {
        out.push({ id: obj.id || '(auto)', type, raw: obj });
      }
    }
    return out;
  }

  function renderObjectTree() {
    const el = $('#objectTree');
    if (!el) return; // object tree was merged into the timeline name column
    el.innerHTML = '';
    if (!state.storyboard) {
      el.innerHTML = __t('<div class="empty-panel">尚未打开 StoryBoard</div>');
      return;
    }
    const groups = ['sprites', 'texts', 'videos', 'lines', 'controllers', 'note_controllers'];
    const labels = { sprites: __t('Sprites 精灵'), texts: __t('Texts 文本'), videos: __t('Videos 视频'), lines: __t('Lines 线段'), controllers: __t('Controllers 控制器'), note_controllers: __t('Note Controllers 音符控制器') };
    for (const g of groups) {
      const list = state.storyboard[g] || [];
      const h = document.createElement('div');
      h.className = 'group-label';
      h.innerHTML = `<span>${labels[g]}</span><span>${list.length}</span>`;
      el.appendChild(h);
      list.forEach((obj, i) => {
        const id = obj.id || `#${i}`;
        const item = document.createElement('div');
        item.className = 'obj-item' + (state.selectedObjId === id ? ' selected' : '');
        item.innerHTML = `<span class="nm">${escapeHtml(id)}</span><span class="del">${svgIcon('close', 12)}</span>`;
        item.addEventListener('click', () => selectObject(id, null));
        item.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          showContextMenu(e.clientX, e.clientY, [
            { label: '复制对象（绝对时间）', action: () => copySelection(false, id) },
            { label: '复制对象（相对播放头）', action: () => copySelection(true, id) },
            { label: '删除对象', action: () => deleteSelection(id), danger: true }
          ]);
        });
        const del = item.querySelector('.del');
        del.addEventListener('click', (e) => {
          e.stopPropagation();
          deleteObject(id);
        });
        el.appendChild(item);
      });
    }
  }

  function deleteObject(id) {
    id = splitEntryId(id).rawId;
    snapshot();
    for (const [group] of Object.entries(GROUP_TYPES)) {
      const list = state.storyboard[group] || [];
      const idx = list.findIndex((o) => (o.id || '') === id);
      if (idx >= 0) {
        list.splice(idx, 1);
        state.dirty = true;
        if (state.objHidden) delete state.objHidden[id];
        if (state.selectedObjId === id) { state.selectedObjId = null; state.selectedKeyIdx = null; }
        refreshAll();
        toast(__t('已删除对象: ') + id);
        return;
      }
    }
  }

  function duplicateObject(id) {
    id = splitEntryId(id).rawId;
    snapshot();
    const entry = findObjectEntry(id);
    if (!entry) return;
    const clone = JSON.parse(JSON.stringify(entry.obj));
    clone.id = uniqueId(entry.type);
    delete clone.states; // keep the clone simple: initial state only
    if (['sprite', 'text', 'video', 'line'].includes(entry.type)) {
      // 复制的 stage 对象重新分配最上层新轨道，不复制原 order。
      const top = topStagePlacement();
      clone.layer = top.layer;
      clone.order = top.order;
    }
    state.storyboard[entry.group].push(clone);
    if (['sprite', 'text', 'video', 'line'].includes(entry.type)) {
      const merged = readCysterStageLanes();
      if (merged) {
        merged.unshift([clone.id]);
        renumberStageLanes(merged);
        setCysterStageLanes(merged);
      }
    }
    state.dirty = true;
    state.selectedObjId = clone.id;
    state.selectedKeyIdx = -1;
    refreshAll();
    toast('已复制对象: ' + clone.id);
  }

  // ---------------------------------------------------------------
  // Timeline data
  // ---------------------------------------------------------------
  // Resolved time used for ordering a state (first token; unresolvable
  // relative/reference times sort to the end).
  function stateSortTime(st, noteId) {
    const tok = st && st.time != null
      ? (Array.isArray(st.time) ? st.time[0] : st.time)
      : null;
    const t = noteId != null ? resolveTimeForNote(tok, noteId) : resolveTime(tok);
    return t == null ? Number.MAX_SAFE_INTEGER : t;
  }

  // Keep obj.states ordered by time (stable: ties keep insertion order) and
  // re-point the selection to the same state objects after the reorder.
  function sortObjectStates(obj) {
    const states = obj && obj.states;
    if (!Array.isArray(states) || states.length < 2) return;
    const before = states.slice();
    const noteId = typeof obj.note === 'number' ? obj.note : null;
    const decorated = states.map((st, i) => ({ st, i, t: stateSortTime(st, noteId) }));
    decorated.sort((a, b) => (a.t - b.t) || (a.i - b.i));
    let changed = false;
    for (let i = 0; i < states.length; i++) {
      if (states[i] !== decorated[i].st) { changed = true; break; }
    }
    if (!changed) return;
    states.length = 0;
    for (const d of decorated) states.push(d.st);
    const isSel = state.selectedObjId === obj.id;
    if (isSel && state.selectedKeyIdx != null && state.selectedKeyIdx >= 0 && state.selectedKeyIdx < before.length) {
      state.selectedKeyIdx = states.indexOf(before[state.selectedKeyIdx]);
    }
    if (isSel && Array.isArray(state.selectedKfs) && state.selectedKfs.some((k) => k.objId === obj.id)) {
      state.selectedKfs = state.selectedKfs.map((k) => {
        if (k.objId !== obj.id) return k;
        const old = k.index >= 0 && k.index < before.length ? before[k.index] : null;
        return { objId: obj.id, index: old ? states.indexOf(old) : k.index };
      });
    }
  }

  function sortAllObjectStates() {
    for (const [group] of Object.entries(GROUP_TYPES)) {
      for (const obj of state.storyboard[group] || []) sortObjectStates(obj);
    }
  }

  // K0 无特殊性：obj.time 只是按时间排序后的第一个关键帧。任一关键帧被拖到
  // 其它关键帧之前/之后时，重新以最早的关键帧作为 K0（obj.time），其余按
  // 时间排入 states；同步字段始终以对象本体为准，不因换基而丢失。
  function normalizeK0(obj) {
    if (!obj) return;
    const e0 = findObjectEntry(obj.id);
    if (!e0) return;
    const isStage = ['sprite', 'text', 'video', 'line'].includes(e0.type);
    // controller / note_controller 同样以最早关键帧为 K0：修复“播放头位于 K0
    // 之前时添加关键帧后，关键帧列表仍把旧的 K0 排在上面”的时间顺序问题。
    // 仅当时间带多值数组或无法解析（$note 表达式无上下文 / 相对时间）时保持
    // 原有行为，避免对多 Note 时间数组重定基造成错乱。
    if (!isStage) {
      const resolvable = (t) => t != null && !Array.isArray(t) && resolveTime(t) != null;
      const allResolvable = resolvable(obj.time) &&
        (obj.states || []).every((st) => st && resolvable(st.time));
      if (!allResolvable) return;
    } else if (obj.time == null || Array.isArray(obj.time) || resolveTime(obj.time) == null) {
      // stage 对象 K0 为无法解析的表达式（$note / 相对时间等）时同样不重定基：
      // 否则新增的绝对时间关键帧会被提升为 K0，把原表达式覆盖成 0.000。
      return;
    }
    const t0 = resolveTime(obj.time);
    const kfs = [];
    if (t0 != null) kfs.push({ t: t0, base: true });
    (obj.states || []).forEach((st, i) => {
      const t = resolveTime(st.time);
      if (t != null) kfs.push({ t, st, i });
    });
    if (!kfs.length) return;
    kfs.sort((a, b) => a.t - b.t);
    const first = kfs[0];
    if (!first.base) {
      // 最早的关键帧不是当前 K0：把它提升为新的 K0，原 K0 降为普通关键帧。
      const promoted = first.st;
      const restStates = obj.states || [];
      const oldBaseState = {};
      for (const k of Object.keys(obj)) {
        if (k === 'states' || k === 'id' || k === 'note' || k === 'time') continue;
        oldBaseState[k] = obj[k];
      }
      const keep = {};
      for (const k of ['id', 'note', 'parent_id', 'target_id', 'path', 'order', 'layer']) {
        if (obj[k] !== undefined) keep[k] = obj[k];
      }
      for (const k of Object.keys(obj)) delete obj[k];
      Object.assign(obj, keep);
      obj.time = promoted.time;
      for (const k of Object.keys(promoted)) {
        if (k === 'states' || k === 'id' || k === 'note' || k === 'time' ||
            k === 'parent_id' || k === 'target_id' || k === 'path' || k === 'order' || k === 'layer') continue;
        obj[k] = promoted[k];
      }
      obj.states = restStates;
      const pi = restStates.indexOf(promoted);
      if (pi >= 0) restStates.splice(pi, 1);
      oldBaseState.time = t0;
      restStates.push(oldBaseState);
    }
    sortObjectStates(obj);
  }

  function objectKeyframes(obj) {
    const kfs = [];
    const t0 = resolveTime(obj.time);
    if (t0 != null) {
      const m = kfMeta(obj, null, -1);
      kfs.push({ index: -1, time: t0, label: 'K0', draggable: typeof obj.time === 'number', easing: m.easing, fromText: m.fromText, toText: m.toText, destroy: !!obj.destroy });
    }
    (obj.states || []).forEach((st, i) => {
      const tokens = Array.isArray(st.time) ? st.time : [st.time];
      for (const tok of tokens) {
        const t = resolveTime(tok);
        if (t != null) {
          const m = kfMeta(obj, st, i);
          kfs.push({ index: i, time: t, label: 'K' + (i + 1), draggable: typeof tok === 'number', easing: m.easing, fromText: m.fromText, toText: m.toText, destroy: !!st.destroy });
        }
      }
    });
    kfs.sort((a, b) => a.time - b.time);
    return kfs;
  }

  // ---- Stage 轨道布局：order 排序 + Cyster 合并轨道持久化 ----
  function stageObjectsSorted() {
    const out = [];
    for (const [group, type] of Object.entries(GROUP_TYPES)) {
      if (type === 'controller' || type === 'note_controller') continue;
      for (const obj of state.storyboard[group] || []) out.push({ group, type, obj });
    }
    // 复合层级：先按 layer（2 最顶）分三段，层内按 order 降序（大者在上）；
    // 未标明 layer / order 的按默认值 0 处理（order=0 位于所有正值之下）。
    out.sort((a, b) => {
      const la = a.obj.layer != null ? a.obj.layer : 0;
      const lb = b.obj.layer != null ? b.obj.layer : 0;
      if (lb !== la) return lb - la;
      const oa = a.obj.order != null ? a.obj.order : 0;
      const ob = b.obj.order != null ? b.obj.order : 0;
      return ob - oa;
    });
    return out;
  }

  // ---- Cyster 可视化专属数据：多难度下按 chart 分桶存于 editor.difficulties ----

  // 当前难度分桶（写入用）：按需创建 editor.difficulties[chartPath]。
  function difficultyBucket() {
    if (!state.projectConfig) state.projectConfig = { editor: {} };
    if (!state.projectConfig.editor || typeof state.projectConfig.editor !== 'object') state.projectConfig.editor = {};
    if (!state.chartPath) return null;
    const ed = state.projectConfig.editor;
    ed.difficulties = ed.difficulties || {};
    if (!ed.difficulties[state.chartPath] || typeof ed.difficulties[state.chartPath] !== 'object') {
      ed.difficulties[state.chartPath] = {};
    }
    return ed.difficulties[state.chartPath];
  }

  // 读取当前难度分桶。兼容旧版平铺 editor：editor.difficulties 不存在时，把
  // 平铺数据视为 config.files.chart（旧版“当前可编辑难度”）的那一份。
  function difficultyBucketRead() {
    const ed = state.projectConfig && state.projectConfig.editor;
    if (!ed || typeof ed !== 'object') return null;
    if (ed.difficulties && typeof ed.difficulties === 'object') {
      return (state.chartPath && ed.difficulties[state.chartPath]) || null;
    }
    if (state.chartPath && state.projectConfig.files &&
        state.chartPath === state.projectConfig.files.chart) {
      return ed;
    }
    return null;
  }

  // 时间表达式合规检查：判断该字段能否在当前对象/note 上下文下解析出具体
  // 时间（即能否在时间轴上创建对应关键帧）。无法解析时返回 false。
  function validTimeToken(value, obj) {
    if (value == null || value === '') return true; // 清空由调用方另行处理
    if (typeof value === 'number') return true;
    if (typeof value !== 'string') return false;
    const s = value.trim();
    if (s === '') return true;
    if (/^-?\d+(\.\d+)?$/.test(s)) return true;
    // 收集可用的 note 上下文：对象自身的 note（单 id / 数组 / 选择器）+
    // 当前选中的 note（合并块的逐 note 编辑场景）。
    const ids = [];
    if (obj && obj.note != null) {
      if (typeof obj.note === 'number') ids.push(obj.note);
      else if (Array.isArray(obj.note)) ids.push(...obj.note.map(Number));
      else if (typeof obj.note === 'object') noteSelectorIds(obj.note).forEach((n) => ids.push(n));
    }
    if (state.selectedNoteId != null && !ids.includes(state.selectedNoteId)) {
      ids.push(state.selectedNoteId);
    }
    // $note 令牌：任一可用 note 能解析即视为可接受（编译时会按各 note 展开）。
    if (s.indexOf('$note') >= 0) {
      return ids.some((n) => resolveTimeForNote(s, n) != null);
    }
    return resolveTime(s) != null;
  }

  // 时间输入规范化：纯数字按 3 位小数收敛并转数值（消除浮点尾差/过长小数，
  // 避免字符串数字落入 resolveTime 解析失败）；空值/表达式按原样返回。
  function normalizeTimeInput(value) {
    if (value == null) return value;
    if (typeof value === 'number') return Math.round(value * 1000) / 1000;
    if (typeof value !== 'string') return value;
    const s = value.trim();
    if (s === '') return '';
    if (/^-?\d+(\.\d+)?$/.test(s)) {
      const n = Number(s);
      return Number.isFinite(n) ? Math.round(n * 1000) / 1000 : value;
    }
    return value;
  }

  // 收敛浮点时间噪声（如 40.0798+0.0006 -> 40.079800000000006）：
  // 保留 6 位小数（远超毫秒精度），保证存储与显示干净。
  function roundTime(t) {
    if (typeof t !== 'number' || !isFinite(t)) return t;
    return Math.round(t * 1e6) / 1e6;
  }

  function readCysterTimelineRaw() {
    const b = difficultyBucketRead();
    const t = b && b.timeline;
    if (t && t.trackGroups) return t;
    // 兼容旧版：storyboard 文件里的 _cyster 仅用于读取迁移，不再写入。
    const c = state.storyboard && state.storyboard._cyster;
    return (c && c.timeline) || null;
  }

  function ensureEditorTimeline() {
    const read = difficultyBucketRead();
    if (read && read.timeline && read.timeline.trackGroups) return read.timeline;
    const b = difficultyBucket();
    if (b) {
      // 迁移：旧版平铺 editor.timeline（仅当当前 chart 是旧版“当前难度”）或
      // storyboard 里的 _cyster 时间轴。
      const ed = state.projectConfig && state.projectConfig.editor;
      const flatTl = (!(ed && ed.difficulties) && read) ? (read.timeline || null) : null;
      const legacy = flatTl ||
        (state.storyboard && state.storyboard._cyster && state.storyboard._cyster.timeline);
      b.timeline = legacy
        ? JSON.parse(JSON.stringify(legacy))
        : { version: 5, trackGroups: { stage: [], note_controller: [], controller: [] }, lockedOrders: [] };
      return b.timeline;
    }
    // chartPath 尚未建立（极早期调用）：退回旧字段，保证不崩。
    if (!state.projectConfig) state.projectConfig = { editor: {} };
    if (!state.projectConfig.editor || typeof state.projectConfig.editor !== 'object') state.projectConfig.editor = {};
    if (!state.projectConfig.editor.timeline) {
      const legacy = state.storyboard && state.storyboard._cyster && state.storyboard._cyster.timeline;
      state.projectConfig.editor.timeline = legacy
        ? JSON.parse(JSON.stringify(legacy))
        : { version: 5, trackGroups: { stage: [], note_controller: [], controller: [] }, lockedOrders: [] };
    }
    return state.projectConfig.editor.timeline;
  }

  // 当前 Cyster 时间轴数据（trackGroups + order 锁定），随项目状态写入 .ctr。
  function currentCysterTimeline() {
    const tl = ensureEditorTimeline();
    return {
      version: 5,
      trackGroups: {
        stage: ((tl.trackGroups && tl.trackGroups.stage) || []).map((l) => l.slice()),
        note_controller: ((tl.trackGroups && tl.trackGroups.note_controller) || []).map((l) => l.slice()),
        controller: ((tl.trackGroups && tl.trackGroups.controller) || []).map((l) => l.slice())
      },
      lockedOrders: Array.from(timeline.lockedOrders || [])
        .filter((x) => Number.isFinite(x))
        .sort((a, b) => a - b)
    };
  }

  // 合并轨道布局变更后写回项目文件（只更新 stage 分组，保留 note_controller）。
  function setCysterStageLanes(merged) {
    const tl = ensureEditorTimeline();
    tl.trackGroups = tl.trackGroups || { stage: [], note_controller: [] };
    tl.trackGroups.stage = (merged || []).map((l) => l.slice()).filter((l) => l.length);
    persistProjectState();
  }

  // 新建 stage 对象的最上层位置：layer 取最高层（2 或更高），order 取该层
  // 现有最大值 + 1，保证它落在最上层的一条新轨道。
  function topStagePlacement() {
    let layer = 2;
    let order = 0;
    for (const [group, type] of Object.entries(GROUP_TYPES)) {
      if (type === 'controller' || type === 'note_controller') continue;
      for (const o of state.storyboard[group] || []) {
        const l = o.layer != null ? o.layer : 0;
        if (l > layer) layer = l;
        if (l === layer) {
          const od = o.order != null ? o.order : 0;
          if (od >= order) order = od + 1;
        }
      }
    }
    return { layer, order };
  }

  // 复制对象：layer 保持不变，只把 order 分配到该层最上层的新轨道（该层最大
  // order + 1），避免与原对象产生同 order 双轨。
  function topOrderInLayer(layer) {
    let order = 0;
    for (const [group, type] of Object.entries(GROUP_TYPES)) {
      if (type === 'controller' || type === 'note_controller') continue;
      for (const o of state.storyboard[group] || []) {
        const l = o.layer != null ? o.layer : 0;
        if (l === layer) {
          const od = o.order != null ? o.order : 0;
          if (od >= order) order = od + 1;
        }
      }
    }
    return order;
  }

  function isOrderLocked(o) {
    return !!(o && o.order != null && timeline.lockedOrders && timeline.lockedOrders.has(o.order));
  }

  // 对合并轨道重新排序并重编号：按首对象的 (layer, order) 复合位置排序，
  // 层内顶部轨道 order 最大；被锁定的 order 层级保留原值不重写。
  function renumberStageLanes(lanes) {
    if (!Array.isArray(lanes) || !lanes.length) return lanes;
    const sorted = stageObjectsSorted();
    const pos = new Map(sorted.map((x, i) => [x.obj.id, i]));
    lanes.sort((a, b) => ((pos.get(a[0]) ?? 0) - (pos.get(b[0]) ?? 0)));
    const byLayer = new Map();
    lanes.forEach((lane, i) => {
      const first = lane.map((id) => findObjectEntry(id)).find((e) => e && e.obj);
      const layer = first ? (first.obj.layer != null ? first.obj.layer : 0) : 0;
      if (!byLayer.has(layer)) byLayer.set(layer, []);
      byLayer.get(layer).push({ lane, i });
    });
    for (const [layer, metas] of byLayer) {
      metas.sort((a, b) => a.i - b.i);
      const n = metas.length;
      metas.forEach((m, k) => {
        const first = m.lane.map((id) => findObjectEntry(id)).find((e) => e && e.obj);
        const curOrder = first && first.obj.order != null ? first.obj.order : null;
        if (curOrder != null && timeline.lockedOrders && timeline.lockedOrders.has(curOrder)) return;
        const order = n - 1 - k;
        for (const id of m.lane) {
          const e = findObjectEntry(id);
          if (e && ['sprite', 'text', 'video', 'line'].includes(e.type)) {
            syncObjectField(e.obj, 'layer', layer);
            syncObjectField(e.obj, 'order', order);
          }
        }
      });
    }
    return lanes;
  }

  // 时间块的有效区间（最早关键帧 ~ 最晚关键帧，至少 0.25s）。
  function objectTimeSpan(obj) {
    // 与时间轴显示一致：带对象级 note 选择器/$note 时间的对象（含合并时间块）
    // 按全部命中 note 解析整体占用区间；普通对象退回 objectKeyframes。
    const kfs = objectKeyframesAllNotes(obj);
    if (!kfs.length) return null;
    const start = kfs[0].time;
    return { start, end: Math.max(start + 0.25, kfs[kfs.length - 1].time) };
  }

  // 校验目标 order 轨道：同 layer 同 order 的对象与当前对象在时间上有无重叠。
  // 无重叠才允许共轨；excluded 可排除一批对象（如多选目标自身）。
  function orderTimeConflict(obj, layer, order, excluded) {
    const span = objectTimeSpan(obj);
    if (!span) return false;
    return stageObjectsSorted().some((x) => {
      if (x.obj === obj) return false;
      if (excluded && excluded.has(x.obj)) return false;
      if ((x.obj.layer != null ? x.obj.layer : 0) !== layer) return false;
      if ((x.obj.order != null ? x.obj.order : 0) !== order) return false;
      const s2 = objectTimeSpan(x.obj);
      if (!s2) return false;
      return span.start < s2.end - 0.001 && s2.start < span.end - 0.001;
    });
  }

  // 合并布局里把对象移到“对应 order”的轨道：优先加入同 layer 同 order 的
  // 现有轨道（调用方已保证无时间重叠），没有则新建一条该 order 的轨道，
  // 并按 (layer, order) 重排所有轨道。
  function moveObjectToOrderLane(merged, id, layer, order) {
    for (let i = 0; i < merged.length; i++) {
      const j = merged[i].indexOf(id);
      if (j >= 0) merged[i].splice(j, 1);
    }
    let target = null;
    for (const lane of merged) {
      if (!lane.length) continue;
      const e = lane[0] != null ? findObjectEntry(lane[0]) : null;
      if (e && e.obj && (e.obj.layer != null ? e.obj.layer : 0) === layer &&
          (e.obj.order != null ? e.obj.order : 0) === order) { target = lane; break; }
    }
    const cleaned = merged.filter((l) => l.length);
    merged.length = 0;
    merged.push(...cleaned);
    if (target && cleaned.includes(target)) target.push(id);
    else merged.push([id]);
    merged.sort((a, b) => {
      const ea = a[0] != null ? findObjectEntry(a[0]) : null;
      const eb = b[0] != null ? findObjectEntry(b[0]) : null;
      const la = ea && ea.obj.layer != null ? ea.obj.layer : 0;
      const lb = eb && eb.obj.layer != null ? eb.obj.layer : 0;
      if (lb !== la) return lb - la;
      const oa = ea && ea.obj.order != null ? ea.obj.order : 0;
      const ob = eb && eb.obj.order != null ? eb.obj.order : 0;
      return ob - oa;
    });
  }

  // 单个 stage 对象直接改 order：校验目标 order 轨道在时间上无重叠，改完后
  // 自动移到对应 order 轨道（新值则新建一条对应轨道）。
  function applyObjectOrder(obj, value) {
    if (!obj) return false;
    if (value === undefined || value === null || value === '') {
      snapshot();
      syncObjectField(obj, 'order', undefined);
      state.dirty = true;
      return true;
    }
    const order = Number(value);
    if (!Number.isFinite(order)) return false;
    const layer = obj.layer != null ? obj.layer : 0;
    const cur = obj.order != null ? obj.order : 0;
    if (cur === order) return false;
    if (orderTimeConflict(obj, layer, order, new Set([obj]))) {
      toast(__t('该 order ') + order + __t(' 层在当前时间已有其它对象，无法移入'), true);
      return false;
    }
    snapshot();
    syncObjectField(obj, 'order', order);
    const merged = readCysterStageLanes();
    if (merged) {
      moveObjectToOrderLane(merged, obj.id, layer, order);
      setCysterStageLanes(merged);
    }
    state.dirty = true;
    return true;
  }

  // 修改 stage 对象的 layer：把对象所在合并轨道移入目标 layer 组（置于该层
  // 最顶部新轨道），避免在时间轴里“新建”一个图层分类；同时保持其它轨道顺序。
  function changeObjectLayer(obj, layer) {
    if (!obj) return false;
    const entry = findObjectEntry(obj.id);
    if (!entry || !['sprite', 'text', 'video', 'line'].includes(entry.type)) return false;
    const nl = layer != null ? Number(layer) : 0;
    if (!Number.isFinite(nl)) return false;
    const cur = obj.layer != null ? obj.layer : 0;
    if (cur === nl) return false;
    snapshot();
    const merged = readCysterStageLanes();
    syncObjectField(obj, 'layer', nl);
    if (merged) {
      for (const lane of merged) {
        const i = lane.indexOf(obj.id);
        if (i >= 0) lane.splice(i, 1);
      }
      const cleaned = merged.filter((l) => l.length);
      const order = topOrderInLayer(nl);
      syncObjectField(obj, 'order', order);
      moveObjectToOrderLane(cleaned, obj.id, nl, order);
      setCysterStageLanes(cleaned);
    }
    state.dirty = true;
    dirtyAndRefresh();
    return true;
  }

  // 多选批量改 layer：所有目标移入目标 layer 组，各自占据该层顶部新轨道。
  function changeObjectsLayer(targets, layer) {
    if (!targets || !targets.length) return false;
    const nl = layer != null ? Number(layer) : 0;
    if (!Number.isFinite(nl)) return false;
    snapshot();
    const merged = readCysterStageLanes();
    for (const t of targets) syncObjectField(t.obj, 'layer', nl);
    if (merged) {
      for (const lane of merged) {
        for (const t of targets) {
          const i = lane.indexOf(t.obj.id);
          if (i >= 0) lane.splice(i, 1);
        }
      }
      const cleaned = merged.filter((l) => l.length);
      for (const t of targets) {
        const order = topOrderInLayer(nl);
        syncObjectField(t.obj, 'order', order);
        moveObjectToOrderLane(cleaned, t.obj.id, nl, order);
      }
      setCysterStageLanes(cleaned);
    }
    state.dirty = true;
    dirtyAndRefresh();
    return true;
  }

  // 多选批量改 order：目标 order 轨道时间重叠（含目标之间）则拒绝。
  function applyOrderToMany(targets, value) {
    if (!targets || !targets.length) return false;
    if (value === undefined || value === null || value === '') {
      snapshot();
      for (const t of targets) syncObjectField(t.obj, 'order', undefined);
      state.dirty = true;
      return true;
    }
    const order = Number(value);
    if (!Number.isFinite(order)) return false;
    const targetSet = new Set(targets.map((t) => t.obj));
    const byLayer = new Map();
    for (const t of targets) {
      const layer = t.obj.layer != null ? t.obj.layer : 0;
      if (!byLayer.has(layer)) byLayer.set(layer, []);
      byLayer.get(layer).push(t);
    }
    for (const [layer, list] of byLayer) {
      for (let i = 0; i < list.length; i++) {
        if (orderTimeConflict(list[i].obj, layer, order, targetSet)) {
          toast(__t('该 order ') + order + __t(' 层在当前时间已有其它对象，无法移入'), true);
          return false;
        }
        for (let j = i + 1; j < list.length; j++) {
          const a = objectTimeSpan(list[i].obj);
          const b = objectTimeSpan(list[j].obj);
          if (a && b && a.start < b.end - 0.001 && b.start < a.end - 0.001) {
            toast(__t('同 layer ') + layer + __t(' 的多个对象时间重叠，不能共用一个 order'), true);
            return false;
          }
        }
      }
    }
    snapshot();
    const merged = readCysterStageLanes();
    for (const t of targets) {
      const layer = t.obj.layer != null ? t.obj.layer : 0;
      syncObjectField(t.obj, 'order', order);
      if (merged) moveObjectToOrderLane(merged, t.obj.id, layer, order);
    }
    if (merged) setCysterStageLanes(merged);
    state.dirty = true;
    return true;
  }

  // .ctr 项目文件（editor.timeline）里 Cyster 专属的合并轨道信息。
  function readCysterStageLanes() {
    const tl = readCysterTimelineRaw();
    const tg = tl && tl.trackGroups && tl.trackGroups.stage;
    if (!Array.isArray(tg)) return null;
    const valid = new Set(stageObjectsSorted().map((x) => x.obj.id));
    const lanes = tg
      .map((lane) => (Array.isArray(lane) ? lane.filter((id) => valid.has(id)) : []))
      .filter((lane) => lane.length);
    return lanes.length ? lanes : null;
  }

  // note_controller 的合并轨道（无层级概念，仅时间不重叠打包）。
  function readCysterNoteLanes() {
    const tl = readCysterTimelineRaw();
    const tg = tl && tl.trackGroups && tl.trackGroups.note_controller;
    if (!Array.isArray(tg)) return null;
    const valid = new Set((state.storyboard.note_controllers || []).map((o) => o.id));
    const lanes = tg
      .map((lane) => (Array.isArray(lane) ? lane.filter((id) => valid.has(id)) : []))
      .filter((lane) => lane.length);
    return lanes.length ? lanes : null;
  }

  // controller 的隐性轨道层级（无 order/layer 概念，仅保存轨道上下顺序）。
  function readCysterControllerLanes() {
    const tl = readCysterTimelineRaw();
    const tg = tl && tl.trackGroups && tl.trackGroups.controller;
    if (!Array.isArray(tg)) return null;
    const valid = new Set((state.storyboard.controllers || []).map((o) => o.id));
    const lanes = tg
      .map((lane) => (Array.isArray(lane) ? lane.filter((id) => valid.has(id)) : []))
      .filter((lane) => lane.length);
    return lanes.length ? lanes : null;
  }

  // .ctr 项目文件里持久化的 order 锁定层级（Cyster 可视化专属）。
  function readCysterLockedOrders() {
    const tl = readCysterTimelineRaw();
    const list = tl && Array.isArray(tl.lockedOrders) ? tl.lockedOrders : [];
    return list.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  }

  // stage + note_controller + controller 三组轨道布局一起交给时间轴。
  function readCysterTrackGroups() {
    const out = {};
    const stage = readCysterStageLanes();
    if (stage) out.stage = stage;
    const nc = readCysterNoteLanes();
    if (nc) out.note_controller = nc;
    const ctl = readCysterControllerLanes();
    if (ctl) out.controller = ctl;
    return Object.keys(out).length ? out : null;
  }

  // 当前时间轴使用的 stage 轨道布局（合并布局或默认一对象一轨）。
  function currentStageLanes() {
    const merged = readCysterStageLanes();
    const sorted = stageObjectsSorted();
    if (merged) {
      const lanes = merged.map((ids) => ({ ids: ids.slice() }));
      // 与时间轴一致：保留持久化/整理后的轨道顺序；未覆盖的新对象补到末尾。
      const covered = new Set(merged.flat());
      for (const x of sorted) if (!covered.has(x.obj.id)) lanes.push({ ids: [x.obj.id] });
      return lanes;
    }
    return sorted.map((x) => ({ ids: [x.obj.id] }));
  }

  // 把合并后的轨道布局写回 .ctr 项目文件（Cyster 可视化专属信息）。
  function organizeStageTracks(all) {
    if (!state.storyboard || !all || typeof all !== 'object') return;
    snapshot();
    const tl = ensureEditorTimeline();
    tl.version = 5;
    tl.trackGroups = {
      stage: (all.stage || []).map((l) => l.slice()),
      note_controller: (all.note_controller || []).map((l) => l.slice()),
      // controller 没有层级概念：保留用户已设定的隐性轨道顺序。
      controller: (all.controller || (tl.trackGroups && tl.trackGroups.controller) || []).map((l) => l.slice())
    };
    const lanes = all.stage || [];
    if (!lanes.length) {
      state.dirty = true;
      persistProjectState();
      saveStoryboard();
      return;
    }
    // 每个合并轨道按首对象的 layer 归类（打包已按类型+层进行），层内按轨道
    // 顺序分配 order：顶部轨道最大、order=0 在该层最底部。
    const beforePos = new Map();
    for (const [group] of Object.entries(GROUP_TYPES)) {
      for (const o of state.storyboard[group] || []) {
        if (o && o.id != null) beforePos.set(o.id, (o.layer != null ? o.layer : 0) + '::' + (o.order != null ? o.order : 0));
      }
    }
    const laneMeta = lanes.map((lane, i) => {
      const first = lane.map((id) => findObjectEntry(id)).find((e) => e && e.obj);
      return { lane, layer: first ? (first.obj.layer != null ? first.obj.layer : 0) : 0, i };
    });
    const byLayer = new Map();
    for (const m of laneMeta) {
      if (!byLayer.has(m.layer)) byLayer.set(m.layer, []);
      byLayer.get(m.layer).push(m);
    }
    for (const [layer, metas] of byLayer) {
      metas.sort((a, b) => a.i - b.i);
      const n = metas.length;
      metas.forEach((m, k) => {
        // 锁定的 order 层级不参与整理：保留原 layer/order，不改写。
        const first = m.lane.map((id) => findObjectEntry(id)).find((e) => e && e.obj);
        const curOrder = first && first.obj.order != null ? first.obj.order : null;
        if (curOrder != null && timeline.lockedOrders && timeline.lockedOrders.has(curOrder)) return;
        const order = n - 1 - k;
        for (const id of m.lane) {
          const e = findObjectEntry(id);
          if (e && ['sprite', 'text', 'video', 'line'].includes(e.type)) {
            syncObjectField(e.obj, 'layer', layer);
            syncObjectField(e.obj, 'order', order);
          }
        }
      });
    }
    // 整理轨道后 (layer, order) 发生变化的对象：标记为自动排序高亮。
    const autoMoved = [];
    for (const [group] of Object.entries(GROUP_TYPES)) {
      for (const o of state.storyboard[group] || []) {
        if (!o || o.id == null) continue;
        const now = (o.layer != null ? o.layer : 0) + '::' + (o.order != null ? o.order : 0);
        if (beforePos.get(o.id) !== undefined && beforePos.get(o.id) !== now) autoMoved.push(o.id);
      }
    }
    markAutoMoved(autoMoved);
    // 当前 order 锁定配置一并写入（Cyster 专属，原 storyboard 没有）。
    tl.lockedOrders =
      Array.from(timeline.lockedOrders || []).filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
    state.dirty = true;
    persistProjectState();
    saveStoryboard();
    // 刷新时间轴对象元数据（order/layer），让名称列与 order 徽标显示整理后的值。
    renderTimeline();
  }

  // order 锁定配置写回 .ctr 项目文件的 editor.timeline（Cyster 可视化专属信息）。
  function saveLockedOrders(orders) {
    if (!state.storyboard) return;
    snapshot();
    const tl = ensureEditorTimeline();
    tl.version = 5;
    tl.lockedOrders = (Array.isArray(orders) ? orders : [])
      .filter((x) => Number.isFinite(x))
      .sort((a, b) => a - b);
    state.dirty = true;
    persistProjectState();
  }

  // 垂直拖动时间块调整上下层级：更新 storyboard 的 order，并按 order 重排。
  function reorderStageObject(id, laneIndex, live) {
    const entry = findObjectEntry(id);
    if (!entry || !['sprite', 'text', 'video', 'line'].includes(entry.type)) return;
    const sorted = stageObjectsSorted();
    const idx = sorted.findIndex((x) => x.obj.id === id);
    if (idx < 0) return;
    const lanes = currentStageLanes();
    if (laneIndex < 0 || laneIndex >= lanes.length) return;
    const anchorId = lanes[laneIndex].ids[0];
    if (!anchorId || anchorId === id) return;
    // 锁定的 order 层级不能被拖入：直接跳过（防御，拖动层已自动跳过锁定行）。
    const anchorE0 = findObjectEntry(anchorId);
    if (anchorE0 && isOrderLocked(anchorE0.obj)) return;
    if (!live) snapshot();
    const merged = readCysterStageLanes();
    if (merged) {
      // 合并布局：把对象移入目标轨道，layer 与 order 都取该轨道的层级值。
      const anchorE = findObjectEntry(anchorId);
      syncObjectField(entry.obj, 'layer', anchorE && anchorE.obj.layer != null ? anchorE.obj.layer : 0);
      syncObjectField(entry.obj, 'order', anchorE && anchorE.obj.order != null ? anchorE.obj.order : 0);
      const newLanes = lanes.map((l) => ({ ids: l.ids.filter((x) => x !== id) }));
      const tgt = newLanes[laneIndex];
      if (tgt) tgt.ids.push(id);
      const cleaned = newLanes.map((l) => l.ids).filter((l) => l.length);
      setCysterStageLanes(cleaned);
    } else {
      let ins = sorted.findIndex((x) => x.obj.id === anchorId);
      if (ins < 0) return;
      const item = sorted.splice(idx, 1)[0];
      if (idx < ins) ins--;
      sorted.splice(ins, 0, item);
      // 换轨跨层时采用目标轨道的 layer；随后按层重编号（顶部=该层最大 order）。
      const anchorE = findObjectEntry(anchorId);
      syncObjectField(item.obj, 'layer', anchorE && anchorE.obj.layer != null ? anchorE.obj.layer : 0);
      renumberByLayer(sorted);
    }
    state.dirty = true;
    resolveLaneOverlaps([entry.obj.id]);
    restorePushedLanes(dragLaneSnapshot);
    dirtyAndRefresh();
  }

  // 当前 controller / note_controller 轨道的显示顺序（合并布局或默认一对象一轨）。
  function currentGroupLanes(group) {
    const list = group === 'controller'
      ? (state.storyboard.controllers || [])
      : (state.storyboard.note_controllers || []);
    const merged = group === 'controller' ? readCysterControllerLanes() : readCysterNoteLanes();
    if (merged) {
      const lanes = merged.map((ids) => ids.slice());
      const covered = new Set(lanes.flat());
      for (const o of list) if (!covered.has(o.id)) lanes.push([o.id]);
      return lanes;
    }
    return list.map((o) => [o.id]);
  }

  // 垂直拖动 controller / note_controller 时间块调整其轨道上下顺序（无层级概念，
  // 只把该轨道移到目标位置），并把新的轨道顺序写入 .ctr 的隐性配置。
  function reorderSpecialLane(id, group, laneIndex, live) {
    const wantType = group === 'controller' ? 'controller' : 'note_controller';
    const entry = findObjectEntry(id);
    if (!entry || entry.type !== wantType) return;
    if (!live) snapshot();
    const lanes = currentGroupLanes(group);
    if (laneIndex < 0 || laneIndex >= lanes.length) return;
    const srcIdx = lanes.findIndex((l) => l.includes(id));
    if (srcIdx < 0 || srcIdx === laneIndex) return;
    const moved = lanes.splice(srcIdx, 1)[0];
    let ins = laneIndex;
    if (srcIdx < ins) ins--;
    lanes.splice(ins, 0, moved);
    const tl = ensureEditorTimeline();
    tl.version = 5;
    tl.trackGroups = tl.trackGroups || { stage: [], note_controller: [], controller: [] };
    tl.trackGroups[group] = lanes.map((l) => l.slice());
    state.dirty = true;
    persistProjectState();
    timeline.setMergedLanes(readCysterTrackGroups());
    dirtyAndRefresh();
  }

  // 统一换轨入口：stage 走 order/layer 层级；controller / note_controller 走
  // .ctr 里持久化的隐性轨道顺序（note_controller 与 stage 同步：只移动被选
  // 中的块到目标轨道，随后按时间重叠挤开；controller 保留整轨顺序移动）。
  function reorderObjectLane(id, group, laneIndex, live) {
    const entry = findObjectEntry(id);
    if (!entry) return;
    if (['sprite', 'text', 'video', 'line'].includes(entry.type)) {
      reorderStageObject(id, laneIndex, live);
      return;
    }
    if (group === 'note_controller' && entry.type === 'note_controller') {
      moveNoteBlockLane(id, laneIndex, live);
      return;
    }
    if (group !== 'controller' && group !== 'note_controller') return;
    reorderSpecialLane(id, group, laneIndex, live);
  }

  // 拖动换轨：note_controller（含合并时间块）只把被拖的块移入目标轨道，其它
  // 成员不动；移入后按时间重叠把重叠块挤到相邻/新轨道（与 stage 拖拽一致）。
  function moveNoteBlockLane(id, laneIndex, live) {
    const entry = findObjectEntry(id);
    if (!entry || entry.type !== 'note_controller') return;
    if (!live) snapshot();
    const lanes = currentGroupLanes('note_controller');
    const srcIdx = lanes.findIndex((l) => l.includes(id));
    if (srcIdx < 0 || laneIndex < 0 || laneIndex >= lanes.length || srcIdx === laneIndex) return;
    const from = lanes[srcIdx];
    from.splice(from.indexOf(id), 1);
    const to = lanes[laneIndex];
    if (!to) lanes[laneIndex] = [id];
    else to.push(id);
    const tl = ensureEditorTimeline();
    tl.version = 5;
    tl.trackGroups = tl.trackGroups || { stage: [], note_controller: [], controller: [] };
    tl.trackGroups.note_controller = lanes.filter((l) => l.length).map((l) => l.slice());
    state.dirty = true;
    resolveNoteLaneOverlaps([id]);
    persistProjectState();
    timeline.setMergedLanes(readCysterTrackGroups());
    dirtyAndRefresh();
  }

  // 按 layer 分组重编号 order：每层内顶部对象 order 最大、order=0 在该层底部。
  function renumberByLayer(sorted) {
    const sizes = new Map();
    for (const x of sorted) {
      const l = x.obj.layer != null ? x.obj.layer : 0;
      sizes.set(l, (sizes.get(l) || 0) + 1);
    }
    const seen = new Map();
    for (const x of sorted) {
      const l = x.obj.layer != null ? x.obj.layer : 0;
      const n = seen.get(l) || 0;
      seen.set(l, n + 1);
      syncObjectField(x.obj, 'order', sizes.get(l) - 1 - n);
    }
  }

  // 同一时间块内关键帧时间不允许重复：把目标时间挪到与相邻关键帧相差 0.001。
  function avoidKfCollision(obj, skipIndex, nt) {
    const times = [];
    const base = resolveTime(obj.time);
    if (base != null) times.push(base);
    for (let i = 0; i < (obj.states || []).length; i++) {
      if (i === skipIndex) continue;
      const t = resolveTime((obj.states[i] || {}).time);
      if (t != null) times.push(t);
    }
    for (const t of times) {
      if (Math.abs(nt - t) < 1e-6) nt = t > nt ? t - 0.001 : t + 0.001;
    }
    return roundTime(nt);
  }

  // 属性面板修改 time 时校验：目标时间是否与同对象其他关键帧重复。
  function timeCollides(obj, skipIdx, rawTime) {
    let nt = resolveTime(rawTime);
    if (nt == null && typeof rawTime === 'string' && rawTime.trim() !== '' && isFinite(Number(rawTime))) {
      nt = Number(rawTime);
    }
    if (nt == null) return false;
    return objectKeyframes(obj).some((k) => k.index !== skipIdx && Math.abs(k.time - nt) < 1e-6);
  }

  // 合并轨道内“自动挤开”：拖动/拉长造成同一轨道内时间块重叠时，不再把被挤的
  // 对象往后推时间，而是把它移到上/下相邻的空闲轨道（层级），保持其时间不变；
  // 找不到任何空闲轨道时才退回时间平移，保证整轨互不重叠。
  function resolveLaneOverlaps(draggedIds) {
    const merged = readCysterStageLanes();
    if (!merged || !draggedIds || !draggedIds.length) return;
    const dragged = new Set(draggedIds);
    const moved = new Set();
    const buildLanes = () => merged.map((lane) => lane
      .map((id) => {
        const entry = findObjectEntry(id);
        if (!entry || !['sprite', 'text', 'video', 'line'].includes(entry.type)) return null;
        // 合并时间块（对象级 note 选择器 + $note 时间）按全部命中 note 计算
        // 占用区间，与时间轴显示一致；普通对象退回单对象关键帧。
        const sp = objectTimeSpan(entry.obj);
        if (!sp) return null;
        return {
          id, o: entry.obj,
          start: sp.start,
          end: sp.end
        };
      })
      .filter(Boolean));
    const fits = (items, victim) => !items.some((x) =>
      x.id !== victim.id && victim.start < x.end - 0.001 && x.start < victim.end - 0.001);
    // 优先挤到上/下相邻轨道，相邻轨道满了再继续向外找（i-1, i+1, i-2, i+2…）。
    const findFreeLane = (lanes, fromLi, victim) => {
      for (let dist = 1; dist < lanes.length; dist++) {
        for (const li of [fromLi - dist, fromLi + dist]) {
          if (li < 0 || li >= lanes.length || li === fromLi) continue;
          if (fits(lanes[li], victim)) return li;
        }
      }
      return -1;
    };
    const moveToLane = (fromLi, toLi, victim) => {
      const from = merged[fromLi];
      const to = merged[toLi];
      const i = from.indexOf(victim.id);
      if (i < 0) return false;
      from.splice(i, 1);
      to.push(victim.id);
      // 被挤对象移入目标轨道后采用该轨道的 layer/order（上下层级）。
      const anchorE = to.map((id) => findObjectEntry(id)).find((e) => e && e.obj);
      if (anchorE) {
        syncObjectField(victim.o, 'layer', anchorE.obj.layer != null ? anchorE.obj.layer : 0);
        syncObjectField(victim.o, 'order', anchorE.obj.order != null ? anchorE.obj.order : 0);
      }
      return true;
    };
    let movedAny = false;
    let changed = true;
    let guard = 0;
    while (changed && guard++ < 8) {
      changed = false;
      const lanes = buildLanes();
      for (let li = 0; li < lanes.length; li++) {
        const items = lanes[li].slice().sort((a, b) => a.start - b.start);
        for (let i = 0; i < items.length; i++) {
          for (let j = i + 1; j < items.length; j++) {
            const a = items[i], b = items[j];
            if (b.start >= a.end - 0.001) continue;
            const aDragged = dragged.has(a.id) && !moved.has(a.id);
            const bDragged = dragged.has(b.id) && !moved.has(b.id);
            let victim = null;
            if (aDragged && !bDragged) victim = b;
            else if (bDragged && !aDragged) victim = a;
            else if (!aDragged && !bDragged) victim = b; // 级联：被挤对象继续找相邻轨道
            if (!victim) continue;
            const toLi = findFreeLane(lanes, li, victim);
            if (toLi >= 0) {
              moveToLane(li, toLi, victim);
              moved.add(victim.id);
              markAutoMoved(victim.id);
              movedAny = true;
              changed = true;
              break;
            }
            // 没有空闲相邻轨道：给被挤对象开一条单独的新轨道，并重新排序。
            if (!dragged.has(victim.id) && !isOrderLocked(victim.o)) {
              const from = merged[li];
              const vi = from.indexOf(victim.id);
              if (vi >= 0) {
                from.splice(vi, 1);
                merged.push([victim.id]);
                renumberStageLanes(merged);
                moved.add(victim.id);
                markAutoMoved(victim.id);
                movedAny = true;
                changed = true;
                break;
              }
            }
            // 被锁定 order 的对象不能换轨/改序：退回时间平移，保持不重叠。
            if (!dragged.has(victim.id)) {
              const need = a.end - b.start;
              const shift = victim === b ? need : Math.min(need, Math.max(0, a.start));
              if (shift > 0.001) {
                shiftObjectTimes(victim.o, victim === b ? shift : -shift);
                movedAny = true;
                changed = true;
                break;
              }
            }
          }
          if (changed) break;
        }
        if (changed) break;
      }
    }
    if (movedAny) {
      setCysterStageLanes(merged);
      state.dirty = true;
    }
  }

  // note_controller 合并轨道（无层级概念）的自动挤开：给前一个块添加关键帧
  // 使其时间延伸到后块范围内时，把后块挤到相邻/新轨道，保持同轨时间不重叠。
  function resolveNoteLaneOverlaps(draggedIds) {
    if (!draggedIds || !draggedIds.length) return;
    const lanes = readCysterNoteLanes();
    if (!lanes) return;
    const dragged = new Set(draggedIds);
    const moved = new Set();
    const spanOf = (obj) => {
      // 与时间轴显示一致：按对象级 note 选择器逐 note 解析 $note 时间，取整体
      // 最早/最晚作为轨道占用区间（controllerKeyframes 只解析 state 级 note，
      // 对 obj.note + $note 时间会解析为空，导致合并时间块不参与轨道挤开）。
      const kfs = objectKeyframesAllNotes(obj);
      if (!kfs.length) return null;
      const start = kfs[0].time;
      return { start, end: Math.max(start + 0.25, kfs[kfs.length - 1].time) };
    };
    const build = () => lanes.map((lane) => lane
      .map((id) => {
        const e = findObjectEntry(id);
        if (!e || e.type !== 'note_controller' || !e.obj) return null;
        const sp = spanOf(e.obj);
        return sp ? { id, sp } : null;
      })
      .filter(Boolean));
    const fits = (items, victim) => !items.some((x) =>
      x.id !== victim.id && victim.sp.start < x.sp.end - 0.001 && x.sp.start < victim.sp.end - 0.001);
    const findFree = (items, fromLi, victim) => {
      for (let dist = 1; dist < items.length; dist++) {
        for (const li of [fromLi - dist, fromLi + dist]) {
          if (li < 0 || li >= items.length || li === fromLi) continue;
          if (fits(items[li], victim)) return li;
        }
      }
      return -1;
    };
    let movedAny = false;
    let changed = true;
    let guard = 0;
    while (changed && guard++ < 8) {
      changed = false;
      const items = build();
      for (let li = 0; li < items.length; li++) {
        const row = items[li].slice().sort((a, b) => a.sp.start - b.sp.start);
        for (let i = 0; i < row.length; i++) {
          for (let j = i + 1; j < row.length; j++) {
            const a = row[i], b = row[j];
            if (b.sp.start >= a.sp.end - 0.001) continue;
            const aDragged = dragged.has(a.id) && !moved.has(a.id);
            const bDragged = dragged.has(b.id) && !moved.has(b.id);
            let victim = null;
            if (aDragged && !bDragged) victim = b;
            else if (bDragged && !aDragged) victim = a;
            else if (!aDragged && !bDragged) victim = b;
            if (!victim) continue;
            const from = lanes[li];
            const vi = from.indexOf(victim.id);
            if (vi < 0) continue;
            const toLi = findFree(items, li, victim);
            if (toLi >= 0) {
              from.splice(vi, 1);
              lanes[toLi].push(victim.id);
            } else {
              from.splice(vi, 1);
              lanes.push([victim.id]);
            }
            moved.add(victim.id);
            markAutoMoved(victim.id);
            movedAny = true;
            changed = true;
            break;
          }
          if (changed) break;
        }
        if (changed) break;
      }
    }
    if (movedAny) {
      const tl = ensureEditorTimeline();
      tl.trackGroups = tl.trackGroups || { stage: [], note_controller: [], controller: [] };
      tl.trackGroups.note_controller = lanes.map((l) => l.slice()).filter((l) => l.length);
      state.dirty = true;
      persistProjectState();
    }
  }

  // stage + note_controller 合并轨道统一挤开入口。
  function resolveAllLaneOverlaps(ids) {
    resolveLaneOverlaps(ids);
    resolveNoteLaneOverlaps(ids);
  }

  // 标记被自动移动/排序的时间块：渲染为临时明黄高亮，下次点击时清除。
  function markAutoMoved(ids) {
    if (!state.autoMovedIds) state.autoMovedIds = new Set();
    for (const id of (Array.isArray(ids) ? ids : [ids])) {
      if (id != null) state.autoMovedIds.add(id);
    }
  }

  // ---- 换轨挤开对象的临时性 ----
  // 拖动期间 resolveLaneOverlaps 会把被挤对象实时移走；拖动结束时若拖动对象
  // 并未真正占用被挤对象的原位（时间不重叠），则把被挤对象放回原轨道并恢复
  // 其 layer/order。
  let dragLaneSnapshot = null;

  function captureLanePushState(ids) {
    const merged = readCysterStageLanes();
    if (!merged) { dragLaneSnapshot = null; return; }
    const meta = new Map();
    for (const lane of merged) {
      for (const id of lane) {
        const e = findObjectEntry(id);
        if (e && e.obj) meta.set(id, { layer: e.obj.layer, order: e.obj.order });
      }
    }
    dragLaneSnapshot = {
      lanes: merged.map((l) => l.slice()),
      meta,
      dragged: new Set((ids || []).map((x) => splitEntryId(x).rawId))
    };
  }

  // 恢复被挤开对象：仅当拖动对象没有真正占用其原位（时间不重叠）时放回原
  // 轨道并恢复 layer/order。拖动过程中实时调用；结束时由 finalize 收尾。
  function restorePushedLanes(snap) {
    if (!snap) return;
    const merged = readCysterStageLanes();
    if (!merged) return;
    const startLaneOf = new Map();
    snap.lanes.forEach((lane, i) => { for (const id of lane) startLaneOf.set(id, i); });
    const movedIds = [];
    merged.forEach((lane, i) => {
      for (const id of lane) {
        // 被挤对象（非拖动对象）才允许放回原位。
        if (snap.dragged.has(id)) continue;
        if (startLaneOf.has(id) && startLaneOf.get(id) !== i) movedIds.push(id);
      }
    });
    if (!movedIds.length) return;
    const spanOf = (id) => {
      const e = findObjectEntry(id);
      if (!e || !e.obj) return null;
      // 合并时间块（对象级选择器 + $note）也按整体占用区间判定，避免被顶回的
      // 对象因区间解析为空而错误地放回与合并块重叠的原轨道。
      return objectTimeSpan(e.obj);
    };
    const overlaps = (a, b) => a.start < b.end - 0.001 && b.start < a.end - 0.001;
    let changed = true;
    let guard = 0;
    while (changed && guard++ < 10) {
      changed = false;
      for (const id of movedIds) {
        const li = startLaneOf.get(id);
        const cur = merged.findIndex((lane) => lane.includes(id));
        if (cur < 0 || cur === li) continue;
        const span = spanOf(id);
        if (!span) continue;
        const target = merged[li];
        const conflict = target.some((xid) => {
          if (xid === id) return false;
          const xs = spanOf(xid);
          return xs && overlaps(span, xs);
        });
        if (conflict) continue;
        merged[cur].splice(merged[cur].indexOf(id), 1);
        target.push(id);
        // 恢复原位后不再需要高亮提示。
        if (state.autoMovedIds) state.autoMovedIds.delete(id);
        const meta = snap.meta.get(id);
        if (meta) {
          const e = findObjectEntry(id);
          if (e && e.obj) {
            syncObjectField(e.obj, 'layer', meta.layer);
            syncObjectField(e.obj, 'order', meta.order);
          }
        }
        changed = true;
      }
    }
    setCysterStageLanes(merged.filter((l) => l.length));
    state.dirty = true;
  }

  function finalizeLanePushes() {
    const snap = dragLaneSnapshot;
    dragLaneSnapshot = null;
    restorePushedLanes(snap);
    dirtyAndRefresh(false);
  }

  // 两个 stage 对象的时间块是否在时间上重叠（“占用位置”判定）。
  function spansOverlap(a, b) {
    const sa = objectTimeSpan(a);
    const sb = objectTimeSpan(b);
    if (!sa || !sb) return false;
    return sa.start < sb.end - 0.001 && sb.start < sa.end - 0.001;
  }

  // 右键时间块“上移一层 / 下移一层”：只移动选中的特定对象——选中的连续
  // order 块整体上/下移一层：仅当相邻层有对象在时间上占用了被移动时间块的
  // 位置（部分重叠）时触发互换——把该对象顶到块的另一端（如 order 1/2/3/4
  // 中选中 1/2/3 上移且 4 与块时间重叠 → 4,1,2,3）；相邻位置空缺（无对象或
  // 时间不重叠）时自由移动到该 order，不触发互换。合并轨道内未选中的成员
  // 保持原 order / 原轨道不动。锁定的 order 层不参与。
  function shiftObjectOrder(id, dir) {
    const entry = findObjectEntry(splitEntryId(id).rawId);
    if (!entry) return;
    // note_controller（含合并时间块）没有 order/layer：与 stage 逻辑同步——
    // 只移动被选中的块到相邻轨道；相邻轨道有对象在时间上占用该块位置（重叠）
    // 时互换（把重叠对象顶回原轨），位置空缺时自由并入（不触发互换）。
    if (entry.type === 'note_controller') {
      const lanes = currentGroupLanes('note_controller');
      const idx = lanes.findIndex((l) => l.includes(entry.obj.id));
      if (idx < 0) return;
      const target = idx + (dir < 0 ? -1 : 1);
      if (target < 0 || target >= lanes.length) { toast('该方向没有可移动的层级', true); return; }
      snapshot();
      const from = lanes[idx];
      const to = lanes[target];
      const sp = objectTimeSpan(entry.obj);
      let victim = null;
      if (sp) {
        for (const tid of to) {
          const e = findObjectEntry(tid);
          if (!e || e.type !== 'note_controller') continue;
          const vs = objectTimeSpan(e.obj);
          if (vs && vs.start < sp.end - 0.001 && sp.start < vs.end - 0.001) { victim = e.obj; break; }
        }
      }
      from.splice(from.indexOf(entry.obj.id), 1);
      if (victim) {
        to.splice(to.indexOf(victim.id), 1);
        from.push(victim.id); // 重叠对象被顶回原轨（与 stage 互换一致）
      }
      to.push(entry.obj.id);
      const tl = ensureEditorTimeline();
      tl.version = 5;
      tl.trackGroups = tl.trackGroups || { stage: [], note_controller: [], controller: [] };
      tl.trackGroups.note_controller = lanes.filter((l) => l.length).map((l) => l.slice());
      state.dirty = true;
      persistProjectState();
      timeline.setMergedLanes(readCysterTrackGroups());
      dirtyAndRefresh();
      return;
    }
    // controller 无层级概念：整轨顺序移动（每个控制器一条轨道）。
    if (entry.type === 'controller') {
      const lanes = currentGroupLanes('controller');
      const idx = lanes.findIndex((l) => l.includes(entry.obj.id));
      if (idx < 0) return;
      const target = idx + (dir < 0 ? -1 : 1);
      if (target < 0 || target >= lanes.length) { toast('该方向没有可移动的层级', true); return; }
      snapshot();
      const moved = lanes.splice(idx, 1)[0];
      lanes.splice(target, 0, moved);
      const tl = ensureEditorTimeline();
      tl.version = 5;
      tl.trackGroups = tl.trackGroups || { stage: [], note_controller: [], controller: [] };
      tl.trackGroups.controller = lanes.map((l) => l.slice());
      state.dirty = true;
      persistProjectState();
      timeline.setMergedLanes(readCysterTrackGroups());
      dirtyAndRefresh();
      return;
    }
    if (!['sprite', 'text', 'video', 'line'].includes(entry.type)) return;
    const selRaw = (state.selectedIds || [])
      .filter((x) => !isNoteEntry(x))
      .map((x) => splitEntryId(x).rawId);
    const targets = selRaw.includes(entry.obj.id) && selRaw.length > 1 ? selRaw : [entry.obj.id];
    const sorted = stageObjectsSorted();
    // 当前轨道布局：合并轨道（.ctr）或默认一对象一轨，按首对象位置排序。
    const merged = readCysterStageLanes();
    const laneList = merged ? merged.slice() : sorted.map((x) => [x.obj.id]);
    const pos = new Map(sorted.map((x, i) => [x.obj.id, i]));
    laneList.sort((a, b) => ((pos.get(a[0]) ?? 0) - (pos.get(b[0]) ?? 0)));
    // 按层分组选中对象（同 layer 之间才互换层级）。
    const byLayer = new Map();
    for (const tid of targets) {
      const e = findObjectEntry(tid);
      if (!e || !e.obj) continue;
      const layer = e.obj.layer != null ? e.obj.layer : 0;
      if (!byLayer.has(layer)) byLayer.set(layer, []);
      byLayer.get(layer).push(e.obj);
    }
    const orderLockedVal = (ord) => !!(timeline.lockedOrders && timeline.lockedOrders.has(ord));
    const plans = []; // { obj, toOrder, seq }
    for (const [layer, objs] of byLayer) {
      const selByOrder = new Map();
      for (const o of objs) {
        const ord = o.order != null ? o.order : 0;
        if (!selByOrder.has(ord)) selByOrder.set(ord, []);
        selByOrder.get(ord).push(o);
      }
      // 连续 order 合并为块（同 order 的多个选中对象同属一块）。
      const selOrders = [...selByOrder.keys()].sort((a, b) => a - b);
      const blocks = [];
      for (const ord of selOrders) {
        const last = blocks[blocks.length - 1];
        if (last && ord === last.hi + 1) { last.hi = ord; last.orders.push(ord); }
        else blocks.push({ lo: ord, hi: ord, orders: [ord] });
      }
      const step = dir < 0 ? 1 : -1;
      let seq = 0;
      for (const block of blocks) {
        // 锁定 order 不参与：块自身含锁定 order，或边界 order 被锁定时跳过。
        if (block.orders.some(orderLockedVal)) continue;
        const boundary = dir < 0 ? block.hi + 1 : block.lo - 1;
        if (orderLockedVal(boundary)) continue;
        // 边界占位 = 该 order 轨道（同 layer 同 order 共轨）中第一个与块内
        // 对象时间重叠的成员；只顶开这一“特定对象”，轨道内其它成员不动。
        // 无时间重叠 = 位置空缺 → 自由移动，不触发互换。
        let occupant = null;
        for (const lane of laneList) {
          const firstId = lane[0];
          const fe = firstId != null ? findObjectEntry(firstId) : null;
          if (fe && fe.obj && (fe.obj.layer != null ? fe.obj.layer : 0) === layer &&
              (fe.obj.order != null ? fe.obj.order : 0) === boundary) {
            const blockObjs = block.orders.flatMap((ord) => selByOrder.get(ord) || []);
            occupant = lane
              .map((id) => findObjectEntry(id))
              .filter((e) => e && e.obj)
              .map((e) => e.obj)
              .find((o) => blockObjs.some((b) => spansOverlap(o, b))) || null;
            break;
          }
        }
        // 应用顺序：上移从块顶向下、下移从块底向上，保证目标 order 的轨道在
        // 移动时仍由“即将让位”的对象占据；被顶开的边界对象最后处理。
        const orderSeq = dir < 0
          ? block.orders.slice().sort((a, b) => b - a)
          : block.orders.slice().sort((a, b) => a - b);
        for (const ord of orderSeq) {
          for (const o of selByOrder.get(ord)) plans.push({ obj: o, toOrder: ord + step, seq: seq++ });
        }
        if (occupant) plans.push({ obj: occupant, toOrder: dir < 0 ? block.lo : block.hi, seq: seq++ });
      }
    }
    if (!plans.length) { toast('该方向没有可移动的层级', true); return; }
    const seen = new Set();
    const finalPlans = plans
      .filter((p) => {
        if (seen.has(p.obj.id)) return false;
        seen.add(p.obj.id);
        return true;
      })
      .sort((a, b) => a.seq - b.seq);
    snapshot();
    for (const p of finalPlans) {
      const layer = p.obj.layer != null ? p.obj.layer : 0;
      syncObjectField(p.obj, 'order', p.toOrder);
      moveObjectToOrderLane(laneList, p.obj.id, layer, p.toOrder);
    }
    setCysterStageLanes(laneList);
    state.dirty = true;
    resolveLaneOverlaps(targets);
    dirtyAndRefresh();
  }

  function renderTimeline() {
    if (!state.storyboard) { timeline.setData([], 60); return; }
    const objs = [];
    // stage 类对象跨 sprite/text/video/line 按 order 全局排序后再生成轨道。
    const stageEntries = [];
    for (const [group, type] of Object.entries(GROUP_TYPES)) {
      const list = (state.storyboard[group] || []).slice();
      if (type === 'sprite' || type === 'text' || type === 'video' || type === 'line') {
        for (const obj of list) stageEntries.push({ obj, type, group });
      } else {
        for (const obj of list) {
          for (const entry of timelineEntriesForObject(obj, type, group)) objs.push(entry);
        }
      }
    }
    // 读取 storyboard 时，stage 类对象按 (layer, order) 复合层级排序：
    // 先按 layer 分三段（2 最顶），层内 order 大者在上；缺省按 0 处理。
    stageEntries.sort((a, b) => {
      const la = a.obj.layer != null ? a.obj.layer : 0;
      const lb = b.obj.layer != null ? b.obj.layer : 0;
      if (lb !== la) return lb - la;
      const oa = a.obj.order != null ? a.obj.order : 0;
      const ob = b.obj.order != null ? b.obj.order : 0;
      return ob - oa;
    });
    for (const x of stageEntries) {
      for (const entry of timelineEntriesForObject(x.obj, x.type, x.group)) objs.push(entry);
    }
    // Align the timeline with the actual music length (whichever is longer)
    const dur = Math.max(
      state.chart ? state.chart.endTime : 0,
      state.audioDuration || 0
    ) + 1;
    timeline.setData(objs, dur);
    // 恢复 .str 文件里持久化的合并轨道布局（Cyster 可视化专属信息）。
    timeline.setMergedLanes(readCysterTrackGroups());
    // 恢复 .str 文件里持久化的 order 锁定配置（Cyster 可视化专属信息）。
    timeline.setLockedOrders(readCysterLockedOrders());
    // Auto-fit zoom when the chart length changes (1.5x length at min zoom)
    if (state._lastAutoDur !== dur) {
      state._lastAutoDur = dur;
      timeline.setAutoZoom(dur);
    }
    timeline.setTime(preview.time);
    timeline.setMultiSelection({
      ids: state.selectedIds.length ? state.selectedIds : (state.selectedObjId ? [state.selectedObjId] : []),
      kfs: state.selectedKfs
    });
    $('#timeTotal').textContent = fmtTime(dur);
  }

  // Split a timeline entry id into the raw storyboard object id and the
  // expanded note id (present when the object uses note selectors).
  // 注意：compiled 展开产物的真实对象 id 形如 "note_controller_8::492"（前缀
  // 对象可能不存在，如 .ctr 元数据缺失时），此时不能按 per-note 条目拆分，否则
  // 该对象会解析到不存在的前缀而无法编辑/删除。规则：完整 id 本身是真实对象时
  // 按整体处理；否则仅当 rawId 前缀是真实对象（或 note 伪分组）时才拆分。
  function splitEntryId(id) {
    const s = String(id);
    const i = s.lastIndexOf('::');
    if (i < 0) return { rawId: s, noteId: null };
    const suffix = s.slice(i + 2);
    const n = Number(suffix);
    if (!Number.isFinite(n)) return { rawId: s, noteId: null };
    if (findRawObject(s)) return { rawId: s, noteId: null };
    const rawId = s.slice(0, i);
    if (rawId !== 'note' && !findRawObject(rawId)) return { rawId: s, noteId: null };
    return { rawId, noteId: n };
  }

  // Timeline entries for one raw object. Objects whose time/content is driven
  // by note selectors ("note":[...] / "time":"start:$note") get one node per
  // selected note, so every affected note is visible and editable.
  function timelineEntriesForObject(obj, type, group) {
    const noteIds = collectNoteIds(obj);
    const baseLabel = obj.id || group + '#' + indexInGroup(obj);
    const build = (id, label, kfs, extra) => {
      const clipStart = kfs.length ? kfs[0].time : 0;
      const clipEnd = kfs.length ? Math.max(clipStart + 0.25, kfs[kfs.length - 1].time) : clipStart + 1;
      const e = {
        id, type, label,
        keyframes: kfs, clipStart, clipEnd,
        noClip: type === 'controller',
        lifecycle: true,
        path: (type === 'sprite' || type === 'video') ? obj.path : undefined,
        // controller / note_controller 没有层级（order/layer）概念。
        order: (type === 'sprite' || type === 'text' || type === 'video' || type === 'line')
          ? (obj.order != null ? obj.order : 0) : undefined,
        layer: (type === 'sprite' || type === 'text' || type === 'video' || type === 'line')
          ? (obj.layer != null ? obj.layer : 0) : undefined
      };
      if (extra) Object.assign(e, extra);
      return e;
    };
    if (type === 'controller') {
      // A controller stays on ONE lane: the content in "states":[] is the
      // continuation of the initial state {}, so everything merges into the
      // same lane; every time specified (including "time":[...] arrays and
      // note-selector times) gets its own node.
      const kfs = controllerKeyframes(obj);
      return [build(obj.id || '(auto)', baseLabel, kfs, { segments: controllerSegments(obj, kfs) })];
    }
    // note 选择器对象（任意类型）：合并模式显示单个特殊时间块（最早/最晚两枚
    // 亮蓝圆形关键帧 + 中央命中数徽标）；note_controller 拆分模式把每个隶属
    // note 各展开为一个独立时间块。
    if (obj.note && typeof obj.note === 'object') {
      if (isNoteSelectorMerged(obj.id)) {
        return [build(obj.id || '(auto)', baseLabel, mergedNoteKeyframes(obj),
          { mergedSelector: true, noteCount: collectNoteIds(obj).length,
            invalidNote: noteMappingLost(obj.note) || collectNoteIds(obj).length === 0 })];
      }
      if (type === 'note_controller') {
        const nids = collectNoteIds(obj);
        if (nids.length > 1) {
          return nids.map((nid) =>
            build(obj.id + '::' + nid, baseLabel + ' · note#' + nid, objectKeyframesForNote(obj, nid),
              { splitSelector: true, noteId: nid,
                invalidNote: !state.chart || !state.chart.noteById(nid) || noteShifted(nid) }));
        }
      }
    }
    if (!noteIds.length) {
      return [build(obj.id || '(auto)', baseLabel, objectKeyframes(obj))];
    }
    // Note-selector objects stay on ONE compact lane (no per-note expansion or
    // group folding): every note-selector time resolves onto that lane.
    return [build(obj.id || '(auto)', baseLabel, objectKeyframesAllNotes(obj),
      { invalidNote: noteMappingLost(obj.note) })];
  }

  function isNoteSelectorMerged(id) {
    return !!(state.noteSelectorMerge && state.noteSelectorMerge[id]);
  }

  // 合并时间块的关键帧：只取全部子 note 关键帧的最早时间与最晚时间，展示用。
  function mergedNoteKeyframes(obj) {
    const all = objectKeyframesAllNotes(obj);
    if (!all.length) return [];
    let min = Infinity, max = -Infinity;
    for (const k of all) {
      if (k.time < min) min = k.time;
      if (k.time > max) max = k.time;
    }
    return [
      { index: -1, time: min, label: '最早', draggable: false, displayOnly: true, merged: true, easing: '', fromText: '', toText: '' },
      { index: -2, time: max, label: '最晚', draggable: false, displayOnly: true, merged: true, easing: '', fromText: '', toText: '' }
    ];
  }

  // Keyframes of an object with note selectors, resolved across ALL selected
  // notes onto a single lane (keeps the timeline compact).
  function objectKeyframesAllNotes(obj) {
    const noteIds = collectNoteIds(obj);
    if (!noteIds.length) return objectKeyframes(obj);
    const kfs = [];
    for (const nid of noteIds) kfs.push(...objectKeyframesForNote(obj, nid));
    kfs.sort((a, b) => a.time - b.time);
    return kfs;
  }

  // Active ranges of a controller: between consecutive state times, which
  // fields are in effect (label = the fields changed at the interval end).
  function controllerSegments(obj, kfs) {
    const segs = [];
    const sorted = kfs.slice().sort((a, b) => a.time - b.time);
    for (let i = 0; i < sorted.length - 1; i++) {
      const a = sorted[i], b = sorted[i + 1];
      if (b.time <= a.time) continue;
      const st = b.index === -1 ? obj : (obj.states && obj.states[b.index]);
      if (!st || typeof st !== 'object') continue;
      const fields = Object.keys(st).filter((k) => !['time', 'easing', 'note', 'id'].includes(k));
      segs.push({ start: a.time, end: b.time, label: fields.join(', ') || 'state' });
    }
    return segs;
  }

  // Union of note ids selected by a single note selector token.
  function noteSelectorIds(sel) {
    const ids = [];
    const add = (token) => {
      if (token == null) return;
      if (Array.isArray(token)) { token.forEach(add); return; }
      if (typeof token === 'number') { ids.push(token); return; }
      if (typeof token === 'object') {
        if (!state.chart) return;
        const types = token.type == null
          ? [0, 1, 2, 3, 4, 5, 6, 7]
          : (Array.isArray(token.type) ? token.type.map(Number) : [Number(token.type)]);
        const start = token.start == null ? -2147483648 : token.start;
        const end = token.end == null ? 2147483647 : token.end;
        for (const n of state.chart.notes) {
          if (!types.includes(n.type)) continue;
          if (!(start <= n.id && end >= n.id)) continue;
          if (token.min_x != null && token.min_x > n.x) continue;
          if (token.max_x != null && token.max_x < n.x) continue;
          if (token.direction != null && token.direction !== n.direction) continue;
          ids.push(n.id);
        }
      }
    };
    add(sel);
    return ids;
  }

  // Keyframes of a controller object: the initial state + every entry in
  // states[] merged into one lane, with one node per specified time (time
  // arrays expand; note-selector times resolve per selected note).
  function controllerKeyframes(obj) {
    const kfs = [];
    for (const tok of Array.isArray(obj.time) ? obj.time : [obj.time]) {
      const t = resolveTime(tok);
      if (t != null) {
        const m = kfMeta(obj, null, -1);
        kfs.push({ index: -1, time: t, label: 'K0', draggable: typeof tok === 'number', easing: m.easing, fromText: m.fromText, toText: m.toText, destroy: !!obj.destroy });
      }
    }
    (obj.states || []).forEach((st, i) => {
      const noteIds = st.note != null ? noteSelectorIds(st.note) : [null];
      const tokens = Array.isArray(st.time) ? st.time : [st.time];
      for (const tok of tokens) {
        for (const nid of noteIds) {
          const t = nid != null ? resolveTimeForNote(tok, nid) : resolveTime(tok);
          if (t != null) {
            const m = kfMeta(obj, st, i);
            kfs.push({ index: i, time: t, label: 'K' + (i + 1), draggable: typeof tok === 'number', easing: m.easing, fromText: m.fromText, toText: m.toText, destroy: !!st.destroy });
          }
        }
      }
    });
    kfs.sort((a, b) => a.time - b.time);
    return kfs;
  }

  // Union of note ids selected by the object itself and by its states.
  function collectNoteIds(obj) {
    const ids = new Set();
    const add = (token) => {
      if (token == null) return;
      if (Array.isArray(token)) { token.forEach(add); return; }
      if (typeof token === 'number') { ids.add(token); return; }
      if (typeof token === 'object') {
        const sel = token;
        if (!state.chart) return;
        const types = sel.type == null
          ? [0, 1, 2, 3, 4, 5, 6, 7]
          : (Array.isArray(sel.type) ? sel.type.map(Number) : [Number(sel.type)]);
        const start = sel.start == null ? -2147483648 : sel.start;
        const end = sel.end == null ? 2147483647 : sel.end;
        for (const n of state.chart.notes) {
          if (!types.includes(n.type)) continue;
          if (!(start <= n.id && end >= n.id)) continue;
          if (sel.min_x != null && sel.min_x > n.x) continue;
          if (sel.max_x != null && sel.max_x < n.x) continue;
          if (sel.direction != null && sel.direction !== n.direction) continue;
          ids.add(n.id);
        }
      }
    };
    add(obj.note);
    for (const st of obj.states || []) add(st.note);
    return [...ids];
  }

  // Does a note selector include the given note id?
  function noteSelectorIncludes(token, nid) {
    if (token == null) return true;
    if (Array.isArray(token)) return token.some((t) => t === nid);
    if (typeof token === 'number') return token === nid;
    if (typeof token === 'object') {
      const sel = token;
      if (!state.chart) return false;
      const n = state.chart.noteById(nid);
      if (!n) return false;
      const types = sel.type == null
        ? [0, 1, 2, 3, 4, 5, 6, 7]
        : (Array.isArray(sel.type) ? sel.type.map(Number) : [Number(sel.type)]);
      if (!types.includes(n.type)) return false;
      if (!(sel.start == null ? -2147483648 : sel.start <= nid && (sel.end == null ? 2147483647 : sel.end) >= nid)) return false;
      if (sel.min_x != null && sel.min_x > n.x) return false;
      if (sel.max_x != null && sel.max_x < n.x) return false;
      if (sel.direction != null && sel.direction !== n.direction) return false;
      return true;
    }
    return false;
  }

  // 谱面变更后“原映射失效”检测：
  //  - 显式 ID 列表/单 ID：引用的 note 在当前谱面不存在，或同一 ID 的时间/类型
  //    相对旧谱面发生错位（会改变 $note 引用 / start:noteID 等表达式的取值）
  //  - 条件型选择器：命中集合为空，或命中的 note 中存在错位（表达式取值变化）
  function noteMappingLost(note) {
    if (note == null) return false;
    const affected = (n) => !state.chart || !state.chart.noteById(n) || noteShifted(n);
    if (typeof note === 'number') return affected(note);
    if (Array.isArray(note)) {
      return note.length === 0 || note.some(affected);
    }
    if (typeof note === 'object') {
      const ids = noteSelectorIds(note);
      return ids.length === 0 || ids.some((n) => noteShifted(n));
    }
    return false;
  }
  // 当前谱面音符签名：id -> [start, end, intro, type]，用于与旧谱面对比。
  function noteSigFromChart(chart) {
    const sig = {};
    if (!chart) return sig;
    for (const n of chart.notes) sig[n.id] = [n.start_time, n.end_time, n.intro_time, n.type];
    return sig;
  }
  // 相对旧签名：同一 ID 存在但时间/类型错位的 note id 集合。
  function computeChartShiftedNotes(prevSig) {
    const out = new Set();
    if (!prevSig || !state.chart) return out;
    for (const n of state.chart.notes) {
      const old = prevSig[n.id];
      if (!old) continue; // 旧谱面没有的 note 属新增，不算错位
      const tDiff = (a, b) => Math.abs(a - b) > 1e-4;
      if (tDiff(old[0], n.start_time) || tDiff(old[1], n.end_time) ||
          tDiff(old[2], n.intro_time) || old[3] !== n.type) {
        out.add(n.id);
      }
    }
    return out;
  }
  function noteShifted(nid) {
    return !!(state.chartShiftedNotes && state.chartShiftedNotes.has(nid));
  }
  function objectNoteMappingLost(obj) {
    if (!obj) return false;
    if (obj.note != null && noteMappingLost(obj.note)) return true;
    return (obj.states || []).some((st) => st.note != null && noteMappingLost(st.note));
  }
  function scanLostNoteMappings() {
    if (!state.storyboard || !state.chart) return 0;
    let n = 0;
    for (const group of Object.keys(GROUP_TYPES)) {
      for (const o of state.storyboard[group] || []) {
        if (o && o.note != null && noteMappingLost(o.note)) n++;
      }
    }
    return n;
  }

  // Resolve a time token with "$note" substituted by the given note id.
  function resolveTimeForNote(value, nid) {
    if (value == null) return null;
    if (typeof value === 'number') return value;
    if (typeof value !== 'string') return null;
    return resolveTime(value.replace(/\$note/g, String(nid)));
  }

  // 收集各 note_controller 的时间表达式 token（.ctr 项目文件里 Cyster 专属）。
  // 导出 storyboard 时时间被编译成绝对数值，重新打开项目时凭此还原成表达式。
  function collectNoteTimeTokens() {
    const out = {};
    if (!state.storyboard) return out;
    for (const nc of state.storyboard.note_controllers || []) {
      if (!nc || nc.id == null) continue;
      const entry = { base: typeof nc.time === 'string' ? nc.time : null, states: [] };
      for (const st of nc.states || []) {
        entry.states.push(typeof st.time === 'string' ? st.time : null);
      }
      if (entry.base != null || entry.states.some((t) => t != null)) out[nc.id] = entry;
    }
    return out;
  }

  // 收集使用 note 选择器（note 为对象/数组）的对象元数据：选择器本身 + $note
  // 时间令牌 + 命中的 note id 列表。导出 storyboard 时选择器被展开成逐 note
  // 的绝对时间对象，重开项目时凭这份元数据还原回单个对象。
  function collectNoteSelectorMeta() {
    const out = {};
    if (!state.storyboard) return out;
    for (const [group, type] of Object.entries(GROUP_TYPES)) {
      for (const o of state.storyboard[group] || []) {
        if (!o || o.id == null || o.note == null || typeof o.note !== 'object') continue;
        out[group + '::' + o.id] = {
          group,
          id: o.id,
          note: JSON.parse(JSON.stringify(o.note)),
          notes: collectNoteIds(o),
          parent_id: o.parent_id != null ? String(o.parent_id) : null,
          time: typeof o.time === 'string' ? o.time : null,
          states: (o.states || []).map((st) => (typeof st.time === 'string' ? st.time : null))
        };
      }
    }
    return out;
  }

  // 重开项目时：把导出后展开的逐 note 对象（id 为 $note 替换结果或 "原id::note"）
  // 合并还原成单个 note 选择器对象，并按 .ctr 记录的 $note 时间令牌恢复时间。
  function reconstructNoteSelectors(sb, meta) {
    if (!sb || !meta || typeof meta !== 'object') return;
    const mergedById = new Map();
    for (const [key, entry] of Object.entries(meta)) {
      if (!entry || !entry.note || typeof entry.note !== 'object') continue;
      const rawId = entry.id;
      const group = entry.group;
      if (!rawId || !group || !Array.isArray(sb[group])) continue;
      if (mergedById.has(key)) continue;
      // 展开产物 id 匹配：原 id / "原id::note号" / "$note 模板按 note 替换后的 id"。
      const prefix = rawId + '::';
      const idSet = new Set([rawId, rawId + '::' + (entry.notes || []).join('::')]);
      const clones = sb[group].filter((x) => {
        if (!x || x.id == null || typeof x.note === 'object') return false;
        if (x.id === rawId || x.id.startsWith(prefix)) return true;
        if (String(rawId).indexOf('$note') >= 0) {
          for (const nid of entry.notes || []) {
            if (x.id === String(rawId).replace(/\$note/g, String(nid))) return true;
          }
        }
        return false;
      });
      if (clones.length <= 1) continue;
      const first = clones[0];
      // 克隆的实际 note 集合：.ctr 元数据可能比 storyboard 旧（缩小选择器后
      // 未同步/写失败），此时若直接沿用 entry.note 会把已排除的 note 复活。
      const actualNotes = [];
      for (const c of clones) {
        let nid = null;
        if (typeof c.note === 'number') nid = c.note;
        else if (c.id != null && c.id !== rawId && String(c.id).indexOf('::') >= 0) {
          const parts = String(c.id).split('::');
          nid = Number(parts[parts.length - 1]);
        }
        if (nid != null && !Number.isNaN(nid)) actualNotes.push(nid);
      }
      actualNotes.sort((a, b) => a - b);
      let mergedNote = JSON.parse(JSON.stringify(entry.note));
      const entryNoteIds = [];
      const collectEntry = (t) => {
        if (t == null) return;
        if (Array.isArray(t)) t.forEach(collectEntry);
        else if (typeof t === 'number') entryNoteIds.push(t);
        else if (typeof t === 'object') noteSelectorIds(t).forEach((n) => entryNoteIds.push(n));
      };
      collectEntry(entry.note);
      const entrySorted = entryNoteIds.slice().sort((a, b) => a - b);
      const notesMatch = entrySorted.length === actualNotes.length &&
        entrySorted.every((n, i) => n === actualNotes[i]);
      if (!notesMatch && actualNotes.length) {
        // 元数据与克隆不一致：以克隆为准（显式 id 列表保真，避免旧 note 复活）。
        mergedNote = actualNotes.length === 1 ? actualNotes[0] : actualNotes.slice();
      }
      const merged = {
        id: rawId,
        note: mergedNote,
        time: entry.time != null ? entry.time : first.time,
        states: []
      };
      for (const k of Object.keys(first)) {
        // states 不能整组复制：克隆里的 states 是绝对时间展开产物，随后会按
        // entry.states 令牌逐个恢复。整组复制会导致表达式选择器重开后 states
        // 翻倍（绝对时间 + 表达式各一份），具体时间关键帧因此“删了又回来”。
        if (k === 'id' || k === 'note' || k === 'time' || k === 'states') continue;
        merged[k] = first[k];
      }
      // $note parent_id 模板随 .ctr 元数据往返：克隆展开后 ParentId 是具体
      // note id（如 parent_0），不还原模板会让整个选择器重开后父级错挂到
      // 第一个 note 的载体上（再保存时所有克隆都指向 parent_0）。
      if (entry.parent_id != null) {
        merged.parent_id = entry.parent_id;
      } else {
        // 旧数据元数据未记录 parent_id：克隆父级是具体 id（如 parent_0）。
        // 若它恰好是已知 $note 载体模板（parent_$note）的具体展开，恢复模板，
        // 让 sprite 与自动创建的 parent_$note 载体在重开后重新正确对应。
        const p = first && first.parent_id;
        if (p && typeof p === 'string') {
          const m = /^(.+?)(\d+)$/.exec(p);
          if (m) {
            const tpl = m[1] + '$note';
            if (state.parentCarriers && state.parentCarriers[tpl]) merged.parent_id = tpl;
          }
        }
      }
      (entry.states || []).forEach((tok, i) => {
        const src = (first.states || [])[i] || {};
        const st = { ...src };
        // compiled 展开时每个 state 都被注入该克隆的 note 号；选择器对象本身的
        // note 已定义隶属关系，保留它会把这些状态错误地限制到单个 note。
        delete st.note;
        delete st.id;
        st.time = tok != null ? tok : src.time;
        merged.states.push(st);
      });
      mergedById.set(key, merged);
    }
    if (!mergedById.size) return;
    for (const [key, merged] of mergedById) {
      const entry = meta[key];
      const rawId = entry.id;
      const group = entry.group;
      const prefix = rawId + '::';
      const removeIds = new Set([rawId]);
      for (const o of sb[group] || []) {
        if (!o || o.id == null) continue;
        if (o.id.startsWith(prefix)) removeIds.add(o.id);
        if (String(rawId).indexOf('$note') >= 0) {
          const nids = [];
          const collectM = (t) => {
            if (t == null) return;
            if (Array.isArray(t)) t.forEach(collectM);
            else if (typeof t === 'number') nids.push(t);
          };
          collectM(merged.note);
          for (const nid of nids) {
            if (o.id === String(rawId).replace(/\$note/g, String(nid))) removeIds.add(o.id);
          }
        }
      }
      sb[group] = sb[group].filter((x) => !removeIds.has(x.id));
      sb[group].push(merged);
    }
  }

  // 尝试把一组绝对时间还原成 $note 表达式（start/end/intro/at + 统一偏移），
  // 拟合失败时退回第一个克隆的绝对时间（保证可编辑，不丢数据）。
  function fitNoteToken(times, noteIds) {
    if (!times || !times.length || !state.chart) return times[0];
    const ref = (base, n) => {
      const note = state.chart.noteById(n);
      if (!note) return null;
      if (base === 'start') return note.start_time;
      if (base === 'end') return note.end_time;
      if (base === 'intro') return note.intro_time;
      return note.start_time;
    };
    for (const base of ['start', 'end', 'intro', 'at']) {
      const offs = [];
      let ok = true;
      for (let i = 0; i < times.length; i++) {
        const r = ref(base, noteIds[i]);
        if (r == null) { ok = false; break; }
        offs.push(times[i] - r);
      }
      if (!ok) continue;
      const spread = Math.max(...offs) - Math.min(...offs);
      if (spread < 1e-4) {
        const off = Math.round(offs[0] * 1e6) / 1e6;
        if (Math.abs(off) < 1e-6) return `${base}:$note`;
        return `${base}:$note:${off}`;
      }
    }
    return times[0];
  }

  // 自愈：compiled 展开产物（id 形如 "前缀::note号"，真实前缀对象已不存在，
  // 且 .ctr 元数据缺失/损坏）会被 splitEntryId 误拆成 per-note 条目而无法编辑。
  // 这里把它们重建回单个 note 选择器对象（note: [] 数组 + 可拟合的 $note 时间
  // 表达式），使这些时间块恢复可编辑/可删除。
  function healOrphanSelectorClones(sb) {
    if (!sb || !state.chart) return sb;
    for (const [group] of Object.entries(GROUP_TYPES)) {
      let list = sb[group] || [];
      const byPrefix = new Map();
      for (const o of list) {
        if (!o || o.id == null) continue;
        const m = /^(.*)::(\d+)$/.exec(String(o.id));
        if (!m) continue;
        const prefix = m[1];
        const nid = Number(m[2]);
        if (!prefix || !state.chart.noteById(nid)) continue;
        if (findRawObject(prefix)) continue; // 真实对象存在：按原样（可能是有意的）
        if (state.parentCarriers && state.parentCarriers[prefix]) continue; // 纯 ID 载体不合并
        if (!byPrefix.has(prefix)) byPrefix.set(prefix, []);
        byPrefix.get(prefix).push(o);
      }
      for (const [prefix, clones] of byPrefix) {
        if (clones.length < 2) continue;
        const noteIds = clones
          .map((c) => Number(String(c.id).split('::')[1]))
          .sort((a, b) => a - b);
        if (noteIds.some((n) => !state.chart.noteById(n))) continue;
        const first = clones.find((c) => Number(String(c.id).split('::')[1]) === noteIds[0]) || clones[0];
        const merged = { id: prefix, note: noteIds.slice(), time: fitNoteToken(
          noteIds.map((nid) => {
            const c = clones.find((x) => Number(String(x.id).split('::')[1]) === nid);
            return c ? c.time : null;
          }), noteIds), states: [] };
        for (const k of Object.keys(first)) {
          if (k === 'id' || k === 'note' || k === 'time' || k === 'states') continue;
          merged[k] = first[k];
        }
        // 形状不一致（各克隆 states 数不同）也合并：按最大状态数逐帧拟合，
        // 缺失该帧的克隆跳过，避免旧条件的 note 重开后变成孤立时间块。
        const maxStates = Math.max(0, ...clones.map((c) => (c.states || []).length));
        for (let i = 0; i < maxStates; i++) {
          const times = [];
          let src = null;
          for (const nid of noteIds) {
            const c = clones.find((x) => Number(String(x.id).split('::')[1]) === nid);
            if (c && c.states && c.states[i]) {
              times.push(c.states[i].time);
              if (!src) src = c.states[i];
            }
          }
          if (!src) continue;
          const st = {};
          for (const k of Object.keys(src)) {
            if (k === 'note' || k === 'id') continue; // 选择器已定义隶属关系
            st[k] = src[k];
          }
          st.time = (times.length === noteIds.length && times.every((t) => t != null))
            ? fitNoteToken(times, noteIds)
            : src.time;
          merged.states.push(st);
        }
        const remove = new Set(clones);
        sb[group] = list.filter((o) => !remove.has(o));
        sb[group].push(merged);
        list = sb[group];
      }
    }
    return sb;
  }

  // 重新打开项目时：按 .ctr 记录的时间表达式，把已导出成绝对时间的
  // note_controller 时间还原回表达式（仅当表达式解析结果与绝对时间一致，
  // 且该控制器 note 为单个 id 时才应用）。
  function applyNoteTimeTokens(sb, tokens) {
    if (!sb || !tokens || typeof tokens !== 'object') return;
    for (const nc of sb.note_controllers || []) {
      if (!nc || nc.id == null) continue;
      const entry = tokens[nc.id];
      if (!entry) continue;
      const nid = typeof nc.note === 'number' ? nc.note : null;
      if (nid == null) continue;
      const match = (token, t) => {
        if (typeof token !== 'string') return false;
        const rt = resolveTimeForNote(token, nid);
        return rt != null && Math.abs(rt - t) < 1e-6;
      };
      const baseT = resolveTime(nc.time);
      if (entry.base && typeof nc.time === 'number' && baseT != null && match(entry.base, baseT)) {
        nc.time = entry.base;
      }
      const unused = new Set();
      (entry.states || []).forEach((tok, i) => { if (typeof tok === 'string') unused.add(i); });
      for (const st of nc.states || []) {
        if (typeof st.time !== 'number') continue;
        const t = resolveTime(st.time);
        if (t == null) continue;
        for (const i of unused) {
          if (match(entry.states[i], t)) {
            st.time = entry.states[i];
            unused.delete(i);
            break;
          }
        }
      }
    }
  }

  // 多选 Note 时间栏解析：纯数字直接返回；带 $note 或具体 note 的选择器式样
  // （start/end/intro/at）按该 note 解析为绝对时间。
  function resolveNoteTimeToken(token, nid) {
    if (token == null) return null;
    if (typeof token === 'number') return token;
    if (typeof token !== 'string') return null;
    const t = String(token).trim();
    if (t === '') return null;
    if (/^-?\d+(\.\d+)?$/.test(t)) return parseFloat(t);
    return resolveTimeForNote(t, nid);
  }

  // First resolvable time of a token (handles arrays and $note contexts).
  function firstResolvedTime(token, noteId) {
    const tokens = Array.isArray(token) ? token : [token];
    for (const t of tokens) {
      const r = noteId != null ? resolveTimeForNote(t, noteId) : resolveTime(t);
      if (r != null) return r;
    }
    return null;
  }

  // Keyframes of one raw object evaluated for a single selected note.
  function objectKeyframesForNote(obj, nid) {
    const kfs = [];
    const t0 = resolveTimeForNote(obj.time, nid);
    if (t0 != null) {
      const m = kfMeta(obj, null, -1);
      kfs.push({ index: -1, time: t0, label: 'K0', draggable: typeof obj.time === 'number', easing: m.easing, fromText: m.fromText, toText: m.toText });
    }
    (obj.states || []).forEach((st, i) => {
      if (!noteSelectorIncludes(st.note, nid)) return;
      const tokens = Array.isArray(st.time) ? st.time : [st.time];
      for (const tok of tokens) {
        const t = resolveTimeForNote(tok, nid);
        if (t != null) {
          const m = kfMeta(obj, st, i);
          kfs.push({ index: i, time: t, label: 'K' + (i + 1), draggable: typeof tok === 'number', easing: m.easing, fromText: m.fromText, toText: m.toText });
        }
      }
    });
    kfs.sort((a, b) => a.time - b.time);
    return kfs;
  }

  function indexInGroup(obj) {
    for (const [group] of Object.entries(GROUP_TYPES)) {
      const list = state.storyboard[group] || [];
      const i = list.indexOf(obj);
      if (i >= 0) return i;
    }
    return 0;
  }

  function moveKeyframe(objId, kfIdx, newTime) {
    const obj = findRawObject(splitEntryId(objId).rawId);
    if (!obj) return;
    newTime = roundTime(newTime);
    if (kfIdx === -1) {
      // 同一时间块内关键帧时间不能重复。
      obj.time = avoidKfCollision(obj, -1, newTime);
    } else if (obj.states && obj.states[kfIdx]) {
      // 非 stage 对象（controller / note_controller）保留不越过 K0 的约束。
      const e = findObjectEntry(obj.id);
      if (!e || !['sprite', 'text', 'video', 'line'].includes(e.type)) {
        const base = resolveTime(obj.time);
        if (base != null && newTime < base - 1e-6) newTime = base;
      }
      newTime = avoidKfCollision(obj, kfIdx, newTime);
      obj.states[kfIdx].time = newTime;
    }
    normalizeK0(obj);
    resolveAllLaneOverlaps([obj.id]);
    restorePushedLanes(dragLaneSnapshot);
    state.dirty = true;
    state.selectedKeyIdx = kfIdx;
    // Lightweight refresh while dragging (skip rebuilding properties/asset DOM)
    if (preview.chart) preview.setStoryboard(state.storyboard);
    renderTimeline();
    requestRender();
  }

  function shiftClip(objId, delta) {
    const { rawId, noteId } = splitEntryId(objId);
    const obj = findRawObject(rawId);
    if (!obj || !delta) return;
    // Rigid whole-block translation: every movable time shifts together so the
    // block window keeps its length. Numeric times shift directly; string times
    // that resolve (e.g. "start:515:0.15", "intro:$note") are converted to
    // absolute shifted times; unresolvable references stay untouched.
    const ctxNote = noteId != null ? noteId : (typeof obj.note === 'number' ? obj.note : null);
    let minT = Infinity;
    const collectMin = (token) => {
      if (typeof token === 'number') return Math.min(minT, token);
      if (typeof token === 'string') {
        const rt = resolveShiftTime(token, ctxNote);
        return rt != null ? Math.min(minT, rt) : minT;
      }
      if (Array.isArray(token)) {
        let m = minT;
        for (const t of token) m = collectMin(t);
        return m;
      }
      return minT;
    };
    const shiftToken = (token) => {
      if (typeof token === 'number') return token + delta;
      if (typeof token === 'string') {
        const rt = resolveShiftTime(token, ctxNote);
        if (rt != null) return rt + delta;
        return token;
      }
      if (Array.isArray(token)) return token.map(shiftToken);
      return token;
    };
    minT = collectMin(obj.time);
    for (const st of obj.states || []) minT = collectMin(st.time);
    if (!isFinite(minT)) return;
    delta = Math.max(delta, -minT);
    if (!delta) return;
    obj.time = shiftToken(obj.time);
    for (const st of obj.states || []) st.time = shiftToken(st.time);
    resolveAllLaneOverlaps([obj.id]);
    restorePushedLanes(dragLaneSnapshot);
    state.dirty = true;
    if (preview.chart) preview.setStoryboard(state.storyboard);
    renderTimeline();
    requestRender();
  }

  function resizeClip(objId, side, newTime) {
    const obj = findRawObject(splitEntryId(objId).rawId);
    if (!obj) return;
    // The block's edges are its earliest/latest keyframes (not necessarily the
    // object's initial time or the last element of the states array).
    const kfs = objectKeyframes(obj);
    if (!kfs.length) return;
    const target = side === 'start' ? kfs[0] : kfs[kfs.length - 1];
    if (target.index === -1) {
      obj.time = newTime;
    } else if (obj.states && obj.states[target.index]) {
      obj.states[target.index].time = newTime;
    }
    normalizeK0(obj);
    resolveAllLaneOverlaps([obj.id]);
    restorePushedLanes(dragLaneSnapshot);
    state.dirty = true;
    if (preview.chart) preview.setStoryboard(state.storyboard);
    renderTimeline();
    requestRender();
  }

  // ---------------------------------------------------------------
  // Multi-select batch operations
  // ---------------------------------------------------------------
  // Earliest resolvable time of an object (same semantics as shiftClip).
  function collectMinTime(obj) {
    const ctxNote = typeof obj.note === 'number' ? obj.note : null;
    let minT = Infinity;
    const collect = (token) => {
      if (typeof token === 'number') { minT = Math.min(minT, token); return; }
      if (typeof token === 'string') {
        const rt = resolveShiftTime(token, ctxNote);
        if (rt != null) minT = Math.min(minT, rt);
        return;
      }
      if (Array.isArray(token)) token.forEach(collect);
    };
    collect(obj.time);
    for (const st of obj.states || []) collect(st.time);
    return minT;
  }

  // Rigid whole-block translation of every time of one object.
  function shiftObjectTimes(obj, delta) {
    if (!delta) return;
    const ctxNote = typeof obj.note === 'number' ? obj.note : null;
    const shiftToken = (token) => {
      if (typeof token === 'number') return roundTime(token + delta);
      if (typeof token === 'string') {
        const rt = resolveShiftTime(token, ctxNote);
        if (rt != null) return roundTime(rt + delta);
        return token;
      }
      if (Array.isArray(token)) return token.map(shiftToken);
      return token;
    };
    obj.time = shiftToken(obj.time);
    for (const st of obj.states || []) st.time = shiftToken(st.time);
  }

  // Batch clip move: every selected object shifts by the SAME delta so the
  // relative spacing between them is preserved.
  function shiftClips(ids, delta) {
    if (!ids || !ids.length || !delta) return;
    const targets = [];
    let globalMin = Infinity;
    for (const id of ids) {
      const obj = findRawObject(splitEntryId(id).rawId);
      if (!obj) continue;
      const minT = collectMinTime(obj);
      if (!isFinite(minT)) continue;
      targets.push(obj);
      globalMin = Math.min(globalMin, minT);
    }
    if (!targets.length) return;
    const safe = Math.max(delta, -globalMin);
    if (!safe) return;
    for (const obj of targets) shiftObjectTimes(obj, safe);
    resolveAllLaneOverlaps(targets.map((o) => o.id));
    restorePushedLanes(dragLaneSnapshot);
    state.dirty = true;
    if (preview.chart) preview.setStoryboard(state.storyboard);
    renderTimeline();
    requestRender();
  }

  // Batch keyframe move: [{objId,index}] all shift by the same delta.
  function moveKeyframes(items, delta) {
    if (!items || !items.length || !delta) return;
    const resolved = [];
    let globalMin = Infinity;
    let minAllowed = Infinity; // 非 stage 对象仍保留“不越过 K0”的约束
    for (const it of items) {
      const obj = findRawObject(splitEntryId(it.objId).rawId);
      if (!obj) continue;
      const st = it.index === -1 ? obj : (obj.states || [])[it.index];
      const t = st != null ? resolveTime(st.time) : null;
      if (t == null) continue;
      resolved.push({ obj, index: it.index, t });
      globalMin = Math.min(globalMin, t);
      if (it.index >= 0) {
        const e = findObjectEntry(obj.id);
        if (!e || !['sprite', 'text', 'video', 'line'].includes(e.type)) {
          const base = resolveTime(obj.time);
          if (base != null) minAllowed = Math.min(minAllowed, t - base);
        }
      }
    }
    if (!resolved.length) return;
    let safe = Math.max(delta, -globalMin);
    if (isFinite(minAllowed)) safe = Math.max(safe, -minAllowed);
    if (!safe) return;
    const touched = new Set();
    const setTimes = [];
    for (const it of resolved) {
      const nt = it.index === -1 ? it.t + safe : avoidKfCollision(it.obj, it.index, it.t + safe);
      if (it.index === -1) it.obj.time = nt;
      else if (it.obj.states && it.obj.states[it.index]) it.obj.states[it.index].time = nt;
      touched.add(it.obj);
      setTimes.push(nt);
    }
    for (const obj of touched) normalizeK0(obj);
    // K0 重定基后，被拖拽的关键帧若被提升为 K0（obj.time 等于本次拖到的
    // 时间），把 items 里该条目的 index 同步为 -1——否则下一次 mousemove 会用
    // 失效的旧 index 去拖“旧 K0”，导致被拖的关键帧停住/错乱。
    for (let i = 0; i < resolved.length; i++) {
      const it = resolved[i];
      if (it.index >= 0 && items[i] && items[i].objId === it.obj.id) {
        const baseT = resolveTime(it.obj.time);
        if (baseT != null && setTimes[i] != null && Math.abs(baseT - setTimes[i]) < 1e-9) {
          items[i].index = -1;
        }
      }
    }
    resolveAllLaneOverlaps([...touched].map((o) => o.id));
    restorePushedLanes(dragLaneSnapshot);
    state.dirty = true;
    if (preview.chart) preview.setStoryboard(state.storyboard);
    renderTimeline();
    requestRender();
  }

  // Delete the current selection (objects + keyframes). A clicked id that is
  // not part of the selection becomes a single-object delete.
  function deleteSelection(clickedId) {
    let ids = [...state.selectedIds];
    if (clickedId) {
      const rid = splitEntryId(clickedId).rawId;
      if (!ids.includes(rid)) ids = [rid];
    }
    const kfs = state.selectedKfs || [];
    if (!ids.length && !kfs.length) return;
    snapshot();
    let changed = false;
    let kfCount = 0;
    const kfByObj = new Map();
    for (const kf of kfs) {
      const rid = splitEntryId(kf.objId).rawId;
      if (!kfByObj.has(rid)) kfByObj.set(rid, []);
      kfByObj.get(rid).push(kf.index);
    }
    // Batch keyframe delete. Selecting keyframes takes precedence over whole
    // objects: the object itself is only removed when its initial keyframe is
    // deleted and no other keyframes remain (same rule as deleteKeyframeOnly).
    // 选中了一个对象全部关键帧时，直接删除整个时间块（wholeDeletes）。
    const wholeDeletes = new Set();
    for (const [rid, idxs] of kfByObj) {
      const obj = findRawObject(rid);
      if (!obj) continue;
      // 选中了一个时间块的全部关键帧（K0 + 所有关键帧）→ 直接删除整个时间块。
      const selSet = new Set(idxs);
      const stateCount = (obj.states || []).length;
      const coversAll = selSet.has(-1) && stateCount > 0 &&
        Array.from({ length: stateCount }, (_, i) => i).every((i) => selSet.has(i));
      // 合并块的展示性标记：两端“最早/最晚”（index -1 / -2）都选中时视为
      // 选中了整个合并块，直接整块删除（框选多个时间块时与普通块行为一致）。
      const mergedAllMarkers = selSet.has(-1) && selSet.has(-2);
      if (coversAll || mergedAllMarkers) {
        if (!ids.includes(rid)) ids.push(rid);
        wholeDeletes.add(rid);
        kfCount += stateCount + 1;
        changed = true;
        continue;
      }
      const delInitial = idxs.includes(-1);
      const stIdx = idxs.filter((i) => i >= 0);
      if (stIdx.length) {
        stIdx.sort((a, b) => b - a);
        for (const i of stIdx) {
          if (obj.states && obj.states[i]) {
            obj.states.splice(i, 1);
            kfCount++;
            changed = true;
          }
        }
      }
      if (delInitial) {
        // 合并时间块（note 选择器）是一个整体单元：删除其 K0 即删除整个块，
        // 避免"K0 提升"把块留下成空壳而无法再正常编辑/删除。
        if (!Array.isArray(obj.states) || !obj.states.length || isNoteSelectorMerged(rid)) {
          // No other keyframes left (or merged block): remove the object itself.
          if (!ids.includes(rid)) ids.push(rid);
          wholeDeletes.add(rid);
          changed = true;
        } else {
          // K0 无特殊性：删除后最早的关键帧成为新的 K0，同步字段以原对象为准。
          const promoted = obj.states.shift();
          const restStates = obj.states;
          const keep = {};
          for (const k of ['id', 'note', 'parent_id', 'target_id', 'path', 'order', 'layer']) {
            if (obj[k] !== undefined) keep[k] = obj[k];
          }
          for (const k of Object.keys(obj)) delete obj[k];
          Object.assign(obj, keep);
          obj.time = promoted.time;
          obj.states = restStates;
          for (const k of Object.keys(promoted)) {
            if (k === 'states' || k === 'id' || k === 'note' || k === 'time' ||
                k === 'parent_id' || k === 'target_id' || k === 'path' || k === 'order' || k === 'layer') continue;
            obj[k] = promoted[k];
          }
          kfCount++;
          changed = true;
        }
      }
    }
    const kfObjSet = new Set(kfByObj.keys());
    const objectDeletes = [];
    for (const id of ids) {
      const rid = splitEntryId(id).rawId;
      if (kfObjSet.has(rid) && !wholeDeletes.has(rid)) continue; // only its keyframes were selected
      objectDeletes.push(rid);
    }
    for (const rid of objectDeletes) {
      for (const [group] of Object.entries(GROUP_TYPES)) {
        const list = state.storyboard[group] || [];
        const i = list.findIndex((o) => (o.id || '') === rid);
        if (i >= 0) {
          list.splice(i, 1);
          if (state.objHidden) delete state.objHidden[rid];
          changed = true;
          break;
        }
      }
    }
    // 删除父/目标对象后，清理其它对象指向它的 parent_id / target_id，
    // 避免玩家端继续报“parent_id 不存在”。
    if (objectDeletes.length) {
      for (const [group] of Object.entries(GROUP_TYPES)) {
        for (const o of state.storyboard[group] || []) {
          if (objectDeletes.some((rid) => String(o.parent_id) === rid)) syncObjectField(o, 'parent_id', undefined);
          if (objectDeletes.some((rid) => String(o.target_id) === rid)) syncObjectField(o, 'target_id', undefined);
        }
      }
    }
    if (!changed) return;
    state.dirty = true;
    if (state.selectedObjId && !findRawObject(state.selectedObjId)) {
      state.selectedObjId = null;
      state.selectedKeyIdx = null;
    }
    state.selectedIds = state.selectedIds.filter((id) => findRawObject(splitEntryId(id).rawId));
    state.selectedKfs = [];
    refreshAll();
    const parts = [];
    if (objectDeletes.length) parts.push(objectDeletes.length + __t(' 个对象'));
    if (kfCount) parts.push(kfCount + __t(' 个关键帧'));
    if (parts.length) toast(__t('已删除 ') + parts.join(' / '));
  }

  // Copy the selection. relative=true anchors the group at the playhead
  // (keeping internal spacing); relative=false preserves absolute times.
  function copySelection(relative, clickedId) {
    let ids = [...state.selectedIds];
    if (clickedId) {
      const rid = splitEntryId(clickedId).rawId;
      if (!ids.includes(rid)) ids = [rid];
    }
    if (!ids.length) return;
    snapshot();
    const originals = [];
    let minT = Infinity;
    for (const id of ids) {
      const entry = findObjectEntry(splitEntryId(id).rawId);
      if (!entry) continue;
      originals.push(entry);
      const kfs = objectKeyframes(entry.obj);
      if (kfs.length) minT = Math.min(minT, kfs[0].time);
    }
    if (!originals.length) return;
    const offset = relative && isFinite(minT) ? (preview.time - minT) : 0;
    const clones = [];
    for (const entry of originals) {
      const clone = JSON.parse(JSON.stringify(entry.obj));
      clone.id = uniqueId(entry.type);
      if (offset) shiftObjectTimes(clone, offset);
      if (['sprite', 'text', 'video', 'line'].includes(entry.type)) {
        // 复制的 stage 对象保持原 layer 不变，只把 order 分配到该层最上层
        // 新轨道（避免同 order 双轨）。
        const layer = clone.layer != null ? clone.layer : 0;
        syncObjectField(clone, 'layer', layer);
        syncObjectField(clone, 'order', topOrderInLayer(layer));
      }
      state.storyboard[entry.group].push(clone);
      // 克隆合并时间块：合并标记跟随克隆体，时间轴仍按合并形式显示。
      if (isNoteSelectorMerged(entry.obj.id)) setNoteSelectorMerge(clone.id, true);
      clones.push(clone.id);
    }
    // 合并布局：复制出的 stage 对象作为最上层新轨道插入并重排。
    const merged = readCysterStageLanes();
    if (merged) {
      const stageClones = clones.filter((id) => {
        const e = findObjectEntry(id);
        return e && ['sprite', 'text', 'video', 'line'].includes(e.type);
      });
      if (stageClones.length) {
        for (const id of stageClones) merged.unshift([id]);
        renumberStageLanes(merged);
        setCysterStageLanes(merged);
      }
    }
    state.dirty = true;
    state.selectedIds = clones;
    state.selectedObjId = clones[0] || null;
    state.selectedKeyIdx = -1;
    refreshAll();
    toast(__t('已复制 ') + clones.length + __t(' 个对象（') + (relative ? __t('相对播放头') : __t('绝对时间')) + __t('）'));
  }

  // 对象剪贴板：Ctrl+C 复制选中对象，Ctrl+V 粘贴到当前播放头。
  function copyObjectsToClipboard() {
    const ids = state.selectedIds && state.selectedIds.length
      ? state.selectedIds
      : (state.selectedObjId ? [state.selectedObjId] : []);
    const items = [];
    for (const id of ids) {
      if (isNoteEntry(id)) continue;
      const entry = findObjectEntry(splitEntryId(id).rawId);
      if (!entry || !entry.obj) continue;
      items.push({ type: entry.type, group: entry.group, obj: JSON.parse(JSON.stringify(entry.obj)) });
    }
    if (!items.length) { toast('请先选择对象', true); return; }
    state.objClipboard = items;
    state.kfClipboard = []; // 对象剪贴板与关键帧剪贴板互斥
    toast(__t('已复制 ') + items.length + __t(' 个对象'));
  }

  function pasteObjectsAtPlayhead() {
    const items = state.objClipboard || [];
    if (!items.length) { toast('剪贴板中没有对象', true); return; }
    snapshot();
    let minT = Infinity;
    for (const it of items) {
      const kfs = objectKeyframes(it.obj);
      if (kfs.length) minT = Math.min(minT, kfs[0].time);
    }
    const offset = isFinite(minT) ? (preview.time - minT) : 0;
    const clones = [];
    const merged = readCysterStageLanes();
    for (const it of items) {
      const clone = JSON.parse(JSON.stringify(it.obj));
      clone.id = uniqueId(it.type);
      if (offset) shiftObjectTimes(clone, offset);
      if (['sprite', 'text', 'video', 'line'].includes(it.type)) {
        // 粘贴的 stage 对象保持原 layer 不变，只把 order 分配到该层最上层。
        const layer = clone.layer != null ? clone.layer : 0;
        syncObjectField(clone, 'layer', layer);
        syncObjectField(clone, 'order', topOrderInLayer(layer));
      }
      state.storyboard[it.group].push(clone);
      // 粘贴合并时间块：合并标记跟随克隆体，时间轴仍按合并形式显示。
      if (isNoteSelectorMerged(it.obj.id)) setNoteSelectorMerge(clone.id, true);
      clones.push(clone.id);
      if (merged && ['sprite', 'text', 'video', 'line'].includes(it.type)) merged.unshift([clone.id]);
    }
    if (merged && clones.length) {
      renumberStageLanes(merged);
      setCysterStageLanes(merged);
    }
    state.dirty = true;
    state.selectedIds = clones;
    state.selectedObjId = clones[0] || null;
    state.selectedKeyIdx = -1;
    refreshAll();
    toast(__t('已粘贴 ') + clones.length + __t(' 个对象到播放头'));
  }

  // ---------------------------------------------------------------
  // Preview visibility (eye toggles) + keyframe context-menu helpers
  // ---------------------------------------------------------------
  function isObjHiddenState(id) {
    if (!state.storyboard) return false;
    const rid = splitEntryId(id).rawId;
    if (state.objHidden && state.objHidden[rid]) return true;
    const entry = findObjectEntry(rid);
    if (entry && state.groupHidden && state.groupHidden[entry.group]) return true;
    return false;
  }

  function isGroupVisible(group) {
    return !(state.groupHidden && state.groupHidden[group]);
  }

  // 合并 note 选择器对象的编译展开克隆 id（raw::note）。眼睛隐藏/拾取跳过时
  // 必须连同这些克隆一起处理，否则合并块对象在预览中隐藏/点击无效。
  function mergedCloneIds(obj) {
    const out = [];
    if (!obj || obj.id == null || obj.note == null || typeof obj.note !== 'object') return out;
    for (const nid of collectNoteIds(obj)) out.push(obj.id + '::' + nid);
    return out;
  }

  // Push the current hidden state (objects + note controllers' notes) into
  // the preview renderer. Called on every refresh so toggles survive re-renders.
  function applyVisibility() {
    if (!preview || !state.storyboard) return;
    const hiddenObjs = new Set();
    const hiddenNotes = new Set();
    const ncGroupHidden = !!(state.groupHidden && state.groupHidden['note_controllers']);
    for (const [group] of Object.entries(GROUP_TYPES)) {
      const gHidden = state.groupHidden && state.groupHidden[group];
      for (const obj of state.storyboard[group] || []) {
        if (!gHidden && !(state.objHidden && state.objHidden[obj.id])) continue;
        hiddenObjs.add(obj.id);
        for (const cid of mergedCloneIds(obj)) hiddenObjs.add(cid);
        // An individual note_controller hides only the notes it actually
        // controls. Only hiding the WHOLE category hides every note (and it
        // works even when the category currently has no objects).
        if (group === 'note_controllers' && !ncGroupHidden) {
          collectNoteIds(obj).forEach((nid) => hiddenNotes.add(nid));
        }
      }
    }
    if (ncGroupHidden && state.chart) {
      for (const n of state.chart.notes) hiddenNotes.add(n.id);
    }
    preview.setVisibility(hiddenObjs, hiddenNotes);
  }

  function toggleObjectVisibility(id) {
    const rid = splitEntryId(id).rawId;
    state.objHidden = state.objHidden || {};
    state.objHidden[rid] = !state.objHidden[rid];
    persistProjectState();
    applyVisibility();
    renderObjectAddPanel();
    renderTimeline();
    requestRender();
  }

  // Toggle one lane / list item that may cover several objects: if every
  // object is hidden show them all, otherwise hide them all.
  function toggleObjectsVisibility(ids) {
    const list = Array.isArray(ids) ? ids : [ids];
    if (!list.length) return;
    const allHidden = list.every((i) => isObjHiddenState(i));
    state.objHidden = state.objHidden || {};
    for (const id of list) {
      state.objHidden[splitEntryId(id).rawId] = !allHidden;
    }
    persistProjectState();
    applyVisibility();
    renderObjectAddPanel();
    renderTimeline();
    requestRender();
  }

  function toggleGroupVisibility(group) {
    state.groupHidden = state.groupHidden || {};
    state.groupHidden[group] = !state.groupHidden[group];
    persistProjectState();
    applyVisibility();
    renderObjectAddPanel();
    renderTimeline();
    requestRender();
  }

  // Delete a single keyframe (not the whole object) from a context menu.
  // Deleting the initial keyframe promotes the first remaining keyframe to
  // become the new initial state; with no other keyframes left, the object
  // itself is deleted.
  function deleteKeyframeOnly(objId, kfIdx) {
    const rid = splitEntryId(objId).rawId;
    const obj = findRawObject(rid);
    if (!obj) return;
    snapshot();
    if (kfIdx === -1) {
      if (!Array.isArray(obj.states) || !obj.states.length) {
        deleteObject(obj.id);
        return;
      }
      // K0 无特殊性：删除后最早的关键帧成为新的 K0，同步字段以原对象为准。
      const promoted = obj.states.shift();
      const restStates = obj.states;
      const keep = {};
      for (const k of ['id', 'note', 'parent_id', 'target_id', 'path', 'order', 'layer']) {
        if (obj[k] !== undefined) keep[k] = obj[k];
      }
      for (const k of Object.keys(obj)) delete obj[k];
      Object.assign(obj, keep);
      obj.time = promoted.time;
      obj.states = restStates;
      for (const k of Object.keys(promoted)) {
        if (k === 'states' || k === 'id' || k === 'note' || k === 'time' ||
            k === 'parent_id' || k === 'target_id' || k === 'path' || k === 'order' || k === 'layer') continue;
        obj[k] = promoted[k];
      }
      state.dirty = true;
      state.selectedKfs = [];
      state.selectedKeyIdx = -1;
      state.selectedIds = [rid];
      state.propsExplicitKf = false;
      refreshAll();
      toast('已删除关键帧');
      return;
    }
    if (kfIdx < 0 || !Array.isArray(obj.states) || kfIdx >= obj.states.length) return;
    obj.states.splice(kfIdx, 1);
    state.dirty = true;
    state.selectedKfs = [];
    state.selectedKeyIdx = -1;
    state.selectedIds = [rid];
    refreshAll();
    toast('已删除关键帧');
  }

  // 删除关键帧组（note 选择器表达式/相同具体时间点的全部关键帧，含 K0）。
  // K0 被删后自动把剩余最早关键帧提升为新 K0（字段以原对象为准）。
  function deleteKeyframeGroup(obj, group) {
    if (!obj || !group || !Array.isArray(group.indices) || !group.indices.length) return;
    snapshot();
    const delK0 = group.indices.includes(-1);
    const delIdx = group.indices.filter((i) => i >= 0).sort((a, b) => b - a);
    let changed = false;
    for (const i of delIdx) {
      if (obj.states && obj.states[i]) { obj.states.splice(i, 1); changed = true; }
    }
    if (delK0) {
      if (!Array.isArray(obj.states) || !obj.states.length) {
        // 没有剩余关键帧：保留对象，K0 归零（note 选择器对象仍可继续编辑）。
        obj.time = 0;
      } else {
        // K0 无特殊性：删除后最早的关键帧成为新的 K0，同步字段以原对象为准。
        const promoted = obj.states.shift();
        const restStates = obj.states;
        const keep = {};
        for (const k of ['id', 'note', 'parent_id', 'target_id', 'path', 'order', 'layer']) {
          if (obj[k] !== undefined) keep[k] = obj[k];
        }
        for (const k of Object.keys(obj)) delete obj[k];
        Object.assign(obj, keep);
        obj.time = promoted.time;
        obj.states = restStates;
        for (const k of Object.keys(promoted)) {
          if (k === 'states' || k === 'id' || k === 'note' || k === 'time' ||
              k === 'parent_id' || k === 'target_id' || k === 'path' || k === 'order' || k === 'layer') continue;
          obj[k] = promoted[k];
        }
      }
      changed = true;
    }
    if (!changed) return;
    state.selectedKfExpression = null;
    state.selectedKeyIdx = -1;
    state.dirty = true;
    dirtyAndRefresh();
    toast(__t('已删除 ') + (group.numeric ? __t('该时间点') : __t('该表达式')) + __t(' 的全部关键帧'));
  }

  // ---------------------------------------------------------------
  // Keyframe badge metadata (easing name + before/after values)
  // ---------------------------------------------------------------
  function normalizeEasing(e) {
    if (!e) return '';
    const s = String(e).toLowerCase();
    if (s === 'linear') return 'Linear';
    if (s === 'none') return 'None';
    if (s === 'spring') return 'Spring';
    const m = s.match(/^ease(inout|in|out)([a-z]+)$/);
    if (m) {
      const p = m[1] === 'inout' ? 'InOut' : (m[1] === 'in' ? 'In' : 'Out');
      const fn = m[2].charAt(0).toUpperCase() + m[2].slice(1);
      return 'Ease' + p + fn;
    }
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  function kfVal(v) {
    if (typeof v === 'number') return String(Math.round(v * 1000) / 1000);
    if (v && typeof v === 'object' && v.value != null) {
      return String(Math.round(v.value * 1000) / 1000) + (v.unit ? ':' + v.unit : '');
    }
    if (v && typeof v === 'object') return JSON.stringify(v);
    return String(v);
  }

  function kfFieldsText(st) {
    if (!st || typeof st !== 'object') return '';
    return Object.keys(st)
      .filter((k) =>
        !['time', 'easing', 'note', 'id', 'add_time', 'relative_time', 'states'].includes(k) &&
        (k !== 'note_fill_colors' ? !Array.isArray(st[k]) : true))
      .map((k) => {
        // Note 填充颜色是 12 色数组：在关键帧详情浮窗中输出可读的 hex 列表
        // （项目内条目为颜色对象，转成 #rrggbb；空项显示 -）。
        if (k === 'note_fill_colors') {
          const arr = Array.isArray(st[k]) ? st[k] : [];
          return k + '=' + arr.map((c) => {
            if (c == null) return '-';
            if (typeof c === 'string') return c;
            return Schema.colorToHex(c) || JSON.stringify(c);
          }).join(',');
        }
        return k + '=' + kfVal(st[k]);
      })
      .join(', ');
  }

  // Keyframe metadata for the timeline badge: easing full name, the state's
  // own values (起始) and the NEXT state's values (结束).
  function kfMeta(obj, st, idx) {
    const src = idx === -1 ? obj : st;
    const easing = normalizeEasing(src && src.easing);
    const fromText = kfFieldsText(src);
    const next = idx === -1 ? (obj.states || [])[0] : (obj.states || [])[idx + 1];
    const toText = kfFieldsText(next);
    return { easing, fromText, toText };
  }

  // ---------------------------------------------------------------
  // Timeline asset thumbnails (sprites / videos)
  // ---------------------------------------------------------------
  const thumbnailCache = {};
  const thumbnailPromises = {};
  const thumbStats = { called: 0, done: 0, failed: 0 };
  window.SBThumbStats = thumbStats;
  window.SBThumbDebug = () => ({
    cache: Object.keys(thumbnailCache),
    promises: Object.keys(thumbnailPromises),
    pending: Object.keys(thumbnailPromises).filter((p) => !(p in thumbnailCache))
  });
  function mimeForPath(p) {
    const l = String(p).toLowerCase();
    if (l.endsWith('.png')) return 'image/png';
    if (l.endsWith('.jpg') || l.endsWith('.jpeg')) return 'image/jpeg';
    if (l.endsWith('.gif')) return 'image/gif';
    if (l.endsWith('.webp')) return 'image/webp';
    if (l.endsWith('.mp4')) return 'video/mp4';
    if (l.endsWith('.webm')) return 'video/webm';
    if (l.endsWith('.ogg') || l.endsWith('.ogv')) return 'video/ogg';
    return 'application/octet-stream';
  }
  function isVideoPath(p) { return /\.(mp4|webm|mov|avi|mkv|ogv|ogg)$/i.test(String(p)); }
  function videoFrameDataUrl(url) {
    return new Promise((resolve) => {
      const v = document.createElement('video');
      v.muted = true;
      v.playsInline = true;
      v.preload = 'auto';
      const c = document.createElement('canvas');
      let done = false;
      const finish = (img) => { if (done) return; done = true; resolve(img); };
      v.onloadeddata = () => { try { v.currentTime = Math.min(0.15, (v.duration || 0.5) * 0.2); } catch (e) {} };
      v.onseeked = () => {
        try {
          c.width = v.videoWidth || 160;
          c.height = v.videoHeight || 90;
          const ctx = c.getContext('2d');
          ctx.drawImage(v, 0, 0, c.width, c.height);
          finish(c.toDataURL('image/jpeg', 0.7));
        } catch (e) { finish(null); }
      };
      v.onerror = () => finish(null);
      setTimeout(() => finish(null), 4000);
      v.src = url;
    });
  }
  function loadThumbnail(path, cb) {
    thumbStats.called++;
    if (!path || !state.levelDir) { cb(null); return; }
    if (thumbnailCache[path]) { cb(thumbnailCache[path]); return; }
    if (thumbnailPromises[path]) {
      thumbnailPromises[path].then((u) => cb(u));
      return;
    }
    const full = resolveAssetPath(path);
    thumbnailPromises[path] = (async () => {
      const res = await window.sbAPI.readFileBuffer(full);
      const bytes = Uint8Array.from(atob(res.data), (ch) => ch.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: mimeForPath(path) }));
      if (isVideoPath(path)) {
        try {
          const frame = await videoFrameDataUrl(url);
          thumbnailCache[path] = frame || url;
        } catch (e) {
          thumbnailCache[path] = url;
        }
      } else {
        thumbnailCache[path] = url;
      }
      thumbStats.done++;
      return thumbnailCache[path];
    })().catch((e) => {
      thumbStats.failed++;
      thumbnailCache[path] = null;
      return null;
    });
    thumbnailPromises[path].then((u) => cb(u));
  }

  function findRawObject(id) {
    if (!state.storyboard) return null;
    for (const [group] of Object.entries(GROUP_TYPES)) {
      const obj = (state.storyboard[group] || []).find((o) => (o.id || '') === id);
      if (obj) return obj;
    }
    return null;
  }

  function findObjectEntry(id) {
    for (const [group, type] of Object.entries(GROUP_TYPES)) {
      const list = state.storyboard[group] || [];
      const i = list.findIndex((o) => (o.id || '') === id);
      if (i >= 0) return { group, type, obj: list[i] };
    }
    return null;
  }

  // ---------------------------------------------------------------
  // Selection & properties
  // ---------------------------------------------------------------
  const PICK_TYPE_LABELS = {
    note: 'Note', sprite: 'Sprite', line: 'Line', text: 'Text', video: 'Video',
    controller: 'Controller', note_controller: 'Note Controller'
  };

  function isNoteEntry(id) {
    return splitEntryId(id).rawId === 'note';
  }

  function isLocked(id) {
    const raw = splitEntryId(id).rawId;
    return !!(state.lockedIds && raw !== 'note' && state.lockedIds.has(raw));
  }

  // 切换锁定：单个对象或整条合并轨道（多个对象）统一切换——全部已锁则解锁，
  // 否则全部加锁。
  function toggleLock(idOrIds) {
    const list = Array.isArray(idOrIds) ? idOrIds : [idOrIds];
    const raws = list.map((x) => splitEntryId(x).rawId).filter((x) => x && x !== 'note');
    if (!raws.length) return;
    const allLocked = raws.every((r) => state.lockedIds.has(r));
    for (const r of raws) {
      if (allLocked) state.lockedIds.delete(r);
      else state.lockedIds.add(r);
    }
    persistProjectState();
    renderObjectAddPanel();
    renderObjectTree();
    renderTimeline();
  }

  // 时间轴表头批量锁定：按“大类 / layer 层级 / 分类”取目标对象 id。
  function categoryTargetIds(kind) {
    const out = [];
    if (!state.storyboard) return out;
    if (kind === 'stage' || (kind && kind.indexOf('layer:') === 0)) {
      const layer = kind.indexOf('layer:') === 0 ? Number(kind.slice(6)) : null;
      for (const [group, type] of Object.entries(GROUP_TYPES)) {
        if (type === 'controller' || type === 'note_controller') continue;
        for (const o of state.storyboard[group] || []) {
          if (layer == null || (o.layer != null ? o.layer : 0) === layer) out.push(o.id);
        }
      }
    } else if (kind === 'controller') {
      for (const o of state.storyboard.controllers || []) out.push(o.id);
    } else if (kind === 'note_controller') {
      for (const o of state.storyboard.note_controllers || []) out.push(o.id);
    }
    return out;
  }

  function isCategoryLocked(kind) {
    const ids = categoryTargetIds(kind);
    return ids.length > 0 && ids.every((id) => state.lockedIds && state.lockedIds.has(id));
  }

  function categoryLockLabel(kind) {
    if (kind === 'stage') return __t('Stage 全部对象');
    if (kind === 'controller') return __t('Controller 全部对象');
    if (kind === 'note_controller') return __t('Note Ctrl 全部对象');
    if (kind && kind.indexOf('layer:') === 0) return 'Layer ' + kind.slice(6) + __t(' 全部对象');
    return kind;
  }

  // 表头批量锁定切换：该分类/层级全部已锁则解锁，否则全部加锁。
  function toggleCategoryLock(kind) {
    const ids = categoryTargetIds(kind);
    if (!ids.length) { toast('该分类下没有对象', true); return; }
    snapshot();
    const allLocked = isCategoryLocked(kind);
    for (const id of ids) {
      if (allLocked) state.lockedIds.delete(id);
      else state.lockedIds.add(id);
    }
    persistProjectState();
    refreshAll();
    toast(allLocked ? __t('已批量解锁') : __t('已批量锁定 ') + categoryLockLabel(kind));
  }

  // R 键切换预览选择层级（Note <-> Stage）。
  function togglePickMode() {
    state.pickMode = state.pickMode === 'note' ? 'stage' : 'note';
    const sel = $('#pickMode');
    if (sel) sel.value = state.pickMode;
    toast(__t('选择层级: ') + (state.pickMode === 'note' ? 'Note' : 'Stage'));
  }

  // 点击合并轨道空白处：不清空也不自动选择第一个对象，而是在属性界面显示该
  // 轨道内所有对象的统计信息（含跳转入口与 stage 对象预览图）。
  function showLaneInfo(laneObjs) {
    if (!laneObjs || !laneObjs.length) return;
    state.selectedLane = { objs: laneObjs.slice() };
    state.previewEmptyFocus = false;
    state.selectedObjId = null;
    state.selectedKeyIdx = null;
    state.selectedIds = [];
    state.selectedKfs = [];
    state.pendingNote = null;
    state.propsExplicitKf = false;
    renderObjectTree();
    renderObjectAddPanel();
    renderProperties();
    timeline.setMultiSelection({ ids: [], kfs: [] });
    updatePreviewHighlight();
  }

  // Core multi-selection. ids use the entry convention ("rawId" or
  // "note::<noteId>"). opts.append = ctrl-style toggle union.
  function selectObjects(ids, opts) {
    const append = !!(opts && opts.append);
    state.selectedLane = null;
    state.noteInMergedBlock = null;
    let next = append ? [...state.selectedIds] : [];
    for (const id of ids) {
      const idx = next.indexOf(id);
      if (idx >= 0) next.splice(idx, 1);
      else next.push(id);
    }
    if (!append && ids.length === 1) next = [ids[0]];
    state.selectedIds = next;
    if (next.length) state.previewEmptyFocus = false;
    const last = next.length ? next[next.length - 1] : null;
    state.selectedObjId = last && !isNoteEntry(last) ? splitEntryId(last).rawId : null;
    state.selectedKeyIdx = next.length ? -1 : null;
    state.selectedKfs = [];
    state.propsExplicitKf = false;
    state.pendingNote = null;
    renderObjectTree();
    renderObjectAddPanel();
    renderProperties();
    timeline.setMultiSelection({ ids: next, kfs: [] });
    updatePreviewHighlight();
  }

  function selectObject(id, keyIdx) {
    state.pendingNote = null;
    state.propsExplicitKf = false;
    state.selectedLane = null;
    state.previewEmptyFocus = false;
    state.noteInMergedBlock = null;
    state.selectedKfExpression = null;
    // Per-note timeline entries carry "rawId::noteId"; select the raw object.
    const split = splitEntryId(id);
    state.selectedObjId = split.rawId === 'note' ? null : split.rawId;
    state.selectedNoteId = split.noteId;
    state.selectedKeyIdx = keyIdx == null ? -1 : keyIdx;
    state.selectedIds = [id];
    state.selectedKfs = keyIdx != null && keyIdx >= -1
      ? [{ objId: split.rawId, index: keyIdx }]
      : [];
    renderObjectTree();
    renderObjectAddPanel();
    renderProperties();
    timeline.setMultiSelection({ ids: state.selectedIds, kfs: state.selectedKfs });
    updatePreviewHighlight();
  }

  // 双击时间块：选中该时间块上的全部关键帧（同一对象的所有关键帧）。
  function selectAllKeyframes(id) {
    const { rawId: rid, noteId } = splitEntryId(id);
    const obj = findRawObject(rid);
    if (!obj) return;
    // note 选择器对象的时间是表达式（"start:$note" 等），objectKeyframes 解析
    // 不出时间返回空数组，导致双击全选失效。按时间块条目类型取正确的关键帧源：
    // 合并块 → 两端展示标记；逐 note 展开条目 → 该 note 的关键帧；
    // 单轨道 note 选择器 → 全部 note 的关键帧；controller → controllerKeyframes。
    const entry = findObjectEntry(rid);
    let kfs;
    if (entry && entry.type === 'controller') {
      kfs = controllerKeyframes(obj);
    } else if (obj.note && typeof obj.note === 'object') {
      if (isNoteSelectorMerged(obj.id)) kfs = mergedNoteKeyframes(obj);
      else if (noteId != null) kfs = objectKeyframesForNote(obj, noteId);
      else kfs = objectKeyframesAllNotes(obj);
    } else {
      kfs = objectKeyframes(obj);
    }
    if (!kfs.length) return;
    state.selectedLane = null;
    state.selectedObjId = rid;
    state.selectedKeyIdx = kfs[0].index;
    state.selectedIds = [rid];
    state.selectedKfs = kfs.map((k) => ({ objId: rid, index: k.index }));
    state.propsExplicitKf = true;
    state.pendingNote = null;
    renderObjectTree();
    renderObjectAddPanel();
    renderProperties();
    timeline.setMultiSelection({ ids: state.selectedIds, kfs: state.selectedKfs });
    updatePreviewHighlight();
  }

  // Highlight the selected objects in the preview (stage objects get an
  // outline; note entries / note_controllers ring the notes they control).
  function updatePreviewHighlight() {
    if (!preview) return;
    const sel = state.selectedIds || [];
    const stageIds = new Set();
    const noteIds = new Set();
    for (const id of sel) {
      if (isNoteEntry(id)) {
        const nid = splitEntryId(id).noteId;
        if (nid != null) noteIds.add(nid);
        continue;
      }
      const entry = findObjectEntry(splitEntryId(id).rawId);
      if (!entry || entry.type === 'controller') continue;
      if (entry.type === 'note_controller') {
        collectNoteIds(entry.obj).forEach((n) => noteIds.add(n));
      } else {
        stageIds.add(entry.obj.id);
      }
    }
    preview.setHighlights(stageIds.size ? stageIds : null, noteIds.size ? noteIds : null);
  }

  // Jump the playhead to a note's start time (the default click behavior).
  function jumpToNoteTime(note) {
    if (!note) return;
    if (state.playing) {
      state.playing = false;
      $('#btnPlay').innerHTML = svgIcon('play');
      preview.setPlaying(false);
    }
    setTime(note.start_time, false);
  }

  // Locate the note_controller that covers a note (direct id or selector).
  function findNoteControllerForNote(noteId) {
    for (const nc of (state.storyboard && state.storyboard.note_controllers) || []) {
      if (nc.note == null) continue;
      // 纯 ID 载体（$note parent_id 自动父级）不占用普通 note_controller 槽位。
      if (isParentCarrier(nc.id)) continue;
      if (nc.note === noteId) return nc;
      if (noteSelectorIncludes(nc.note, noteId)) return nc;
    }
    return null;
  }

  // 查找覆盖某 note 的“合并时间块”：该 note 没有独立 note_controller 时，
  // 右键应进入这个块的整体属性编辑（它已通过选择器给该 note 分配了关键帧），
  // 而不是显示“创建新 note_controller”页面。优先合并的 note_controller
  // （含纯 ID 载体），其次带 note 选择器的合并 stage 对象。
  function findMergedBlockForNote(noteId) {
    if (!state.storyboard) return null;
    for (const nc of state.storyboard.note_controllers || []) {
      if (!nc || nc.note == null) continue;
      if (!isNoteSelectorMerged(nc.id)) continue;
      if (noteSelectorIncludes(nc.note, noteId)) return { group: 'note_controllers', type: 'note_controller', obj: nc };
    }
    for (const [group, type] of Object.entries(GROUP_TYPES)) {
      if (type === 'controller' || type === 'note_controller') continue;
      for (const o of state.storyboard[group] || []) {
        if (!o || o.note == null) continue;
        if (!isNoteSelectorMerged(o.id)) continue;
        if (noteSelectorIncludes(o.note, noteId)) return { group, type, obj: o };
      }
    }
    return null;
  }

  // 选择某条 drag / C-drag 锁链的全部 note：从链头沿 next_id 一路收集。
  // 当前 note 不一定是链头时，扫描所有链头找到包含它的链。
  function selectDragChain(noteId) {
    const ch = state.chart;
    if (!ch) return;
    const seen = new Set();
    const follow = (startId) => {
      const out = [];
      let cur = ch.noteById(startId);
      let guard = 0;
      while (cur && !seen.has(cur.id) && guard++ < 1000) {
        seen.add(cur.id);
        out.push(cur.id);
        cur = cur.next_id > 0 ? ch.noteById(cur.next_id) : null;
      }
      return out;
    };
    let chain = null;
    for (const n of ch.notes) {
      if (n.type !== 3 && n.type !== 6) continue;
      const cand = follow(n.id);
      if (cand.includes(noteId)) { chain = cand; break; }
    }
    if (!chain) chain = follow(noteId);
    if (!chain.length) return;
    selectObjects(chain.map((nid) => 'note::' + nid), {});
  }

  // ---- 可拖动的独立浮动窗口（非模态，可与主界面同时操作）----
  let floatWindowEl = null;
  let floatWindowKind = null;
  function closeFloatingWindow() {
    if (floatWindowEl) floatWindowEl.remove();
    floatWindowEl = null;
    state.notePickerActive = false;
    // 关闭选择器编辑器：未点击“应用”的草稿改动直接丢弃，对象保持原样。
    nsDraft = null;
    // 关闭选择器编辑器时清除预览中的命中高亮。
    if (floatWindowKind === 'note-selector' && preview) {
      preview.setHighlight(null, null);
      preview.markDirty();
      requestRender();
    }
    floatWindowKind = null;
  }
  function openFloatingWindow(title, bodyHtml, kind) {
    closeFloatingWindow();
    floatWindowKind = kind || null;
    const win = document.createElement('div');
    win.className = 'float-window';
    const head = document.createElement('div');
    head.className = 'float-window-head';
    head.innerHTML = `<span class="float-window-title">${escapeHtml(title)}</span>` +
      `<button class="float-window-close" title="关闭">×</button>`;
    const body = document.createElement('div');
    body.className = 'float-window-body';
    body.innerHTML = bodyHtml;
    win.appendChild(head);
    win.appendChild(body);
    document.body.appendChild(win);
    win.style.left = Math.max(8, window.innerWidth - 380) + 'px';
    win.style.top = '76px';
    let drag = null;
    head.addEventListener('mousedown', (e) => {
      if (e.target.closest('.float-window-close')) return;
      drag = { dx: e.clientX - win.offsetLeft, dy: e.clientY - win.offsetTop };
      const move = (ev) => {
        win.style.left = Math.max(4, Math.min(window.innerWidth - 60, ev.clientX - drag.dx)) + 'px';
        win.style.top = Math.max(4, Math.min(window.innerHeight - 40, ev.clientY - drag.dy)) + 'px';
      };
      const up = () => {
        document.removeEventListener('mousemove', move);
        document.removeEventListener('mouseup', up);
      };
      document.addEventListener('mousemove', move);
      document.addEventListener('mouseup', up);
    });
    head.querySelector('.float-window-close').addEventListener('click', closeFloatingWindow);
    floatWindowEl = win;
    return { win, body };
  }

  // ---- Note 选择器编辑器 ----
  const NOTE_TYPE_LABELS = { 0: 'Click', 1: 'Hold', 2: 'LongHold', 3: 'Drag头', 4: 'Drag子', 5: 'Flick', 6: 'CDrag头', 7: 'CDrag子' };
  let noteSelectorTarget = null; // 绑定的 note_controller（null = 应用到当前选中 note）
  // 选择器编辑器中的未提交改动（note + merge）。只有点击“应用”才写回对象；
  // 关闭窗口/切换绑定对象时丢弃，保持对象原样。
  let nsDraft = null;

  function openNoteSelectorEditor(controller) {
    noteSelectorTarget = controller || null;
    // 打开编辑器时以对象当前值初始化草稿：窗口内的所有改动先落在草稿上，
    // 点击“应用”才写回对象；直接关闭则丢弃。
    nsDraft = noteSelectorTarget
      ? {
          note: JSON.parse(JSON.stringify(noteSelectorTarget.note != null ? noteSelectorTarget.note : {})),
          merge: isNoteSelectorMerged(noteSelectorTarget.id)
        }
      : null;
    // R1：独立进程窗口（可跨屏拖动/缩放），由 note_selector.html 承载编辑器。
    if (window.sbAPI && window.sbAPI.nsOpen) {
      window.sbAPI.nsOpen();
      // 独立窗口可能已打开：推送 note-target 让它立即刷新绑定对象并显示草稿。
      if (window.sbAPI.nsSend) {
        window.sbAPI.nsSend({
          type: 'note-target',
          id: noteSelectorTarget ? noteSelectorTarget.id : null,
          // 新选择器（未绑定对象）默认合并时间块开启；绑定对象按自身状态同步。
          merge: noteSelectorTarget
            ? (nsDraft ? nsDraft.merge : isNoteSelectorMerged(noteSelectorTarget.id))
            : true
        });
      }
    } else { const { body } = openFloatingWindow('Note 选择器编辑器', '', 'note-selector'); renderNoteSelectorEditor(body); }
  }

  // Parent_id 输入框右键：把该对象的 parent_id 设为含 $note 的模板并打开
  // note 选择器编辑器（应用时自动创建纯 ID 载体，见 ensureNoteSelectorParent）。
  function promptUseNoteSelectorAsParent(obj) {
    if (!obj) return;
    const cur = obj.parent_id != null ? String(obj.parent_id) : '';
    openModal('使用 note 选择器作为 Parent_id', `
      <div class="help-text">${__t('Parent_id 模板需包含 <b>$note</b> 占位符，导出时按每个 note 替换成对应 ID（如 parent_$note → parent_492）。应用 note 选择器后自动为未被控制器覆盖的 note 创建纯 ID 载体 note_controller。')}</div>
      <div class="field"><label>${__t('模板')}</label><input type="text" id="pmParentId"
        value="${escapeHtml(cur.indexOf('$note') >= 0 ? cur : 'parent_$note')}" style="flex:1"></div>`,
      [{ label: '取消' }, { label: '使用', cls: 'primary' }], (b) => {
        if (b.label !== '使用') return;
        const v = $('#pmParentId').value.trim();
        if (!v) { toast('Parent_id 模板不能为空', true); return; }
        if (v.indexOf('$note') < 0) {
          confirmDialog('警告', '模板必须包含 $note，否则无法在多对象情景中应用', [{ label: '知道了', cls: 'primary' }]);
          return;
        }
        snapshot();
        syncObjectField(obj, 'parent_id', v);
        state.dirty = true;
        // $note 模板在应用 note 选择器（创建纯 ID 载体）之前无法展开：此刻
        // 直接重编译会让编译器把模板替换成 parent_undefined 并抛“不存在”。
        // 只刷新树/属性面板，预览重编译推迟到 note 选择器应用时。
        renderObjectTree();
        renderProperties();
        renderTimeline();
        requestRender();
        openNoteSelectorEditor(obj);
      });
  }

  // ---- 独立进程窗口的 IPC 桥（note_selector.html 通过 window.sbAPI.nsCall 调用）----
  function nsGetContext() {
    const notes = (state.chart ? state.chart.notes : []).map((n) => ({
      id: n.id, type: n.type, x: n.x, direction: n.direction, start_time: n.start_time
    }));
    const controllers = (state.storyboard && state.storyboard.note_controllers || []).map((nc) => ({
      id: nc.id, note: nc.note, carrier: isParentCarrier(nc.id)
    }));
    return {
      hasProject: !!(state.storyboard && state.chart),
      notes,
      controllers,
      target: noteSelectorTarget ? {
        id: noteSelectorTarget.id,
        type: noteSelectorTarget.type || null,
        // 编辑器显示草稿（未提交）值；提交前对象本身保持不变。
        note: nsDraft ? nsDraft.note : (noteSelectorTarget.note || null),
        parentId: noteSelectorTarget.parent_id || null,
        merge: nsDraft ? !!nsDraft.merge : isNoteSelectorMerged(noteSelectorTarget.id)
      } : null,
      mode: state.nsMode || null,
      pickActive: !!state.notePickerActive
    };
  }

  function nsApply(payload) {
    if (!payload || !state.storyboard) return { ok: false, msg: '未打开项目' };
    const id = payload.id;
    let obj = null;
    if (id) {
      const entry = findObjectEntry(id);
      if (entry) obj = entry.obj;
    }
    if (!obj) {
      // 无绑定对象：写入当前选中 note 集合（同一选择器控制器或新建）。
      const noteIds = (state.selectedIds || [])
        .filter(isNoteEntry)
        .map((x) => splitEntryId(x).noteId)
        .filter((n) => n != null);
      if (!noteIds.length) return { ok: false, msg: '请先在预览中选择 note 或绑定对象' };
      snapshot();
      obj = sharedSelectorControllerForNotes(noteIds);
      if (!obj) {
        const first = state.chart ? state.chart.noteById(noteIds[0]) : null;
        obj = { id: uniqueId('note_controller'), note: payload.note, time: first ? first.start_time : 0 };
        state.storyboard.note_controllers = state.storyboard.note_controllers || [];
        state.storyboard.note_controllers.push(obj);
      }
    } else {
      snapshot();
    }
    obj.note = payload.note;
    if (obj.parent_id && String(obj.parent_id).indexOf('$note') >= 0) {
      ensureNoteSelectorParent(obj, payload.note);
    }
    setNoteSelectorMerge(obj.id, !!payload.merge);
    // 选择器/合并状态变化后，note_controller 轨道的占用区间可能改变：按与普通
    // 时间块相同的堆叠规则把重叠块挤到相邻/新轨道。
    resolveAllLaneOverlaps([obj.id]);
    // 提交成功后草稿同步为已提交值，后续编辑从该值继续。
    nsDraft = { note: JSON.parse(JSON.stringify(payload.note != null ? payload.note : {})), merge: !!payload.merge };
    noteSelectorTarget = obj;
    state.dirty = true;
    dirtyAndRefresh();
    return { ok: true, id: obj.id, note: payload.note };
  }

  // 编辑器窗口的未提交改动（如“切换至筛选样式”的草稿、merge 开关）：
  // 只更新草稿，不触碰对象；点击“应用”时才真正写回。
  function nsDraftSet(payload) {
    if (!noteSelectorTarget || !nsDraft) return { ok: false, msg: '未绑定选择器对象' };
    if (payload && payload.note !== undefined) {
      nsDraft.note = JSON.parse(JSON.stringify(payload.note));
    }
    if (payload && payload.merge !== undefined) nsDraft.merge = !!payload.merge;
    return { ok: true, note: nsDraft.note, merge: nsDraft.merge };
  }

  function nsHighlight(noteIds) {
    if (!preview) return;
    preview.setHighlight(null, new Set(noteIds || []));
    preview.markDirty();
    requestRender();
    return true;
  }

  function nsSetPick(on) {
    state.notePickerActive = !!on;
    return true;
  }

  // 独立窗口的时间写入：把 $note 表达式写到主窗口属性表单当前时间输入框
  // 对应的对象帧（K0 或指定 state）。
  function nsWriteTime(payload) {
    if (!state.nsTimeTarget) return { ok: false, msg: '未选择时间输入框' };
    const entry = findObjectEntry(state.nsTimeTarget.objId);
    if (!entry || !entry.obj) return { ok: false, msg: '对象不存在' };
    const obj = entry.obj;
    const frame = state.nsTimeTarget.isK0 ? obj : (obj.states || [])[state.nsTimeTarget.frame];
    if (!frame) return { ok: false, msg: '目标帧不存在' };
    snapshot();
    setStateField(frame, 'time', payload.expr);
    state.dirty = true;
    dirtyAndRefresh(false);
    renderProperties();
    return { ok: true };
  }

  function selectorFormFromNote(note) {
    const s = { types: {}, start: null, end: null, direction: null, min_x: null, max_x: null,
      listMode: false, arrayIds: [] };
    for (let t = 0; t < 8; t++) s.types[t] = false;
    if (Array.isArray(note)) {
      // 手动拾取后的列表形式：[] 内逐个列出选中的 note。
      s.listMode = true;
      s.arrayIds = note.map(Number);
    } else if (note && typeof note === 'object') {
      const ts = Array.isArray(note.type) ? note.type.map(Number) : (note.type != null ? [Number(note.type)] : []);
      for (const t of ts) if (s.types[t] != null) s.types[t] = true;
      if (!Object.keys(note).length) {
        // 空 {} = 命中全部 note：显示为全选状态。
        for (let t = 0; t < 8; t++) s.types[t] = true;
      }
      s.start = note.start != null ? Number(note.start) : null;
      s.end = note.end != null ? Number(note.end) : null;
      s.direction = note.direction != null ? Number(note.direction) : null;
      s.min_x = note.min_x != null ? Number(note.min_x) : null;
      s.max_x = note.max_x != null ? Number(note.max_x) : null;
    }
    return s;
  }

  function renderNoteSelectorEditor(body) {
    const s = selectorFormFromNote(noteSelectorTarget && noteSelectorTarget.note);
    if (s.listMode) {
      const noteRows = (s.arrayIds || []).map((id) => {
        const n = state.chart ? state.chart.noteById(Number(id)) : null;
        const type = n ? (NOTE_TYPE_LABELS[n.type] || ('类型 ' + n.type)) : '未知';
        return `<div style="display:flex;justify-content:space-between;padding:2px 4px">` +
          `<span>#${id}</span><span style="color:var(--accent)">${type}</span></div>`;
      }).join('');
      body.innerHTML =
        `<div class="help-text">${__t('手动列表模式：选择器将以 <b>[]数组</b> 形式逐个列出选中的 note（共 <b>')}${s.arrayIds.length}${__t('</b> 个）。')}` +
        `${__t('拾取模式开启后点击预览中的 note 即可继续添加/取消；点击“应用”后生效。')}</div>` +
        `<div class="field"><label>${__t('已选 note')}</label><div style="max-height:300px;overflow-y:auto;flex:1;border:1px solid #333;border-radius:4px;padding:4px;font-size:12px">` +
        (noteRows || __t('<span style="color:#888">（空列表）</span>')) + `</div></div>` +
        `<div class="field"><label>${__t('合并时间块')}</label><input type="checkbox" id="nselMerge"${(!noteSelectorTarget || (nsDraft && nsDraft.merge)) ? ' checked' : ''}></div>` +
        `<div class="btn-row"><button class="mini-btn" id="nselPick">${__t(state.notePickerActive ? '停止拾取' : '手动拾取note')}</button>` +
        `<button class="mini-btn" id="nselApply">${__t('应用')}</button>` +
        `<button class="mini-btn" id="nselToFilter">${__t('切换至筛选样式并清空列表')}</button></div>`;
      body.querySelector('#nselPick').addEventListener('click', () => {
        state.notePickerActive = !state.notePickerActive;
        renderNoteSelectorEditor(body);
        toast(state.notePickerActive ? __t('拾取模式：点击预览画面中的 note 加入选择器') : __t('已退出拾取模式'));
      });
      body.querySelector('#nselApply').addEventListener('click', applyNoteSelectorFromEditor);
      body.querySelector('#nselToFilter').addEventListener('click', () => {
        if (!noteSelectorTarget) return;
        // 只改草稿，点击“应用”才真正切换。
        nsDraft = nsDraft || { note: {}, merge: false };
        nsDraft.note = {};
        renderNoteSelectorEditor(body);
        toast('已切换至筛选模式，点击“应用”后生效');
      });
      body.querySelector('#nselMerge').addEventListener('change', () => {
        // 新选择器（未绑定）也记录合并开关草稿，重渲染后仍保持用户选择。
        nsDraft = nsDraft || { note: {}, merge: false };
        nsDraft.merge = body.querySelector('#nselMerge').checked;
      });
      return;
    }
    const typeHtml = [0, 1, 2, 3, 4, 5, 6, 7].map((t) =>
      `<label style="display:inline-flex;align-items:center;gap:2px;font-size:11px">` +
      `<input type="checkbox" class="nsel-type" data-type="${t}"${s.types[t] ? ' checked' : ''}>${NOTE_TYPE_LABELS[t]}</label>`).join('');
    body.innerHTML =
      `<div class="help-text">${state.notePickerActive
        ? __t('<b style="color:var(--accent)">拾取模式：点击预览画面中的 note 加入选择器。</b>')
        : __t('勾选类型/填写范围即可实时统计命中 note 数量；')}` +
      (noteSelectorTarget
        ? __t('当前绑定控制器 <b>') + escapeHtml(noteSelectorTarget.id) + __t('</b>，应用时直接写入其 note 字段。')
        : __t('应用时写入当前选中的 note 集合（同一选择器控制器或新建）。')) +
      `</div>` +
      `<div class="field"><label>类型</label><div style="display:flex;flex-wrap:wrap;gap:2px 8px;flex:1">${typeHtml}</div></div>` +
      `<div class="field"><label>ID 从</label><input type="number" id="nselStart" value="${s.start != null ? s.start : ''}" placeholder="不限"></div>` +
      `<div class="field"><label>ID 到</label><input type="number" id="nselEnd" value="${s.end != null ? s.end : ''}" placeholder="不限"></div>` +
      `<div class="field"><label>方向</label><select id="nselDir">` +
      `<option value="">不限</option><option value="1"${s.direction === 1 ? ' selected' : ''}>上行 (1)</option>` +
      `<option value="-1"${s.direction === -1 ? ' selected' : ''}>下行 (-1)</option></select></div>` +
      `<div class="field"><label>min_X</label><input type="number" id="nselMinX" step="0.01" value="${s.min_x != null ? s.min_x : ''}" placeholder="不限"></div>` +
      `<div class="field"><label>max_X</label><input type="number" id="nselMaxX" step="0.01" value="${s.max_x != null ? s.max_x : ''}" placeholder="不限"></div>` +
      `<div class="field"><label>命中数量</label><span id="nselHit" style="flex:1;color:var(--accent)">-</span></div>` +
      `<div class="field"><label>合并时间块</label><input type="checkbox" id="nselMerge"${(!noteSelectorTarget || (nsDraft ? nsDraft.merge : isNoteSelectorMerged(noteSelectorTarget && noteSelectorTarget.id))) ? ' checked' : ''}></div>` +
      (state.nsTimeTarget
        ? `<div class="field"><label>写入时间</label><select id="nselTimeExpr">` +
          `<option value="start:$note">${__t('起始 start:$note')}</option>` +
          `<option value="end:$note">${__t('结束 end:$note')}</option>` +
          `<option value="intro:$note">${__t('渐入 intro:$note')}</option>` +
          `<option value="at:$note:0.5">at:$note:0.5</option></select>` +
          `<button class="mini-btn" id="nselWriteTime">${__t('写入')}</button></div>`
        : '') +
      `<div class="btn-row"><button class="mini-btn" id="nselApply">${__t(noteSelectorTarget ? '应用（写入绑定控制器）' : '应用（写入选中 note）')}</button>` +
      `<button class="mini-btn" id="nselToggleAll">${__t('全选/清空条件')}</button>` +
      `<button class="mini-btn" id="nselPick">${__t(state.notePickerActive ? '停止拾取' : '手动拾取note')}</button></div>`;
    const readSel = () => {
      const sel = {};
      const types = Array.from(body.querySelectorAll('.nsel-type:checked')).map((el) => Number(el.dataset.type));
      if (types.length && types.length < 8) sel.type = types;
      const num = (id) => {
        const v = body.querySelector('#' + id).value.trim();
        return v === '' ? null : Number(v);
      };
      const start = num('nselStart'), end = num('nselEnd');
      if (start != null) sel.start = start;
      if (end != null) sel.end = end;
      const dir = body.querySelector('#nselDir').value;
      if (dir !== '') sel.direction = Number(dir);
      const minX = num('nselMinX'), maxX = num('nselMaxX');
      if (minX != null) sel.min_x = minX;
      if (maxX != null) sel.max_x = maxX;
      return sel;
    };
    const updateHit = () => {
      const sel = readSel();
      const ids = Object.keys(sel).length
        ? noteSelectorIds(sel)
        : (state.chart ? state.chart.notes.map((n) => n.id) : []);
      const el = body.querySelector('#nselHit');
      if (el) el.textContent = String(ids.length) + ' 个 note';
      // 预览中实时高亮被命中的 note。
      if (preview) {
        preview.setHighlight(null, new Set(ids));
        preview.markDirty();
        requestRender();
      }
    };
    body.querySelectorAll('input, select').forEach((el) => el.addEventListener('input', updateHit));
    body.querySelectorAll('input, select').forEach((el) => el.addEventListener('change', updateHit));
    updateHit();
    body.querySelector('#nselApply').addEventListener('click', applyNoteSelectorFromEditor);
    // 全选/清空条件效果一致（都得到空 {} = 全部 note），合并为一个切换按钮。
    body.querySelector('#nselToggleAll').addEventListener('click', () => {
      const allChecked = body.querySelectorAll('.nsel-type').length > 0 &&
        Array.from(body.querySelectorAll('.nsel-type')).every((cb) => cb.checked);
      if (allChecked) {
        body.querySelectorAll('.nsel-type').forEach((cb) => { cb.checked = false; });
        ['nselStart', 'nselEnd', 'nselMinX', 'nselMaxX'].forEach((id) => { body.querySelector('#' + id).value = ''; });
        body.querySelector('#nselDir').value = '';
      } else {
        body.querySelectorAll('.nsel-type').forEach((cb) => { cb.checked = true; });
      }
      updateHit();
    });
    body.querySelector('#nselPick').addEventListener('click', () => {
      state.notePickerActive = !state.notePickerActive;
      renderNoteSelectorEditor(body);
      toast(state.notePickerActive ? '拾取模式：点击预览画面中的 note 加入选择器' : '已退出拾取模式');
    });
    const writeTimeBtn = body.querySelector('#nselWriteTime');
    if (writeTimeBtn) {
      writeTimeBtn.addEventListener('click', () => {
        const expr = body.querySelector('#nselTimeExpr').value;
        writeTimeExpressionToTarget(expr);
      });
    }
  }

  // 从编辑器浮窗读取当前筛选条件（筛选模式专用；列表模式返回 null）。
  function readNoteSelectorFromBody(body) {
    if (!body || !body.querySelector('#nselStart')) return null;
    const types = Array.from(body.querySelectorAll('.nsel-type:checked')).map((el) => Number(el.dataset.type));
    const num = (id) => {
      const v = body.querySelector('#' + id).value.trim();
      return v === '' ? null : Number(v);
    };
    const sel = {};
    if (types.length && types.length < 8) sel.type = types;
    const start = num('nselStart'), end = num('nselEnd');
    if (start != null) sel.start = start;
    if (end != null) sel.end = end;
    const dir = body.querySelector('#nselDir').value;
    if (dir !== '') sel.direction = Number(dir);
    const minX = num('nselMinX'), maxX = num('nselMaxX');
    if (minX != null) sel.min_x = minX;
    if (maxX != null) sel.max_x = maxX;
    return sel;
  }

  function applyNoteSelectorFromEditor() {
    if (!floatWindowEl) return;
    const body = floatWindowEl.querySelector('.float-window-body');
    // 列表模式没有筛选表单（readNoteSelectorFromBody 返回 null）：提交草稿列表。
    let sel = readNoteSelectorFromBody(body);
    if (sel === null && noteSelectorTarget && nsDraft) sel = nsDraft.note;
    if (sel === null) sel = {};
    // 空 {} 是合法的“全部 note”选择器（R5：允许创建，compiled 展开全部 note）。
    const merge = body.querySelector('#nselMerge').checked;
    if (noteSelectorTarget) {
      snapshot();
      noteSelectorTarget.note = sel;
      // sprite 使用 $note parent_id 时：自动确保纯 ID 载体父级存在。
      if (noteSelectorTarget.parent_id &&
          String(noteSelectorTarget.parent_id).indexOf('$note') >= 0) {
        ensureNoteSelectorParent(noteSelectorTarget, sel);
      }
      setNoteSelectorMerge(noteSelectorTarget.id, merge);
      nsDraft = { note: JSON.parse(JSON.stringify(sel != null ? sel : {})), merge };
      state.dirty = true;
      dirtyAndRefresh();
      toast(__t('已更新 note 选择器: ') + JSON.stringify(sel));
      return;
    }
    const noteIds = (state.selectedIds || [])
      .filter(isNoteEntry)
      .map((id) => splitEntryId(id).noteId)
      .filter((n) => n != null);
    if (!noteIds.length) { toast('请先在预览中选择一个或多个 note', true); return; }
    snapshot();
    const shared = sharedSelectorControllerForNotes(noteIds);
    let nc = shared;
    if (!nc) {
      const first = state.chart ? state.chart.noteById(noteIds[0]) : null;
      nc = { id: uniqueId('note_controller'), note: sel, time: first ? first.start_time : 0 };
      state.storyboard.note_controllers = state.storyboard.note_controllers || [];
      state.storyboard.note_controllers.push(nc);
    } else {
      nc.note = sel;
    }
    setNoteSelectorMerge(nc.id, merge);
    state.dirty = true;
    refreshAll();
    toast(__t('已应用 note 选择器（命中 ') + noteIds.length + __t(' 个选中 note）: ') + JSON.stringify(sel));
  }

  // 选中的 note 是否全部隶属于同一个 note_controller（即同一个选择器）。
  function sharedSelectorControllerForNotes(noteIds) {
    let shared = null;
    for (const nid of noteIds) {
      const nc = findNoteControllerForNote(nid);
      if (!nc) return null;
      if (!shared) shared = nc;
      else if (shared !== nc) return null;
    }
    return shared;
  }

  function setNoteSelectorMerge(id, on) {
    state.noteSelectorMerge = state.noteSelectorMerge || {};
    if (on) state.noteSelectorMerge[id] = true;
    else delete state.noteSelectorMerge[id];
    persistProjectState();
  }

  // $note parent_id 的纯 ID 载体标记（.ctr 持久化）。
  function isParentCarrier(id) {
    return !!(state.parentCarriers && state.parentCarriers[id]);
  }
  function markParentCarrier(id, on) {
    state.parentCarriers = state.parentCarriers || {};
    if (on) state.parentCarriers[id] = true;
    else delete state.parentCarriers[id];
    persistProjectState();
  }

  // 查找覆盖某 note 的“真实”（非纯 ID 载体）note_controller。
  function findRealControllerForNote(noteId) {
    for (const nc of (state.storyboard && state.storyboard.note_controllers) || []) {
      if (nc.note == null || isParentCarrier(nc.id)) continue;
      if (nc.note === noteId) return nc;
      if (noteSelectorIncludes(nc.note, noteId)) return nc;
    }
    return null;
  }

  // 覆盖某 note 的纯 ID 载体 id（取第一个）。
  function carrierForNote(noteId) {
    for (const [id, on] of Object.entries(state.parentCarriers || {})) {
      if (!on) continue;
      const nc = (state.storyboard && state.storyboard.note_controllers || []).find((x) => x.id === id);
      if (nc && noteSelectorIncludes(nc.note, noteId)) return id;
    }
    return null;
  }

  // 载体收缩：把已由真实控制器接管的 note 从载体列表中移除；清空则删除载体。
  function shrinkCarrier(carrierId, takenNotes) {
    const nc = (state.storyboard && state.storyboard.note_controllers || []).find((x) => x.id === carrierId);
    if (!nc) return;
    let list = Array.isArray(nc.note) ? nc.note.map(Number) : noteSelectorIds(nc.note);
    list = list.filter((n) => !takenNotes.includes(n));
    if (!list.length) {
      state.storyboard.note_controllers = state.storyboard.note_controllers.filter((x) => x !== nc);
      markParentCarrier(carrierId, false);
    } else {
      nc.note = list;
    }
  }

  // 创建独立 note_controller 时的 ID：单 note 且该 note 由 $note 载体覆盖时，
  // 采用载体的具体展开 id（如 parent_5）并把该 note 从载体（合并时间块）中
  // 分离——真实控制器同时承担父级引用与独立编辑，不产生同 id 双对象；多 note
  // 或未被载体覆盖时用普通唯一 id。旧实现把载体模板 id（parent_$note）交给
  // 真实控制器，造成同 id 双对象（载体 + 真实控制器），时间轴选中/属性面板
  // 解析会命中错误对象，重开后还会被选择器还原逻辑吞并。
  function noteControllerIdWithHandoff(noteIds) {
    if (noteIds && noteIds.length === 1 && noteIds[0] != null) {
      const carrierId = carrierForNote(noteIds[0]);
      if (carrierId) {
        shrinkCarrier(carrierId, noteIds);
        return String(carrierId).replace(/\$note/g, String(noteIds[0]));
      }
    }
    return uniqueId('note_controller');
  }

  function createNoteControllerWithIdHandoff(noteIds, time) {
    const firstNote = noteIds[0];
    const id = noteControllerIdWithHandoff(noteIds);
    const first = state.chart ? state.chart.noteById(firstNote) : null;
    const nc = {
      id,
      note: noteIds.length === 1 ? noteIds[0] : noteIds,
      time: time != null ? time : (first ? first.start_time : 0)
    };
    state.storyboard.note_controllers = state.storyboard.note_controllers || [];
    state.storyboard.note_controllers.push(nc);
    return nc;
  }

  // 为 sprite 的 $note parent_id 确保存在纯 ID 载体 note_controller：
  // 未被真实控制器覆盖的 note 由载体提供 `模板→<noteId>` 的 compiled ID。
  // 载体与引用对象的 note 选择器必须保持同步：任一引用对象的 note 集合变化
  // （选择器编辑、真实控制器接管/删除）后，载体的 note 列表若不同步，保存时
  // 编译校验会抛 parent_id "模板→noteId" 不存在，导致 StoryBoard 无法保存。
  function syncNoteSelectorCarriers() {
    if (!state.storyboard || !state.chart) return;
    // 收集所有引用 $note 模板的对象所需覆盖的 note 集合。
    const wanted = new Map(); // template -> Set<noteId>
    for (const [group, type] of Object.entries(GROUP_TYPES)) {
      if (type === 'controller' || type === 'note_controller') continue;
      for (const o of state.storyboard[group] || []) {
        if (!o || o.parent_id == null || String(o.parent_id).indexOf('$note') < 0) continue;
        if (o.note == null) continue;
        const ids = noteSelectorIds(o.note);
        if (!ids.length) continue;
        const template = String(o.parent_id);
        if (!wanted.has(template)) wanted.set(template, new Set());
        for (const n of ids) wanted.get(template).add(n);
      }
    }
    for (const [template, ids] of wanted) {
      const uncovered = [...ids].filter((n) => carrierNeedsNote(template, n));
      const carrier = (state.storyboard.note_controllers || [])
        .find((nc) => nc && nc.id === template && isParentCarrier(nc.id));
      if (carrier) {
        if (uncovered.length) carrier.note = uncovered;
        else {
          state.storyboard.note_controllers = state.storyboard.note_controllers.filter((x) => x !== carrier);
          markParentCarrier(template, false);
        }
      } else if (uncovered.length) {
        state.storyboard.note_controllers = state.storyboard.note_controllers || [];
        state.storyboard.note_controllers.push({ id: template, note: uncovered, time: 0 });
        setNoteSelectorMerge(template, true);
        markParentCarrier(template, true);
      }
    }
  }

  // ---------------------------------------------------------------
  // “尝试修复合并时间块”：把 compiled 展开后遗留的逐 note 克隆重建回
  // 单个合并时间块（$note 载体）。适用场景：.ctr 的 noteSelectorMeta
  // 缺失/损坏（如 EffectsTest），导致 reconstructNoteSelectors 与自愈
  // 逻辑都无法把 parent_$note 还原，时间轴只剩一长串 parent_N 条目。
  // 只合并形状一致（共享同一批状态）的克隆；被单独编辑过的真实控制器
  // （如 parent_21）形状不同，保持独立不并入。
  // ---------------------------------------------------------------
  function repairMergedBlocks() {
    if (!state.storyboard) { toast('请先打开关卡', true); return; }
    const sb = state.storyboard;
    const ncs = sb.note_controllers || [];
    const chart = state.chart;
    if (!chart || !chart.noteById) { toast('修复需要已加载的谱面数据', true); return; }
    const noteExists = (n) => !!(chart.noteById(n));
    const templatePrefix = (template) => String(template).slice(0, -5); // 去掉 "$note"
    const cloneNidOf = (nc, prefix) => {
      if (!nc || nc.id == null) return null;
      const m = /^(.*?)(\d+)$/.exec(String(nc.id));
      if (!m || m[1] !== prefix) return null;
      const nid = Number(m[2]);
      // 逐 note 克隆的 note 字段必须等于其 id 尾部的 note 号（如 parent_0 →
      // note 0）。普通编号控制器（note_controller_3 覆盖 note 103）id 尾号
      // 与 note 不一致，不能误当成 $note 模板的克隆。
      if (!Number.isInteger(nid) || !noteExists(nid)) return null;
      if (nc.note !== nid) return null;
      return nid;
    };

    // 1) 候选模板：.ctr 元数据已声明 $note 载体/合并标记但对象不存在；
    //    或克隆 id 前缀形如自动生成的 $note 模板（如 parent_ / wave_），
    //    且该模板确实被引用过（stage 对象的 parent_id、选择器元数据或
    //    时间轴轨道出现模板本身）。避免把 note_controller_1 /
    //    note_controller_2 这类普通编号控制器误并成 note_controller_$note。
    const candidates = new Set();
    const addMetaCandidates = (map) => {
      if (!map || typeof map !== 'object') return;
      for (const id of Object.keys(map)) {
        if (id.indexOf('$note') < 0) continue;
        if (ncs.some((nc) => nc && nc.id === id)) continue; // 对象已存在，无需修复
        candidates.add(id);
      }
    };
    addMetaCandidates(state.parentCarriers);
    addMetaCandidates(state.noteSelectorMerge);
    const templateReferenced = (template) => {
      for (const [groupName] of Object.entries(GROUP_TYPES)) {
        if (groupName === 'controllers' || groupName === 'note_controllers') continue;
        for (const o of sb[groupName] || []) {
          if (o && o.parent_id != null && String(o.parent_id) === template) return true;
        }
      }
      for (const entry of Object.values(state.noteSelectorMeta || {})) {
        if (entry && entry.parent_id != null && String(entry.parent_id) === template) return true;
      }
      const tl = readCysterTimelineRaw();
      const tg = tl && tl.trackGroups;
      if (tg) {
        for (const list of Object.values(tg)) {
          for (const lane of (list || [])) {
            if ((lane || []).includes(template)) return true;
          }
        }
      }
      return false;
    };
    const cloneGroups = new Map(); // template -> clones
    for (const nc of ncs) {
      const m = !nc || nc.id == null ? null : /^(.*?)(\d+)$/.exec(String(nc.id));
      if (!m || !m[1] || !noteExists(Number(m[2]))) continue;
      if (nc.note !== Number(m[2])) continue; // id 尾号必须与 note 一致才是克隆
      const template = m[1] + '$note';
      if (ncs.some((x) => x && x.id === template)) continue;
      if (!cloneGroups.has(template)) cloneGroups.set(template, []);
      cloneGroups.get(template).push(nc);
    }
    for (const [template, clones] of cloneGroups) {
      if (clones.length < 2) continue;
      if (!candidates.has(template) && !templateReferenced(template)) continue;
      candidates.add(template);
    }

    const repairs = [];
    for (const template of candidates) {
      const prefix = templatePrefix(template);
      const clones = ncs
        .map((nc) => ({ nc, nid: cloneNidOf(nc, prefix) }))
        .filter((x) => x.nid != null)
        .map((x) => x.nc);
      if (clones.length < 2) continue;
      // 按状态形状分组：同一合并块的克隆形状一致（states 数 + 每帧字段集）。
      const shapeOf = (c) => (c.states || []).map((st) =>
        Object.keys(st || {})
          .filter((k) => k !== 'time' && k !== 'note' && k !== 'id')
          .sort().join(',')
      ).join('|') + '#n' + (c.states || []).length;
      const byShape = new Map();
      for (const c of clones) {
        const k = shapeOf(c);
        if (!byShape.has(k)) byShape.set(k, []);
        byShape.get(k).push(c);
      }
      const group = [...byShape.values()].sort((a, b) => b.length - a.length)[0];
      if (!group || group.length < 2) continue;
      const groupIds = new Set(group.map((c) => c.id));
      const noteIds = group
        .map((c) => Number(String(c.id).replace(prefix, '')))
        .sort((a, b) => a - b);
      if (noteIds.length < 2) continue;
      const first = group[0];
      const stCount = (first.states || []).length;
      // 合并块共享同一批状态：核对非时间字段一致（浮点噪声容差），有差异
      // 时仍以第一个为准尽力合并（避免因小数尾差误判为不可修复）。
      const valueEq = (a, b) => {
        if (a === b) return true;
        if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) < 1e-6;
        if (a && b && typeof a === 'object' && typeof b === 'object') {
          const ka = Object.keys(a), kb = Object.keys(b);
          if (ka.length !== kb.length) return false;
          return ka.every((k) => valueEq(a[k], b[k]));
        }
        return false;
      };
      let consistent = true;
      for (let i = 0; i < stCount; i++) {
        const baseSt = (first.states || [])[i] || {};
        for (const c of group) {
          const st = (c.states || [])[i] || {};
          for (const k of Object.keys(baseSt)) {
            if (k === 'time' || k === 'note' || k === 'id') continue;
            if (!valueEq(baseSt[k], st[k])) { consistent = false; break; }
          }
          if (!consistent) break;
        }
        if (!consistent) break;
      }
      const merged = { id: template, note: noteIds, time: 0, states: [] };
      for (const k of Object.keys(first)) {
        if (k === 'id' || k === 'note' || k === 'time' || k === 'states') continue;
        merged[k] = first[k];
      }
      // K0：各克隆对象级 time 一致时保持绝对时间，否则按 $note 表达式拟合。
      const k0Times = noteIds.map((nid) => {
        const c = group.find((x) => Number(String(x.id).replace(prefix, '')) === nid);
        return c ? c.time : null;
      });
      merged.time = k0Times.every((t) => t != null)
        ? fitNoteToken(k0Times, noteIds) : (first.time != null ? first.time : 0);
      for (let i = 0; i < stCount; i++) {
        const times = noteIds.map((nid) => {
          const c = group.find((x) => Number(String(x.id).replace(prefix, '')) === nid);
          return c && c.states[i] ? c.states[i].time : null;
        });
        const src = (first.states || [])[i] || {};
        const st = {};
        for (const k of Object.keys(src)) {
          if (k === 'note' || k === 'id') continue;
          st[k] = src[k];
        }
        st.time = times.every((t) => t != null) ? fitNoteToken(times, noteIds) : src.time;
        merged.states.push(st);
      }
      repairs.push({
        template, prefix, noteIds, groupIds,
        merged, clones: group.length, consistent
      });
    }

    if (!repairs.length) {
      toast('未发现可修复的合并时间块（缺少 $note 载体克隆，或对应对象已存在）', true);
      return;
    }
    snapshot();
    for (const r of repairs) {
      const { template, prefix, noteIds, groupIds, merged } = r;
      sb.note_controllers = sb.note_controllers.filter((x) => !groupIds.has(x.id));
      sb.note_controllers.push(merged);
      state.noteSelectorMerge = state.noteSelectorMerge || {};
      state.noteSelectorMerge[template] = true;
      state.parentCarriers = state.parentCarriers || {};
      state.parentCarriers[template] = true;
      // 清理指向已移除克隆的残留元数据标记。
      for (const id of groupIds) {
        if (state.noteSelectorMerge) delete state.noteSelectorMerge[id];
        if (state.parentCarriers) delete state.parentCarriers[id];
        if (state.noteSelectorMeta) delete state.noteSelectorMeta['note_controllers::' + id];
      }
      // 重新绑定引用克隆 id（如 parent_0）的 stage 选择器对象 → $note 模板，
      // 让重开/保存时 parent_id 模板与重建的载体正确对应。
      for (const [groupName] of Object.entries(GROUP_TYPES)) {
        if (groupName === 'controllers' || groupName === 'note_controllers') continue;
        for (const o of sb[groupName] || []) {
          if (!o || o.parent_id == null || o.note == null || typeof o.note !== 'object') continue;
          const p = String(o.parent_id);
          if (groupIds.has(p)) o.parent_id = template;
        }
      }
    }
    state.dirty = true;
    syncNoteSelectorCarriers();
    persistProjectState();
    dirtyAndRefresh();
    const parts = repairs.map((r) =>
      __t('「') + r.template + __t('」(') + r.clones + __t('个拆分条目→合并') + r.noteIds.length + __t('个note）')).join('、');
    saveStoryboard().then((ok) => {
      toast(ok
        ? __t('已修复合并时间块：') + parts + __t('（已保存）')
        : __t('已修复合并时间块：') + parts + __t('（内存中已生效，请手动保存）'));
    });
  }

  // 载体是否需要覆盖某 note：“独立即让位”——只要该 note 已由任何真实
  // note_controller（非纯 ID 载体）覆盖，载体就让位（排除该 note），sprite 的
  // 父级在编译时由 resolveStageParent 解析到那个真实控制器；否则载体保留该
  // note 供 parent_<n> 引用。
  function carrierNeedsNote(template, nid) {
    for (const nc of (state.storyboard && state.storyboard.note_controllers) || []) {
      if (!nc || nc.note == null || isParentCarrier(nc.id)) continue;
      if (noteSelectorIncludes(nc.note, nid)) return false;
    }
    return true;
  }

  function ensureNoteSelectorParent(sprite, sel) {
    if (!sprite || !sprite.parent_id || String(sprite.parent_id).indexOf('$note') < 0) return null;
    const template = String(sprite.parent_id);
    const covered = noteSelectorIds(sel);
    if (!covered.length) return null;
    const uncovered = covered.filter((nid) => carrierNeedsNote(template, nid));
    if (!uncovered.length) return null;
    snapshot();
    let carrier = (state.storyboard.note_controllers || []).find((nc) => nc.id === template && isParentCarrier(nc.id));
    if (!carrier) {
      carrier = { id: template, note: uncovered, time: 0 };
      state.storyboard.note_controllers = state.storyboard.note_controllers || [];
      state.storyboard.note_controllers.push(carrier);
      setNoteSelectorMerge(carrier.id, true);
      markParentCarrier(carrier.id, true);
    } else {
      // 选择器已变化：全量重算（含其它引用同模板的对象），而不是只做并集，
      // 否则载体收缩后缺的 note 不会补回，保存时会抛 parent_id 不存在。
      syncNoteSelectorCarriers();
      carrier = (state.storyboard.note_controllers || [])
        .find((nc) => nc && nc.id === template && isParentCarrier(nc.id));
      if (!carrier) return null;
    }
    state.dirty = true;
    return carrier;
  }

  // 控制器是否使用 $note 时间表达式（note 选择器相关）。
  function usesNoteExpressions(obj) {
    if (!obj) return false;
    const check = (t) => typeof t === 'string' && t.indexOf('$note') >= 0;
    return check(obj.time) || (obj.states || []).some((st) => check(st.time));
  }

  // 任意对象类型是否使用 note 选择器相关表达式（$note 时间令牌 / $note parent_id）。
  // 用于在属性面板对非 note_controller 类型也显示 Note 选择器输入框。
  function objectUsesNoteTokens(obj) {
    if (!obj) return false;
    const check = (t) => typeof t === 'string' && t.indexOf('$note') >= 0;
    if (check(obj.time)) return true;
    if (obj.parent_id != null && String(obj.parent_id).indexOf('$note') >= 0) return true;
    return (obj.states || []).some((st) => check(st.time));
  }

  // 关键帧按时间分组去重：相同的 $note 表达式只显示一次；在给定 note 上下文
  // 下解析出相同具体时间（如雪女里的 57.499）的数字/绝对时间帧也合并为一组。
  // resolver(token) 返回解析后的时间（无上下文时返回 null）。
  function noteSelectorKeyframeGroups(obj, resolver) {
    const groups = [];
    const add = (token, index) => {
      if (typeof token === 'string' && token.indexOf('$note') >= 0) {
        const g = groups.find((x) => x.token === token);
        if (g) g.indices.push(index);
        else groups.push({ token, indices: [index], numeric: false });
      } else {
        const rt = resolver ? resolver(token) : null;
        const id = rt != null ? '#' + rt : 'raw:' + String(token);
        const g = groups.find((x) => x.numeric && x.id === id);
        if (g) g.indices.push(index);
        else groups.push({ token, indices: [index], numeric: true, id, time: rt });
      }
    };
    add(obj.time, -1);
    (obj.states || []).forEach((st, i) => add(st.time, i));
    return groups;
  }

  // 手动拾取：把选中的 note 加入选择器控制器；原有筛选条件因单独拾取加入的
  // note 可能被破坏，note 字段转换为 [] 数组、逐个列出每个选中的 note。
  function pickNoteToSelector(nid) {
    // 绑定了选择器编辑器时：先改草稿，点击“应用”才写回对象；直接关闭窗口
    // 则丢弃，保持对象原样。
    if (noteSelectorTarget && nsDraft) {
      const n = Number(nid);
      const cur = nsDraft.note;
      let base = [];
      if (Array.isArray(cur)) base = cur.map(Number);
      else if (typeof cur === 'number') base = [cur];
      else if (cur && typeof cur === 'object') base = noteSelectorIds(cur);
      const existed = base.includes(n);
      base = existed ? base.filter((x) => x !== n) : [...base, n];
      nsDraft.note = base;
      // 通知独立进程窗口实时更新（拾取结果回传）。
      if (window.sbAPI && window.sbAPI.nsPicked) {
        window.sbAPI.nsPicked({ noteId: n, note: base, count: base.length, targetId: noteSelectorTarget.id });
      }
      if (floatWindowEl && floatWindowKind === 'note-selector') {
        renderNoteSelectorEditor(floatWindowEl.querySelector('.float-window-body'));
      }
      toast(existed
        ? __t('已从选择器草稿移除 note ') + n + __t('（剩余 ') + base.length + __t(' 个，点击“应用”生效）')
        : __t('已拾取 note ') + n + __t(' 加入选择器草稿（共 ') + base.length + __t(' 个，点击“应用”生效）'));
      return;
    }
    let controller = noteSelectorTarget;
    if (!controller) {
      const selIds = (state.selectedIds || [])
        .filter(isNoteEntry)
        .map((id) => splitEntryId(id).noteId)
        .filter((n) => n != null);
      controller = sharedSelectorControllerForNotes(selIds);
      if (!controller) {
        const first = state.chart ? state.chart.noteById(nid) : null;
        controller = { id: uniqueId('note_controller'), note: [], time: first ? first.start_time : 0 };
        state.storyboard.note_controllers = state.storyboard.note_controllers || [];
        state.storyboard.note_controllers.push(controller);
      }
      noteSelectorTarget = controller;
    }
    snapshot();
    const cur = controller.note;
    let base = [];
    if (Array.isArray(cur)) base = cur.map(Number);
    else if (typeof cur === 'number') base = [cur];
    else if (cur && typeof cur === 'object') {
      // 优先使用编辑器当前正在编辑的筛选条件（用户可能改了但未点“应用”），
      // 否则用已写入的 note 字段。
      let effective = cur;
      if (floatWindowEl && floatWindowKind === 'note-selector') {
        const body = floatWindowEl.querySelector('.float-window-body');
        const sel = body ? readNoteSelectorFromBody(body) : null;
        if (sel && Object.keys(sel).length) effective = sel;
      }
      base = noteSelectorIds(effective);
    }
    // 手动拾取切换：点击已包含的 note 即从选择器中取消（移除）。
    const n = Number(nid);
    const existed = base.includes(n);
    base = existed ? base.filter((x) => x !== n) : [...base, n];
    controller.note = base;
    state.dirty = true;
    dirtyAndRefresh();
    // 通知独立进程窗口实时更新（拾取结果回传）。
    if (window.sbAPI && window.sbAPI.nsPicked) {
      window.sbAPI.nsPicked({ noteId: Number(nid), note: base, count: base.length, targetId: controller.id });
    }
    if (floatWindowEl && floatWindowKind === 'note-selector') {
      renderNoteSelectorEditor(floatWindowEl.querySelector('.float-window-body'));
    }
    toast(existed
      ? __t('已从选择器移除 note ') + nid + __t('（剩余 ') + base.length + __t(' 个，[] 列表形式）')
      : __t('已拾取 note ') + nid + __t(' 加入选择器（共 ') + base.length + __t(' 个，[] 列表形式）'));
  }

  // True when the playhead sits exactly on one of the object's keyframes.
  function isPlayheadOnKeyframe(obj) {
    const t = preview.time;
    return objectKeyframes(obj).some((k) => Math.abs(k.time - t) < 1e-6);
  }

  // Evaluate the object's state at the playhead (interpolated between the two
  // surrounding keyframes) using the preview's compiled engine result.
  function interpolatedStateFor(obj, type, t) {
    if (!preview.compiled) return null;
    const group = type === 'note_controller' ? 'noteControllers' : TYPE_GROUPS[type];
    const list = preview.compiled[group] || [];
    const entry = list.find((e) => e.id === obj.id);
    if (!entry) return null;
    const r = SB.storyboard.evaluateObject(entry, t);
    return r ? (r.from || null) : null;
  }

  // Rebuild the properties panel when the playhead moves onto/off a keyframe,
  // or while showing interpolated (read-only) values. Skipped during playback
  // so per-frame scrubbing does not rebuild the panel constantly.
  function refreshPropsIfNeeded() {
    if (state.playing || !state.storyboard) return;
    // 预览空白处：实时统计面板随播放头重渲染。
    if (state.previewEmptyFocus) { renderProperties(); return; }
    if (!state.selectedObjId) return;
    if (state.selectedIds && state.selectedIds.length > 1) return;
    const entry = findObjectEntry(state.selectedObjId);
    if (!entry) return;
    const onKf = isPlayheadOnKeyframe(entry.obj);
    const explicit = !!state.propsExplicitKf;
    const effective = onKf || explicit;
    if (effective !== state.propsOnKeyframe || !effective) renderProperties();
  }

  function fmtLiveStat(v) {
    if (v === undefined || v === null) return '—';
    if (typeof v === 'boolean') return v ? '开' : '关';
    if (typeof v === 'number') return String(Math.round(v * 1000) / 1000);
    if (Array.isArray(v)) return '[' + v.length + ' ' + __t('项') + ']';
    return String(v);
  }

  // 预览空白处：controller 实时统计数据（播放头时刻所有控制器合并结果）
  // + 全部属性卡片（未占用可拖到预览画面创建新轨道，右键启用/删除/跳转）。
  function renderControllerLiveStats(body) {
    if (preview.evaluate) preview.evaluate(preview.time);
    const m = preview.mergedCtrl || {};
    const rows = [
      ['相机透视', 'perspective'], ['视野 FOV', 'fov'],
      ['相机 X', 'xPx'], ['相机 Y', 'yPx'], ['相机 Z', 'zPx'],
      ['相机旋转 X', 'rot_x'], ['相机旋转 Y', 'rot_y'], ['相机旋转 Z', 'rot_z'],
      ['场景不透明度', 'storyboard_opacity'], ['UI 不透明度', 'ui_opacity'],
      ['扫描线不透明度', 'scanline_opacity'], ['背景遮罩', 'background_dim'],
      ['Note 不透明度倍率', 'note_opacity_multiplier'], ['扫描线颜色', 'scanline_color'],
      ['扫描线位置', 'scanline_posPx'], ['扫描线平滑', 'scanline_smoothing'],
      ['Note 外圈颜色', 'note_ring_color']
    ];
    const seenToggles = new Set(['perspective', 'override_scanline_pos']);
    for (const card of Schema.CONTROLLER_CARDS) {
      if (card.toggle && !seenToggles.has(card.toggle)) rows.push([card.label, card.toggle]);
    }
    const statsHtml = rows.map(([label, key]) =>
      `<div class="field"><label>${escapeHtml(label)}</label>` +
      `<span class="live-stat" data-live-stat="${key}">${fmtLiveStat(m[key])}</span></div>`).join('');
    body.innerHTML =
      `<div class="prop-section"><h4>${__t('Controller 实时统计')}</h4>` +
      `<div class="help-text">${__t('播放头时刻所有controller合并后的实时状态。未启用卡片可拖到预览画面直接创建对应轨道，或右键「启用」创建新controller轨道。')}</div>` +
      `<div class="ctrl-live-stats">${statsHtml}</div></div>` +
      `<div class="prop-section"><h4>${__t('Controller 属性卡片')}</h4>` +
      `<div id="stateForm" class="kf-form"></div></div>`;
    const formEl = body.querySelector('#stateForm');
    Schema.renderControllerCards(formEl, Schema.SCHEMAS.controller, {}, () => {}, true, {
      owners: controllerCardOwners(),
      enabledOnly: false,
      showUnset: false,
      onCardContextMenu: onControllerCardContextMenu
    });
  }

  // 播放中低频更新实时统计数值（不重建 DOM）。
  function updateControllerLiveStats() {
    if (!state.previewEmptyFocus) return;
    const el = $('#propBody');
    if (!el) return;
    const m = preview.mergedCtrl || {};
    el.querySelectorAll('[data-live-stat]').forEach((node) => {
      node.textContent = fmtLiveStat(m[node.dataset.liveStat]);
    });
  }

  // Show the pending note_controller editor for a note (created on first edit).
  function openPendingNoteController(noteId) {
    state.pendingNote = noteId;
    state.selectedObjId = null;
    state.selectedKeyIdx = null;
    state.previewEmptyFocus = false;
    state.noteInMergedBlock = null;
    updatePreviewHighlight();
    renderObjectTree();
    renderProperties();
    renderTimeline();
  }

  // 右键单个 note 进入“单独编辑”页：该 note 位于合并时间块内、尚无独立
  // note_controller。页面显示该 note 的 Note ID 与合并块分配给它的关键帧，
  // 首次修改任意字段生效时创建独立 note_controller（被纯 ID 载体覆盖时采用
  // 具体 parent_<n> id）并把它从合并块分离——区别于直接编辑合并时间块。
  function openNoteInMergedBlock(noteId, blockObj) {
    if (!blockObj) return;
    state.pendingNote = null;
    state.previewEmptyFocus = false;
    state.noteInMergedBlock = { noteId: Number(noteId), blockId: blockObj.id };
    state.selectedObjId = null;
    state.selectedKeyIdx = -1;
    state.selectedNoteId = Number(noteId);
    state.selectedIds = [];
    state.selectedKfs = [];
    state.propsExplicitKf = false;
    updatePreviewHighlight();
    renderObjectTree();
    renderProperties();
    renderTimeline();
    timeline.setMultiSelection({ ids: [], kfs: [] });
    toast(__t('将单独编辑 note ') + noteId + __t('（位于合并时间块 ') + blockObj.id + __t('，首次修改后独立）'));
  }

  function renderProperties() {
    const body = $('#propBody');
    if (state.noteInMergedBlock) {
      renderMergedNoteEditor(body);
      return;
    }
    if (state.pendingNote != null) {
      renderPendingNoteController(body);
      return;
    }
    if (state.selectedLane) {
      renderLaneInfo(body);
      return;
    }
    // 预览空白处：controller 实时统计数据 + 全部属性卡片（管理/新建轨道）。
    if (state.previewEmptyFocus) {
      renderControllerLiveStats(body);
      return;
    }
    const selIds = state.selectedIds || [];
    const noteSel = selIds.filter(isNoteEntry);
    const stageSel = selIds.filter((id) => !isNoteEntry(id));
    if (noteSel.length && !stageSel.length) {
      // 检测选中 note 的 note 选择器情况：同属一个选择器控制器时给出顶部
      // 按钮；单选且已有控制器时显示“编辑note_controller”（进入单独编辑），
      // 尚无控制器时显示“创建note_controller”，多选共享控制器时仍为选择器编辑。
      const selNoteIds = noteSel.map((id) => splitEntryId(id).noteId).filter((n) => n != null);
      const sharedNc = sharedSelectorControllerForNotes(selNoteIds);
      const showSelBtn = selNoteIds.length === 1 || (selNoteIds.length > 1 && sharedNc);
      const noCtrl = selNoteIds.length === 1 && !sharedNc;
      const singleWithNc = selNoteIds.length === 1 && !!sharedNc;
      const selBtnHtml = showSelBtn
        ? `<div class="prop-section" style="border-bottom:none"><button class="ctrl-card-add" id="btnEditNoteSelector">${noCtrl ? '创建note_controller' : (singleWithNc ? '编辑note_controller' : '编辑note选择器')}</button></div>`
        : '';
      const wireSelBtn = () => {
        const btn = $('#btnEditNoteSelector');
        if (btn) btn.addEventListener('click', () => {
          if (noCtrl) openPendingNoteController(selNoteIds[0]);
          else if (singleWithNc) {
            // 单独编辑：合并时间块内进入该 note 的单独编辑页（首次修改独立）；
            // 普通控制器直接选中其属性页。
            const nid = selNoteIds[0];
            if (isNoteSelectorMerged(sharedNc.id) && sharedNc.note && typeof sharedNc.note === 'object') {
              openNoteInMergedBlock(nid, sharedNc);
            } else {
              selectObject(sharedNc.id, null);
            }
          }
          else openNoteSelectorEditor(sharedNc);
        });
      };
      if (noteSel.length > 1) {
        renderMultiNoteController(body, noteSel);
      } else {
        const nid = splitEntryId(noteSel[0]).noteId;
        const note = state.chart ? state.chart.noteById(nid) : null;
        const nc = findNoteControllerForNote(nid);
        body.innerHTML = selBtnHtml + `<div class="prop-section"><h4>${__t('Note 音符')}</h4>` +
          field('ID', nid != null ? String(nid) : '') +
          field('开始时间', note ? String(note.start_time.toFixed(3)) : '') +
          field('类型', note != null ? String(note.type) : '') +
          field('位置 X', note != null ? String(note.x) : '') +
          (nc ? field('Note Controller', nc.id) : '') +
          '</div>';
      }
      if (showSelBtn) {
        if (noteSel.length > 1) body.insertAdjacentHTML('afterbegin', selBtnHtml);
        wireSelBtn();
      }
      return;
    }
    // 多选编辑目标：多个对象、同一对象内多个关键帧（不同时间）、或跨对象的
    // 关键帧组合。有选中关键帧时只编辑这些关键帧，否则编辑对象本体（K0）。
    const kfsSel = (state.selectedKfs || []).filter((kf) => {
      const rid = splitEntryId(kf.objId).rawId;
      return selIds.includes(kf.objId) || selIds.includes(rid) ||
        new Set(stageSel.map((id) => splitEntryId(id).rawId)).has(rid);
    });
    if (selIds.length > 1 || kfsSel.length > 1) {
      const typeSet = new Set();
      const targetStates = [];
      const seen = new Set();
      if (kfsSel.length) {
        for (const kf of kfsSel) {
          const rid = splitEntryId(kf.objId).rawId;
          const obj = findRawObject(rid);
          if (!obj) continue;
          const e = findObjectEntry(rid);
          if (!e) continue;
          typeSet.add(e.type);
          const st = kf.index === -1 ? obj : (obj.states || [])[kf.index];
          if (!st) continue;
          const key = rid + '::' + kf.index;
          if (seen.has(key)) continue;
          seen.add(key);
          targetStates.push({ st, obj });
        }
      } else {
        for (const id of stageSel) {
          const e = findObjectEntry(splitEntryId(id).rawId);
          if (!e || !e.obj) continue;
          typeSet.add(e.type);
          targetStates.push({ st: e.obj, obj: e.obj });
        }
      }
      // 批量时间编辑：多选的关键帧每个只对应一个对象（同一对象不多选关键帧）
      // 时，允许统一编辑时间（支持 start:$note 表达式，按各对象 note 解析）。
      const canBatchTime = kfsSel.length > 1 &&
        new Set(kfsSel.map((k) => splitEntryId(k.objId).rawId)).size === kfsSel.length;
      const kfTimeVals = canBatchTime
        ? targetStates.map((t) => t.st.time).filter((v) => v != null)
        : [];
      const kfTimeSame = kfTimeVals.length === targetStates.length && kfTimeVals.length > 0 &&
        kfTimeVals.every((v) => JSON.stringify(v) === JSON.stringify(kfTimeVals[0]));
      const batchTimeHtml = canBatchTime
        ? `<div class="field"><label>${__t('时间 (秒)')}</label><input id="multiKfTime" type="text" value="${kfTimeSame ? escapeHtml(String(kfTimeVals[0])) : ''}" placeholder="${__t('支持$note表达式')}"></div>`
        : '';
      // 批量 Parent / Target：对象级全帧同步字段，多选时统一编辑。
      const parentVals = targetStates.map((t) => t.obj.parent_id);
      const parentSame = parentVals.every((v) => JSON.stringify(v) === JSON.stringify(parentVals[0]));
      const targetVals = targetStates.map((t) => t.obj.target_id);
      const targetSame = targetVals.every((v) => JSON.stringify(v) === JSON.stringify(targetVals[0]));
      const parentTargetHtml =
        `<div class="field"><label class="sync-label">Parent_id<span class="sync-tag">SYNC</span></label>` +
        `<input type="text" id="multiParentId" value="${escapeHtml(parentSame && parentVals[0] != null ? String(parentVals[0]) : '')}" placeholder="${parentSame ? '' : '多个数值'}"></div>` +
        `<div class="field"><label class="sync-label">Target_id<span class="sync-tag">SYNC</span></label>` +
        `<input type="text" id="multiTargetId" value="${escapeHtml(targetSame && targetVals[0] != null ? String(targetVals[0]) : '')}" placeholder="${targetSame ? '' : '多个数值'}"></div>`;
      const label = typeSet.size === 1
        ? (PICK_TYPE_LABELS[[...typeSet][0]] || [...typeSet][0])
        : '对象';
      if (typeSet.size === 1 && targetStates.length > 1) {
        const type = [...typeSet][0];
        let schema = Schema.SCHEMAS[type];
        // Controller 关键帧多选：只有选择的是同一条轨道（同一 controller）上的
        // 关键帧时才显示属性卡片界面（改动应用到该轨道所有选中关键帧）；跨多条
        // controller 轨道时只浏览关键帧数量，不显示编辑表单。
        if (type === 'controller') {
          const rawIds = new Set(kfsSel.length
            ? kfsSel.map((k) => splitEntryId(k.objId).rawId)
            : targetStates.map((t) => t.obj.id));
          const count = kfsSel.length || targetStates.length;
          if (rawIds.size === 1) {
            const trackId = [...rawIds][0];
            // 多选关键帧：各字段值不一致时合并为“多个数值”，而不是套用第一个
            // 关键帧的数值；编辑任一字段时统一应用到全部选中关键帧。
            const merged = {};
            for (const f of schema.fields) {
              const vals = targetStates.map((t) => t.st[f.key]);
              const first = vals[0];
              merged[f.key] = vals.every((v) => JSON.stringify(v) === JSON.stringify(first))
                ? first
                : Schema.MULTI_VALUE;
            }
            body.innerHTML =
              `<div class="empty-panel">${__t('已选择')} ${count} ${__t('个关键帧')}${__t('（同一条 controller 轨道）')}</div>` +
              `<div class="prop-section"><h4>${__t('对象 · ')}${escapeHtml(schema.label)}${__t('（关键帧卡片）')}</h4>` +
              `<div id="stateForm" class="kf-form"></div></div>` +
              `<div class="prop-section"><div class="state-form-head"><h4>${__t('状态属性')}</h4>` +
              `<span class="state-common"><label>${__t('缓动')} <select id="multiKfEasing"></select></label></span>` +
              `</div></div>`;
            const formEl = body.querySelector('#stateForm');
            const onStateChange = (key, value) => {
              // 空值切换单位（__unitChange 标记）在多选卡片里没有投影换算依据：
              // 直接忽略，避免把标记对象写进关键帧数据。
              if (value && typeof value === 'object' && value.__unitChange) return;
              snapshot();
              for (const t of targetStates) setStateField(t.st, key, value);
              if (key === 'time') {
                const o = findRawObject(trackId);
                if (o) sortObjectStates(o);
              }
              state.dirty = true;
              dirtyAndRefresh(false);
              if (key === 'time') renderProperties();
            };
            Schema.renderControllerCards(formEl, schema, merged, onStateChange, false, {
              owners: controllerCardOwners(),
              selectedId: trackId,
              enabledOnly: true,
              multi: true,
              onCardContextMenu: onControllerCardContextMenu,
              onAddCard: () => promptAssignCardsToTrack(trackId)
            });
            // 多选 controller 关键帧：统一编辑缓动（单帧编辑时缓动在状态属性头）。
            const multiEasing = $('#multiKfEasing');
            if (multiEasing) {
              multiEasing.innerHTML = '<option value="">(多个数值)</option>' +
                Schema.EASING_OPTIONS.map((o) => `<option value="${o.value}">${o.label}</option>`).join('');
              const ev = targetStates.map((t) => t.st.easing);
              const eSame = ev.length > 0 && ev.every((v) => v === ev[0]);
              if (eSame && ev[0] != null) multiEasing.value = String(ev[0]);
              multiEasing.addEventListener('change', () => {
                snapshot();
                const v = multiEasing.value === '' ? undefined : multiEasing.value;
                for (const t of targetStates) setStateField(t.st, 'easing', v);
                state.dirty = true;
                dirtyAndRefresh(false);
              });
            }
          } else {
            body.innerHTML =
              `<div class="empty-panel">${__t('已选择')} ${count} ${__t('个关键帧')}${__t('（来自 ')}${rawIds.size}${__t(' 条 controller 轨道）')}</div>` +
              `<div class="prop-section"><h4>${__t('Controller 关键帧多选')}</h4>` +
              `<div class="help-text">${__t('跨轨道的 controller 关键帧仅支持浏览数量；请在单条 controller 轨道上选择关键帧以编辑属性卡片。')}</div></div>`;
          }
          return;
        }
        // 多选 note_controller：关联 Note 不参与“多个数值”合并，改为列出各
        // 对象的 note ID 并计数（与多选 Note 面板的关联 Note 显示一致）。
        let noteRowHtml = '';
        if (type === 'note_controller') {
          const noteIds = [];
          const seenNotes = new Set();
          const addNoteToken = (tok) => {
            if (tok == null) return;
            if (typeof tok === 'number') {
              if (!seenNotes.has(tok)) { seenNotes.add(tok); noteIds.push(tok); }
              return;
            }
            if (Array.isArray(tok)) { tok.forEach(addNoteToken); return; }
            if (typeof tok === 'object') noteSelectorIds(tok).forEach(addNoteToken);
          };
          for (const t of targetStates) addNoteToken(t.obj && t.obj.note);
          noteRowHtml = `<div class="field"><label>${__t('关联 Note')}</label><span style="flex:1;color:var(--text)">${escapeHtml(noteIds.join(', '))}${__t('（共 ')}${noteIds.length}${__t('）')}</span></div>`;
          schema = { ...schema, fields: schema.fields.filter((f) => f.key !== 'note') };
        }
        const merged = {};
        const unitInfo = {};
        for (const f of schema.fields) {
          if (f.key === 'time') continue; // 缓动/destroy 可统一编辑
          // 全帧同步字段以对象本体为准（关键帧上可能残留旧副本）。
          const syncKey = f.key === 'path' || f.key === 'order' || f.key === 'layer';
          const vals = targetStates.map((t) => syncKey ? t.obj[f.key] : t.st[f.key]);
          const first = vals[0];
          merged[f.key] = vals.every((v) => JSON.stringify(v) === JSON.stringify(first)) ? first : Schema.MULTI_VALUE;
          // 单位字段多选：所有目标同单位时下拉显示该单位。
          if (f.kind === 'unit' && (f.key === 'x' || f.key === 'y')) {
            const def = f.key === 'x' ? 'stagex' : 'stagey';
            const units = targetStates.map((t) => propUnitField(t.st[f.key], def).unit);
            unitInfo[f.key] = units.every((u) => u === units[0]) ? units[0] : def;
          }
        }
        body.innerHTML =
          `<div class="empty-panel">${__t('已选择')} ${kfsSel.length || targetStates.length} ${kfsSel.length ? __t('关键帧') : ' ' + __t(label)}</div>` +
          `<div class="prop-section"><h4>${__t('对象 · ')}${escapeHtml(schema.label)}${__t('（多选编辑）')}</h4>` +
          noteRowHtml +
          parentTargetHtml +
          batchTimeHtml +
          `<div id="syncForm" class="kf-form"></div>` +
          `<div id="stateForm" class="kf-form"></div></div>`;
        const batchTimeInput = $('#multiKfTime');
        if (batchTimeInput) {
          if (!kfTimeSame) batchTimeInput.placeholder = '多个数值（支持$note表达式）';
          batchTimeInput.addEventListener('change', () => {
            const raw = batchTimeInput.value.trim();
            if (!raw) return;
            snapshot();
            let ok = true;
            for (const t of targetStates) {
              const nid = typeof t.obj.note === 'number' ? t.obj.note : null;
              if (resolveNoteTimeToken(raw, nid) == null) { ok = false; break; }
            }
            if (!ok) { toast(__t('无法解析时间: ') + raw, true); renderProperties(); return; }
            const numeric = /^-?\d+(\.\d+)?$/.test(raw);
            const stored = numeric ? Math.round(parseFloat(raw) * 1000) / 1000 : raw;
            const objs = new Set();
            for (const t of targetStates) {
              setStateField(t.st, 'time', stored);
              objs.add(t.obj);
            }
            for (const o of objs) sortObjectStates(o);
            state.dirty = true;
            dirtyAndRefresh(false);
            renderProperties();
            toast('已批量设置关键帧时间');
          });
        }
        const multiParent = $('#multiParentId');
        const multiTarget = $('#multiTargetId');
        const applyMultiParent = (kind, value) => {
          const v = value || undefined;
          for (const t of targetStates) {
            const guard = validateParentTarget(t.obj, kind, v);
            if (!guard.ok) { toast(guard.msg, true); renderProperties(); return; }
          }
          snapshot();
          for (const t of targetStates) {
            syncObjectField(t.obj, kind, v);
            if (kind === 'parent_id' && v && t.obj.target_id) syncObjectField(t.obj, 'target_id', undefined);
            if (kind === 'target_id' && v && t.obj.parent_id) syncObjectField(t.obj, 'parent_id', undefined);
          }
          sortStageObjectsParentFirst();
          state.dirty = true;
          dirtyAndRefresh(false);
          renderProperties();
        };
        if (multiParent) multiParent.addEventListener('change', () => applyMultiParent('parent_id', multiParent.value));
        if (multiTarget) multiTarget.addEventListener('change', () => applyMultiParent('target_id', multiTarget.value));
        const syncEl = $('#syncForm');
        const onSyncMultiChange = (key, value) => {
          if (key === 'order') {
            if (!applyOrderToMany(targetStates, value)) { renderProperties(); return; }
            dirtyAndRefresh(false);
            renderProperties();
            return;
          }
          if (key === 'layer') {
            changeObjectsLayer(targetStates.map((t) => t.obj), value);
            renderProperties();
            return;
          }
          snapshot();
          for (const t of targetStates) {
            if (key === 'path') syncPathAcrossFrames(t.obj, value);
            else syncObjectField(t.obj, key, value);
          }
          state.dirty = true;
          dirtyAndRefresh(false);
          renderProperties();
        };
        if (syncEl) Schema.renderSyncForm(syncEl, schema, merged, onSyncMultiChange, false, { multi: true });
        const formEl = $('#stateForm');
        const onMultiChange = (key, value) => {
          if (key === 'x' || key === 'y') {
            const def = key === 'x' ? 'stagex' : 'stagey';
            const marker = value && typeof value === 'object' && value.__unitChange;
            // 显式带坐标系前缀（如 notex:0.8）：按指定坐标系直接写入，不换算。
            const explicitUnit = typeof value === 'string' && /^[a-zA-Z]+:/.test(value);
            const incoming = marker ? null : (typeof value === 'number'
              ? { value, unit: def }
              : (typeof value === 'string' ? propUnitField(value, def) : null));
            if (marker || (!explicitUnit && incoming && targetStates.some((t) => propUnitField(t.st[key], def).unit !== incoming.unit))) {
              snapshot();
              let changed = false;
              for (const t of targetStates) {
                const old = propUnitField(t.st[key], def);
                const newUnit = marker ? marker : incoming.unit;
                const base = marker ? old.value : incoming.value;
                const converted = convertUnitValue(t.obj, t.st, key, base, old.unit, newUnit);
                if (converted != null) {
                  setStateField(t.st, key, propRawUnit(converted, newUnit, def));
                  changed = true;
                }
              }
              if (changed) {
                state.dirty = true;
                dirtyAndRefresh(false);
                renderProperties();
              } else {
                toast('单位换算失败：无法保持当前位置', true);
                renderProperties();
              }
              return;
            }
          }
          snapshot();
          // 只对选到的编辑目标生效（选中的关键帧或对象 K0），不扩散到全部关键帧。
          for (const t of targetStates) {
            if (key === 'path') syncPathAcrossFrames(t.obj, value);
            else setStateField(t.st, key, value);
          }
          state.dirty = true;
          dirtyAndRefresh(false);
          renderProperties();
        };
        Schema.renderForm(formEl, schema, merged, onMultiChange, false, {
          multi: true,
          excludeSync: true,
          unitInfo
        });
        return;
      }
      body.innerHTML = `<div class="empty-panel">${__t('已选择')} ${kfsSel.length || stageSel.length} ${kfsSel.length ? __t('关键帧') : ' ' + __t(label)}</div>`;
      return;
    }
    const entry = state.selectedObjId ? findObjectEntry(state.selectedObjId) : null;
    if (!entry) {
      body.innerHTML = __t('<div class="empty-panel">在左侧或时间轴中选择对象<br/>在时间轴中点击关键帧可编辑该帧属性</div>');
      return;
    }
    const { group, type, obj } = entry;
    const schema = Schema.SCHEMAS[type];
    const isInitial = state.selectedKeyIdx === -1;
    const noteCtx = state.selectedNoteId;
    const kfCollapsed = !!state.keyframesCollapsed;
    const onKf = isPlayheadOnKeyframe(obj);
    const explicit = !!state.propsExplicitKf;
    state.propsOnKeyframe = onKf || explicit;
    const interpolated = !onKf && !explicit;
    const baseStateJson = isInitial ? obj : (obj.states || [])[state.selectedKeyIdx];
    // When the playhead is not on a keyframe, show the interpolated values at
    // the playhead (read-only) instead of the selected keyframe's raw values.
    const stateJson = interpolated
      ? (interpolatedStateFor(obj, type, preview.time) || baseStateJson)
      : baseStateJson;
    if (!stateJson) { body.innerHTML = __t('<div class="empty-panel">该关键帧不存在</div>'); return; }

    let html = '';
    html += `<div class="prop-section"><h4>${__t('对象 · ')}${schema.label}</h4>`;
    // note 选择器对象（任意类型）：顶部按钮——编辑此note选择器（呼出编辑浮窗）；
    // 未合并状态下额外提供“合并选择器时间块”一键合并。
    if (type === 'note_controller' || (obj.note && typeof obj.note === 'object')) {
      const isSelObj = obj.note && typeof obj.note === 'object';
      const merged = isNoteSelectorMerged(obj.id);
      html = `<div class="prop-section" style="border-bottom:none">` +
        `<button class="ctrl-card-add" id="btnEditThisSelector">${__t('编辑此note选择器')}</button>` +
        (isSelObj && !merged ? `<button class="ctrl-card-add" id="btnMergeSelectorBlock">${__t('合并选择器时间块')}</button>` : '') +
        (isParentCarrier(obj.id)
          ? __t('<div class="help-text carrier-note-hint">这是一个由parent_ID功能自动生成的载体note_controller，对其直接修改可能无法达到预期效果；若要编辑note选择器请前往对应的使用了parent_ID的对象中进行编辑。</div>')
          : '') +
        `</div>` + html;
    }
    html += field('ID', obj.id || '(自动)', false);
    html += field('类型', group, false);
    // parent_id 仅适用于 texts / sprites；target_id 只适用于场景对象
    // （sprites / texts / videos / lines）。其它对象类型不显示这两个选项。
    const showParentId = type === 'text' || type === 'sprite';
    const showTargetId = ['sprite', 'text', 'video', 'line'].includes(type);
    if (showParentId) {
      html += `<div class="field"><label class="sync-label">Parent_id<span class="sync-tag">SYNC</span></label><input type="text" id="fParentId" value="${escapeHtml(obj.parent_id || '')}" /></div>`;
    }
    if (showTargetId) {
      html += `<div class="field"><label class="sync-label">Target_id<span class="sync-tag">SYNC</span></label><input type="text" id="fTargetId" value="${escapeHtml(obj.target_id || '')}" /></div>`;
    }
    html += `<div id="syncForm" class="kf-form"></div>`;
    // note_controller 的 Note 是对象级全帧同步字段（单个时间块内统一）；
    // 其它对象类型一旦携带 note 选择器或使用 $note 表达式也显示该字段。
    // note 选择器外部窗口打开时，尚未注入选择器的 stage 对象同样显示空白
    // Note 输入框（位置一致），点击即绑定选择器编辑器，便于直接创建并注入。
    const isStageObj = type === 'sprite' || type === 'text' || type === 'video' || type === 'line';
    if (type === 'note_controller' || obj.note != null || objectUsesNoteTokens(obj) ||
        (state.nsWindowOpen && isStageObj)) {
      const noteDesc = obj.note != null
        ? (typeof obj.note === 'object' ? JSON.stringify(obj.note) : String(obj.note))
        : '';
      // 谱面变更后原映射失效的 note 选择器：输入框红色描边提示重处理。
      const noteLost = objectNoteMappingLost(obj);
      html += `<div class="field"><label class="sync-label">Note<span class="sync-tag">SYNC</span></label><input type="text" id="fNote" class="${noteLost ? 'invalid-note' : ''}" value="${escapeHtml(noteDesc)}" placeholder="${obj.note == null ? '未设置' : ''}" /></div>`;
    }
    html += '</div>';

    html += `<div class="prop-section"><h4 class="kf-toggle" id="kfToggle" title="${__t('点击折叠/展开')}">${kfCollapsed ? svgIcon('chevronRight', 11, true) : svgIcon('chevronDown', 11, true)}${__t('关键帧')} (${isInitial ? 'K0' : 'K' + (state.selectedKeyIdx + 1)})</h4>`;
    html += `<div class="key-list" id="keyList"${kfCollapsed ? ' style="display:none"' : ''}>`;
    // 关键帧时间显示：对象自身带 note（如 note_controller 的 time:"start:$note"）
    // 时按该 note 解析，避免 $note 表达式显示成 0.000；解析不出时显示原始表达式。
    const kfNoteCtx = (() => {
      if (noteCtx != null) return noteCtx;
      if (typeof obj.note === 'number') return obj.note;
      const ids = collectNoteIds(obj);
      return ids.length ? ids[0] : null;
    })();
    const kfTimeLabel = (token) => {
      // note 选择器控制器的 $note 时间表达式按原样显示（不解析成绝对时间）。
      if (type === 'note_controller' && typeof token === 'string' && token.indexOf('$note') >= 0) {
        return escapeHtml(token);
      }
      const t = firstResolvedTime(token, kfNoteCtx);
      return t != null ? fmtTime(t) : (typeof token === 'string' ? escapeHtml(token) : '0.000');
    };
    let kfGroups = null;
    // 任意对象（stage 对象带 note 选择器 / $note 表达式时也一样）的 $note
    // 表达式关键帧统一以表达式形式分组显示；点击进入分组编辑（表达式不跳转，
    // 具体时间可跳转）。纯数字时间的对象保持原来的 K0/K1 列表。
    if (usesNoteExpressions(obj)) {
      const kfResolver = (tok) => (noteCtx != null ? resolveTimeForNote(tok, noteCtx) : resolveTime(tok));
      kfGroups = noteSelectorKeyframeGroups(obj, kfResolver);
      for (const g of kfGroups) {
        if (g.numeric) {
          const idx = g.indices[0];
          const label = idx === -1 ? 'K0' : 'K' + (idx + 1);
          const sel = state.selectedKfExpression === g.id ? ' selected' : '';
          const st = idx >= 0 ? (obj.states || [])[idx] : obj;
          html += `<div class="key-item${sel}${st && st.destroy ? ' destroy' : ''}" data-kf-exp="${escapeHtml(g.id)}">` +
            `<span class="klabel">${label}</span><span class="kt">${fmtTime(g.time)}</span>` +
            `<span class="del" title="${__t('删除该时间点的全部关键帧')}">${svgIcon('close', 12)}</span></div>`;
        } else {
          const sel = state.selectedKfExpression === g.token ? ' selected' : '';
          html += `<div class="key-item${sel}" data-kf-exp="${escapeHtml(g.token)}">` +
            `<span class="klabel">${__t('表达式')}</span><span class="kt">${escapeHtml(g.token)}</span>` +
            `<span class="del" title="${__t('删除该表达式的全部关键帧')}">${svgIcon('close', 12)}</span></div>`;
        }
      }
    } else {
      html += `<div class="key-item${isInitial ? ' selected' : ''}${obj.destroy ? ' destroy' : ''}" data-kf="-1"><span class="klabel">K0</span><span class="kt">${kfTimeLabel(obj.time)}</span><span class="del">${svgIcon('close', 12)}</span></div>`;
      (obj.states || []).forEach((st, i) => {
        const sel = state.selectedKeyIdx === i && !isInitial ? ' selected' : '';
        html += `<div class="key-item${sel}${st.destroy ? ' destroy' : ''}" data-kf="${i}"><span class="klabel">K${i + 1}</span><span class="kt">${kfTimeLabel(st.time)}</span><span class="del">${svgIcon('close', 12)}</span></div>`;
      });
    }
    html += '</div><div class="btn-row">';
    html += `<button class="mini-btn" id="btnAddKf">${svgIcon('plus', 12, true)}${__t('在播放头添加关键帧')}</button>`;
    html += `<button class="mini-btn" id="btnCopyKf">${__t('复制当前帧')}</button>`;
    html += '</div></div>';

    const commonRow = type === 'controller'
      ? `<span class="state-common">` +
        `<label title="${__t('到达后销毁')}">${__t('销毁')} <input type="checkbox" id="kfDestroy" ${stateJson.destroy ? 'checked' : ''} /></label>` +
        `<label>${__t('缓动')} <select id="kfEasing"></select></label>` +
        `</span>`
      : '';
    const interpHint = interpolated
      ? __t('<div class="help-text interp-hint">播放头不在关键帧上：以下为当前时刻的插值（只读）</div>')
      : '';
    html += `<div class="prop-section"><div class="state-form-head"><h4>${__t('状态属性')}</h4>${commonRow}</div>${interpHint}<div id="stateForm" class="kf-form"></div></div>`;
    body.innerHTML = html;
    const editSelBtn = $('#btnEditThisSelector');
    if (editSelBtn) editSelBtn.addEventListener('click', () => openNoteSelectorEditor(obj));
    const mergeSelBtn = $('#btnMergeSelectorBlock');
    if (mergeSelBtn) mergeSelBtn.addEventListener('click', () => {
      setNoteSelectorMerge(obj.id, true);
      dirtyAndRefresh();
    });
    // Wire object-level inputs
    const fParent = $('#fParentId');
    const fTarget = $('#fTargetId');
    const fNote = $('#fNote');
    // Collapse/expand the keyframe list
    const kfToggle = $('#kfToggle');
    if (kfToggle) {
      kfToggle.addEventListener('click', () => {
        state.keyframesCollapsed = !state.keyframesCollapsed;
        renderProperties();
      });
    }
    if (fParent) fParent.addEventListener('change', () => {
      const v = fParent.value || undefined;
      const guard = validateParentTarget(obj, 'parent_id', v);
      if (!guard.ok) { toast(guard.msg, true); fParent.value = obj.parent_id || ''; return; }
      snapshot();
      syncObjectField(obj, 'parent_id', v);
      if (obj.parent_id && obj.target_id) { syncObjectField(obj, 'target_id', undefined); fTarget.value = ''; }
      sortStageObjectsParentFirst();
      dirtyAndRefresh();
    });
    if (fParent) fParent.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const pid = obj.parent_id != null ? String(obj.parent_id) : '';
      const parentObj = pid ? findRawObject(pid) : null;
      // parent_id 已指向载体 note_controller（如 parent_$note）时隐藏
      // “在parent_id中使用note选择器”，避免重复创建载体造成双载体冲突。
      const parentIsCarrier = !!(parentObj && isParentCarrier(parentObj.id));
      const menu = [
        ...(parentIsCarrier
          ? []
          : [{ label: '在parent_id中使用note选择器', action: () => promptUseNoteSelectorAsParent(obj) }]),
        { label: '编辑note选择器', action: () => openNoteSelectorEditor(obj) }
      ];
      // 已绑定父对象时：追加“跳转至父对象属性”。$note 模板直接定位到模板/载体
      // 本身（如 parent_$note），普通 id 定位到对应对象。
      if (pid.trim() !== '') {
        menu.push({
          label: '跳转至父对象属性',
          action: () => {
            const parent = findRawObject(pid);
            if (parent) {
              selectObject(parent.id, null);
            } else {
              toast(__t('未找到父对象: ') + pid, true);
            }
          }
        });
      }
      showContextMenu(e.clientX, e.clientY, menu);
    });
    if (fTarget) fTarget.addEventListener('change', () => {
      const v = fTarget.value || undefined;
      const guard = validateParentTarget(obj, 'target_id', v);
      if (!guard.ok) { toast(guard.msg, true); fTarget.value = obj.target_id || ''; return; }
      snapshot();
      syncObjectField(obj, 'target_id', v);
      if (obj.target_id && obj.parent_id) { syncObjectField(obj, 'parent_id', undefined); if (fParent) fParent.value = ''; }
      sortStageObjectsParentFirst();
      dirtyAndRefresh();
    });
    // 全帧同步字段（path / order / layer）统一在属性页顶部编辑。
    const syncEl = $('#syncForm');
    if (syncEl) {
      Schema.renderSyncForm(syncEl, schema, obj, (key, value) => {
        if (key === 'order') {
          if (!applyObjectOrder(obj, value)) { renderProperties(); return; }
          dirtyAndRefresh(false);
          renderProperties();
          return;
        }
        if (key === 'layer') {
          changeObjectLayer(obj, value);
          renderProperties();
          return;
        }
        snapshot();
        if (key === 'path') syncPathAcrossFrames(obj, value);
        else syncObjectField(obj, key, value);
        state.dirty = true;
        dirtyAndRefresh(false);
        renderProperties();
      }, false, { orderInfo: orderInfoFor(obj) });
    }
    if (fNote) fNote.addEventListener('change', () => {
      const v = fNote.value.trim();
      let parsed;
      if (v === '') parsed = undefined;
      else {
        try { parsed = JSON.parse(v); } catch (e) { parsed = /^\d+$/.test(v) ? parseInt(v, 10) : v; }
      }
      snapshot();
      syncObjectField(obj, 'note', parsed);
      dirtyAndRefresh();
    });
    // Note 输入框：选择器浮窗打开时点击即绑定该对象（应用后把选择器数据写回
    // 该对象的 note 字段）；右键仍可手动呼出编辑器。
    if (fNote) fNote.addEventListener('click', () => {
      state.nsMode = 'note';
      noteSelectorTarget = obj;
      nsDraft = {
        note: JSON.parse(JSON.stringify(obj.note != null ? obj.note : {})),
        merge: isNoteSelectorMerged(obj.id)
      };
      if (floatWindowEl && floatWindowKind === 'note-selector') {
        renderNoteSelectorEditor(floatWindowEl.querySelector('.float-window-body'));
      } else if (window.sbAPI && window.sbAPI.nsSend) {
        window.sbAPI.nsSend({ type: 'note-target', id: obj.id });
      }
    });
    if (fNote) fNote.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      showContextMenu(e.clientX, e.clientY, [
        { label: '编辑note选择器', action: () => openNoteSelectorEditor(obj) }
      ]);
    });

    // Keyframe list clicks
    body.querySelectorAll('.key-item').forEach((el) => {
      if (el.hasAttribute('data-kf-exp')) return;
      const kfIdx = parseInt(el.dataset.kf, 10);
      el.addEventListener('click', () => {
        const st = (obj.states || [])[kfIdx];
        const kfTime = kfIdx === -1 ? firstResolvedTime(obj.time, noteCtx) : firstResolvedTime(st ? st.time : null, noteCtx);
        selectKeyframe(obj.id, kfIdx, kfTime);
      });
      const del = el.querySelector('.del');
      if (del && kfIdx >= 0) {
        del.addEventListener('click', (e) => {
          e.stopPropagation();
          (obj.states || []).splice(kfIdx, 1);
          state.selectedKeyIdx = -1;
          dirtyAndRefresh();
        });
      } else if (del && kfIdx === -1) {
        del.addEventListener('click', (e) => {
          e.stopPropagation();
          deleteKeyframeOnly(obj.id, -1);
        });
      }
    });
    // $note 表达式关键帧：点击不跳转具体时间，进入表达式分组编辑
    // （修改应用到该表达式下的全部关键帧）。
    body.querySelectorAll('.key-item[data-kf-exp]').forEach((el) => {
      el.addEventListener('click', () => {
        const gid = el.dataset.kfExp;
        const g = (kfGroups || []).find((x) => x.id === gid || x.token === gid);
        if (!g) return;
        state.selectedKfExpression = gid;
        state.selectedKeyIdx = g.indices[0] >= 0 ? g.indices[0] : -1;
        state.propsExplicitKf = true;
        renderProperties();
        // 具体时间点（数字/绝对时间去重组）可跳转；$note 表达式不跳转。
        if (g.numeric && g.time != null) setTime(g.time, false);
      });
      const delEl = el.querySelector('.del');
      if (delEl) delEl.addEventListener('click', (e) => {
        e.stopPropagation();
        const gid = el.dataset.kfExp;
        const g = (kfGroups || []).find((x) => x.id === gid || x.token === gid);
        if (!g) return;
        deleteKeyframeGroup(obj, g);
      });
    });
    $('#btnAddKf').addEventListener('click', () => addKeyframeAtPlayhead(obj));
    $('#btnCopyKf').addEventListener('click', () => copyKeyframesToClipboard());

    // State form
    const formEl = $('#stateForm');
    const onStateChange = (key, value) => {
      // line 端点轴单位切换（规范版）：按该端点当前值做世界位置保持换算。
      if (key === 'pos' && value && typeof value === 'object' && value.__posUnitChange) {
        const pos = Array.isArray(stateJson.pos) ? stateJson.pos : [];
        const p = pos[value.index];
        if (p && preview && preview.chart) {
          const defs = { x: 'notex', y: 'notey', z: 'world' };
          const def = defs[value.axis] || 'world';
          const uv = propUnitField(p[value.axis], def);
          if (uv.value != null && Number.isFinite(uv.value) && uv.unit !== value.unit) {
            const converted = convertUnitScalar(uv.value, uv.unit, value.unit, preview.ctxInfo());
            if (converted != null) {
              snapshot();
              p[value.axis] = propRawUnit(converted, value.unit, def);
              state.dirty = true;
              dirtyAndRefresh(false);
              renderProperties();
              return;
            }
          }
        }
        renderProperties();
        return;
      }
      // $note 表达式分组关键帧：字段修改应用到该表达式下的全部关键帧
      // （K0 + 各 state），时间字段仍按单帧处理。
      if (state.selectedKfExpression && key !== 'time') {
        snapshot();
        const gid = state.selectedKfExpression;
        const g = (kfGroups || []).find((x) => x.id === gid || x.token === gid);
        const kfResolver = (tok) => (noteCtx != null ? resolveTimeForNote(tok, noteCtx) : resolveTime(tok));
        for (const frame of [obj, ...(obj.states || [])]) {
          const hit = g && g.numeric
            ? (() => { const rt = kfResolver(frame.time); return rt != null && Math.abs(rt - g.time) < 1e-6; })()
            : (frame.time === gid);
          if (hit) setStateField(frame, key, value);
        }
        state.dirty = true;
        dirtyAndRefresh(false);
        renderProperties();
        return;
      }
      // 同一时间块内关键帧时间不能重复：面板改 time 时校验并拒绝。
      if (key === 'time') {
        // 输入规范化：纯数字（含粘贴的长小数）按 3 位小数收敛并转数值。
        value = normalizeTimeInput(value);
        // 清空时间输入框 = 删除该关键帧（K0 按既有删除语义：最早关键帧提升为
        // 新的 K0，无其它关键帧则删除对象），而不是留下 time 为空的关键帧。
        const cleared = value === undefined || value === null ||
          (typeof value === 'string' && value.trim() === '') || value === '';
        if (cleared) {
          if (state.selectedKeyIdx === -1 || (obj.states && obj.states[state.selectedKeyIdx])) {
            deleteKeyframeOnly(obj.id, state.selectedKeyIdx);
          } else {
            renderProperties();
          }
          return;
        }
        // 合规性检查：无法解析的 note 表达式（时间轴上无法创建关键帧）拒绝输入。
        if (!validTimeToken(value, obj)) {
          toast(__t('无法解析时间表达式: ') + String(value), true);
          renderProperties();
          return;
        }
        if (timeCollides(obj, state.selectedKeyIdx, value)) {
          toast('该时间已有其他关键帧', true);
          renderProperties();
          return;
        }
      }
      if (key === 'x' || key === 'y') {
        const def = key === 'x' ? 'stagex' : 'stagey';
        const marker = value && typeof value === 'object' && value.__unitChange;
        // 显式带坐标系前缀（如 notex:0.8）：按指定坐标系直接写入，不换算。
        const explicitUnit = typeof value === 'string' && /^[a-zA-Z]+:/.test(value);
        const old = propUnitField(stateJson[key], def);
        const incoming = marker ? null : (typeof value === 'number'
          ? { value, unit: def }
          : (typeof value === 'string' ? propUnitField(value, def) : null));
        if (marker || (!explicitUnit && incoming && incoming.unit !== old.unit)) {
          snapshot();
          const newUnit = marker ? marker : incoming.unit;
          const base = marker ? old.value : incoming.value;
          const converted = convertUnitValue(obj, stateJson, key, base, old.unit, newUnit);
          if (converted != null) {
            setStateField(stateJson, key, propRawUnit(converted, newUnit, def));
            state.dirty = true;
            dirtyAndRefresh(false);
            renderProperties();
          } else {
            // 换算失败（投影/basis 不可用）：给出提示而不是静默丢弃编辑。
            toast('单位换算失败：无法保持当前位置', true);
            renderProperties();
          }
          return;
        }
      }
      snapshot();
      setStateField(stateJson, key, value);
      if (key === 'time') {
        sortObjectStates(obj);
        resolveAllLaneOverlaps([obj.id]);
      }
      dirtyAndRefresh(false);
      // 时间改动后重渲染属性面板，让时间输入框/关键帧列表立即反映新时间。
      if (key === 'time') renderProperties();
    };
    if (type === 'controller') {
      // Controller scene options are edited as option-block cards; each card
      // is a self-contained unit that can be dragged onto the timeline.
      // 轨道面板只显示该轨道启用的卡片（唯一归属，每张卡片只能被一条轨道引用）。
      Schema.renderControllerCards(formEl, schema, stateJson, onStateChange, interpolated, {
        owners: controllerCardOwners(),
        selectedId: obj.id,
        enabledOnly: true,
        onCardContextMenu: onControllerCardContextMenu,
        onAddCard: () => promptAssignCardsToTrack(obj.id)
      });
      // Keyframe-level controls (destroy / easing) live in the section header.
      const easingSel = $('#kfEasing');
      if (easingSel) {
        easingSel.innerHTML = '<option value="">(未设置)</option>' +
          Schema.EASING_OPTIONS.map((o) => `<option value="${o.value}">${o.label}</option>`).join('');
        easingSel.disabled = interpolated;
        if (stateJson.easing != null) {
          const hit = Schema.EASING_OPTIONS.find((o) => String(o.value).toLowerCase() === String(stateJson.easing).toLowerCase());
          if (hit) easingSel.value = String(hit.value);
        }
        easingSel.addEventListener('change', () => onStateChange('easing', easingSel.value === '' ? undefined : easingSel.value));
      }
      const destroyCb = $('#kfDestroy');
      if (destroyCb) {
        destroyCb.disabled = interpolated;
        destroyCb.addEventListener('change', () => onStateChange('destroy', destroyCb.checked));
      }
    } else {
      // note_controller 的 Note 在全帧同步区编辑，状态表单不再重复（避免按帧修改）。
      const stateSchema = type === 'note_controller'
        ? { ...schema, fields: schema.fields.filter((f) => f.key !== 'note') }
        : schema;
      Schema.renderForm(formEl, stateSchema, stateJson, onStateChange, interpolated, {
        orderInfo: orderInfoFor(obj),
        excludeSync: true
      });
    }
    // Keep focus while editing; refresh timeline labels only.
    formEl.addEventListener('change', () => renderTimeline());

    // 时间输入框：右键呼出“使用note选择器写入时间”；选择器浮窗打开时点击
    // 该输入框即进入对应对象类型的写入时间模式。
    // 注意：必须在本函数末尾（Schema.renderForm 填充 #stateForm 之后）查找，
    // 否则找不到刚生成的输入框；事件绑定在字段行上，插值只读（disabled）时
    // 右键/点击依然有效。
    const timeInput = Array.from(document.querySelectorAll('#stateForm .field input[type=text]'))
      .find((el) => {
        const l = el.closest('.field') && el.closest('.field').querySelector('label');
        return l && l.textContent.indexOf('时间') >= 0;
      });
    const timeField = timeInput ? (timeInput.closest('.field') || timeInput) : null;
    if (timeField) {
      const setTimeTarget = () => {
        state.nsTimeTarget = { objId: obj.id, isK0: isInitial, frame: isInitial ? -1 : state.selectedKeyIdx };
      };
      timeField.addEventListener('click', () => {
        state.nsMode = 'time';
        if (floatWindowEl && floatWindowKind === 'note-selector') {
          setTimeTarget();
          renderNoteSelectorEditor(floatWindowEl.querySelector('.float-window-body'));
        } else if (window.sbAPI && window.sbAPI.nsSend) {
          setTimeTarget();
          window.sbAPI.nsSend({
            type: 'time-target', id: obj.id, isK0: state.nsTimeTarget.isK0,
            frame: state.nsTimeTarget.frame
          });
        }
      });
      timeField.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        showContextMenu(e.clientX, e.clientY, [
          { label: '使用note选择器写入时间', action: () => {
            setTimeTarget();
            openNoteSelectorEditor(obj);
          } },
          { label: '编辑note选择器', action: () => openNoteSelectorEditor(obj) }
        ]);
      });
    }
  }

  // 合并轨道统计信息：列出轨道内每个对象（类型 / 时间范围 / stage 预览图），
  // 点击条目跳转选中对应对象。
  const LANE_INFO_TYPE_LABELS = {
    sprite: 'Sprite', text: 'Text', video: 'Video', line: 'Line',
    controller: 'Controller', note_controller: 'Note Ctrl'
  };
  function renderLaneInfo(body) {
    const lane = state.selectedLane;
    const objs = (lane && lane.objs) || [];
    if (!objs.length) {
      state.selectedLane = null;
      renderProperties();
      return;
    }
    let html = `<div class="empty-panel">${__t('已选择轨道 · ')}${objs.length} ${__t('个对象')}</div>` +
      `<div class="prop-section"><h4>${__t('轨道对象统计')}</h4>`;
    for (const o of objs) {
      const entry = findObjectEntry(o.id);
      const type = entry ? entry.type : o.type;
      const label = o.label || o.id;
      const t0 = o.clipStart != null ? fmtTime(o.clipStart) : '—';
      const t1 = o.clipEnd != null ? fmtTime(o.clipEnd) : '—';
      const thumb = (type === 'sprite' || type === 'video') && o.path
        ? `<img class="lane-info-thumb" data-path="${escapeHtml(o.path)}" alt="">`
        : '';
      html += `<div class="lane-info-item" data-id="${escapeHtml(o.id)}">${thumb}` +
        `<div class="lane-info-meta">` +
        `<div class="lane-info-name">${escapeHtml(label)}<span class="lane-info-type">${escapeHtml(LANE_INFO_TYPE_LABELS[type] || type)}</span></div>` +
        `<div class="lane-info-time">${t0} → ${t1}</div>` +
        `</div><span class="lane-info-jump">${svgIcon('chevronRight', 12)}</span></div>`;
    }
    html += '</div>';
    body.innerHTML = html;
    body.querySelectorAll('.lane-info-thumb').forEach((img) => {
      const p = img.dataset.path;
      if (p) loadThumbnail(p, (url) => { if (url && img.isConnected) img.src = url; });
    });
    body.querySelectorAll('.lane-info-item').forEach((item) => {
      item.addEventListener('click', () => {
        const id = item.dataset.id;
        if (id) selectObject(id, null);
      });
    });
  }

  // Scroll the right properties panel so the "状态属性" (changed property
  // info) section is visible after selecting a keyframe.
  function scrollToStateForm(body) {
    const form = body && body.querySelector('#stateForm');
    if (!form) return;
    const section = form.closest('.prop-section');
    if (!section) return;
    const target = Math.max(0, section.offsetTop - 8);
    if (typeof body.scrollTo === 'function') {
      body.scrollTo({ top: target, behavior: 'smooth' });
    } else {
      body.scrollTop = target;
    }
  }

  // Selecting a keyframe (from the properties list or the timeline) jumps the
  // playhead to its time and brings the changed property info into view.
  function selectKeyframe(objId, kfIdx, kfTime) {
    state.selectedKfExpression = null;
    selectObject(objId, kfIdx);
    // A directly clicked keyframe is always editable in the properties panel,
    // even when the playhead sits between keyframes.
    state.propsExplicitKf = true;
    renderProperties();
    if (kfTime != null) setTime(kfTime, false);
    scrollToStateForm($('#propBody'));
  }

  // Cancel the current keyframe selection (the object stays selected) and
  // hide the floating detail window after any outside interaction.
  function dismissKeyframeSelection() {
    if (!state.selectedKfs || !state.selectedKfs.length) return;
    const objId = state.selectedObjId;
    if (!objId || !findRawObject(objId)) {
      state.selectedKfs = [];
      state.selectedKeyIdx = -1;
      return;
    }
    selectObject(objId, null);
  }

    function dismissKeyframeSelectionIfOutside(e) {
      // 右键（按钮 2）触发的是上下文菜单，不应清除框选出来的多选结果。
      if (e.button !== 0) return;
      if (!state.storyboard || !state.selectedKfs || !state.selectedKfs.length) return;
      const t = e.target;
      if (!t || typeof t.closest !== 'function') return;
      // Interacting with the keyframe itself, its floating detail window, the
      // properties panel, or an open context menu keeps the selection.
      if (t.closest('.kf, #kfTooltip, #propBody, #contextMenu')) return;
      // 预览画布上已命中对象的拖拽（多选关键帧后直接拖动）：保留关键帧选择，
      // 让拖拽作用于全部选中关键帧。
      if (objectDrag) return;
      dismissKeyframeSelection();
    }

  // 单独编辑草稿的初始关键帧：尽量继承合并块分配给该 note 的关键帧（保持视觉
  // 不突变）。仅 note_controller 合并块的状态字段可迁移（stage 对象的字段不
  // 属于 note_controller）。
  function mergedNoteSeed(blockObj, noteId, note) {
    const kfs = objectKeyframesForNote(blockObj, noteId);
    const states = [];
    if (blockObj && Array.isArray(blockObj.states) && blockObj.states.length) {
      for (const st of blockObj.states) {
        if (!noteSelectorIncludes(st.note, noteId)) continue;
        const c = { ...st };
        delete c.note;
        delete c.id;
        states.push(c);
      }
    }
    return {
      // K0 保留合并块的原始时间 token（$note 表达式按原样显示）；没有 token 时
      // 退回解析后的首个关键帧时间或 note 起始时间。
      time: blockObj && blockObj.time != null
        ? blockObj.time
        : (kfs.length ? kfs[0].time : (note ? note.start_time : 0)),
      states
    };
  }

  // 合并时间块内 note 的“单独编辑”页：Note 输入框取该 note 的 ID；关键帧列表
  // 继承合并块分配给该 note 的关键帧并可编辑（含“在播放头添加关键帧”）；任意
  // 修改生效时创建独立 note_controller 并把该 note 从合并块分离（区别于直接
  // 编辑合并时间块的整体属性）。
  function renderMergedNoteEditor(body) {
    const info = state.noteInMergedBlock;
    if (!info) return;
    const noteId = info.noteId;
    const blockObj = findRawObject(info.blockId);
    if (!blockObj) {
      state.noteInMergedBlock = null;
      renderProperties();
      return;
    }
    const note = state.chart ? state.chart.noteById(noteId) : null;
    const schema = Schema.SCHEMAS.note_controller;
    const seed = mergedNoteSeed(blockObj, noteId, note);
    const draft = {
      id: uniqueId('note_controller'),
      note: noteId,
      time: seed.time,
      states: seed.states
    };
    let created = false;
    // 首次修改生效：创建独立 note_controller 并把该 note 从合并块分离
    // （被纯 ID 载体覆盖时采用具体 parent_<n> id 并收缩载体）。
    const ensureCreated = () => {
      if (created) return;
      created = true;
      draft.id = noteControllerIdWithHandoff([noteId]);
      state.storyboard.note_controllers = state.storyboard.note_controllers || [];
      state.storyboard.note_controllers.push(draft);
      state.dirty = true;
      state.noteInMergedBlock = null;
      state.pendingNote = null;
      state.selectedObjId = draft.id;
      state.selectedKeyIdx = -1;
      state.selectedIds = [draft.id];
      if (preview.chart) preview.setStoryboard(state.storyboard);
      renderObjectTree();
    };
    // 关键帧列表：$note 表达式按原样显示（表达式形式），数值时间按该 note
    // 解析为绝对时间；整体按该 note 解析后的时间正序排列。
    const kfEntries = [
      { index: -1, token: draft.time, label: 'K0' },
      ...(draft.states || []).map((st, i) => ({ index: i, token: st.time, label: 'K' + (i + 1) }))
    ];
    const kfTime = (e) => {
      const t = resolveTimeForNote(e.token, noteId);
      return t != null ? t : Number.MAX_VALUE;
    };
    const kfTimeText = (token) => {
      if (typeof token === 'string' && token.indexOf('$note') >= 0) return escapeHtml(token);
      const t = resolveTimeForNote(token, noteId);
      return t != null ? fmtTime(t) : (typeof token === 'string' ? escapeHtml(token) : '0.000');
    };
    kfEntries.sort((a, b) => kfTime(a) - kfTime(b));
    const kfHtml = kfEntries.map((e) =>
      `<div class="key-item" data-kf="${e.index}"><span class="klabel">${e.label}</span><span class="kt">${kfTimeText(e.token)}</span>` +
      (e.index >= 0 ? `<span class="del" title="${__t('删除该关键帧')}">${svgIcon('close', 12)}</span>` : '') + `</div>`).join('');
    let html = `<div class="prop-section"><h4>${__t('对象 · ')}${schema.label}${__t('（单独编辑）')}</h4>`;
    html += __t('<div class="help-text merged-note-hint">该note位于合并时间块 <b>') + escapeHtml(String(blockObj.id)) +
      __t('</b> 中，对其进行单独修改会导致其独立；若要进行整体修改请从轨道中点击进入该note选择器的整体属性编辑</div>');
    html += field('关联 Note', noteId, false);
    html += `<div class="prop-section"><h4>${__t('合并时间块分配给该 note 的关键帧')}</h4><div class="key-list" id="keyList">${kfHtml}</div>` +
      `<div class="btn-row"><button class="mini-btn" id="btnAddKf">${svgIcon('plus', 12, true)}${__t('在播放头添加关键帧')}</button></div></div>`;
    html += `<div class="prop-section"><h4>${__t('状态属性')}</h4><div id="stateForm" class="kf-form"></div></div>`;
    html += `<div class="btn-row"><button class="mini-btn" id="btnOpenMergedBlock">${__t('进入合并时间块整体属性编辑')}</button></div>`;
    body.innerHTML = html;

    const refreshAfterAction = () => {
      if (created) renderProperties();
      else renderMergedNoteEditor(body);
    };
    body.querySelector('#btnOpenMergedBlock').addEventListener('click', () => {
      state.noteInMergedBlock = null;
      selectObject(blockObj.id, null);
    });
    body.querySelector('#btnAddKf').addEventListener('click', () => {
      snapshot();
      ensureCreated();
      addKeyframeAtPlayhead(draft);
      renderProperties();
    });
    body.querySelectorAll('#keyList .key-item').forEach((el) => {
      el.addEventListener('click', () => {
        const kfIdx = parseInt(el.dataset.kf, 10);
        state.selectedKeyIdx = kfIdx;
        state.propsExplicitKf = true;
        refreshAfterAction();
      });
      const del = el.querySelector('.del');
      if (del) del.addEventListener('click', (e) => {
        e.stopPropagation();
        snapshot();
        ensureCreated();
        (draft.states || []).splice(parseInt(el.dataset.kf, 10), 1);
        dirtyAndRefresh(false);
        renderProperties();
      });
    });

    const formEl = $('#stateForm');
    Schema.renderForm(formEl, schema, draft, (key, value) => {
      snapshot();
      ensureCreated();
      if (key === 'time') value = normalizeTimeInput(value);
      // 清空时间输入框 = 删除该关键帧，而不是留下空时间；K0 清空时把最早
      // 关键帧提升为新的 K0（无其它关键帧则还原，不写入空值）。
      const clearedTime = key === 'time' && (value === undefined || value === null ||
        (typeof value === 'string' && value.trim() === '') || value === '');
      if (clearedTime) {
        if (state.selectedKeyIdx >= 0 && draft.states && draft.states[state.selectedKeyIdx]) {
          draft.states.splice(state.selectedKeyIdx, 1);
        } else if (draft.states && draft.states.length) {
          const promoted = draft.states.shift();
          draft.time = promoted.time;
          for (const k of Object.keys(promoted)) {
            if (['states', 'id', 'note', 'time', 'parent_id', 'target_id', 'path', 'order', 'layer'].includes(k)) continue;
            draft[k] = promoted[k];
          }
        } else {
          renderProperties();
          return;
        }
        state.dirty = true;
        dirtyAndRefresh(false);
        renderProperties();
        return;
      }
      setStateField(draft, key, value);
      resolveAllLaneOverlaps([draft.id]);
      dirtyAndRefresh(false);
      // 独立后：属性页切换到该控制器的正常编辑页。
      renderProperties();
    });
  }

  // Shows a note_controller editor for a note that doesn't have one yet. The
  // controller object is created (and added to the storyboard) only when the
  // user changes any field value.
  function renderPendingNoteController(body) {
    const noteId = state.pendingNote;
    const note = state.chart ? state.chart.noteById(noteId) : null;
    const schema = Schema.SCHEMAS.note_controller;
    const draft = {
      id: uniqueId('note_controller'),
      note: noteId,
      // 右键 note 创建 note_controller：初始关键帧落在播放头当前位置，
      // 而不是 note 的 start_time（否则时间块出现在时间轴别处）。
      time: preview.time != null ? preview.time : (note ? note.start_time : 0)
    };
    let html = `<div class="prop-section"><h4>${__t('对象 · ')}${schema.label}${__t('（待创建）')}</h4>`;
    html += field('关联 Note', noteId, false);
    html += `<div class="help-text">${__t('该 Note 还没有 Note Controller。修改下面任意属性后将自动在当前时间创建并生成对象。')}</div>`;
    html += `<div class="prop-section"><h4>${__t('状态属性')}</h4><div id="stateForm" class="kf-form"></div></div>`;
    body.innerHTML = html;

    const formEl = $('#stateForm');
    let created = false;
    Schema.renderForm(formEl, schema, draft, (key, value) => {
      if (key === 'time') value = normalizeTimeInput(value);
      // 清空时间输入框：不创建/不写入空时间的关键帧（有待有效输入时再落）。
      if (key === 'time' && (value === undefined || value === null ||
          (typeof value === 'string' && value.trim() === '') || value === '')) {
        return;
      }
      if (!created) {
        created = true;
        snapshot();
        // ID 交接：若该 note 由纯 ID 载体覆盖，新建控制器采用载体的 id 模板。
        draft.id = noteControllerIdWithHandoff([noteId]);
        state.storyboard.note_controllers = state.storyboard.note_controllers || [];
        state.storyboard.note_controllers.push(draft);
        state.dirty = true;
        state.pendingNote = null;
        state.selectedObjId = draft.id;
        state.selectedKeyIdx = -1;
        if (preview.chart) preview.setStoryboard(state.storyboard);
        renderObjectTree();
      }
      if (created) snapshot();
      setStateField(draft, key, value);
      dirtyAndRefresh(false);
    });
  }

  // 多选 Note：进入 note_controller 复数属性编辑界面（与 stage 多选一致的样式）。
  // “关联 Note”列出选中的每个 note ID 并计数；时间栏支持 start:$note 等带
  // $note 选择器式样的输入，输入后按各选中 Note 自动替换 $note 并转为绝对时间。
  function renderMultiNoteController(body, noteSel) {
    const schema = Schema.SCHEMAS.note_controller;
    const noteIds = [];
    const seen = new Set();
    for (const id of noteSel) {
      const nid = splitEntryId(id).noteId;
      if (nid == null || seen.has(nid)) continue;
      seen.add(nid);
      noteIds.push(nid);
    }
    const targets = noteIds.map((nid) => ({ nid, nc: findNoteControllerForNote(nid) || null }));
    // 首次修改时才为没有 note_controller 的 Note 创建（同单个 Note 的懒创建语义）。
    const ensureTargets = () => {
      let changed = false;
      for (const t of targets) {
        if (t.nc) continue;
        const note = state.chart ? state.chart.noteById(t.nid) : null;
        t.nc = {
          // ID 交接：若该 note 由纯 ID 载体覆盖，采用载体的 id 模板。
          id: noteControllerIdWithHandoff([t.nid]),
          note: t.nid,
          time: note ? note.start_time : 0
        };
        state.storyboard.note_controllers = state.storyboard.note_controllers || [];
        state.storyboard.note_controllers.push(t.nc);
        state.dirty = true;
        changed = true;
      }
      if (changed && preview.chart) preview.setStoryboard(state.storyboard);
      return changed;
    };

    // 合并数值：各 Note 的控制器同值则显示该值，否则显示“多个数值”。
    const merged = {};
    const unitInfo = {};
    for (const f of schema.fields) {
      if (f.key === 'note' || f.key === 'time') continue;
      const vals = targets.map((t) => (t.nc ? t.nc[f.key] : undefined));
      const first = vals[0];
      merged[f.key] = vals.every((v) => JSON.stringify(v) === JSON.stringify(first)) ? first : Schema.MULTI_VALUE;
      if (f.kind === 'unit' && (f.key === 'x' || f.key === 'y')) {
        const def = f.key === 'x' ? 'notex' : 'notey';
        const units = targets.map((t) => (t.nc ? propUnitField(t.nc[f.key], def).unit : def));
        unitInfo[f.key] = units.every((u) => u === units[0]) ? units[0] : def;
      }
    }
    const timeVals = targets.map((t) => (t.nc ? t.nc.time : undefined)).filter((v) => v != null);
    const allTimeUnset = timeVals.length === 0;
    const timeSame = timeVals.length === targets.length && timeVals.length > 0 &&
      timeVals.every((v) => JSON.stringify(v) === JSON.stringify(timeVals[0]));
    const timeStr = timeSame && timeVals[0] != null ? String(timeVals[0]) : '';

    body.innerHTML =
      `<div class="empty-panel">${__t('已选择')} ${noteIds.length} ${__t('个 Note')}</div>` +
      `<div class="prop-section"><h4>${__t('对象 · ')}${escapeHtml(schema.label)}${__t('（多选编辑）')}</h4>` +
      `<div class="field"><label>${__t('关联 Note')}</label><span style="flex:1;color:var(--text)">${escapeHtml(noteIds.join(', '))}${__t('（共 ')}${noteIds.length}${__t('）')}</span></div>` +
      `<div class="field"><label>${__t('时间 (秒)')}</label><input id="ncMultiTime" type="text" value="${escapeHtml(timeStr)}" placeholder="${__t('支持$note表达式')}"></div>` +
      `<div id="ncMultiForm" class="kf-form"></div></div>`;

    const timeInput = $('#ncMultiTime');
    if (!allTimeUnset && !timeSame) timeInput.placeholder = '多个数值';
    timeInput.addEventListener('change', () => {
      const raw = timeInput.value.trim();
      if (!raw) return;
      snapshot();
      ensureTargets();
      let ok = true;
      for (const t of targets) {
        if (resolveNoteTimeToken(raw, t.nid) == null) { ok = false; break; }
      }
      if (!ok) { toast(__t('无法解析时间: ') + raw, true); renderProperties(); return; }
      // 维持输入的表达式原样（如 start:$note），导出时同样输出表达式，方便
      // 后续更改；纯数字才存为数值。
      const numeric = /^-?\d+(\.\d+)?$/.test(raw);
      const stored = numeric ? Math.round(parseFloat(raw) * 1000) / 1000 : raw;
      for (const t of targets) setStateField(t.nc, 'time', stored);
      state.dirty = true;
      dirtyAndRefresh(false);
      renderProperties();
      toast('已设置时间表达式');
    });

    const formEl = $('#ncMultiForm');
    const ncSchema = { ...schema, fields: schema.fields.filter((f) => f.key !== 'note') };
    const onMultiChange = (key, value) => {
      snapshot();
      ensureTargets();
      if (key === 'x' || key === 'y') {
        const def = key === 'x' ? 'notex' : 'notey';
        const marker = value && typeof value === 'object' && value.__unitChange;
        // 显式带坐标系前缀（如 stagex:1）：按指定坐标系直接写入，不换算。
        const explicitUnit = typeof value === 'string' && /^[a-zA-Z]+:/.test(value);
        const incoming = marker ? null : (typeof value === 'number'
          ? { value, unit: def }
          : (typeof value === 'string' ? propUnitField(value, def) : null));
        const unitsDiffer = incoming && targets.some((t) => propUnitField(t.nc[key], def).unit !== incoming.unit);
        if (marker || (!explicitUnit && unitsDiffer)) {
          let changed = false;
          for (const t of targets) {
            const old = propUnitField(t.nc[key], def);
            const newUnit = marker ? marker : incoming.unit;
            const base = marker ? old.value : incoming.value;
            const converted = convertUnitValue(t.nc, t.nc, key, base, old.unit, newUnit);
            if (converted != null) {
              setStateField(t.nc, key, propRawUnit(converted, newUnit, def));
              changed = true;
            }
          }
          if (changed) {
            state.dirty = true;
            dirtyAndRefresh(false);
            renderProperties();
          } else {
            toast('单位换算失败：无法保持当前位置', true);
            renderProperties();
          }
          return;
        }
      }
      for (const t of targets) setStateField(t.nc, key, value);
      state.dirty = true;
      dirtyAndRefresh(false);
      renderProperties();
    };
    Schema.renderForm(formEl, ncSchema, merged, onMultiChange, false, { multi: true, excludeSync: true, unitInfo });
  }

  function setStateField(stateJson, key, value) {
    if (value === undefined) delete stateJson[key];
    else stateJson[key] = value;
    if (key === 'scale') {
      if (value === undefined) { delete stateJson.scale_x; delete stateJson.scale_y; }
      else { stateJson.scale_x = value; stateJson.scale_y = value; }
    }
  }

  // 属性面板用的单位解析/序列化（与预览拖拽的 unitField/rawUnit 同语义）。
  function propUnitField(v, defUnit) {
    if (v == null) return { value: null, unit: defUnit };
    if (typeof v === 'number') return { value: v, unit: defUnit };
    if (typeof v === 'object') return { value: Number(v.value), unit: v.unit || defUnit };
    const s = String(v);
    const i = s.indexOf(':');
    if (i < 0) return { value: parseFloat(s), unit: defUnit };
    return { value: parseFloat(s.slice(i + 1)), unit: s.slice(0, i).toLowerCase() };
  }

  function propRawUnit(value, unit, defUnit) {
    if (value == null || isNaN(value)) return undefined;
    const v = Math.round(value * 10000) / 10000;
    return (!unit || unit === defUnit) ? v : unit + ':' + v;
  }

  // 坐标系切换：把单位值换算到新坐标系，保持对象实际投影位置不变。
  // 通过预览的投影与拖动基向量求逆，支持旋转/透视/父级变换下的精确换算。
  function convertUnitValue(obj, st, key, value, oldUnit, newUnit) {
    if (value == null || isNaN(value) || oldUnit === newUnit) return null;
    if (key !== 'x' && key !== 'y') return null;
    if (!preview || !preview.chart) return null;
    const info = preview.ctxInfo();
    const xu = key === 'x' ? { value, unit: oldUnit } : propUnitField(st.x, 'stagex');
    const yu = key === 'y' ? { value, unit: oldUnit } : propUnitField(st.y, 'stagey');
    const pCur = preview.stageOriginPx(obj, st, info, xu, yu);
    const xu0 = key === 'x' ? { value: 0, unit: newUnit } : xu;
    const yu0 = key === 'y' ? { value: 0, unit: newUnit } : yu;
    const p0 = preview.stageOriginPx(obj, st, info, xu0, yu0);
    const b = preview.stageOriginDragBasis(obj, st, info, xu0, yu0);
    const basis = key === 'x' ? b.bx : b.by;
    const denom = basis.x * basis.x + basis.y * basis.y;
    if (denom < 1e-12) return null;
    return ((pCur.x - p0.x) * basis.x + (pCur.y - p0.y) * basis.y) / denom;
  }

  // 纯世界坐标标量换算（与 preview.unitWorld 互逆）：用于 line 端点等不依赖
  // 对象变换的逐轴单位切换，保持世界位置不变。
  function unitFromWorld(world, unit, info) {
    const ch = state.chart;
    const ortho = info.ortho;
    const aspect = info.W / info.H;
    switch (unit) {
      case 'stagex': return world / ortho / aspect * 800;
      case 'stagey': return world / ortho * 600;
      case 'camerax': return world / ortho / aspect;
      case 'cameray': return world / ortho;
      case 'notex': {
        const hr = ch.horizontalRatio, base = ch.baseSize, sr = ch.screenRatio;
        return (world / (base * sr) + hr) / (2 * hr);
      }
      case 'notey': {
        const vr = ch.verticalRatio, base = ch.baseSize, vo = ch.verticalOffset;
        return (world - vo + vr * base) / (2 * vr * base);
      }
      default: return world;
    }
  }
  function convertUnitScalar(value, fromUnit, toUnit, info) {
    if (value == null || !Number.isFinite(value) || fromUnit === toUnit) return null;
    const w = preview.unitWorld({ value, unit: fromUnit }, info);
    return unitFromWorld(w, toUnit, info);
  }

  function field(label, value, editable) {
    if (window.SBi18n) label = window.SBi18n.t(label);
    return `<div class="field"><label>${label}</label><span style="flex:1;color:var(--text)">${escapeHtml(String(value))}</span></div>`;
  }

  function addKeyframeAtPlayhead(obj) {
    const t = preview.time;
    const kfs = objectKeyframes(obj);
    // 同一时间块内关键帧时间不能重复：播放头已有关键帧时不再新建。
    const existing = kfs.find((k) => Math.abs(k.time - t) < 1e-6);
    if (existing) {
      state.selectedKeyIdx = existing.index;
      renderProperties();
      renderTimeline();
      toast('该时间已存在关键帧');
      return;
    }
    const cur = kfs.filter((k) => k.time <= t + 0.0001).pop() || kfs[0];
    let clone;
    if (cur && cur.index === -1) clone = { ...obj };
    else if (cur) clone = { ...(obj.states[cur.index] || {}) };
    else clone = {};
    delete clone.states;
    delete clone.id;
    delete clone.note;
    // 全帧同步字段以对象本体为准（path / order / layer / parent / target）。
    for (const k of ['path', 'order', 'layer', 'parent_id', 'target_id']) {
      if (obj[k] !== undefined) clone[k] = obj[k];
      else delete clone[k];
    }
    clone.time = roundTime(t);
    obj.states = obj.states || [];
    obj.states.push(clone);
    sortObjectStates(obj);
    normalizeK0(obj);
    // 新关键帧早于原 K0 时会被提升为新的 K0（obj.time），选中索引同步为 -1；
    // 否则保持原索引语义（关键帧列表按时间重排后仍指向新增帧）。
    state.selectedKeyIdx = Math.abs(resolveTime(obj.time) - t) < 1e-9
      ? -1
      : obj.states.length - 1;
    resolveAllLaneOverlaps([obj.id]);
    dirtyAndRefresh();
    toast(__t('已在 ') + fmtTime(t) + __t(' 添加关键帧'));
  }

  // “添加关键帧”：给所有选中的时间块在播放头处各建一个关键帧。clickedId 用于
  // 时间块右键菜单：点击对象不在当前多选里时只给该对象添加。
  function addKeyframeToSelectedObjects(clickedId) {
    if (!state.storyboard) return;
    let ids = state.selectedIds && state.selectedIds.length
      ? [...state.selectedIds]
      : (state.selectedObjId ? [state.selectedObjId] : []);
    if (clickedId) {
      const rid = splitEntryId(clickedId).rawId;
      if (!ids.includes(rid)) ids = [rid];
    }
    const objs = [];
    for (const id of ids) {
      if (isNoteEntry(id)) continue;
      const e = findObjectEntry(splitEntryId(id).rawId);
      if (e && e.obj && !objs.includes(e.obj)) objs.push(e.obj);
    }
    if (!objs.length) { toast('请先选中对象', true); return; }
    snapshot();
    for (const obj of objs) addKeyframeAtPlayhead(obj);
    toast(__t('已为 ') + objs.length + __t(' 个对象在播放头添加关键帧'));
  }

  // Copy the selected keyframe(s) to the internal clipboard. Multi-selected
  // keyframes (state.selectedKfs) are copied as a group; otherwise the
  // currently selected keyframe is copied.
  function copyKeyframesToClipboard() {
    const items = [];
    const push = (obj, src) => {
      if (!obj || !src) return;
      const t = resolveTime(src.time);
      if (t == null) return;
      const clone = JSON.parse(JSON.stringify(src));
      delete clone.states;
      items.push({ objId: obj.id, time: t, state: clone });
    };
    const kfs = state.selectedKfs || [];
    if (kfs.length) {
      for (const kf of kfs) {
        const obj = findRawObject(splitEntryId(kf.objId).rawId);
        if (!obj) continue;
        const src = kf.index === -1 ? obj : (obj.states || [])[kf.index];
        push(obj, src);
      }
    } else if (state.selectedObjId) {
      const obj = findRawObject(state.selectedObjId);
      if (obj) {
        const src = state.selectedKeyIdx === -1 ? obj : (obj.states || [])[state.selectedKeyIdx];
        push(obj, src);
      }
    }
    if (!items.length) return;
    state.kfClipboard = items;
    state.objClipboard = []; // 关键帧剪贴板与对象剪贴板互斥
    toast(`已复制 ${items.length} 个关键帧`);
  }

  // Legacy single-keyframe helper: copy the given object's current keyframe
  // to the clipboard (tests / callers that pass an explicit object).
  function copyKeyframe(obj) {
    const isInitial = state.selectedKeyIdx === -1;
    const src = isInitial ? obj : (obj.states || [])[state.selectedKeyIdx];
    if (!src) return;
    const t = resolveTime(src.time);
    const clone = JSON.parse(JSON.stringify(src));
    delete clone.states;
    state.kfClipboard = [{ objId: obj.id, time: t == null ? preview.time : t, state: clone }];
    toast('已复制关键帧');
  }

  // Paste the clipboard keyframes at the playhead, keeping their relative
  // spacing (the earliest copied keyframe lands on the playhead).
  function pasteKeyframesAtPlayhead() {
    const items = state.kfClipboard || [];
    if (!items.length) { toast('剪贴板中没有关键帧', true); return; }
    snapshot();
    const t0 = Math.min(...items.map((i) => i.time));
    const target = preview.time;
    const added = [];
    let count = 0;
    for (const it of items) {
      const obj = findRawObject(it.objId);
      if (!obj) continue;
      const st = JSON.parse(JSON.stringify(it.state));
      delete st.id;
      delete st.note;
      // 全帧同步字段不随粘贴带入：以目标对象本体为准。
      for (const k of ['path', 'order', 'layer', 'parent_id', 'target_id']) {
        if (obj[k] !== undefined) st[k] = obj[k];
        else delete st[k];
      }
      st.time = target + (it.time - t0);
      // 同一时间块内关键帧时间不能重复：目标时间已有其他关键帧时跳过。
      if (objectKeyframes(obj).some((k) => Math.abs(k.time - st.time) < 1e-6)) continue;
      obj.states = obj.states || [];
      obj.states.push(st);
      sortObjectStates(obj);
      added.push({ objId: obj.id, index: obj.states.indexOf(st) });
      count++;
    }
    if (!count) { toast('粘贴失败：源对象已不存在', true); return; }
    resolveAllLaneOverlaps(added.map((a) => a.objId));
    state.dirty = true;
    if (preview.chart) preview.setStoryboard(state.storyboard);
    state.selectedObjId = added[0].objId;
    state.selectedKeyIdx = added[0].index;
    state.selectedIds = [added[0].objId];
    state.selectedKfs = added;
    renderTimeline();
    renderProperties();
    renderObjectTree();
    requestRender();
    toast(__t('已粘贴 ') + count + __t(' 个关键帧至播放头'));
  }

  function dirtyAndRefresh(rebuildProps = true) {
    state.dirty = true;
    if (preview.chart) preview.setStoryboard(state.storyboard);
    renderTimeline();
    if (rebuildProps) renderProperties();
    renderObjectTree();
    requestRender();
  }

  // 卡片是否已被控制器的关键帧数据写入（旧项目无启用元数据时的回退判断）。
  function controllerCardFramesClaimed(c, card) {
    const frames = [c, ...(c.states || [])];
    return frames.some((f) => {
      if (card.toggle && f[card.toggle] !== undefined) return true;
      return card.fields.some((k) => f[k] !== undefined);
    });
  }

  // 每个 controller 卡片（选项块）只能被一个控制器轨道引用：优先使用
  // .ctr 里持久化的启用元数据，旧数据回退到关键帧字段扫描，返回
  // { cardKey: controllerId }。同一卡片被多个控制器写入时以第一条轨道为准。
  function controllerCardOwners() {
    const owners = {};
    for (const c of (state.storyboard.controllers || [])) {
      const meta = new Set((state.controllerCards && state.controllerCards[c.id]) || []);
      for (const card of Schema.CONTROLLER_CARDS) {
        if (owners[card.key] != null) continue;
        if (meta.has(card.key) || controllerCardFramesClaimed(c, card)) owners[card.key] = c.id;
      }
    }
    return owners;
  }

  // 某控制器轨道启用的卡片 key 列表（元数据 + 字段回退）。
  function enabledCardsForTrack(controllerId) {
    const c = findRawObject(controllerId);
    if (!c) return [];
    const meta = new Set((state.controllerCards && state.controllerCards[controllerId]) || []);
    const out = [];
    for (const card of Schema.CONTROLLER_CARDS) {
      if (meta.has(card.key) || controllerCardFramesClaimed(c, card)) out.push(card.key);
    }
    return out;
  }

  // 以一组属性卡片创建新的 controller 轨道（当前播放头时间）；开关类卡片
  // 同时写入显式 true，让对应设置立即生效。
  function createControllerWithCards(cardKeys, time) {
    if (!state.storyboard) { toast('请先打开项目', true); return null; }
    const valid = (cardKeys || []).filter((k) => Schema.CONTROLLER_CARDS.some((c) => c.key === k));
    if (!valid.length) { toast('请至少选择一个属性卡片', true); return null; }
    const owners = controllerCardOwners();
    const taken = valid.filter((k) => owners[k] != null);
    if (taken.length) {
      toast('部分卡片已被其它控制器轨道启用，不能重复引用', true);
      return null;
    }
    snapshot();
    const id = uniqueId('controller');
    const obj = { id, time: time != null ? time : preview.time };
    state.controllerCards = state.controllerCards || {};
    state.controllerCards[id] = valid.slice();
    for (const k of valid) {
      const card = Schema.CONTROLLER_CARDS.find((c) => c.key === k);
      if (card && card.toggle) obj[card.toggle] = true;
    }
    state.storyboard.controllers = state.storyboard.controllers || [];
    state.storyboard.controllers.push(obj);
    state.selectedObjId = id;
    state.selectedKeyIdx = -1;
    state.selectedIds = [id];
    state.selectedKfs = [];
    state.selectedLane = null;
    state.pendingNote = null;
    state.previewEmptyFocus = false;
    state.dirty = true;
    refreshAll();
    toast(__t('已在 Controller 轨道 ') + id + __t('中启用 ') + valid.length + __t(' 个属性卡片'));
    return obj;
  }

  // 从某控制器轨道删除一张卡片：清空该卡片在所有关键帧中的 storyboard
  // 条目；若删除后该轨道无剩余启用卡片，则自动删除整条轨道。
  function deleteCardFromTrack(card, ownerId) {
    const entry = findObjectEntry(ownerId);
    if (!entry || entry.type !== 'controller') return;
    snapshot();
    const obj = entry.obj;
    const keys = [card.toggle, ...card.fields].filter(Boolean);
    for (const frame of [obj, ...(obj.states || [])]) {
      for (const k of keys) delete frame[k];
    }
    if (state.controllerCards && state.controllerCards[ownerId]) {
      state.controllerCards[ownerId] = state.controllerCards[ownerId].filter((k) => k !== card.key);
      if (!state.controllerCards[ownerId].length) delete state.controllerCards[ownerId];
    }
    state.dirty = true;
    const remaining = enabledCardsForTrack(ownerId);
    if (!remaining.length) {
      state.storyboard.controllers = (state.storyboard.controllers || []).filter((c) => c.id !== ownerId);
      if (state.selectedObjId === ownerId) {
        state.selectedObjId = null;
        state.selectedKeyIdx = null;
        state.selectedIds = [];
        state.previewEmptyFocus = true;
      }
      toast(__t('已删除「') + card.label + __t('」'));
    } else {
      toast(__t('已删除「') + card.label + __t('」'));
    }
    refreshAll();
  }

  // 跳转到启用该卡片的控制器轨道（选中并在时间轴高亮）。
  function jumpToControllerTrack(ownerId) {
    if (!findRawObject(ownerId)) return;
    selectObject(ownerId, null);
  }

  // 卡片右键菜单：未启用 → 启用（创建新轨道）；已启用 → 删除 / 跳转。
  function onControllerCardContextMenu(card, ownerId, x, y) {
    if (ownerId == null) {
      showContextMenu(x, y, [
        { label: __t('启用「') + card.label + __t('」'), action: () => createControllerWithCards([card.key], preview.time) }
      ]);
    } else {
      const items = [
        { label: __t('删除「') + card.label + __t('」'), danger: true, action: () => deleteCardFromTrack(card, ownerId) },
        { label: '跳转至对应轨道', action: () => jumpToControllerTrack(ownerId) }
      ];
      // 选中 controller 轨道时：可把该属性（含关键帧）整体拆分到新轨道。
      if (state.selectedObjId === ownerId) {
        items.splice(1, 0, {
          label: __t('拆分「') + card.label + __t('」至新轨道'),
          action: () => splitCardToNewTrack(card, ownerId)
        });
      }
      showContextMenu(x, y, items);
    }
  }

  // 对象库“+”号添加 Controller：弹出可用（未被其它轨道占用）卡片多选窗口。
  // 可勾选多选的 controller 属性卡片选择窗口（对象库 + 号 / 轨道添加属性共用）。
  function openControllerCardPicker(title, hint, available, onPick, confirmLabel) {
    const rows = available.length
      ? available.map((c) =>
          `<label class="cc-add-row"><input type="checkbox" class="cc-add-cb" data-card="${c.key}">` +
          `<span>${escapeHtml(c.label)}</span></label>`).join('')
      : '<div class="help-text">所有属性卡片都已被其它控制器轨道占用，没有可用卡片。</div>';
    openModal(title,
      `<div class="help-text">${hint}</div><div class="cc-add-list">${rows}</div>`,
      [{ label: '取消' }, { label: confirmLabel || '确定', cls: 'primary' }],
      (btn) => {
        if (btn.label !== (confirmLabel || '确定')) return;
        const picked = Array.from(document.querySelectorAll('#modalBody .cc-add-cb:checked')).map((el) => el.dataset.card);
        if (!picked.length) { toast('请至少选择一个属性卡片', true); return; }
        onPick(picked);
      });
  }

  // 对象库“+”号添加 Controller：选择未被其它轨道占用的卡片，创建新轨道。
  function promptAddController() {
    if (!state.storyboard) { toast('请先打开项目', true); return; }
    const owners = controllerCardOwners();
    const available = Schema.CONTROLLER_CARDS.filter((c) => owners[c.key] == null);
    openControllerCardPicker('添加 Controller 对象',
      __t('选择要在此新轨道上启用的属性卡片（可多选，一次在同一个轨道内启用多个卡片）。未被其它轨道占用的卡片才可选用。'),
      available, (picked) => createControllerWithCards(picked, preview.time), '创建');
  }

  // 轨道面板底部“添加controller属性”：给选定的轨道分配一个或多个新卡片。
  function promptAssignCardsToTrack(trackId) {
    if (!state.storyboard) { toast('请先打开项目', true); return; }
    const owners = controllerCardOwners();
    const available = Schema.CONTROLLER_CARDS.filter((c) => owners[c.key] == null);
    openControllerCardPicker('添加 Controller 属性',
      __t('选择要分配给当前轨道的新属性卡片（可多选）。已被任何轨道（含当前轨道）占用的卡片不会列出。'),
      available, (picked) => assignCardsToTrack(trackId, picked), '分配');
  }

  // 把选中的卡片分配给现有轨道：写入启用元数据，开关类卡片在 K0 写入 true。
  function assignCardsToTrack(trackId, cardKeys) {
    const entry = findObjectEntry(trackId);
    if (!entry || entry.type !== 'controller') return;
    const valid = (cardKeys || []).filter((k) => Schema.CONTROLLER_CARDS.some((c) => c.key === k));
    if (!valid.length) { toast('请至少选择一个属性卡片', true); return; }
    const owners = controllerCardOwners();
    const taken = valid.filter((k) => owners[k] != null);
    if (taken.length) {
      toast('部分卡片已被其它控制器轨道启用，不能重复引用', true);
      return;
    }
    snapshot();
    const obj = entry.obj;
    state.controllerCards = state.controllerCards || {};
    const cur = state.controllerCards[trackId] || [];
    const next = cur.slice();
    for (const k of valid) if (!next.includes(k)) next.push(k);
    state.controllerCards[trackId] = next;
    for (const k of valid) {
      const card = Schema.CONTROLLER_CARDS.find((c) => c.key === k);
      if (card && card.toggle && obj[card.toggle] === undefined) obj[card.toggle] = true;
    }
    state.dirty = true;
    refreshAll();
    toast(__t('已为轨道 ') + trackId + __t(' 分配 ') + valid.length + __t(' 个属性卡片'));
  }

  // 工具：修复扫描线变速事件颜色。原版引擎会在变速事件时自动把扫描线染成
  // 事件色（SpeedUp 红 / SpeedDown 青，1s 淡入 → 3s 保持 → 1s 淡出），但
  // 用户写的“一直生效”的 scanline_color controller 会覆盖它。这里把这段
  // 变色序列以 controller 关键帧的形式固定下来：变速事件时段按原版变色，
  // 其余时段回到用户 controller 的基准色。
  function fixScanlineEventColors() {
    if (!state.storyboard || !state.chart) { toast('请先打开项目', true); return; }
    const ch = state.chart;
    const events = (ch.events || []).filter((ev) => ev.type === 0 || ev.type === 1);
    if (!events.length) { toast('谱面中没有显式变速事件（SpeedUp / SpeedDown）', true); return; }
    events.sort((a, b) => a.time - b.time);
    // 基准色：当前（不含修复 controller）合并结果里的 scanline_color，无则白。
    let base = { r: 1, g: 1, b: 1, a: 1 };
    try {
      preview.evaluate(events[0].time);
      if (preview.mergedCtrl && preview.mergedCtrl.scanline_color) base = preview.mergedCtrl.scanline_color;
    } catch (e) { /* 保持默认白 */ }
    const baseHex = Schema.colorToHex(base);
    const kfs = [];
    for (const ev of events) {
      let target = null;
      try {
        const p = ch.eventPresentationAt(ev.time);
        if (p && p.targetColor) target = p.targetColor;
      } catch (e) {}
      if (!target) {
        target = ev.type === 0
          ? { r: 0.82352, g: 0.33725, b: 0.41176, a: 1 }   // SpeedUp 红
          : { r: 0.6289, g: 0.78125, b: 0.75, a: 1 };      // SpeedDown 青
      }
      const targetHex = Schema.colorToHex(target);
      // 与 chart.js PRESENT_* 一致：1s 淡入、3s 保持、1s 淡出。
      kfs.push({ time: ev.time, scanline_color: baseHex });
      kfs.push({ time: ev.time + 1, scanline_color: targetHex });
      kfs.push({ time: ev.time + 4, scanline_color: targetHex });
      kfs.push({ time: ev.time + 5, scanline_color: baseHex });
    }
    kfs.sort((a, b) => a.time - b.time);
    const states = [];
    for (const k of kfs) {
      const last = states[states.length - 1];
      if (last && Math.abs(last.time - k.time) < 1e-6) last.scanline_color = k.scanline_color;
      else states.push({ time: k.time, scanline_color: k.scanline_color });
    }
    snapshot();
    // 重复执行时替换旧修复 controller（id 前缀识别），避免累积。
    const old = (state.storyboard.controllers || []).filter((c) => String(c.id).startsWith('ctl_scanline_fix'));
    state.storyboard.controllers = (state.storyboard.controllers || []).filter((c) => !old.includes(c));
    if (state.controllerCards) for (const o of old) delete state.controllerCards[o.id];
    // 固定 id：重复执行时直接替换旧修复 controller。
    const id = 'ctl_scanline_fix';
    const obj = { id, time: 0, scanline_color: baseHex, states };
    state.storyboard.controllers.push(obj); // 追加到末尾：合并时后写覆盖，保证生效
    state.controllerCards = state.controllerCards || {};
    state.controllerCards[id] = ['scanline_color'];
    state.dirty = true;
    refreshAll();
    toast(__t('已生成扫描线变速事件颜色修复 controller：') + id + __t('（覆盖 ') + events.length + __t(' 个变速事件）'));
  }

  // 拆分：把当前轨道中该卡片的数值（连带对应关键帧）整体移动到一条新轨道。
  // 源轨道若拆分后无剩余启用卡片则自动删除。
  function splitCardToNewTrack(card, ownerId) {
    const entry = findObjectEntry(ownerId);
    if (!entry || entry.type !== 'controller') return;
    const obj = entry.obj;
    const keys = [card.toggle, ...card.fields].filter(Boolean);
    const k0 = {};
    let hasK0 = false;
    for (const k of keys) {
      if (obj[k] !== undefined) { k0[k] = obj[k]; hasK0 = true; }
    }
    const states = [];
    for (const st of (obj.states || [])) {
      if (!keys.some((k) => st[k] !== undefined)) continue;
      const clone = {};
      for (const k of Object.keys(st)) {
        if (k === 'time' || k === 'easing' || k === 'destroy' || keys.includes(k)) clone[k] = st[k];
      }
      states.push(clone);
    }
    if (!hasK0 && !states.length) {
      toast(__t('「') + card.label + __t('」在当前轨道没有已设置的关键帧'), true);
      return;
    }
    snapshot();
    const newId = uniqueId('controller');
    const newObj = { id: newId, time: obj.time };
    if (hasK0) {
      for (const k of Object.keys(k0)) newObj[k] = k0[k];
    }
    if (states.length) newObj.states = states;
    // 从源轨道移除该卡片的全部 storyboard 条目，清理只剩 time 的空关键帧。
    for (const k of keys) delete obj[k];
    if (Array.isArray(obj.states)) {
      for (const st of obj.states) for (const k of keys) delete st[k];
      obj.states = obj.states.filter((st) => Object.keys(st).some((k) => k !== 'time'));
    }
    state.storyboard.controllers = state.storyboard.controllers || [];
    state.storyboard.controllers.push(newObj);
    state.controllerCards = state.controllerCards || {};
    state.controllerCards[ownerId] = (state.controllerCards[ownerId] || []).filter((k) => k !== card.key);
    if (!state.controllerCards[ownerId].length) delete state.controllerCards[ownerId];
    state.controllerCards[newId] = [card.key];
    sortObjectStates(newObj);
    let srcDeleted = false;
    if (!enabledCardsForTrack(ownerId).length) {
      state.storyboard.controllers = state.storyboard.controllers.filter((c) => c.id !== ownerId);
      srcDeleted = true;
    }
    state.selectedObjId = newId;
    state.selectedKeyIdx = -1;
    state.selectedIds = [newId];
    state.selectedKfs = [];
    state.selectedLane = null;
    state.previewEmptyFocus = false;
    state.dirty = true;
    refreshAll();
    toast(srcDeleted
      ? __t('已拆分「') + card.label + __t('」至新轨道 ') + newId + __t('（源轨道已空，自动删除）')
      : __t('已拆分「') + card.label + __t('」至新轨道 ') + newId);
  }

  // Drop a controller option card onto the timeline: write the card's block
  // into a keyframe at the given time (merge into an existing keyframe there
  // or create a new one) for the currently selected controller.
  function addControllerCardAtTime({ groupKey, values, time }) {
    if (!state.storyboard) return;
    const entry = state.selectedObjId ? findObjectEntry(state.selectedObjId) : null;
    if (!entry || entry.type !== 'controller') {
      // 与拖入预览画面一致：未选中控制器时，在播放头位置直接创建新的
      // controller 轨道并启用该卡片。
      const card = Schema.CONTROLLER_CARDS.find((c) => c.key === groupKey);
      if (!card) return;
      const owners = controllerCardOwners();
      if (owners[card.key] != null) {
        toast('该卡片已被其它控制器轨道启用，不能重复引用', true);
        return;
      }
      createControllerWithCards([card.key], preview.time);
      return;
    }
    const card = Schema.CONTROLLER_CARDS.find((c) => c.key === groupKey);
    if (!card) return;
    const obj = entry.obj;
    // 卡片唯一性：已被其它控制器轨道引用时拒绝重复引用。
    const ownerId = controllerCardOwners()[card.key];
    if (ownerId != null && ownerId !== obj.id) {
      toast(__t('「') + card.label + __t('」已被其他controller轨道使用，不能在多轨道重复引用'), true);
      return;
    }
    snapshot();
    let st = (obj.states || []).find((s) => {
      const t = resolveTime(s.time);
      return t != null && Math.abs(t - time) < 1e-6;
    });
    if (!st) {
      st = { time };
      obj.states = obj.states || [];
      obj.states.push(st);
    } else {
      st.time = time;
    }
    const apply = {};
    if (card.toggle) apply[card.toggle] = values[card.toggle] === undefined ? true : values[card.toggle];
    for (const k of card.fields) {
      if (values[k] !== undefined) apply[k] = values[k];
    }
    for (const k of Object.keys(apply)) setStateField(st, k, apply[k]);
    // 卡片写入关键帧后同步标记为该轨道启用（唯一归属元数据）。
    state.controllerCards = state.controllerCards || {};
    const cur = state.controllerCards[obj.id] || [];
    if (!cur.includes(card.key)) state.controllerCards[obj.id] = [...cur, card.key];
    sortObjectStates(obj);
    state.selectedObjId = obj.id;
    state.selectedKeyIdx = obj.states.indexOf(st);
    state.dirty = true;
    setTime(time, false);
    dirtyAndRefresh();
    toast(__t('已添加「') + card.label + __t('」关键帧 @ ') + fmtTime(time));
  }

  // Add an object of the given category from the left-panel "对象" section,
  // placed at the current playhead time.
  function addObjectFromTag(key) {
    if (!state.storyboard) { toast('请先打开项目', true); return; }
    const type = GROUP_TYPES[key] || 'sprite';
    // Controller 对象只能携带已启用的属性卡片：弹出多选窗口选择。
    if (type === 'controller') { promptAddController(); return; }
    // A sprite without an image can never render; require a library asset.
    if (type === 'sprite' && !(state.manualImages || []).length) {
      toast('素材库中没有文件，请先添加素材', true);
      return;
    }
    snapshot();
    const id = uniqueId(type);
    const t = preview.time;
    const obj = { id, time: t };
    // stage 对象新建时直接落在最上层的一条新轨道。
    const top = ['sprite', 'text', 'video', 'line'].includes(type) ? topStagePlacement() : null;
    if (type === 'sprite') {
      obj.path = state.manualImages[0];
      obj.opacity = 1;
      obj.preserve_aspect = true;
      obj.x = 'stagex:0';
      obj.y = 'stagey:0';
      obj.layer = top.layer;
      obj.order = top.order;
    } else if (type === 'text') {
      obj.text = 'Hello Cytoid!';
      obj.opacity = 1;
      obj.x = 'stagex:0';
      obj.y = 'stagey:0';
      obj.layer = top.layer;
      obj.order = top.order;
    } else if (type === 'line') {
      obj.opacity = 1;
      obj.pos = [{ x: 0, y: 0 }, { x: 1, y: 0 }];
      obj.width = 0.05;
      obj.layer = top.layer;
      obj.order = top.order;
    } else if (type === 'video') {
      obj.path = '';
      obj.opacity = 1;
      obj.x = 'stagex:0';
      obj.y = 'stagey:0';
      obj.layer = top.layer;
      obj.order = top.order;
    } else if (type === 'note_controller') {
      obj.note = 0;
    }
    state.storyboard[key] = state.storyboard[key] || [];
    state.storyboard[key].push(obj);
    // 已有合并布局时：把新对象作为一条单独轨道插入最上层，并重新排序。
    const merged = readCysterStageLanes();
    if (merged && top) {
      // 新对象排在合并轨道最前，重排后保持最上层最顶。
      merged.unshift([obj.id]);
      renumberStageLanes(merged);
      setCysterStageLanes(merged);
    }
    state.selectedObjId = id;
    state.selectedKeyIdx = -1;
    state.dirty = true;
    refreshAll();
    toast('已添加 ' + Schema.SCHEMAS[type].label + ': ' + id);
  }

  // ---------------------------------------------------------------
  // Modal
  // ---------------------------------------------------------------
  function openModal(title, bodyHtml, buttons, onAction) {
    if (window.SBi18n) {
      title = window.SBi18n.t(title);
      // 按钮显示用翻译后的文字，但保留原始标签（_origLabel）供回调/调用方按
      // 中文标签做分支判断（如 choice === '取消'），否则切语言后流程全部断裂。
      buttons = (buttons || []).map((b) => Object.assign({}, b, {
        label: window.SBi18n.t(b.label),
        _origLabel: b.label
      }));
    }
    $('#modalTitle').textContent = title;
    $('#modalBody').innerHTML = bodyHtml;
    const foot = $('#modalFoot');
    foot.innerHTML = '';
    for (const b of buttons) {
      const btn = document.createElement('button');
      btn.className = 'dlg-btn' + (b.cls ? ' ' + b.cls : '');
      btn.textContent = b.label;
      btn.addEventListener('click', () => {
        closeModal();
        if (onAction) onAction({ ...b, label: b._origLabel != null ? b._origLabel : b.label });
      });
      foot.appendChild(btn);
    }
    $('#modalMask').classList.remove('hidden');
  }

  function closeModal() {
    $('#modalMask').classList.add('hidden');
    $('#modalBox').classList.remove('modal-wide');
  }

  let pendingConfirm = null;
  let pendingChartResolve = null;

  function confirmDialog(title, messageHtml, buttons) {
    return new Promise((resolve) => {
      pendingConfirm = resolve;
      openModal(title, `<div class="help-text">${window.SBi18n ? window.SBi18n.t(messageHtml) : messageHtml}</div>`, buttons, (btn) => {
        pendingConfirm = null;
        resolve(btn.label);
      });
    });
  }

  // ---------------------------------------------------------------
  // Welcome screen & project flows
  // ---------------------------------------------------------------
  let tipIndex = -1; // 当前展示的 tips 下标（-1 = 尚未展示）

  // 随机选一条（与当前不同），避免“换一条”换到同一条。
  function pickRandomTipIndex() {
    const n = (window.CYSTER_TIPS || []).length;
    if (!n) return -1;
    if (n === 1) return 0;
    let i = Math.floor(Math.random() * n);
    if (i === tipIndex) i = (i + 1) % n;
    return i;
  }

  // 内置 Tips 小浮窗：每次进入欢迎页随机展示一条。
  function showRandomTip() {
    const box = $('#welcomeTip');
    if (!box) return;
    const tips = window.CYSTER_TIPS || [];
    if (!tips.length) {
      box.style.display = 'none';
      return;
    }
    box.style.display = '';
    tipIndex = pickRandomTipIndex();
    const tip = tips[Math.max(0, tipIndex)];
    const title = $('#welcomeTipTitle');
    const body = $('#welcomeTipBody');
    if (title) title.textContent = window.SBi18n ? window.SBi18n.t(tip.title || 'Tips:') : (tip.title || 'Tips:');
    if (body) {
      body.textContent = window.SBi18n ? window.SBi18n.t(tip.body || '') : (tip.body || '');
      body.classList.remove('switching');
      void body.offsetWidth; // 重启切换动画
      body.classList.add('switching');
    }
  }

  // ---- 在线更新：手动检查 + 后台更新事件提示 ----
  let updateChecking = false;

  // 切换语言并全量刷新界面（设置面板与欢迎页下拉共用）。
  function applyLanguage(l) {
    if (!window.SBi18n) return;
    window.SBi18n.setLanguage(l, true);
    window.SBi18n.applyStatic(document);
    window.SBi18n.localizeSchema();
    if (window.sbAPI && window.sbAPI.notifyLanguageChanged) window.sbAPI.notifyLanguageChanged(l);
    renderProperties();
    renderObjectTree();
    renderTimeline();
    showWelcome();
    const mb = document.getElementById('modalBox');
    if (mb) window.SBi18n.applyStatic(mb);
    const wl = $('#welcomeLang');
    if (wl) wl.value = l;
    const sl = $('#setLanguage');
    if (sl) sl.value = l;
    toast(window.SBi18n.t('语言已切换'));
  }

  async function manualUpdateCheck() {
    if (updateChecking) return;
    updateChecking = true;
    try {
      const r = await window.sbAPI.updateCheck();
      if (!r) return;
      if (r.dev) { toast('当前为开发模式，不进行在线更新检查'); return; }
      if (!r.ok) {
        toast((window.SBi18n ? window.SBi18n.t('检查更新失败：') : '检查更新失败：') + (r.error || '未知错误'), true);
        return;
      }
      if (r.upToDate) toast((window.SBi18n ? window.SBi18n.t('已是最新版本（v') : '已是最新版本（v') + r.current + '）');
      else toast((window.SBi18n ? window.SBi18n.t('发现新版本 v') : '发现新版本 v') + r.available + (window.SBi18n ? window.SBi18n.t('，正在后台下载…') : '，正在后台下载…'));
    } catch (e) {
      toast((window.SBi18n ? window.SBi18n.t('检查更新失败：') : '检查更新失败：') + (e && e.message ? e.message : e), true);
    } finally {
      updateChecking = false;
    }
  }

  function wireUpdateEvents() {
    if (!window.sbAPI.onUpdateAvailable) return;
    window.sbAPI.onUpdateAvailable((p) => {
      toast((window.SBi18n ? window.SBi18n.t('发现新版本 v') : '发现新版本 v') + (p && p.version ? p.version : '') + (window.SBi18n ? window.SBi18n.t('，正在后台下载…') : '，正在后台下载…'));
    });
    window.sbAPI.onUpdateProgress(() => {});
    window.sbAPI.onUpdateDownloaded((p) => {
      confirmDialog('更新已就绪', __t('新版本 v') + (p && p.version ? p.version : '') + __t('已下载完成，重启后即可安装。'), [
        { label: '稍后', cls: '' },
        { label: '立即重启安装', cls: 'primary' }
      ]).then((choice) => {
        if (choice === '立即重启安装') window.sbAPI.updateInstall();
      });
    });
  }

  function showWelcome() {
    renderRecentProjects();
    const h = new Date().getHours();
    const greet = h < 6 ? '夜深了' : h < 12 ? '早上好' : h < 18 ? '下午好' : '晚上好';
    const el = $('#welcomeGreeting');
    const greeting = `${greet}，欢迎回来`;
    if (el) el.textContent = window.SBi18n ? window.SBi18n.t(greeting) : greeting;
    document.body.classList.add('welcome-mode');
    showRandomTip();
    const manage = $('#welcomeManage');
    if (manage) manage.classList.toggle('hidden', !state.projectPath);
    updateSwitchDifficultyState();
  }

  function hideWelcome() {
    document.body.classList.remove('welcome-mode');
  }

  function renderRecentProjects() {
    const box = $('#recentProjects');
    const list = state.settings.recentProjects || [];
    if (!list.length) {
      box.innerHTML = '';
      return;
    }
    let html = __t('<div class="recent-title">最近项目</div>');
    for (const p of list) {
      const name = p.split(/[\\/]/).pop().replace(/\.(ctr|ctdsber)$/i, '');
      html += `<div class="recent-item" data-path="${escapeHtml(p)}">
        <span>${svgIcon('folder', 18)}</span>
        <span class="ri-name">${escapeHtml(name)}</span>
        <span class="ri-path">${escapeHtml(p)}</span>
        <span class="ri-actions">
          <button class="ri-btn" data-act="folder">${__t('文件夹')}</button>
          <button class="ri-btn" data-act="copy">${__t('复制路径')}</button>
          <button class="ri-btn" data-act="remove">${__t('移除')}</button>
        </span>
      </div>`;
    }
    box.innerHTML = html;
    for (const item of box.querySelectorAll('.recent-item')) {
      const openProject = async () => {
        try {
          // 与"打开项目"入口一致：包含未保存修改确认与"在哪里打开项目"提示。
          await openProjectFilePath(item.dataset.path);
        } catch (e) {
          toast(__t('打开项目失败: ') + e.message, true);
        }
      };
      item.addEventListener('click', openProject);
      for (const btn of item.querySelectorAll('.ri-btn')) {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const act = btn.dataset.act;
          const p = item.dataset.path;
          if (act === 'folder') {
            window.sbAPI.openPath(p.replace(/[\\/][^\\/]+\.(ctr|ctdsber)$/i, '')).catch(() => toast('无法打开文件夹', true));
          } else if (act === 'copy') {
            try {
              await navigator.clipboard.writeText(p);
              toast('已复制项目路径');
            } catch (e) {
              toast('复制失败', true);
            }
          } else if (act === 'remove') {
            state.settings.recentProjects = (state.settings.recentProjects || []).filter((x) => x !== p);
            window.sbAPI.setSettings(state.settings).catch(() => {});
            renderRecentProjects();
          }
        });
      }
    }
  }

  function addRecentProject(path) {
    const list = (state.settings.recentProjects || []).filter((p) => p !== path);
    list.unshift(path);
    state.settings.recentProjects = list.slice(0, 6);
    window.sbAPI.setSettings(state.settings).catch(() => {});
  }

  function newProjectFlow() {
    const sel = { music: null, chart: null, background: null, storyboard: null };
    const body = `
      <div class="pick-row"><label>${__t('项目名称')}</label><input type="text" id="pjName" placeholder="${__t('例如：My Storyboard Level')}" /></div>
      <div class="pick-row"><label>${__t('关卡ID')}</label><input type="text" id="pjLevelId" placeholder="charter.title" /></div>
      <div class="pick-hint">${__t('只包含小写字母、数字、下划线、短横杠和点；留空则根据项目名称自动生成')}</div>
      <div class="pick-row"><label>${__t('音乐')}</label><input type="text" id="pjMusic" placeholder="${__t('未选择')}" readonly /><button class="mini-btn" data-kind="music">${__t('选择')}</button></div>
      <div class="pick-hint">${__t('支持 .mp3 / .ogg / .wav / .wma / .aac（必选）')}</div>
      <div class="pick-row"><label>${__t('谱面')}</label><input type="text" id="pjChart" placeholder="${__t('未选择')}" readonly /><button class="mini-btn" data-kind="chart">${__t('选择')}</button></div>
      <div class="pick-hint">${__t('支持 .txt / .json（必选，Cytoid 谱面格式）')}</div>
      <div class="pick-row"><label>${__t('背景')}</label><input type="text" id="pjBg" placeholder="${__t('未选择（可选）')}" readonly /><button class="mini-btn" data-kind="background">${__t('选择')}</button></div>
      <div class="pick-hint">${__t('支持 .png / .jpg / .jpeg')}</div>
      <div class="pick-row"><label>${__t('StoryBoard')}</label><input type="text" id="pjSb" placeholder="${__t('未选择（可选）')}" readonly /><button class="mini-btn" data-kind="storyboard">${__t('选择')}</button></div>
      <div class="pick-hint">${__t('支持 .json；未选择将创建空白 StoryBoard')}</div>
      <div class="help-text">${__t('创建项目后，所选文件会被复制到项目文件夹（.ctr 所在目录），并生成 level.json。')}</div>`;
    openModal('新建 Cyster 项目', body, [
      { label: '取消', cls: '' },
      { label: '创建项目', cls: 'primary' }
    ], async (btn) => {
      if (btn.label !== '创建项目') return;
      const name = $('#pjName').value.trim() || __t('未命名项目');
      if (!sel.music || !sel.chart) { toast('请选择音乐与谱面', true); return; }
      const projectPath = await window.sbAPI.saveProjectAs(name + '.ctr');
      if (!projectPath) return;
      // A project is already open: ask where to create it (Cylheim-style)
      if (state.projectPath) {
        // 有未保存修改时：未保存确认弹窗已让用户确认丢弃/保存并继续，
        // 不再重复弹“在哪里创建项目”的二次确认。
        const hadUnsaved = !!(state.dirty && state.projectPath);
        if (!(await confirmDiscardUnsaved('切换项目'))) return;
        if (!hadUnsaved) {
          const choice = await confirmDialog(
            '在哪里创建项目？',
            '当前窗口已经打开了一个项目。你可以在本窗口创建（将关闭当前项目），或取消这次操作。',
            [
              { label: '取消', cls: '' },
              { label: '关闭当前项目并创建', cls: 'primary' }
            ]
          );
          if (!choice) return;
        }
      }
      // Target project file already exists: open / overwrite / cancel (Cylheim-style)
      if (await window.sbAPI.projectExists({ path: projectPath })) {
        const choice = await confirmDialog(
          '项目文件已存在',
          '你选择的项目文件已经存在。你可以直接打开已有项目、覆盖为新的空项目，或者取消这次操作。',
          [
            { label: '取消', cls: '' },
            { label: '打开已有项目', cls: '' },
            { label: '覆盖为新项目', cls: 'primary' }
          ]
        );
        if (!choice) return;
        if (choice === '打开已有项目') {
          try {
            const res = await window.sbAPI.projectOpen({ path: projectPath });
            if (res) await loadLevelInfo(res.info, { projectPath: res.projectPath, config: res.config });
          } catch (e) {
            toast(__t('打开项目失败: ') + e.message, true);
          }
          return;
        }
      }
      try {
        const res = await window.sbAPI.projectCreate({
          projectPath,
          name,
          music: sel.music,
          chart: sel.chart,
          background: sel.background,
          storyboard: sel.storyboard,
          chartType: 'easy',
          levelId: ($('#pjLevelId').value || '').trim()
        });
        await loadLevelInfo(res.info, { projectPath: res.projectPath, config: res.config });
        toast(__t('项目已创建: ') + projectPath);
      } catch (e) {
        toast(__t('创建项目失败: ') + e.message, true);
      }
    });
    const filters = {
      music: { title: __t('选择音乐文件'), filters: [{ name: __t('音频'), extensions: ['mp3', 'ogg', 'wav', 'wma', 'aac', 'acc'] }] },
      chart: { title: __t('选择谱面文件'), filters: [{ name: __t('谱面'), extensions: ['txt', 'json'] }] },
      background: { title: __t('选择背景图片'), filters: [{ name: __t('图片'), extensions: ['png', 'jpg', 'jpeg'] }] },
      storyboard: { title: __t('选择 StoryBoard 文件'), filters: [{ name: 'StoryBoard', extensions: ['json'] }] }
    };
    $('#modalBody').querySelectorAll('.pick-row .mini-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const kind = btn.dataset.kind;
        const p = await window.sbAPI.pickFile(filters[kind]);
        if (!p) return;
        sel[kind] = p;
        const input = { music: '#pjMusic', chart: '#pjChart', background: '#pjBg', storyboard: '#pjSb' }[kind];
        $(input).value = p;
      });
    });
  }

  async function openProjectFlow() {
    const path = await window.sbAPI.pickFile({
      title: __t('打开 Cyster 项目'),
      filters: [{ name: 'Cyster 项目', extensions: ['ctr', 'ctdsber'] }]
    });
    if (!path) return;
    try {
      await openProjectFilePath(path);
    } catch (e) {
      toast(__t('打开项目失败: ') + e.message, true);
    }
  }

  // 切换/关闭当前项目前，若有未保存修改则先确认（效果类似退出软件时的提示）。
  // 返回 true 表示可以继续切换，false 表示用户取消。
  async function confirmDiscardUnsaved(actionLabel) {
    if (!state.dirty || !state.projectPath) return true;
    const p = (n) => String(n).padStart(2, '0');
    const lastText = state.lastSavedAt
      ? `${state.lastSavedAt.getFullYear()}-${p(state.lastSavedAt.getMonth() + 1)}-${p(state.lastSavedAt.getDate())} ${p(state.lastSavedAt.getHours())}:${p(state.lastSavedAt.getMinutes())}`
      : __t('从未保存');
    const body = state.lastSavedAt
      ? `${__t('最后一次保存在')}${lastText}${__t('，')}${__t(actionLabel)}${__t('会遗失自最后一次保存以来的所有内容。')}`
      : `${__t('从未保存')}${__t('，')}${__t(actionLabel)}${__t('会遗失自最后一次保存以来的所有内容。')}`;
    const choice = await confirmDialog(
      '有未保存的修改',
      body,
      [
        { label: '取消', cls: '' },
        { label: '不保存', cls: '' },
        { label: '保存并继续', cls: 'primary' }
      ]
    );
    if (!choice || choice === '取消') return false;
    if (choice === '保存并继续') {
      const ok = await saveStoryboard();
      if (!ok) return false;
    }
    return true;
  }

  // 图片/视频路径是整块统一的属性：任一关键帧修改后同步到该对象本体及
  // 全部关键帧（默认同步，不再有“只能 K0 改”的特殊设定）。
  function syncPathAcrossFrames(obj, value) {
    if (!obj) return;
    if (value === undefined) {
      delete obj.path;
      for (const st of obj.states || []) delete st.path;
    } else {
      obj.path = value;
      for (const st of obj.states || []) st.path = value;
    }
  }

  // 通用对象级唯一字段同步（order / layer 等）：改动后写满对象本体与全部关键帧。
  function syncObjectField(obj, key, value) {
    if (!obj) return;
    if (value === undefined) {
      delete obj[key];
      for (const st of obj.states || []) delete st[key];
    } else {
      obj[key] = value;
      for (const st of obj.states || []) st[key] = value;
    }
  }

  // CytoidPlayer 生成顺序：NoteController → Text → Sprite → Line → Video →
  // Controller，且同组内按数组顺序逐个注册，父/目标必须已先注册。编辑与导出
  // 时把同组内“父/目标先于子”的拓扑顺序落回数组，避免 parent_id 不存在报错。
  const PLAYER_SPAWN_ORDER = { note_controller: -1, text: 0, sprite: 1, line: 2, video: 3, controller: 4 };

  function sortStageObjectsParentFirst() {
    if (!state.storyboard) return;
    const groups = ['sprites', 'texts', 'videos', 'lines', 'controllers', 'note_controllers'];
    const byId = new Map();
    for (const g of groups) {
      for (const o of state.storyboard[g] || []) byId.set(String(o.id), { obj: o, group: g });
    }
    for (const g of groups) {
      const list = state.storyboard[g];
      if (!Array.isArray(list) || list.length < 2) continue;
      const visited = new Set();
      const temp = new Set();
      const out = [];
      const visit = (o) => {
        if (visited.has(o)) return;
        if (temp.has(o)) return; // 环保护：保持原顺序，避免死循环
        temp.add(o);
        for (const k of ['parent_id', 'target_id']) {
          const v = o[k];
          if (v == null) continue;
          const e = byId.get(String(v));
          if (e && e.group === g && e.obj !== o) visit(e.obj);
        }
        temp.delete(o);
        visited.add(o);
        out.push(o);
      };
      for (const o of list) visit(o);
      let changed = false;
      for (let i = 0; i < list.length; i++) {
        if (list[i] !== out[i]) { changed = true; break; }
      }
      if (changed) state.storyboard[g] = out;
    }
  }

  // 校验 parent_id / target_id：目标必须存在；target_id 必须同类型；父类型
  // 在玩家生成顺序中不得晚于子类型（NoteController 不能有父对象）。
  function validateParentTarget(obj, kind, value) {
    if (value == null || String(value).trim() === '') return { ok: true };
    const rid = String(value).trim();
    const entry = findObjectEntry(rid);
    if (!entry) return { ok: false, msg: `${kind === 'parent_id' ? 'Parent' : 'Target'} does not exist: ${rid}` };
    const childEntry = findObjectEntry(obj.id);
    const childType = childEntry && childEntry.type;
    const parentType = entry.type;
    if (kind === 'target_id') {
      if (parentType !== childType) return { ok: false, msg: __t('target_id 必须指向同类型对象（当前是 ') + parentType + __t('）') };
      return { ok: true };
    }
    if (childType === 'note_controller') return { ok: false, msg: 'Note Controller cannot have a Parent' };
    const ci = PLAYER_SPAWN_ORDER[childType] != null ? PLAYER_SPAWN_ORDER[childType] : 99;
    const pi = PLAYER_SPAWN_ORDER[parentType] != null ? PLAYER_SPAWN_ORDER[parentType] : 99;
    if (pi > ci) return { ok: false, msg: `Parent type ${parentType} spawns after ${childType} in the player, invalid` };
    return { ok: true };
  }

  // order 缺省或与同 layer 其他对象重复时，实际层叠由 storyboard 数组顺序决定：
  // 返回该对象的数组位置（1 起）供属性面板显示为只读的灰色提示。
  function orderInfoFor(obj) {
    if (!obj) return null;
    const entry = findObjectEntry(obj.id);
    if (!entry) return null;
    const list = state.storyboard[entry.group] || [];
    const idx = list.indexOf(obj);
    if (idx < 0) return null;
    const layer = obj.layer != null ? obj.layer : 0;
    const eff = obj.order != null ? obj.order : 0;
    const missing = obj.order == null;
    const dup = list.some((o) => {
      if (!o || o === obj) return false;
      return ((o.layer != null ? o.layer : 0) === layer) &&
             ((o.order != null ? o.order : 0) === eff);
    });
    if (!missing && !dup) return null;
    return { auto: true, index: idx + 1 };
  }

  // Shared by the 打开项目 dialog, drag-and-drop and double-click .ctr /
  // .ctdsber files (file association). Opens the project in this window,
  // asking first if another project is already open.
  async function openProjectFilePath(path) {
    if (!path) return;
    if (state.projectPath && state.projectPath !== path) {
      // 有未保存修改时：未保存确认弹窗已让用户确认丢弃/保存并继续，
      // 不再重复弹“在哪里打开项目”的二次确认。
      const hadUnsaved = !!(state.dirty && state.projectPath);
      if (!(await confirmDiscardUnsaved('切换项目'))) return;
      if (!hadUnsaved) {
        const choice = await confirmDialog(
          '在哪里打开项目？',
          '当前窗口已经打开了一个项目。你可以在本窗口打开所选项目（将关闭当前项目），或取消这次操作。',
          [
            { label: '取消', cls: '' },
            { label: '关闭当前项目并打开', cls: 'primary' }
          ]
        );
        if (!choice) return;
      }
    }
    const res = await window.sbAPI.projectOpen({ path });
    if (res) await loadLevelInfo(res.info, { projectPath: res.projectPath, config: res.config });
  }

  async function importLevelFlow() {
    try {
      // Importing a .cytoidlevel ALWAYS creates a brand-new project; it never
      // overwrites the currently open project. The user picks the folder that
      // will contain the new project (named after the level).
      if (state.projectPath && !(await confirmDiscardUnsaved('导入新项目'))) return;
      const res = await window.sbAPI.projectImportLevel();
      if (!res) return;
      await loadLevelInfo(res.info, { projectPath: res.projectPath, config: res.config, mode: 'import-level' });
      toast(__t('已导入 .cytoidlevel 并创建新项目: ') + res.projectPath);
    } catch (e) {
      toast(__t('导入失败: ') + e.message, true);
    }
  }

  // 难度滑条显示语义：0 = “？”（未知）、1–15 = 数值、16 = “15+”
  function difficultyDisplayLabel(v) {
    const n = Number(v);
    if (n >= 16) return '15+';
    if (n <= 0) return '?';
    return String(n);
  }

  // 关卡信息 + 谱面难度编辑：对应 level.json 编辑界面的缺失功能
  // （“转换 Cytus II 3.0 新特性到故事板”按用户要求略过）。
  function projectSettingsFlow() {
    const cfg = state.projectConfig;
    if (!cfg || !state.projectPath) { toast('请先打开或创建项目', true); return; }
    const level = state.level || {};
    const lvlMusic = (level.music && level.music.path) || (cfg.files && cfg.files.music) || '';
    const lvlPreview = (level.music_preview && level.music_preview.path) || '';
    const lvlBg = (level.background && level.background.path) || (cfg.files && cfg.files.background) || '';
    const stdTypes = ['easy', 'hard', 'extreme'];
    const charts = (state.levelCharts || []).map((c) => {
      const t = String(c.type || '').toLowerCase();
      return {
        type: stdTypes.includes(t) ? t : 'easy',
        name: c.name || '',
        difficulty: c.difficulty != null ? c.difficulty : 1,
        path: c.path || '',
        music: c.musicOverride || '',
        storyboard: c.storyboardPath || ''
      };
    });
    // 本次编辑中新选择的文件（绝对路径），保存时由主进程复制进关卡目录。
    const pending = {
      music: null, preview: null, background: null,
      charts: charts.map(() => ({ path: null, music: null, storyboard: null }))
    };
    const esc = (v) => escapeHtml(v == null ? '' : String(v));
    const fileFilters = {
      music: { title: __t('选择音乐文件'), filters: [{ name: __t('音频'), extensions: ['mp3', 'ogg', 'wav', 'wma', 'aac', 'acc'] }] },
      preview: { title: __t('选择歌曲预览文件'), filters: [{ name: __t('音频'), extensions: ['mp3', 'ogg', 'wav', 'wma', 'aac', 'acc'] }] },
      background: { title: __t('选择曲绘图片'), filters: [{ name: __t('图片'), extensions: ['png', 'jpg', 'jpeg'] }] },
      path: { title: __t('选择谱面文件'), filters: [{ name: __t('谱面'), extensions: ['txt', 'json'] }] },
      storyboard: { title: __t('选择 StoryBoard 文件'), filters: [{ name: 'StoryBoard', extensions: ['json'] }] }
    };
    const metaPane = `
      <div class="le-grid">
        <div class="le-field"><label>${__t('版本')}</label><input id="leVersion" type="number" min="1" value="${esc(level.version != null ? level.version : 1)}" /></div>
        <div class="le-field le-span2"><label>${__t('ID')}</label><input id="leId" value="${esc(level.id || '')}" placeholder="charter.title" /></div>
        <div class="le-hint le-span2">${__t('只包含小写字母、数字、下划线、短横杠和点，并至少带有一个点分隔符。示例：charter.title')}</div>
        <div class="le-field"><label>${__t('歌曲标题')}</label><input id="leTitle" value="${esc(level.title || '')}" /></div>
        <div class="le-field"><label>${__t('标题的英文译文')}</label><input id="leTitleLocalized" value="${esc(level.title_localized || '')}" /></div>
        <div class="le-field"><label>${__t('歌曲作者')}</label><input id="leArtist" value="${esc(level.artist || '')}" /></div>
        <div class="le-field"><label>${__t('歌曲作者的英文译文')}</label><input id="leArtistLocalized" value="${esc(level.artist_localized || '')}" /></div>
        <div class="le-field le-span2"><label>${__t('歌曲来源 URL')}</label><input id="leArtistSource" value="${esc(level.artist_source || '')}" /></div>
        <div class="le-field"><label>${__t('曲绘画师名')}</label><input id="leIllustrator" value="${esc(level.illustrator || '')}" /></div>
        <div class="le-field"><label>${__t('曲绘画师名的英文译文')}</label><input id="leIllustratorLocalized" value="${esc(level.illustrator_localized || '')}" /></div>
        <div class="le-field le-span2"><label>${__t('曲绘来源 URL')}</label><input id="leIllustratorSource" value="${esc(level.illustrator_source || '')}" /></div>
        <div class="le-field"><label>${__t('谱面作者')}</label><input id="leCharter" value="${esc(level.charter || '')}" /></div>
        <div class="le-field"><label>${__t('故事板作者')}</label><input id="leStoryboarder" value="${esc(level.storyboarder || '')}" /></div>
      </div>
      <div class="le-files">
        <div class="le-field"><label>${__t('歌曲')}</label><input id="leMusic" readonly value="${esc(lvlMusic)}" /><button class="mini-btn" data-file="music">${__t('选择')}</button></div>
        <div class="le-field"><label>${__t('歌曲预览')}</label><input id="leMusicPreview" readonly value="${esc(lvlPreview)}" placeholder="${__t('无')}" /><button class="mini-btn" data-file="preview">${__t('选择')}</button><button class="mini-btn le-clear" data-clear="preview">×</button></div>
        <div class="le-field"><label>${__t('曲绘')}</label><input id="leBackground" readonly value="${esc(lvlBg)}" placeholder="${__t('无')}" /><button class="mini-btn" data-file="background">${__t('选择')}</button><button class="mini-btn le-clear" data-clear="background">×</button></div>
      </div>`;

    const renderChartsList = () => charts.map((c, i) => `
      <div class="le-chart" data-chart="${i}">
        <div class="le-chart-head">
          <span class="le-chart-title">${__t('难度')} ${i + 1}${c.type ? ' · ' + c.type : ''}</span>
          <button class="le-chart-del" data-del="${i}">${__t('删除此难度')}</button>
        </div>
        <div class="le-grid">
          <div class="le-field"><label>${__t('难度类型')}</label><select data-f="type" data-i="${i}">
            ${stdTypes.map((t) => `<option value="${t}" ${c.type === t ? 'selected' : ''}>${t}</option>`).join('')}
          </select></div>
          <div class="le-field"><label>${__t('难度名称')}</label><input data-f="name" data-i="${i}" value="${esc(c.name)}" placeholder="${__t('可选')}" /></div>
          <div class="le-field"><label>${__t('谱面文件')}</label><input data-f="path" data-i="${i}" readonly value="${esc(c.path)}" /><button class="mini-btn" data-pick="path" data-i="${i}">${__t('选择')}</button></div>
          <div class="le-field"><label>${__t('替换歌曲')}</label><input data-f="music" data-i="${i}" readonly value="${esc(c.music)}" placeholder="${__t('跟随关卡音乐')}" /><button class="mini-btn" data-pick="music" data-i="${i}">${__t('选择')}</button><button class="mini-btn le-clear" data-clear="music" data-i="${i}">×</button></div>
          <div class="le-field"><label>${__t('难度')}</label><input class="le-slider" type="range" min="0" max="16" step="1" data-f="difficulty" data-i="${i}" value="${esc(c.difficulty)}" /><span class="le-diff-label" data-difflabel="${i}">${difficultyDisplayLabel(c.difficulty)}</span></div>
          <div class="le-field"><label>${__t('故事板')}</label><input data-f="storyboard" data-i="${i}" readonly value="${esc(c.storyboard)}" placeholder="${__t('无')}" /><button class="mini-btn" data-pick="storyboard" data-i="${i}">${__t('选择')}</button><button class="mini-btn le-clear" data-clear="storyboard" data-i="${i}">×</button></div>
        </div>
      </div>`).join('') || __t('<div class="help-text">暂无谱面</div>');

    const chartsPane = `
      <div id="leChartsList">${renderChartsList()}</div>
      <div class="le-add-wrap"><button id="leAddChart" class="le-add">＋ ${__t('添加谱面')}</button></div>`;

    const body = `
      <div class="le-editor">
        <div class="le-tabs">
          <button class="le-tab active" data-tab="meta">${__t('关卡信息')}</button>
          <button class="le-tab" data-tab="charts">${__t('谱面难度')}</button>
        </div>
        <div class="le-pane" data-pane="meta">${metaPane}</div>
        <div class="le-pane hidden" data-pane="charts">${chartsPane}</div>
      </div>`;

    $('#modalTitle').textContent = __t('关卡设置');
    $('#modalBody').innerHTML = body;
    $('#modalFoot').innerHTML = `
      <button class="dlg-btn" id="leClose">${__t('关闭')}</button>
      <button class="dlg-btn primary" id="leSave">${__t('保存')}</button>`;
    $('#modalMask').classList.remove('hidden');
    $('#modalBox').classList.add('modal-wide');

    $('#leClose').addEventListener('click', closeModal);
    const saveBtn = $('#leSave');

    // 标签页切换
    document.querySelectorAll('.le-tab').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.le-tab').forEach((b) => b.classList.toggle('active', b === btn));
        document.querySelectorAll('.le-pane').forEach((p) => p.classList.toggle('hidden', p.dataset.pane !== btn.dataset.tab));
      });
    });

    // 关卡元数据文件选择（仅 meta 面板内的按钮）
    document.querySelectorAll('.le-files [data-file]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const kind = btn.dataset.file;
        const p = await window.sbAPI.pickFile(fileFilters[kind]);
        if (!p) return;
        pending[kind] = p;
        const idMap = { music: 'leMusic', preview: 'leMusicPreview', background: 'leBackground' };
        $(idMap[kind]).value = p.split(/[\\/]/).pop();
        toast('已选择文件，保存时生效');
      });
    });
    document.querySelectorAll('.le-files [data-clear]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const kind = btn.dataset.clear;
        pending[kind] = '__clear__';
        $(kind === 'preview' ? 'leMusicPreview' : 'leBackground').value = '';
      });
    });

    const bindChartEvents = () => {
      document.querySelectorAll('#leChartsList [data-pick]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const i = parseInt(btn.dataset.i, 10);
          const kind = btn.dataset.pick;
          const p = await window.sbAPI.pickFile(fileFilters[kind]);
          if (!p) return;
          pending.charts[i][kind] = p;
          const input = btn.parentElement.querySelector('input[data-f="' + kind + '"]');
          if (input) input.value = p.split(/[\\/]/).pop();
          toast('已选择文件，保存时生效');
        });
      });
      document.querySelectorAll('#leChartsList [data-clear]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const i = parseInt(btn.dataset.i, 10);
          const kind = btn.dataset.clear;
          pending.charts[i][kind] = '__clear__';
          const input = btn.parentElement.querySelector('input[data-f="' + kind + '"]');
          if (input) input.value = '';
        });
      });
      document.querySelectorAll('#leChartsList [data-f]').forEach((input) => {
        const i = parseInt(input.dataset.i, 10);
        if (input.dataset.f === 'type') {
          input.addEventListener('change', () => { charts[i].type = input.value; });
        } else if (input.dataset.f === 'name') {
          input.addEventListener('input', () => { charts[i].name = input.value; });
        } else if (input.dataset.f === 'difficulty') {
          input.addEventListener('input', () => {
            charts[i].difficulty = Number(input.value);
            const lbl = document.querySelector('[data-difflabel="' + i + '"]');
            if (lbl) lbl.textContent = difficultyDisplayLabel(charts[i].difficulty);
          });
        }
      });
      document.querySelectorAll('#leChartsList [data-del]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const i = parseInt(btn.dataset.del, 10);
          if (charts.length <= 1) { toast('至少保留一个谱面', true); return; }
          charts.splice(i, 1);
          pending.charts.splice(i, 1);
          $('#leChartsList').innerHTML = renderChartsList();
          bindChartEvents();
        });
      });
    };
    bindChartEvents();
    $('#leAddChart').addEventListener('click', () => {
      const used = charts.map((c) => c.type);
      const nextType = stdTypes.find((t) => !used.includes(t)) || 'easy';
      charts.push({ type: nextType, name: '', difficulty: 1, path: '', music: '', storyboard: '' });
      pending.charts.push({ path: null, music: null, storyboard: null });
      $('#leChartsList').innerHTML = renderChartsList();
      bindChartEvents();
    });

    const footHtml = `<button class="dlg-btn" id="leClose">关闭</button><button class="dlg-btn primary" id="leSave">保存</button>`;
    const restoreFoot = () => {
      $('#modalFoot').innerHTML = footHtml;
      $('#leClose').addEventListener('click', closeModal);
      const sb = $('#leSave');
      sb.disabled = false;
      sb.textContent = '保存';
      sb.addEventListener('click', saveLevelEditor);
    };

    async function doSave(levelData, chartsData, prevIndex) {
      const curPath = chartsData[prevIndex] ? chartsData[prevIndex].path : null;
      const sb = $('#leSave');
      if (sb) {
        sb.disabled = true;
        sb.textContent = '保存中…';
      }
      try {
        const res = await window.sbAPI.applyLevel({
          projectPath: state.projectPath,
          levelDir: state.levelDir,
          level: levelData,
          charts: chartsData,
          currentChartPath: curPath
        });
        closeModal();
        await loadLevelInfo(res.info, {
          projectPath: res.projectPath,
          config: res.config,
          mode: 'reload-level',
          reloadIndex: prevIndex
        });
        toast('已保存关卡设置');
      } catch (e) {
        restoreFoot();
        toast(__t('保存失败: ') + e.message, true);
      }
    }

    async function saveLevelEditor() {
      const num = (id, fallback) => {
        const raw = $(id).value.trim();
        if (raw === '') return fallback;
        const v = Number(raw);
        return Number.isFinite(v) ? v : fallback;
      };
      const levelData = {
        // 格式版本（schema_version）固定为 2，不可变更。
        schema_version: 2,
        version: num('#leVersion', 1),
        id: $('#leId').value.trim(),
        title: $('#leTitle').value.trim(),
        title_localized: $('#leTitleLocalized').value.trim(),
        artist: $('#leArtist').value.trim(),
        artist_localized: $('#leArtistLocalized').value.trim(),
        artist_source: $('#leArtistSource').value.trim(),
        illustrator: $('#leIllustrator').value.trim(),
        illustrator_localized: $('#leIllustratorLocalized').value.trim(),
        illustrator_source: $('#leIllustratorSource').value.trim(),
        charter: $('#leCharter').value.trim(),
        storyboarder: $('#leStoryboarder').value.trim(),
        music: { path: pending.music || lvlMusic },
        music_preview: { path: pending.preview === '__clear__' ? '' : (pending.preview || lvlPreview) },
        background: { path: pending.background === '__clear__' ? '' : (pending.background || lvlBg) }
      };
      const chartsData = charts.map((c, i) => ({
        type: c.type,
        name: c.name,
        difficulty: c.difficulty,
        path: pending.charts[i].path || c.path,
        music_override: { path: pending.charts[i].music === '__clear__' ? '' : (pending.charts[i].music || c.music) },
        // 故事板回退到 .ctr 当前实际文件（levelCharts 里的路径可能在本次会话
        // 创建故事板后过期），避免更换谱面时把故事板引用清掉。
        storyboard: { path: pending.charts[i].storyboard === '__clear__' ? '' :
          (pending.charts[i].storyboard || c.storyboard || (cfg.files && cfg.files.storyboard) || '') }
      }));
      if (!chartsData.length) { toast('至少需要一个谱面', true); return; }
      if (chartsData.some((c) => !c.path)) { toast('谱面文件不能为空', true); return; }
      const rawIndex = (state.levelCharts || []).findIndex((c) => c.path === state.chartPath);
      const prevIndex = rawIndex >= 0 ? rawIndex : 0;
      // 保存前校验（弹窗内确认，不打断当前编辑）：ID 格式 / 难度类型重复。
      const issues = [];
      const idVal = $('#leId').value.trim();
      if (idVal !== '' && !(/^[a-z0-9_.-]+$/.test(idVal) && idVal.indexOf('.') >= 0)) {
        issues.push('ID 格式不规范：只应包含小写字母、数字、下划线、短横杠和点，并至少带有一个点分隔符（当前：' + idVal + '）。');
      }
      const seenTypes = new Set();
      for (const c of chartsData) {
        if (seenTypes.has(c.type)) {
          issues.push('难度类型 “' + c.type + '” 重复：Cytoid 每个难度类型通常只有一份。');
          break;
        }
        seenTypes.add(c.type);
      }
      if (issues.length) {
        let notice = document.querySelector('#modalBody .le-issues');
        if (!notice) {
          notice = document.createElement('div');
          notice.className = 'le-issues';
          $('#modalBody').appendChild(notice);
        }
        notice.innerHTML = issues.map((m) => `<div>⚠ ${escapeHtml(m)}</div>`).join('');
        $('#modalFoot').innerHTML = `
          <button class="dlg-btn" id="leBack">${__t('返回修改')}</button>
          <button class="dlg-btn primary" id="leConfirmSave">${__t('仍要保存')}</button>`;
        $('#leBack').addEventListener('click', () => { if (notice) notice.remove(); restoreFoot(); });
        $('#leConfirmSave').addEventListener('click', () => {
          if (notice) notice.remove();
          // 确认态页脚没有 #leSave：先还原正常页脚再执行保存。
          restoreFoot();
          doSave(levelData, chartsData, prevIndex);
        });
        return;
      }
      await doSave(levelData, chartsData, prevIndex);
    }
    saveBtn.addEventListener('click', saveLevelEditor);
  }

  // ---------------------------------------------------------------
  // Save / export / player
  // ---------------------------------------------------------------
  function storyboardJson() {
    sortStageObjectsParentFirst();
    const obj = { ...state.storyboard };
    // Never export chart backup content that some tools embed in the storyboard
    delete obj.chart_backup;
    delete obj.chartBackup;
    delete obj.backup;
    // Cyster 可视化数据已迁移到 .ctr 项目文件，不再写入 storyboard。
    delete obj._cyster;
    // Export only the storyboard body (like the reference .json files)
    delete obj.templates;
    // Normalize: omit empty arrays? Keep them; standardized output.
    for (const k of ['sprites', 'texts', 'videos', 'lines', 'controllers', 'note_controllers']) {
      if (!obj[k] || !obj[k].length) delete obj[k];
    }
    return JSON.stringify(obj, null, 2);
  }

  // Output format aligned with the compiled (CytoidPlayer-standardized)
  // StoryBoard: PascalCase states, absolute Times, Easing enums, UnitFloat /
  // Unity-color structures. Used for every actual file output (save/export).
  function storyboardCompiledJson() {
    if (!state.storyboard) return null;
    // 保存前自愈：$note 父载体的 note 集合按当前选择器重算，避免
    // "Storyboard: parent_id ... 不存在" 导致 StoryBoard 无法保存。
    syncNoteSelectorCarriers();
    sortStageObjectsParentFirst();
    const compiled = SB.storyboard.toCompiled(state.storyboard, state.chart);
    // Cyster 可视化数据已迁移到 .ctr 项目文件，不再写入 storyboard。
    if (compiled && compiled._cyster) delete compiled._cyster;
    return JSON.stringify(compiled, null, 2);
  }

  // Editor-only project state (kept in the .ctr file, never in the storyboard):
  // the material library plus preview hidden/locked objects and panel state.
  function collectEditorState() {
    const out = {
      manualImages: state.manualImages || [],
      manualSizes: state.manualSizes || {},
      groupHidden: state.groupHidden || {},
      collapsedTags: state.tagCollapsed || {}
    };
    // 独特功能元数据按难度（chart）分桶，互不覆盖。
    const perDiff = {
      hiddenObjects: state.objHidden || {},
      lockedIds: state.lockedIds ? [...state.lockedIds] : [],
      // controllerId -> 该轨道启用的属性卡片 key 列表（卡片唯一归属元数据）。
      controllerCards: state.controllerCards || {},
      // note_controllerId -> 选择器子时间块合并标记 + 选择器元数据（.ctr 持久化）。
      noteSelectorMerge: state.noteSelectorMerge || {},
      noteSelectorMeta: collectNoteSelectorMeta(),
      parentCarriers: state.parentCarriers || {},
      // Cyster 时间轴数据（合并轨道 + order 锁定）随项目文件持久化。
      timeline: currentCysterTimeline(),
      // note_controller 的时间表达式（$note 等）：导出为绝对时间后重开时据此还原。
      noteTimeTokens: collectNoteTimeTokens(),
      // 当前谱面音符签名：重开时与谱面文件对比，检测同 ID 时间/类型错位。
      chartNoteSig: state.chartNoteSig || {}
    };
    if (state.chartPath) {
      const ed = (state.projectConfig && state.projectConfig.editor) || {};
      out.difficulties = { ...(ed.difficulties || {}) };
      out.difficulties[state.chartPath] = perDiff;
    }
    return out;
  }

  // 项目级 editor 状态（素材库 / 分类折叠 / 分类隐藏），跨难度共享。
  function applyEditorState(ed) {
    if (!ed || typeof ed !== 'object') return;
    if (Array.isArray(ed.manualImages)) state.manualImages = ed.manualImages.slice();
    if (ed.manualSizes && typeof ed.manualSizes === 'object') state.manualSizes = { ...ed.manualSizes };
    if (ed.groupHidden && typeof ed.groupHidden === 'object') state.groupHidden = { ...ed.groupHidden };
    if (ed.collapsedTags && typeof ed.collapsedTags === 'object') state.tagCollapsed = { ...ed.collapsedTags };
  }

  // 当前难度分桶的独特功能元数据（note 选择器 / 合并块 / 载体 / 卡片归属 /
  // 隐藏锁定 / 时间 token），按难度独立加载。
  function applyDifficultyEditorState() {
    const d = difficultyBucketRead() || {};
    state.objHidden = (d.hiddenObjects && typeof d.hiddenObjects === 'object')
      ? { ...d.hiddenObjects } : {};
    state.lockedIds = new Set(Array.isArray(d.lockedIds)
      ? d.lockedIds.filter((x) => typeof x === 'string' || typeof x === 'number')
      : []);
    const cc = {};
    if (d.controllerCards && typeof d.controllerCards === 'object') {
      for (const [id, keys] of Object.entries(d.controllerCards)) {
        if (Array.isArray(keys)) cc[id] = keys.filter((k) => typeof k === 'string');
      }
    }
    state.controllerCards = cc;
    const m = {};
    if (d.noteSelectorMerge && typeof d.noteSelectorMerge === 'object') {
      for (const [id, v] of Object.entries(d.noteSelectorMerge)) {
        if (typeof id === 'string') m[id] = !!v;
      }
    }
    state.noteSelectorMerge = m;
    state.noteSelectorMeta = (d.noteSelectorMeta && typeof d.noteSelectorMeta === 'object')
      ? JSON.parse(JSON.stringify(d.noteSelectorMeta)) : {};
    state.chartNoteSig = (d.chartNoteSig && typeof d.chartNoteSig === 'object')
      ? d.chartNoteSig : null;
    const pc = {};
    if (d.parentCarriers && typeof d.parentCarriers === 'object') {
      for (const [id, v] of Object.entries(d.parentCarriers)) {
        if (typeof id === 'string') pc[id] = !!v;
      }
    }
    state.parentCarriers = pc;
  }

  function persistProjectState() {
    if (!state.projectPath || !state.projectConfig) return;
    window.sbAPI.saveProjectState({ projectPath: state.projectPath, state: collectEditorState() }).catch(() => {});
  }

  // 撤销/重做后把恢复的状态真正落盘（.ctr 的轨道布局 + storyboard 文件的层级），
  // 避免“只是视觉上撤回、文件里仍是变更后的状态”。
  function persistAfterUndo() {
    persistProjectState();
    try {
      const content = storyboardCompiledJson();
      if (state.levelDir && content && state.storyboardFileName) {
        window.sbAPI.saveStoryboard({
          levelDir: state.levelDir,
          fileName: state.storyboardFileName,
          content
        }).catch(() => {});
      }
    } catch (e) { /* 恢复状态不因导出校验失败而中断 */ }
  }

  async function saveStoryboard() {
    if (!state.levelDir || !state.storyboard) { toast('请先打开关卡', true); return false; }
    const content = storyboardCompiledJson();
    if (!content) { toast('StoryBoard 为空内容', true); return false; }
    const fileName = (state.projectConfig && state.projectConfig.files && state.projectConfig.files.storyboard)
      ? state.projectConfig.files.storyboard
      : (state.storyboardFileName || 'storyboard_base.json');
    state.storyboardFileName = fileName;
    try {
      await window.sbAPI.saveStoryboard({ levelDir: state.levelDir, fileName, content });
      // Ensure level.json references it
      if (state.level) {
        const charts = state.level.charts || [];
        // Update the chart that is currently being edited (multi-difficulty
        // levels keep their other charts untouched).
        const chart = charts.find((c) => c.path === state.chartPath) || charts[0];
        if (chart) {
          chart.storyboard = chart.storyboard || {};
          if (chart.storyboard.path !== fileName) {
            chart.storyboard.path = fileName;
            await window.sbAPI.saveStoryboard({ levelDir: state.levelDir, fileName: 'level.json', content: JSON.stringify(state.level, null, 2) });
          }
        }
      }
      state.dirty = false;
      state.lastSavedAt = new Date();
      persistProjectState();
      toast('项目已保存');
      return true;
    } catch (e) {
      toast(__t('保存失败: ') + e.message, true);
      return false;
    }
  }

  async function exportJson() {
    if (!await saveStoryboard()) return;
    const content = storyboardCompiledJson();
    const def = (state.projectConfig && state.projectConfig.files && state.projectConfig.files.storyboard) ||
      state.storyboardFileName || 'storyboard.json';
    const out = await window.sbAPI.saveJsonDialog({ defaultName: def, content });
    if (!out) return;
    toast(__t('StoryBoard JSON 已导出: ') + out);
  }

  async function exportZip() {
    if (!await saveStoryboard()) return;
    const def = `${(state.level && state.level.id) || 'level'}.cytoidlevel`;
    const out = await window.sbAPI.saveLevelAs(def);
    if (!out) return;
    try {
      await window.sbAPI.packLevel({ levelDir: state.levelDir, outZip: out });
      toast(__t('已导出: ') + out);
    } catch (e) {
      toast(__t('导出失败: ') + e.message, true);
    }
  }

  async function importStoryboard() {
    try {
      const { canceled, filePath, content } = await window.sbAPI.importJsonFile();
      if (canceled || !filePath) return;
      // Importing a non-compiled storyboard requires explicit confirmation.
      const rawParsed = SB.json.parse(content);
      const looksCompiled = rawParsed && (rawParsed.compiled === true ||
        (rawParsed.controllers && rawParsed.controllers[0] && rawParsed.controllers[0].States));
      if (!looksCompiled) {
        const choice = await confirmDialog('确认导入',
          '导入的storyboard文件未经过compiled可能导致读取效果异常，继续吗？',
          [{ label: '取消' }, { label: '继续导入', cls: 'primary' }]);
        if (choice !== '继续导入') return;
      }
      const parsed = parseStoryboardContent(content, { silent: true });
      if (!parsed || typeof parsed !== 'object') throw new Error('JSON 内容无效');
      // Remember the imported file as the project's storyboard: copy it into
      // the project folder and persist the reference (config + level.json), so
      // the next time the project is opened it loads this same file.
      if (state.projectPath && state.projectConfig) {
        const cfgSb = state.projectConfig.files && state.projectConfig.files.storyboard;
        const base = String(filePath).split(/[\\/]/).pop();
        const levelSb = state.levelDir ? (state.levelDir.replace(/\\/g, '/') + '/' + cfgSb).toLowerCase() : '';
        const sameFile = cfgSb === base && levelSb && filePath.replace(/\\/g, '/').toLowerCase() === levelSb;
        if (sameFile) {
          state.storyboardFileName = cfgSb;
        } else {
        try {
          const res = await window.sbAPI.projectUpdateFile({ projectPath: state.projectPath, kind: 'storyboard', filePath });
          if (res) {
            state.projectPath = res.projectPath || state.projectPath;
            state.projectConfig = res.config || state.projectConfig;
            if (res.config && res.config.files && res.config.files.storyboard) {
              state.storyboardFileName = res.config.files.storyboard;
            }
          }
        } catch (e) {
        toast(__t('记录 StoryBoard 文件失败: ') + e.message, true);
        }
        }
      }
      state.storyboard = parsed;
      healOrphanSelectorClones(state.storyboard);
      normalizeStoryboardIds();
      sortAllObjectStates();
      sortStageObjectsParentFirst();
      state.selectedObjId = null;
      state.selectedKeyIdx = null;
      dirtyAndRefresh();
      toast(__t('已导入: ') + filePath);
    } catch (e) {
      toast(__t('导入失败: ') + e.message, true);
    }
  }

  // ---------------------------------------------------------------
  // Settings
  // ---------------------------------------------------------------
  function showSettings() {
    const playerPath = (state.settings && state.settings.playerExe) || playerExeDefault();
    const playerPathTip = __t('选择 Cytoidplayer.exe 所在的文件夹（保存后生效）；加载关卡时会先把当前关卡复制到其 player 文件夹（原内容移入新建的 Backup file+时间戳 文件夹），再启动 Cytoidplayer');
    const curLang = window.SBi18n ? window.SBi18n.getLanguage() : 'zh-CN';
    openModal('设置', `
      <div class="pick-row"><label data-i18n="Cytoidplayer路径">Cytoidplayer路径</label><span id="setPlayerExe" class="settings-path">${escapeHtml(playerPath)}</span><button type="button" class="mini-btn" id="btnPickPlayerFolder" data-i18n="选择文件夹…">选择文件夹…</button><span class="field-tip" id="playerPathTip">i</span></div>
      <div class="pick-row"><label data-i18n="界面语言">界面语言</label><select id="setLanguage">
        <option value="zh-CN">简体中文 / Simplified Chinese</option>
        <option value="zh-TW">繁體中文 / Traditional Chinese</option>
        <option value="en">English / English</option>
      </select></div>
      <div class="help-text" style="margin-top:8px"><b data-i18n="关于">关于</b><span data-i18n="：Cyster v0.1beta — 基于 ">：Cyster v0.1beta — 基于 </span><a href="#" id="ghLink">Cytoid 官方 GitHub</a><span data-i18n=" 与官方 StoryBoard 格式文档（v2.0.2）开发的 StoryBoard 可视化编辑器。StoryBoard 功能以文档明确列出的内容为准。"> 与官方 StoryBoard 格式文档（v2.0.2）开发的 StoryBoard 可视化编辑器。StoryBoard 功能以文档明确列出的内容为准。</span></div>`, [
      { label: '关闭', cls: 'primary' }
    ], () => {});
    if (window.SBi18n) window.SBi18n.applyStatic(document.getElementById('modalBox'));
    $('#playerPathTip').addEventListener('mouseenter', (ev) => {
      if (window.SBSchema) window.SBSchema.showFieldTip(ev.currentTarget, playerPathTip);
    });
    $('#playerPathTip').addEventListener('mouseleave', () => {
      if (window.SBSchema) window.SBSchema.hideFieldTip();
    });
    $('#btnPickPlayerFolder').addEventListener('click', async () => {
      const picked = await window.sbAPI.pickFolder({ title: __t('选择 Cytoidplayer 所在文件夹') });
      if (!picked) return;
      state.settings.playerExe = picked;
      const el = $('#setPlayerExe');
      if (el) el.textContent = picked;
      window.sbAPI.setSettings(state.settings).catch(() => {});
    });
    $('#ghLink').addEventListener('click', (e) => {
      e.preventDefault();
      window.sbAPI.openExternal('https://github.com/Cytoid/cytoid');
    });
    const langSel = $('#setLanguage');
    if (langSel) {
      langSel.value = curLang;
      langSel.addEventListener('change', () => {
        applyLanguage(langSel.value);
      });
    }
  }

  // ---------------------------------------------------------------
  // Cytoidplayer launch (external window; no state tracking after launch)
  // ---------------------------------------------------------------
  function playerExeDefault() {
    return 'D:\\sd\\Cytoid flies';
  }

  async function launchCytoidplayer() {
    if (!state.levelDir) {
      toast('请先打开一个项目', true);
      return;
    }
    // 避免本地预览与外部 Cytoidplayer 同时出声。
    if (state.playing) {
      state.playing = false;
      $('#btnPlay').innerHTML = svgIcon('play');
      preview.setPlaying(false);
    }
    const exe = (state.settings && state.settings.playerExe) || playerExeDefault();
    try {
      await window.sbAPI.launchPlayer({ levelDir: state.levelDir, playerPath: exe });
      toast('已复制关卡到 Cytoidplayer 并启动');
    } catch (e) {
      toast(__t('启动 Cytoidplayer 失败: ') + e.message, true);
    }
  }

  // ---------------------------------------------------------------
  // Playback
  // ---------------------------------------------------------------
  function togglePlay() {
    if (!state.chart) return;
    const audio = preview.audio;
    if (state.playing) {
      state.playing = false;
      $('#btnPlay').innerHTML = svgIcon('play');
      preview.setPlaying(false);
      refreshPropsIfNeeded();
      return;
    }
    if (audio && !state.audioReady) {
      toast('音乐加载中，请稍候再播放…', true);
      return;
    }
    state.playing = true;
    $('#btnPlay').innerHTML = svgIcon('pause');
    if (audio) {
      // Start playback sample-accurately at the current timeline position
      // PlayerGame: Time = PlaybackTime - ChartOffset + MusicOffset (ChartOffset = 0)
      preview.setPlaying(true, Math.max(0, preview.time - musicOffset()));
      try { setTime(audio.currentTime + musicOffset(), true); } catch (e) {}
    } else {
      preview.setPlaying(true, preview.time);
      if (preview.time >= (state.chart.endTime + 1)) setTime(0, false);
    }
  }

  function step(dt) {
    setTime(preview.time + dt, false);
  }

  function jumpToKeyframe(dir) {
    const kfs = [];
    for (const obj of allObjects()) {
      for (const k of objectKeyframes(obj.raw)) kfs.push(k.time);
    }
    kfs.sort((a, b) => a - b);
    const cur = preview.time;
    let target = null;
    if (dir > 0) target = kfs.find((t) => t > cur + 0.001);
    else {
      const before = kfs.filter((t) => t < cur - 0.001);
      target = before.length ? before[before.length - 1] : null;
    }
    if (target != null) setTime(target, false);
  }

  // ---------------------------------------------------------------
  // Preview loop
  // ---------------------------------------------------------------
  let fpsFrames = 0;
  let fpsLast = performance.now();
  let previewZoom = 1;
  let lastNavPaint = 0;
  let lastLiveStatAt = 0;
  const NAV_W = 176, NAV_H = 110;

  // Navigator mini-map refresh (top-level so the render loop can call it).
  function updatePreviewNav() {
    const nav = document.getElementById('previewNav');
    const navCanvas = document.getElementById('previewNavCanvas');
    const navView = document.getElementById('previewNavView');
    const canvas = document.getElementById('previewCanvas');
    const scrollEl = document.getElementById('previewScroll');
    if (!nav || !navCanvas || !navView || !canvas || !scrollEl || !canvas.width || !canvas.height) return;
    const show = previewZoom > 1.001;
    nav.classList.toggle('visible', show);
    if (!show) return;
    const now = performance.now();
    if (now - lastNavPaint > 120) {
      lastNavPaint = now;
      navCanvas.width = NAV_W;
      navCanvas.height = NAV_H;
      const nctx = navCanvas.getContext('2d');
      nctx.clearRect(0, 0, NAV_W, NAV_H);
      nctx.drawImage(canvas, 0, 0, NAV_W, NAV_H);
    }
    const cssW = parseFloat(canvas.style.width) || 1;
    const cssH = parseFloat(canvas.style.height) || 1;
    const pxPerCssX = canvas.width / cssW;
    const pxPerCssY = canvas.height / cssH;
    const sx = scrollEl.scrollLeft * pxPerCssX * (NAV_W / canvas.width);
    const sy = scrollEl.scrollTop * pxPerCssY * (NAV_H / canvas.height);
    const sw = Math.min(NAV_W, scrollEl.clientWidth * pxPerCssX * (NAV_W / canvas.width));
    const sh = Math.min(NAV_H, scrollEl.clientHeight * pxPerCssY * (NAV_H / canvas.height));
    navView.style.left = Math.round(sx) + 'px';
    navView.style.top = Math.round(sy) + 'px';
    navView.style.width = Math.max(8, Math.round(sw)) + 'px';
    navView.style.height = Math.max(8, Math.round(sh)) + 'px';
  }

  setInterval(() => {
    const now = performance.now();
    const dt = Math.max(0.001, (now - fpsLast) / 1000);
    fpsLast = now;
    const fps = Math.round(fpsFrames / dt);
    fpsFrames = 0;
    const el = $('#fpsBadge');
    if (el) {
      el.textContent = fps + ' FPS';
      el.classList.toggle('low', fps < 50);
      el.classList.toggle('ok', fps >= 50);
    }
  }, 1000);

  function loop() {
    fpsFrames++;
    if (state.playing && preview.audio) {
      // Drive playback from the Web Audio clock every frame — sample-accurate, no drift
      try {
        setTime(preview.audio.currentTime + musicOffset(), true);
        if (state.chart && preview.time >= state.chart.endTime + 0.5) {
          state.playing = false;
          $('#btnPlay').innerHTML = svgIcon('play');
          if (preview.audio.playing) preview.audio.pause();
        }
      } catch (e) {}
    } else if (state.playing && !preview.audio) {
      setTime(preview.time + 1 / 60, true);
      if (preview.time >= (state.chart ? state.chart.endTime + 1 : 60)) {
        state.playing = false;
        $('#btnPlay').innerHTML = svgIcon('play');
        preview.setPlaying(false);
      }
    }
    requestRender();
    updatePreviewNav();
    // 播放中低频更新 controller 实时统计数值。
    if (state.previewEmptyFocus && performance.now() - lastLiveStatAt > 100) {
      lastLiveStatAt = performance.now();
      updateControllerLiveStats();
    }
    requestAnimationFrame(loop);
  }

  // ---------------------------------------------------------------
  // Init
  // ---------------------------------------------------------------
  async function init() {
    if (window.SBPreview && window.SBPreview.loadSbFonts) {
      window.SBPreview.loadSbFonts().then(() => requestRender());
    }
    els.play = $('#btnPlay');
    els.prevKey = $('#btnPrevKey');
    els.nextKey = $('#btnNextKey');
    els.chkNotes = $('#chkShowIds');
    els.chkUI = $('#chkShowUI');
    els.chkEffects = $('#chkEffects');
    els.chkRichFx = $('#chkRichFx');

  // ------------------------------------------------------------------
  // Easter egg: click the top-left "Cyster" brand 11 times
  // ------------------------------------------------------------------
  let eggClicks = 0;
  let eggClickTimer = 0;
  let eggRaf = null;
  let eggParticles = [];
  let eggRockets = [];

  async function showEasterEgg() {
    if (document.getElementById('eggOverlay')) return;
    const imgRes = await window.sbAPI.getAsset('easter/egg.png').catch(() => null);
    const imgUrl = imgRes ? 'data:image/png;base64,' + imgRes.data : null;
    const overlay = document.createElement('div');
    overlay.id = 'eggOverlay';
    overlay.innerHTML =
      '<canvas id="eggCanvas"></canvas>' +
      '<div class="egg-box">' +
      `<div class="egg-img-wrap">${imgUrl ? `<img id="eggImg" src="${imgUrl}" alt="${__t('彩蛋')}" />` : __t('<div class="egg-img-missing">(图片缺失)</div>')}</div>` +
      __t('<div class="egg-text">恭喜你发现了彩蛋：Cyyysters!!</div>') +
      `<button class="egg-confirm" id="eggConfirm">${__t('确认')}</button>` +
      '</div>';
    document.body.appendChild(overlay);
    document.getElementById('eggConfirm').addEventListener('click', closeEasterEgg);
    startEggFireworks(overlay);
    toast('恭喜你发现了彩蛋：Cyyysters!!');
  }

  function closeEasterEgg() {
    const overlay = document.getElementById('eggOverlay');
    if (overlay) overlay.remove();
    if (eggRaf) { cancelAnimationFrame(eggRaf); eggRaf = null; }
    eggParticles = [];
    eggRockets = [];
  }

  // Fullscreen fireworks: rockets launch from the bottom and burst into
  // glowing colorful particles (with trails via frame fading).
  function startEggFireworks(overlay) {
    const canvas = overlay.querySelector('#eggCanvas');
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const resize = () => {
      canvas.width = Math.max(1, overlay.clientWidth) * dpr;
      canvas.height = Math.max(1, overlay.clientHeight) * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    eggParticles = [];
    eggRockets = [];
    const W = () => overlay.clientWidth;
    const H = () => overlay.clientHeight;
    const rand = (a, b) => a + Math.random() * (b - a);
    const HUES = [0, 30, 55, 120, 175, 210, 260, 300, 330];
    const launch = (big) => {
      eggRockets.push({
        x: rand(0.08, 0.92) * W(),
        y: H() + 12,
        vy: -rand(10, 14) * (H() / 720),
        targetY: rand(0.12, 0.42) * H(),
        hue: HUES[(Math.random() * HUES.length) | 0],
        big: !!big
      });
    };
    const explode = (r) => {
      const n = r.big ? 130 : (40 + Math.floor(Math.random() * 45));
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = rand(1.5, r.big ? 9 : 6.2) * (H() / 720);
        eggParticles.push({
          x: r.x, y: r.y,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp,
          life: rand(0.8, 1.7),
          age: 0,
          hue: r.hue + rand(-28, 28),
          size: rand(1.6, r.big ? 5 : 3.6)
        });
      }
    };
    let last = performance.now();
    let launchAcc = 0;
    const frame = (now) => {
      // 10x speed: all motion and launch cadence scale by ten.
      const dt = Math.min(0.05, (now - last) / 1000) * 10;
      last = now;
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = 'rgba(8,6,24,0.22)';
      ctx.fillRect(0, 0, W(), H());
      launchAcc += dt;
      if (launchAcc > 2.4) {
        launchAcc = 0;
        const bursts = Math.random() < 0.2 ? 3 : (Math.random() < 0.5 ? 2 : 1);
        for (let i = 0; i < bursts; i++) launch(Math.random() < 0.18);
      }
      for (let i = eggRockets.length - 1; i >= 0; i--) {
        const r = eggRockets[i];
        r.y += r.vy * dt;
        r.vy += (H() / 720) * 1.2 * dt;
        ctx.save();
        ctx.shadowBlur = 14;
        ctx.shadowColor = `hsl(${r.hue},100%,70%)`;
        ctx.fillStyle = `hsla(${r.hue},100%,78%,0.95)`;
        ctx.beginPath();
        ctx.arc(r.x, r.y, 2.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        if (r.y <= r.targetY) {
          explode(r);
          eggRockets.splice(i, 1);
        }
      }
      ctx.globalCompositeOperation = 'lighter';
      for (let i = eggParticles.length - 1; i >= 0; i--) {
        const p = eggParticles[i];
        p.age += dt;
        if (p.age >= p.life) { eggParticles.splice(i, 1); continue; }
        p.vy += (H() / 720) * 2.6 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        const k = 1 - p.age / p.life;
        ctx.save();
        ctx.shadowBlur = 10;
        ctx.shadowColor = `hsl(${p.hue},100%,60%)`;
        ctx.fillStyle = `hsla(${p.hue},100%,66%,${Math.max(0, k)})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * k + 0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      ctx.globalCompositeOperation = 'source-over';
      eggRaf = requestAnimationFrame(frame);
    };
    eggRaf = requestAnimationFrame(frame);
  }

  // Clicking the app brand (top-left "Cyster") switches to the
  // welcome page; clicking it again returns to the editor. 11 consecutive
  // clicks (within a short window) reveal the easter egg.
  document.querySelector('.brand').addEventListener('click', () => {
    const now = Date.now();
    if (eggClickTimer && now - eggClickTimer > 1500) eggClicks = 0;
    eggClickTimer = now;
    eggClicks++;
    if (eggClicks >= 11) {
      eggClicks = 0;
      showEasterEgg();
    }
    if (document.body.classList.contains('welcome-mode')) hideWelcome();
    else showWelcome();
  });
    els.play.addEventListener('click', togglePlay);
    els.prevKey.addEventListener('click', () => jumpToKeyframe(-1));
    els.nextKey.addEventListener('click', () => jumpToKeyframe(1));

    $('#btnWelcomeNew').addEventListener('click', newProjectFlow);
    $('#btnWelcomeOpen').addEventListener('click', openProjectFlow);
    $('#btnWelcomeImport').addEventListener('click', importLevelFlow);
    $('#btnWelcomeManual').addEventListener('click', () => window.sbAPI.manualOpen());
    $('#btnTipNext').addEventListener('click', showRandomTip);
    const welcomeLang = $('#welcomeLang');
    if (welcomeLang) welcomeLang.addEventListener('change', () => applyLanguage(welcomeLang.value));
    wireUpdateEvents();
    $('#btnWelcomeManage').addEventListener('click', hideWelcome);
    $('#btnWelcomeSettings').addEventListener('click', projectSettingsFlow);
    $('#welcomeGh').addEventListener('click', (e) => {
      e.preventDefault();
      window.sbAPI.openExternal('https://github.com/BlaCH2R/Cyster');
    });

    els.chkNotes.addEventListener('change', () => {
      preview.ui.showNoteIds = els.chkNotes.checked;
      preview.markDirty();
      requestRender();
    });
    els.chkUI.addEventListener('change', () => {
      preview.ui.show = els.chkUI.checked;
      preview.markDirty();
      requestRender();
    });
    els.chkEffects.addEventListener('change', () => {
      preview.effectsEnabled = els.chkEffects.checked;
      preview.markDirty();
      requestRender();
    });
    els.chkRichFx.addEventListener('change', () => {
      preview.richEffects = els.chkRichFx.checked;
      preview.markDirty();
      requestRender();
    });

    // Top menu bar: 文件 / 编辑 / 设置
    const menuItems = Array.from(document.querySelectorAll('.menu-item'));
    const closeMenus = () => menuItems.forEach((m) => m.classList.remove('open'));
    menuItems.forEach((m) => {
      m.addEventListener('mousedown', (e) => {
        if (e.target.closest('.menu-dropdown')) return; // entry clicks handled below
        e.stopPropagation();
        const wasOpen = m.classList.contains('open');
        closeMenus();
        if (!wasOpen) m.classList.add('open');
      });
    });
    const menuActions = {
      'new': newProjectFlow,
      'open': openProjectFlow,
      'switch-difficulty': switchDifficultyFlow,
      'import-level': importLevelFlow,
      'import-sb': importStoryboard,
      'save-sb': saveStoryboard,
      'export-sb': exportJson,
      'export-level': exportZip,
      'project-settings': projectSettingsFlow,
      'show-folder': () => {
        if (!state.levelDir) { toast('未打开项目', true); return; }
        window.sbAPI.openPath(state.levelDir).catch(() => toast('无法打开项目文件夹', true));
      },
      'launch-player': launchCytoidplayer,
      'fix-scanline-event-colors': fixScanlineEventColors,
      'note-selector-editor': () => {
        noteSelectorTarget = null;
        if (window.sbAPI && window.sbAPI.nsOpen) window.sbAPI.nsOpen();
        else openNoteSelectorEditor(null);
      },
      'repair-merged-blocks': repairMergedBlocks,
      'quit': () => window.close(),
      'undo': undo,
      'redo': redo,
      'duplicate-selected': () => {
        if (!state.selectedObjId) { toast('请先选择对象', true); return; }
        duplicateObject(state.selectedObjId);
      },
      'delete-selected': () => {
        if (!state.selectedObjId) { toast('请先选择对象', true); return; }
        deleteObject(state.selectedObjId);
      },
      'reset-layout': () => {
        const lp = $('#leftPanel'), rp = $('#rightPanel'), tl = $('#timeline');
        lp.style.flex = '';
        lp.style.width = '';
        rp.style.flex = '';
        rp.style.width = '';
        tl.style.height = '';
        // 预览比例一并恢复默认 16:9（比例通过布局实现，随布局重置）。
        state.settings = state.settings || {};
        state.settings.previewRatio = 16 / 9;
        window.sbAPI.setSettings(state.settings).catch(() => {});
        rebuildPreviewChart(16 / 9);
        setZoom(1, false);
        resizePreview();
        renderTimeline();
        syncPreviewRatioMenu();
        toast('已还原默认窗口布局');
      },
      'check-update': manualUpdateCheck,
      'app-settings': showSettings
    };
    document.querySelectorAll('.menu-entry').forEach((entry) => {
      entry.addEventListener('click', () => {
        closeMenus();
        const fn = menuActions[entry.dataset.action];
        if (fn) fn();
      });
    });
    // 视图菜单：预览显示开关。条目文字描述“点击后将执行的动作”：
    // 当前显示时就写“隐藏 …”，点击后执行对应动作。
    const viewToggles = Array.from(document.querySelectorAll('.menu-entry[data-view-toggle]'));
    const syncViewToggles = () => {
      viewToggles.forEach((entry) => {
        const cb = document.getElementById(entry.dataset.viewToggle);
        if (!cb) return;
        const label = cb.checked ? (entry.dataset.off || entry.textContent) : (entry.dataset.on || entry.textContent);
        entry.textContent = window.SBi18n ? window.SBi18n.t(label) : label;
      });
    };
    viewToggles.forEach((entry) => {
      entry.addEventListener('click', () => {
        const cb = document.getElementById(entry.dataset.viewToggle);
        if (!cb) return;
        cb.checked = !cb.checked;
        cb.dispatchEvent(new Event('change', { bubbles: true }));
        syncViewToggles();
      });
    });
    // 视图菜单：预览窗口比例切换。
    document.querySelectorAll('.menu-entry[data-preview-ratio]').forEach((entry) => {
      entry.addEventListener('click', () => {
        closeMenus();
        setPreviewRatio(entry.dataset.previewRatio);
      });
    });
    syncPreviewRatioMenu();
    [els.chkNotes, els.chkUI, els.chkEffects, els.chkRichFx].forEach((cb) => {
      cb.addEventListener('change', syncViewToggles);
    });
    syncViewToggles();

    $('#modalMask').addEventListener('click', (e) => {
      if (e.target === $('#modalMask')) {
        closeModal();
        // 点遮罩关闭难度选择框等价于取消：只解挂等待者，是否回欢迎页由调用方
        // 决定（初始加载无难度可选时才回欢迎页）。
        if (pendingChartResolve) {
          const r = pendingChartResolve;
          pendingChartResolve = null;
          r(null);
        }
        if (pendingConfirm) {
          const r = pendingConfirm;
          pendingConfirm = null;
          r(null);
        }
      }
    });
    document.addEventListener('keydown', (e) => {
      if (!$('#modalMask').classList.contains('hidden')) return;
      // While typing in a field, the editor's global shortcuts must not fire
      // (arrow keys step the playhead / space toggles playback).
      const t = e.target;
      const typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
      if ((e.ctrlKey || e.metaKey) && (e.code === 'KeyZ' || e.code === 'KeyY')) {
        e.preventDefault();
        if (e.code === 'KeyZ' && !e.shiftKey) undo();
        else redo();
      } else if ((e.ctrlKey || e.metaKey) && e.code === 'KeyS') {
        e.preventDefault();
        saveStoryboard();
      } else if ((e.ctrlKey || e.metaKey) && e.code === 'KeyC') {
        if (!typing) {
          e.preventDefault();
          const kfs = (state.selectedKfs || []).filter((k) => k && k.objId != null);
          if (kfs.length) { copyKeyframesToClipboard(); state.objClipboard = []; }
          else copyObjectsToClipboard();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.code === 'KeyV') {
        if (!typing) {
          e.preventDefault();
          if (state.kfClipboard && state.kfClipboard.length) pasteKeyframesAtPlayhead();
          else if (state.objClipboard && state.objClipboard.length) pasteObjectsAtPlayhead();
          else toast('剪贴板为空', true);
        }
      } else if (e.code === 'Escape') {
        if (document.body.classList.contains('preview-fullscreen')) {
          document.body.classList.remove('preview-fullscreen');
          const btn = $('#btnZoomFull');
          if (btn) btn.classList.remove('active');
          setZoom(previewZoom, false);
        }
      } else if (e.code === 'Space') { if (!typing) { e.preventDefault(); togglePlay(); } }
      else if (e.code === 'KeyR') { if (!typing) { e.preventDefault(); togglePickMode(); } }
      else if (e.code === 'ArrowLeft') { if (!typing) { e.preventDefault(); step(e.shiftKey ? -0.5 : -0.05); } }
      else if (e.code === 'ArrowRight') { if (!typing) { e.preventDefault(); step(e.shiftKey ? 0.5 : 0.05); } }
      else if (e.code === 'Delete' || e.code === 'Backspace') {
        if (!typing) { e.preventDefault(); deleteSelection(); }
      }
      // Shift：开启/关闭 Note ID 显示（仅预览画面聚焦时生效；输入框避让）。
      else if ((e.code === 'ShiftLeft' || e.code === 'ShiftRight') && !e.repeat && !typing && state.previewFocused) {
        preview.ui.showNoteIds = !preview.ui.showNoteIds;
        if (els.chkNotes) els.chkNotes.checked = preview.ui.showNoteIds;
        preview.markDirty();
        requestRender();
        toast(preview.ui.showNoteIds ? '已显示 Note ID' : '已隐藏 Note ID');
      }
      // Z：呼出/隐藏预览画面缩放滑条（无 Ctrl/Meta，避免与撤销冲突；输入框避让）。
      else if (!e.ctrlKey && !e.metaKey && e.code === 'KeyZ' && !typing) {
        e.preventDefault();
        toggleZoomPopup();
      }
      // CapsLock：隐藏/显示全部 note（同对象类型库中 note_controller 眼睛；
      // 仅预览画面聚焦时生效；输入框避让）。
      else if (e.code === 'CapsLock' && !e.repeat && !typing && state.previewFocused) {
        e.preventDefault();
        toggleGroupVisibility('note_controllers');
      }
      // Tab：隐藏/显示预览 UI（扫描线/上下边界/事件文字一并隐藏；
      // 与视图选项卡“显示 UI”同步；仅预览画面聚焦时生效；输入框避让）。
      else if (e.code === 'Tab' && !typing && state.previewFocused) {
        e.preventDefault();
        preview.ui.show = !preview.ui.show;
        if (els.chkUI) els.chkUI.checked = preview.ui.show;
        preview.markDirty();
        requestRender();
        toast(preview.ui.show ? '已显示 UI' : '已隐藏 UI');
      }
    });
    document.addEventListener('mousedown', (e) => {
      if (e.target.closest && !e.target.closest('.menu-item')) closeMenus();
      if (e.target.closest && !e.target.closest('#contextMenu')) hideContextMenu();
      // 自动移动/排序的临时高亮：下一次点击时消失。
      if (state.autoMovedIds && state.autoMovedIds.size) {
        state.autoMovedIds.clear();
        renderTimeline();
      }
      dismissKeyframeSelectionIfOutside(e);
    });

    // Canvas sizing with preview zoom (50%~200%) + drag panning. The canvas
    // lives inside #previewScroll; #previewWrap itself never scrolls, so the
    // floating overlays (empty/hint/navigator) stay fixed over the preview.
    const wrap = $('#previewWrap');
    const scrollEl = $('#previewScroll');
    const canvas = $('#previewCanvas');
    // 预览画面聚焦状态：Shift / CapsLock 快捷键仅在鼠标位于预览画面内时生效。
    if (scrollEl) {
      scrollEl.addEventListener('mouseenter', () => { state.previewFocused = true; });
      scrollEl.addEventListener('mouseleave', () => { state.previewFocused = false; });
    }
    let suppressNextCanvasClick = false;
    let panState = null;

    const setZoom = (z, keepCenter) => {
      const oldZoom = previewZoom;
      const cx = scrollEl.scrollLeft + scrollEl.clientWidth / 2;
      const cy = scrollEl.scrollTop + scrollEl.clientHeight / 2;
      previewZoom = Math.min(2, Math.max(0.5, z));
      wrap.classList.toggle('zoomed', previewZoom > 1.001);
      const slider = $('#zoomSlider');
      if (slider) slider.value = Math.round(previewZoom * 100);
      const label = $('#zoomLabel');
      if (label) label.textContent = Math.round(previewZoom * 100) + '%';
      resizePreview();
      if (keepCenter !== false && oldZoom > 0 && oldZoom !== previewZoom) {
        // Keep the viewport center stable while zooming.
        scrollEl.scrollLeft = Math.max(0, cx * (previewZoom / oldZoom) - scrollEl.clientWidth / 2);
        scrollEl.scrollTop = Math.max(0, cy * (previewZoom / oldZoom) - scrollEl.clientHeight / 2);
      }
      // Scrollbars appear/disappear with zoom; re-measure on the next frame
      // so the canvas settles at the final (scrollbar-free) wrap size.
      requestAnimationFrame(() => resizePreview());
    };

    function togglePreviewFullscreen() {
      const on = document.body.classList.toggle('preview-fullscreen');
      const btn = $('#btnZoomFull');
      if (btn) btn.classList.toggle('active', on);
      setZoom(previewZoom, false);
    }

    function syncPreviewRatioMenu() {
      const ratio = currentPreviewRatio();
      document.querySelectorAll('.menu-entry[data-preview-ratio]').forEach((el) => {
        el.classList.toggle('active', Math.abs(parsePreviewRatio(el.dataset.previewRatio) - ratio) < 1e-6);
      });
    }
    // 按比例重建 chart（note X 位置依赖 screenRatio）。
    function rebuildPreviewChart(ratio) {
      if (preview) preview.canvasRatio = ratio;
      if (state.chartText) {
        try {
          state.chart = new SB.chart.Chart(state.chartText, { screenRatio: ratio });
          if (preview) {
            preview.chart = state.chart;
            if (state.storyboard) preview.setStoryboard(state.storyboard);
          }
        } catch (e) { /* 解析失败保持旧 chart */ }
      }
    }
    // 通过调整各模块布局让预览区域达到目标比例（画布始终填满预览区，不留
    // 黑边）。策略：优先调整预览区域两侧的面板宽度（改变预览宽度），两侧
    // 模块拉伸后等宽、预览区域保持居中；两侧面板收到最小宽度仍不够（预览
    // 需要更宽）时，才增大时间轴（缩短预览高度），时间轴区域只能增大、不能
    // 减小，避免影响用户操作便利性。
    function applyPreviewRatioLayout() {
      const ratio = currentPreviewRatio();
      const wrapEl = $('#previewWrap');
      const tlEl = $('#timeline');
      const lp = $('#leftPanel');
      const rp = $('#rightPanel');
      if (!wrapEl || !tlEl || !lp || !rp || !wrapEl.clientWidth) return;
      // 两侧面板最小宽度：收缩时不低于此值（避免 21:9 等宽比例把两侧整得太窄），
      // 宽度需求优先由增大时间轴承担。
      const SIDE_MIN = 220;
      const wrapW = wrapEl.clientWidth;
      const wrapH = wrapEl.clientHeight;
      const delta = ratio * wrapH - wrapW; // 预览区需要增加（正）/减少（负）的宽度
      let totalSide = lp.getBoundingClientRect().width + rp.getBoundingClientRect().width;
      if (delta > 0) {
        // 预览需要更宽：两侧总宽等量收窄后等宽分配，保持预览居中。
        const shrink = Math.min(delta, Math.max(0, totalSide - 2 * SIDE_MIN));
        totalSide -= shrink;
        const each = Math.max(SIDE_MIN, totalSide / 2);
        lp.style.width = Math.round(each) + 'px';
        rp.style.width = Math.round(each) + 'px';
        const shortfall = delta - shrink;
        if (shortfall > 0.5) {
          // 两侧已到最小仍不够宽：增大时间轴（缩短预览高度），时间轴只增不减。
          const wrapW2 = wrapEl.clientWidth;
          const wrapH2 = wrapEl.clientHeight;
          const targetH = wrapW2 / ratio;
          if (targetH < wrapH2 - 1) {
            const maxTl = Math.max(36, window.innerHeight - 120);
            tlEl.style.height = Math.min(maxTl, tlEl.clientHeight + (wrapH2 - targetH)) + 'px';
          }
        }
      } else if (delta < 0) {
        // 预览需要更窄：两侧总宽等量加宽后等宽分配，保持预览居中。
        totalSide += -delta;
        const each = totalSide / 2;
        lp.style.width = Math.round(each) + 'px';
        rp.style.width = Math.round(each) + 'px';
      }
      resizePreview();
    }
    function setPreviewRatio(ratioStr) {
      const ratio = parsePreviewRatio(ratioStr);
      state.settings = state.settings || {};
      state.settings.previewRatio = ratio;
      window.sbAPI.setSettings(state.settings).catch(() => {});
      rebuildPreviewChart(ratio);
      applyPreviewRatioLayout();
      syncPreviewRatioMenu();
      toast(__t('预览窗口比例: ') + ratioStr);
    }

    const resizePreview = () => {
      const dprBase = Math.min(1.5, window.devicePixelRatio || 1);
      // Keep the total pixel count reasonable at high zoom by easing the dpr.
      const dpr = dprBase / Math.max(1, previewZoom * 0.8);
      // 预览画布填满预览区域；比例由模块布局（时间轴高度等）保证。
      const w = Math.max(80, wrap.clientWidth);
      const h = Math.max(60, wrap.clientHeight);
      const z = previewZoom;
      // Below 100% the canvas keeps filling the wrap and the scene renders
      // at z (single scale): the playfield shrinks toward the center and
      // storyboard content beyond its edges becomes visible around it.
      // At/above 100% the canvas scales up (scrollable) and the playfield
      // fills it as before.
      if (z < 1) {
        canvas.style.left = '0px';
        canvas.style.top = '0px';
        canvas.style.transform = '';
        if (preview.sceneScale !== z) preview.sceneScale = z;
      } else {
        canvas.style.left = '0px';
        canvas.style.top = '0px';
        canvas.style.transform = '';
        if (preview.sceneScale !== 1) preview.sceneScale = 1;
      }
      const zw = z < 1 ? w : Math.max(80, Math.round(w * z));
      const zh = z < 1 ? h : Math.max(60, Math.round(h * z));
      canvas.width = Math.round(zw * dpr);
      canvas.height = Math.round(zh * dpr);
      canvas.style.width = zw + 'px';
      canvas.style.height = zh + 'px';
      if (preview.chart) preview.chart.screenRatio = currentPreviewRatio();
      // Resizing the canvas clears it; force a repaint even when the playhead
      // did not move (otherwise the stopped preview stays blank after a zoom).
      preview.markDirty();
      requestRender();
      updatePreviewNav();
    };
    window.addEventListener('resize', resizePreview);

    // Zoom controls: the magnifier toggles a floating popup (styled like the
    // timeline keyframe detail window) anchored below the button; the
    // fullscreen button is always visible at the far right of the toolbar.
    const zoomControls = $('#zoomControls');
    const positionZoomPopup = () => {
      const btn = $('#btnZoomToggle');
      const r = btn.getBoundingClientRect();
      const tw = zoomControls.offsetWidth;
      const th = zoomControls.offsetHeight;
      const vw = window.innerWidth, vh = window.innerHeight;
      let left = r.left;
      let top = r.bottom + 4;
      if (left + tw > vw - 6) left = Math.max(6, vw - tw - 6);
      if (left < 6) left = 6;
      if (top + th > vh - 6) top = Math.max(6, r.top - th - 4);
      zoomControls.style.left = left + 'px';
      zoomControls.style.top = top + 'px';
    };
    const hideZoomPopup = () => {
      zoomControls.classList.add('hidden');
      $('#btnZoomToggle').classList.remove('active');
    };
    const toggleZoomPopup = () => {
      if (zoomControls.classList.contains('hidden')) {
        zoomControls.classList.remove('hidden');
        positionZoomPopup();
        $('#btnZoomToggle').classList.add('active');
      } else {
        hideZoomPopup();
      }
    };
    $('#btnZoomToggle').addEventListener('click', toggleZoomPopup);
    document.addEventListener('mousedown', (e) => {
      if (zoomControls.classList.contains('hidden')) return;
      if (!e.target.closest('#zoomControls') && !e.target.closest('#btnZoomToggle')) hideZoomPopup();
    });
    window.addEventListener('resize', () => {
      if (!zoomControls.classList.contains('hidden')) positionZoomPopup();
    });
    // Best-effort: persist editor-only state when the window closes.
    window.addEventListener('beforeunload', () => persistProjectState());
    // 关闭软件时若有未保存修改，先弹出确认（取消 / 确认 / 保存并退出）。
    if (window.sbAPI && window.sbAPI.onConfirmClose) {
      window.sbAPI.onConfirmClose(async () => {
        if (!state.dirty) { window.sbAPI.confirmCloseDone(); return; }
        const p = (n) => String(n).padStart(2, '0');
        const lastText = state.lastSavedAt
          ? `${state.lastSavedAt.getFullYear()}-${p(state.lastSavedAt.getMonth() + 1)}-${p(state.lastSavedAt.getDate())} ${p(state.lastSavedAt.getHours())}:${p(state.lastSavedAt.getMinutes())}`
          : __t('从未保存');
        const body = state.lastSavedAt
          ? `${__t('最后一次保存在')}${lastText}${__t('，现在退出会遗失自最后一次保存以来的所有内容，继续吗？')}`
          : `${__t('从未保存')}${__t('，现在退出会遗失自最后一次保存以来的所有内容，继续吗？')}`;
        const choice = await confirmDialog(
          '有未保存的修改',
          body,
          [
            { label: '取消', cls: '' },
            { label: '确认', cls: '' },
            { label: '保存并退出', cls: 'primary' }
          ]
        );
        if (choice === '保存并退出') {
          const ok = await saveStoryboard();
          if (ok) window.sbAPI.confirmCloseDone();
        } else if (choice === '确认') {
          window.sbAPI.confirmCloseDone();
        }
      });
    }
    $('#zoomSlider').addEventListener('input', () => {
      setZoom(Number($('#zoomSlider').value) / 100);
    });
    $('#btnZoomReset').addEventListener('click', () => {
      setZoom(1, false);
      scrollEl.scrollLeft = 0;
      scrollEl.scrollTop = 0;
    });
    $('#btnZoomFull').addEventListener('click', togglePreviewFullscreen);

    // Navigator mini-map: bottom-right thumbnail of the whole (zoomed) canvas
    // with a cyan viewport rectangle; drag it to pan the visible area.
    const nav = $('#previewNav');
    let navDrag = null;

    function panByNav(clientX, clientY) {
      const rect = nav.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const nx = (clientX - rect.left) / rect.width;
      const ny = (clientY - rect.top) / rect.height;
      const cssW = parseFloat(canvas.style.width) || 1;
      const cssH = parseFloat(canvas.style.height) || 1;
      scrollEl.scrollLeft = Math.max(0, Math.min(cssW - scrollEl.clientWidth, nx * cssW - scrollEl.clientWidth / 2));
      scrollEl.scrollTop = Math.max(0, Math.min(cssH - scrollEl.clientHeight, ny * cssH - scrollEl.clientHeight / 2));
    }

    nav.addEventListener('mousedown', (e) => {
      if (previewZoom <= 1.001) return;
      e.preventDefault();
      navDrag = true;
      panByNav(e.clientX, e.clientY);
    });
    document.addEventListener('mousemove', (e) => {
      if (navDrag) panByNav(e.clientX, e.clientY);
    });
    document.addEventListener('mouseup', () => { navDrag = false; });
    scrollEl.addEventListener('scroll', updatePreviewNav);

    // Drag the zoomed canvas to pan (grab cursor). A small movement
    // threshold keeps normal clicks on notes working.
    canvas.addEventListener('mousedown', (e) => {
      if (tryArmObjectDrag(e)) return;
      if (e.button !== 0 || previewZoom <= 1.001) return;
      panState = { x: e.clientX, y: e.clientY, sl: scrollEl.scrollLeft, st: scrollEl.scrollTop, moved: false };
      wrap.classList.add('panning');
    });
    document.addEventListener('mousemove', (e) => {
      if (!panState) return;
      const dx = e.clientX - panState.x, dy = e.clientY - panState.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) panState.moved = true;
      scrollEl.scrollLeft = panState.sl - dx;
      scrollEl.scrollTop = panState.st - dy;
    });
    document.addEventListener('mouseup', () => {
      if (!panState) return;
      suppressNextCanvasClick = panState.moved;
      panState = null;
      wrap.classList.remove('panning');
    });
    resizePreview();

    // Draggable panel splitters: left library / right properties / timeline height
    const leftPanel = $('#leftPanel');
    const rightPanel = $('#rightPanel');
    const timelineEl = $('#timeline');
    const mainEl = $('#main');
    const clampNum = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
    const bindSplitter = (bar, onMove) => {
      bar.addEventListener('mousedown', (e) => {
        e.preventDefault();
        bar.classList.add('active');
        const move = (ev) => onMove(ev);
        const up = () => {
          bar.classList.remove('active');
          document.removeEventListener('mousemove', move);
          document.removeEventListener('mouseup', up);
        };
        document.addEventListener('mousemove', move);
        document.addEventListener('mouseup', up);
      });
    };
    bindSplitter($('#splitL'), (ev) => {
      const rect = mainEl.getBoundingClientRect();
      const w = clampNum(ev.clientX - rect.left, 150, 520);
      leftPanel.style.flex = `0 0 ${w}px`;
      leftPanel.style.width = w + 'px';
      resizePreview();
    });
    bindSplitter($('#splitR'), (ev) => {
      const rect = mainEl.getBoundingClientRect();
      const w = clampNum(rect.right - ev.clientX, 200, 640);
      rightPanel.style.flex = `0 0 ${w}px`;
      rightPanel.style.width = w + 'px';
      resizePreview();
    });
    bindSplitter($('#splitT'), (ev) => {
      const rect = mainEl.getBoundingClientRect();
      const h = clampNum(rect.bottom - ev.clientY, 120, Math.max(120, window.innerHeight - 300));
      timelineEl.style.height = h + 'px';
      renderTimeline();
    });

    // Preview selection layer (toolbar): what left-click selects in the
    // preview — note / sprite / line / text / video.
    const pickModeSel = $('#pickMode');
    if (pickModeSel) {
      pickModeSel.value = state.pickMode || 'note';
      pickModeSel.addEventListener('change', () => {
        state.pickMode = pickModeSel.value || 'note';
        updatePreviewHighlight();
      });
    }

    // Preview pick + marquee: click selects the topmost object of the current
    // layer (Ctrl toggles); left-drag (at 100% zoom) draws a rectangle to
    // select every object of that layer inside it. Locked objects are skipped.
    const rectToCanvas = (e) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: (e.clientX - rect.left) / rect.width * canvas.width,
        y: (e.clientY - rect.top) / rect.height * canvas.height,
      };
    };
    // 预览拾取跳过集：锁定对象 + 被隐藏（眼睛关闭 / 整组隐藏）的对象。
    const pickSkip = () => {
      const skip = new Set();
      if (state.lockedIds) for (const id of state.lockedIds) skip.add(id);
      if (state.storyboard) {
        for (const [group, list] of Object.entries(state.storyboard)) {
          if (!Array.isArray(list)) continue;
          for (const o of list) {
            if (o && o.id != null && isObjHiddenState(o.id)) {
              skip.add(o.id);
              for (const cid of mergedCloneIds(o)) skip.add(cid);
            }
          }
        }
      }
      return skip.size ? { skip } : null;
    };
    const marqueeEl = document.createElement('div');
    marqueeEl.className = 'marquee-box';
    let marquee = null;
    // Armed preview object drag: { target, startPx, moved, targets, currentPx }.
    let objectDrag = null;

    // ---- Preview object dragging ----------------------------------------
    // When a draggable object (sprite / line body / line endpoint / text /
    // note with a note_controller that overrides X/Y) is grabbed, the mouse
    // movement is converted back into the object's OWN coordinate system and
    // written into the keyframe state at the playhead.

    // Parse a stored unit field (number | "unit:value" | {value,unit}).
    function unitField(v, defUnit) {
      if (v == null) return { value: 0, unit: defUnit };
      if (typeof v === 'number') return { value: v, unit: defUnit };
      if (typeof v === 'object') {
        return { value: Number(v.value) || 0, unit: v.unit || defUnit };
      }
      const s = String(v);
      const i = s.indexOf(':');
      if (i < 0) return { value: parseFloat(s) || 0, unit: defUnit };
      return { value: parseFloat(s.slice(i + 1)) || 0, unit: s.slice(0, i).toLowerCase() };
    }

    // Serialize a unit value back to the raw storyboard form (number when it
    // matches the field's default unit, "unit:value" otherwise).
    function rawUnit(value, unit, defUnit) {
      const v = Math.round(value * 10000) / 10000;
      if (!unit || unit === defUnit) return v;
      return unit + ':' + v;
    }

    function normUnitField(v, def) {
      const u = unitField(v, def);
      return rawUnit(u.value, u.unit, def);
    }

    // Keyframes created from interpolated (compiled) states carry parsed unit
    // objects; normalize them back to the raw number/"unit:value" form.
    function normalizeStateUnits(st, type) {
      const defs = type === 'note_controller'
        ? { x: 'notex', y: 'notey', z: 'world' }
        : type === 'line'
          ? { width: 'world' }
          : { x: 'stagex', y: 'stagey', z: 'world', width: 'stagex', height: 'stagey' };
      for (const k of Object.keys(defs)) {
        if (st[k] !== undefined) st[k] = normUnitField(st[k], defs[k]);
      }
      if (Array.isArray(st.pos)) {
        st.pos = st.pos.map((p) => {
          const q = { ...p };
          for (const ax of ['x', 'y', 'z']) {
            if (q[ax] !== undefined) {
              q[ax] = normUnitField(q[ax], ax === 'x' ? 'notex' : ax === 'y' ? 'notey' : 'world');
            }
          }
          return q;
        });
      }
    }

    // Solve dPx = dX*bx + dY*by for the unit deltas (2D), falling back to
    // axis projection when the basis is degenerate.
    function solveDragDeltas(dx, dy, bx, by) {
      const det = bx.x * by.y - bx.y * by.x;
      if (Math.abs(det) < 1e-9) {
        const lx = bx.x * bx.x + bx.y * bx.y;
        const ly = by.x * by.x + by.y * by.y;
        return {
          x: lx > 1e-12 ? (dx * bx.x + dy * bx.y) / lx : 0,
          y: ly > 1e-12 ? (dx * by.x + dy * by.y) / ly : 0
        };
      }
      return {
        x: (dx * by.y - dy * by.x) / det,
        y: (bx.x * dy - bx.y * dx) / det
      };
    }

    // 自动对齐吸附：把屏幕坐标吸附到网格（画布 1/16 宽 × 1/12 高，天然包含
    // 画布中心线），阈值 5px，用于图片/文字等对象的拖拽。
    function snapDragPoint(px, py, W, H) {
      const cellX = Math.max(20, Math.round(W / 16));
      const cellY = Math.max(20, Math.round(H / 12));
      const TH = 5;
      let x = px, y = py;
      const gx = Math.round(px / cellX) * cellX;
      if (Math.abs(px - gx) <= TH) x = gx;
      const gy = Math.round(py / cellY) * cellY;
      if (Math.abs(py - gy) <= TH) y = gy;
      return { x, y };
    }

    // A note is draggable when its note_controller currently overrides X and/or
    // Y (evaluated at the playhead). Returns { nc, ox, oy, evalSt } or null.
    function noteDragInfo(nid) {
      const nc = findNoteControllerForNote(nid);
      if (!nc) return null;
      const evalSt = interpolatedStateFor(nc, 'note_controller', preview.time) || nc;
      const ox = evalSt.override_x === true;
      const oy = evalSt.override_y === true;
      if (!ox && !oy) return null;
      return { nc, ox, oy, evalSt };
    }

    // What draggable target sits under the cursor (respecting the current
    // pick layer and locked objects)? Null = not draggable.
    function dragTargetAt(p, skip) {
      const mode = state.pickMode || 'note';
      if (mode === 'note') {
        const id = preview.hitTestPick(p.x, p.y, 'note', skip);
        if (!id) return null;
        const nid = splitEntryId(id).noteId;
        if (!noteDragInfo(nid)) return null;
        return { kind: 'note', id, noteId: nid };
      }
      // stage（及旧的具体类型模式）统一按舞台对象拾取：端点优先，其次按
      // (layer, order) 取最上层对象。
      const ep = preview.hitTestLineEndpoint(p.x, p.y, skip);
      if (ep) return { kind: 'lineEndpoint', id: ep.id, endpointIndex: ep.index };
      const id = preview.hitTestPick(p.x, p.y, 'stage', skip);
      if (!id) return null;
      return { kind: 'stage', id };
    }

    // `sel` is the selection captured at mousedown ({ids, objId}): the
    // document-level keyframe-dismiss handler can collapse the selection
    // between mousedown and the drag commit, which must not break a batch
    // drag that the user already committed to.
    function targetSelected(target, sel) {
      const ids = sel ? sel.ids : state.selectedIds;
      if (target.kind === 'note') {
        if (ids.includes('note::' + target.noteId)) return true;
        const info = noteDragInfo(target.noteId);
        if (info && (ids.includes(info.nc.id) || (sel ? sel.objId : state.selectedObjId) === info.nc.id)) return true;
        return false;
      }
      return ids.includes(target.id);
    }

    // The raw state edited by a drag: the keyframe at the playhead, or a new
    // keyframe created there from the interpolated state (so the object does
    // not jump when the drag starts between keyframes).
    function ensureEditableState(obj, type) {
      const t = preview.time;
      const on = objectKeyframes(obj).find((k) => Math.abs(k.time - t) < 1e-6);
      if (on) return on.index === -1 ? obj : obj.states[on.index];
      const interp = interpolatedStateFor(obj, type, t);
      const clone = JSON.parse(JSON.stringify(interp || obj));
      delete clone.states;
      delete clone.id;
      delete clone.note;
      // 全帧同步字段以对象本体为准。
      for (const k of ['path', 'order', 'layer', 'parent_id', 'target_id']) {
        if (obj[k] !== undefined) clone[k] = obj[k];
        else delete clone[k];
      }
      normalizeStateUnits(clone, type);
      clone.time = t;
      obj.states = obj.states || [];
      obj.states.push(clone);
      sortObjectStates(obj);
      resolveAllLaneOverlaps([obj.id]);
      return clone;
    }

    function buildStageTarget(entry, stOverride) {
      const st = stOverride || ensureEditableState(entry.obj, entry.type);
      const xu = unitField(st.x, 'stagex');
      const yu = unitField(st.y, 'stagey');
      const info = preview.ctxInfo();
      const basis = preview.stageOriginDragBasis(entry.obj, st, info, xu, yu);
      const p0 = preview.stageOriginPx(entry.obj, st, info, xu, yu);
      return {
        kind: 'stage', obj: entry.obj, st,
        p0, W: info.W, H: info.H,
        x: { start: xu.value, unit: xu.unit, def: 'stagex', basis: basis.bx },
        y: { start: yu.value, unit: yu.unit, def: 'stagey', basis: basis.by },
        apply(dPx) {
          // 拖拽终点先做网格吸附（图片/文字等舞台对象），再换算回单位增量。
          const sp = snapDragPoint(this.p0.x + dPx.x, this.p0.y + dPx.y, this.W, this.H);
          const d = solveDragDeltas(sp.x - this.p0.x, sp.y - this.p0.y, this.x.basis, this.y.basis);
          if (Math.abs(d.x) > 1e-9) this.st.x = rawUnit(this.x.start + d.x, this.x.unit, this.x.def);
          if (Math.abs(d.y) > 1e-9) this.st.y = rawUnit(this.y.start + d.y, this.y.unit, this.y.def);
        }
      };
    }

    function buildLineTarget(id, endpointIndex, stOverride) {
      const entry = findObjectEntry(id);
      if (!entry || entry.type !== 'line') return null;
      const st = stOverride || ensureEditableState(entry.obj, 'line');
      const pos = Array.isArray(st.pos) ? st.pos : [];
      if (!pos.length) return null;
      const info = preview.ctxInfo();
      const endpoints = pos.map((p, i) => {
        const xu = unitField(p.x, 'notex');
        const yu = unitField(p.y, 'notey');
        const zu = unitField(p.z, 'world');
        const basis = preview.worldUnitDragBasis(xu, yu, zu, info);
        return {
          idx: i,
          x: { start: xu.value, unit: xu.unit, def: 'notex', basis: basis.bx },
          y: { start: yu.value, unit: yu.unit, def: 'notey', basis: basis.by }
        };
      });
      return {
        kind: 'line', obj: entry.obj, st, endpoints,
        dragIndex: endpointIndex != null ? endpointIndex : -1, // -1 = whole body
        apply(dPx) {
          for (const ep of this.endpoints) {
            if (this.dragIndex >= 0 && ep.idx !== this.dragIndex) continue;
            const d = solveDragDeltas(dPx.x, dPx.y, ep.x.basis, ep.y.basis);
            const p = this.st.pos[ep.idx];
            if (Math.abs(d.x) > 1e-9) p.x = rawUnit(ep.x.start + d.x, ep.x.unit, ep.x.def);
            if (Math.abs(d.y) > 1e-9) p.y = rawUnit(ep.y.start + d.y, ep.y.unit, ep.y.def);
          }
        }
      };
    }

    function buildNoteTarget(info) {
      const st = ensureEditableState(info.nc, 'note_controller');
      const evalSt = info.evalSt;
      // override_x without an explicit x falls back to the field center (0.5),
      // matching the engine's note_controller placeholder behavior.
      const xRaw = evalSt && evalSt.x != null ? evalSt.x : 0.5;
      const yRaw = evalSt && evalSt.y != null ? evalSt.y : 0.5;
      const xu = unitField(xRaw, 'notex');
      const yu = unitField(yRaw, 'notey');
      const zu = unitField(st.z, 'world');
      const basis = preview.worldUnitDragBasis(xu, yu, zu, preview.ctxInfo());
      return {
        kind: 'note', obj: info.nc, st,
        x: info.ox ? { start: xu.value, unit: xu.unit, def: 'notex', basis: basis.bx } : null,
        y: info.oy ? { start: yu.value, unit: yu.unit, def: 'notey', basis: basis.by } : null,
        apply(dPx) {
          if (this.x && this.y) {
            const d = solveDragDeltas(dPx.x, dPx.y, this.x.basis, this.y.basis);
            this.st.x = rawUnit(this.x.start + d.x, this.x.unit, this.x.def);
            this.st.y = rawUnit(this.y.start + d.y, this.y.unit, this.y.def);
          } else if (this.x) {
            const lx = this.x.basis.x * this.x.basis.x + this.x.basis.y * this.x.basis.y;
            const d = lx > 1e-12 ? (dPx.x * this.x.basis.x + dPx.y * this.x.basis.y) / lx : 0;
            this.st.x = rawUnit(this.x.start + d, this.x.unit, this.x.def);
          } else if (this.y) {
            const ly = this.y.basis.x * this.y.basis.x + this.y.basis.y * this.y.basis.y;
            const d = ly > 1e-12 ? (dPx.x * this.y.basis.x + dPx.y * this.y.basis.y) / ly : 0;
            this.st.y = rawUnit(this.y.start + d, this.y.unit, this.y.def);
          }
        }
      };
    }

    function firstVisibleControlledNote(ncObj) {
      const ids = collectNoteIds(ncObj);
      const t = preview.time;
      for (const nid of ids) {
        const note = state.chart && state.chart.noteById ? state.chart.noteById(nid) : null;
        if (note && t >= note.intro_time && t <= preview.noteClearTime(note)) return nid;
      }
      return ids[0] || null;
    }

    // Drag targets for the current grab: a single endpoint, the clicked
    // object alone, or every selected draggable object (batch move).
    function buildDragTargets(target, sel) {
      const out = [];
      const add = (t) => { if (t) out.push(t); };
      // 显式多选关键帧：预览拖拽直接作用于每个选中关键帧的状态（line 节点或
      // stage 的 x/y），同一屏幕位移同步应用到全部选中关键帧。
      const kfs = (state.selectedKfs || []).filter((kf) => kf && kf.objId != null);
      if (kfs.length > 1 && targetSelected(target, sel)) {
        const ep = target.kind === 'lineEndpoint' ? target.endpointIndex : null;
        const seen = new Set();
        for (const kf of kfs) {
          const rid = splitEntryId(kf.objId).rawId;
          const key = rid + '::' + kf.index;
          if (seen.has(key)) continue;
          seen.add(key);
          const entry = findObjectEntry(rid);
          if (!entry || !entry.obj) continue;
          const st = kf.index === -1 ? entry.obj : (entry.obj.states || [])[kf.index];
          if (!st) continue;
          if (entry.type === 'line') add(buildLineTarget(entry.obj.id, ep, st));
          else if (entry.type === 'sprite' || entry.type === 'text' || entry.type === 'video') add(buildStageTarget(entry, st));
        }
        if (out.length) return out;
      }
      if (target.kind === 'lineEndpoint') {
        add(buildLineTarget(target.id, target.endpointIndex));
        return out;
      }
      const ids = sel ? sel.ids : state.selectedIds;
      if (targetSelected(target, sel) && ids.length > 1) {
        for (const id of ids) {
          if (isNoteEntry(id)) {
            const ni = noteDragInfo(splitEntryId(id).noteId);
            if (ni) add(buildNoteTarget(ni));
            continue;
          }
          const entry = findObjectEntry(splitEntryId(id).rawId);
          if (!entry) continue;
          if (entry.type === 'sprite' || entry.type === 'text' || entry.type === 'video') add(buildStageTarget(entry));
          else if (entry.type === 'line') add(buildLineTarget(entry.obj.id, null));
          else if (entry.type === 'note_controller') {
            const nid = firstVisibleControlledNote(entry.obj);
            if (nid != null) {
              const ni = noteDragInfo(nid);
              if (ni) add(buildNoteTarget(ni));
            }
          }
        }
        return out;
      }
      if (target.kind === 'note') {
        const ni = noteDragInfo(target.noteId);
        if (ni) add(buildNoteTarget(ni));
      } else if (target.kind === 'lineBody') {
        add(buildLineTarget(target.id, null));
      } else {
        const entry = findObjectEntry(target.id);
        if (entry) {
          // 线段整体拖动走 pos 端点目标（line 没有 x/y 舞台字段）。
          if (entry.type === 'line') add(buildLineTarget(entry.obj.id, null));
          else add(buildStageTarget(entry));
        }
      }
      return out;
    }

    // Arm a potential drag on mousedown; returns true when the press is
    // handled by the object drag (so pan / marquee do not start).
    function tryArmObjectDrag(e) {
      if (e.button !== 0 || objectDrag) return true;
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return false;
      const p = {
        x: (e.clientX - rect.left) / rect.width * canvas.width,
        y: (e.clientY - rect.top) / rect.height * canvas.height
      };
      const target = dragTargetAt(p, pickSkip());
      if (!target) return false;
      objectDrag = {
        target, startPx: p, moved: false, targets: null, currentPx: p,
        sel: { ids: state.selectedIds.slice(), objId: state.selectedObjId }
      };
      return true;
    }

    function commitObjectDrag(drag) {
      snapshot();
      drag.targets = buildDragTargets(drag.target, drag.sel);
      if (!drag.targets.length) return;
      // An unselected object becomes the selection once actually dragged.
      if (!targetSelected(drag.target, drag.sel)) {
        const selId = drag.target.kind === 'note' ? 'note::' + drag.target.noteId : drag.target.id;
        selectObjects([selId], {});
      }
    }

    function applyDragDelta(drag) {
      const p = drag.currentPx;
      if (!p) return;
      const dPx = { x: p.x - drag.startPx.x, y: p.y - drag.startPx.y };
      for (const t of drag.targets) t.apply(dPx);
      const dragIds = drag.targets.map((t) => t.obj && t.obj.id).filter(Boolean);
      if (dragIds.length) resolveAllLaneOverlaps(dragIds);
      dirtyAndRefresh(false);
    }

    function finishObjectDrag(drag) {
      if (!drag.targets || drag.targets.length !== 1) return;
      const t = drag.targets[0];
      const idx = t.st === t.obj ? -1 : (t.obj.states || []).indexOf(t.st);
      // 拖动的若是对象本体（K0）视为对象级选中，避免 Ctrl+C 误复制成关键帧。
      selectObject(t.obj.id, idx === -1 ? null : idx);
    }

    canvas.addEventListener('click', (e) => {
      if (suppressNextCanvasClick) { suppressNextCanvasClick = false; return; }
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const p = rectToCanvas(e);
      // note 选择器手动拾取模式：点击 note 直接加入选择器，不改变选中状态。
      if (state.notePickerActive) {
        const pickNote = preview.hitTestNote(p.x, p.y);
        if (pickNote) pickNoteToSelector(pickNote.id);
        return;
      }
      const id = preview.hitTestPick(p.x, p.y, state.pickMode || 'note', pickSkip());
      if (id) {
        const append = e.ctrlKey || e.metaKey;
        selectObjects([id], { append });
        // Note layer keeps the original behavior: a plain click also jumps
        // the playhead to the note's start time.
        if (!append && (state.pickMode || 'note') === 'note' && isNoteEntry(id)) {
          const nid = splitEntryId(id).noteId;
          const note = state.chart ? state.chart.noteById(nid) : null;
          if (note) jumpToNoteTime(note);
        }
      } else if (!(e.ctrlKey || e.metaKey)) {
        // 预览空白处点击：属性面板切到 controller 实时统计 + 全部属性卡片。
        state.previewEmptyFocus = true;
        selectObjects([], {});
      }
    });

    // 属性面板中未启用的 controller 卡片可拖到预览画面：在当前播放头位置
    // 实时创建该卡片对应的 controller 对象（新轨道）。
    canvas.addEventListener('dragover', (e) => {
      if (e.dataTransfer && e.dataTransfer.types &&
          Array.prototype.includes.call(e.dataTransfer.types, 'application/x-cytoid-ctrl-card')) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
      }
    });
    canvas.addEventListener('drop', (e) => {
      const raw = e.dataTransfer && e.dataTransfer.getData('application/x-cytoid-ctrl-card');
      if (!raw) return;
      e.preventDefault();
      try {
        const payload = JSON.parse(raw);
        const card = Schema.CONTROLLER_CARDS.find((c) => c.key === payload.groupKey);
        if (!card) return;
        const owners = controllerCardOwners();
        if (owners[card.key] != null) {
          toast('该卡片已被其它控制器轨道启用，不能重复引用', true);
          return;
        }
        createControllerWithCards([card.key], preview.time);
      } catch (err) { /* 非卡片拖拽 */ }
    });

    canvas.addEventListener('mousedown', (e) => {
      if (e.button !== 0 || tryArmObjectDrag(e)) return;
      if (previewZoom > 1.001) return;
      const p = rectToCanvas(e);
      const r = wrap.getBoundingClientRect();
      marquee = { x1: p.x, y1: p.y, cx1: e.clientX - r.left, cy1: e.clientY - r.top, moved: false };
      marqueeEl.style.display = 'none';
      wrap.appendChild(marqueeEl);
    });
    document.addEventListener('mousemove', (e) => {
      if (!marquee) return;
      const r = wrap.getBoundingClientRect();
      const cx = e.clientX - r.left, cy = e.clientY - r.top;
      if (!marquee.moved && Math.hypot(cx - marquee.cx1, cy - marquee.cy1) > 4) marquee.moved = true;
      if (marquee.moved) {
        marqueeEl.style.display = 'block';
        marqueeEl.style.left = Math.min(marquee.cx1, cx) + 'px';
        marqueeEl.style.top = Math.min(marquee.cy1, cy) + 'px';
        marqueeEl.style.width = Math.abs(cx - marquee.cx1) + 'px';
        marqueeEl.style.height = Math.abs(cy - marquee.cy1) + 'px';
      }
    });
    document.addEventListener('mouseup', (e) => {
      if (!marquee) return;
      const p = rectToCanvas(e);
      const wasMarquee = marquee.moved;
      if (wasMarquee) {
        const mode = state.pickMode || 'note';
        const ids = preview.hitTestPickRect(marquee.x1, marquee.y1, p.x, p.y, mode, pickSkip());
        selectObjects(ids, { append: e.ctrlKey || e.metaKey });
      }
      marqueeEl.remove();
      marquee = null;
      suppressNextCanvasClick = wasMarquee;
    });

    // Live object dragging: once the pointer moves past the threshold, the
    // grabbed object (or every selected object) follows the mouse in its own
    // coordinate system. The final click is suppressed after a real drag.
    document.addEventListener('mousemove', (e) => {
      if (!objectDrag) return;
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      objectDrag.currentPx = {
        x: (e.clientX - rect.left) / rect.width * canvas.width,
        y: (e.clientY - rect.top) / rect.height * canvas.height
      };
      if (!objectDrag.moved) {
        const d = objectDrag.currentPx;
        if (Math.hypot(d.x - objectDrag.startPx.x, d.y - objectDrag.startPx.y) <= 4) return;
        commitObjectDrag(objectDrag);
        objectDrag.moved = true;
        suppressNextCanvasClick = true;
        wrap.classList.add('object-dragging');
      }
      applyDragDelta(objectDrag);
    });
    document.addEventListener('mouseup', () => {
      if (!objectDrag) return;
      if (objectDrag.moved) finishObjectDrag(objectDrag);
      objectDrag = null;
      wrap.classList.remove('object-dragging');
    });

    canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const x = (e.clientX - rect.left) / rect.width * canvas.width;
      const y = (e.clientY - rect.top) / rect.height * canvas.height;
      const note = preview.hitTestNote(x, y);
      if (!note) return;
      const nc = findNoteControllerForNote(note.id);
      // 合并的多 note 选择器控制器（含带 note 选择器的合并 stage 对象）：
      // 右键单个 note 进入“单独编辑”页（首次修改独立），而不是直接打开合并块
      // 的整体编辑页，也不是“创建新 note_controller”页面。
      const ncMergedBlock = nc && isNoteSelectorMerged(nc.id) && nc.note && typeof nc.note === 'object'
        ? { group: 'note_controllers', type: 'note_controller', obj: nc }
        : null;
      const mergedBlock = ncMergedBlock || (nc ? null : findMergedBlockForNote(note.id));
      const noteMenu = [
        // 跳转
        { label: '跳转至note的渐入时间', action: () => setTime(note.intro_time, false) },
        ...(note.type === 1 || note.type === 2
          ? [{ label: __t('跳转至end:') + note.id, action: () => setTime(note.end_time, false) }]
          : []),
        { sep: true },
        // 复制时间
        { label: '复制note时间', action: () => {
          const v = note.start_time.toFixed(3);
          navigator.clipboard.writeText(v).then(() => toast(__t('已复制 note 时间: ') + v));
        } },
        { label: '复制note的渐入（intro）时间', action: () => {
          const v = note.intro_time.toFixed(3);
          navigator.clipboard.writeText(v).then(() => toast(__t('已复制 note 渐入（intro）时间: ') + v));
        } },
        { sep: true },
        // 复制坐标
        { label: '复制noteX', action: () => {
          navigator.clipboard.writeText('notex:' + note.x).then(() => toast(__t('已复制 noteX: ') + note.x));
        } },
        { label: '复制noteY', action: () => {
          navigator.clipboard.writeText('notey:' + note.chartY).then(() => toast(__t('已复制 noteY: ') + note.chartY));
        } },
        { sep: true },
        // 编辑 / 创建 / 单独编辑 note_controller
        mergedBlock
          ? { label: __t('单独编辑note') + note.id + __t('的note_controller（位于合并时间块 ') + mergedBlock.obj.id + __t('）'), action: () => openNoteInMergedBlock(note.id, mergedBlock.obj) }
          : nc
            ? { label: __t('编辑note') + note.id + __t('的note_controller'), action: () => selectObject(nc.id, null) }
            : { label: __t('对此note（') + note.id + __t('）创建note_controller'), action: () => openPendingNoteController(note.id) },
        // drag / C-drag：专属选择整条锁链（链头沿 next_id 一路收集）。
        ...(note.type === 3 || note.type === 4 || note.type === 6 || note.type === 7
          ? [{ sep: true }, { label: '选择整条锁链', action: () => selectDragChain(note.id) }]
          : [])
      ];
      showContextMenu(e.clientX, e.clientY, noteMenu);
    });

    // Drag-and-drop: drop supported files onto the window to open/import them.
    document.addEventListener('dragover', (e) => {
      e.preventDefault();
    });
    document.addEventListener('drop', async (e) => {
      e.preventDefault();
      const files = Array.from((e.dataTransfer && e.dataTransfer.files) || []);
      for (const f of files) {
        let p = null;
        try {
          p = window.sbAPI.getPathForFile ? window.sbAPI.getPathForFile(f) : (f.path || null);
        } catch (err) {
          p = null;
        }
        if (!p) continue;
        const ext = p.split('.').pop().toLowerCase();
        try {
          if (ext === 'ctr' || ext === 'ctdsber') {
            await openProjectFilePath(p);
            toast(__t('已打开项目: ') + p);
          } else if (ext === 'cytoidlevel' || ext === 'zip') {
            if (!(await confirmDiscardUnsaved('导入新项目'))) return;
            const res = await window.sbAPI.projectImportLevelPath({
              filePath: p
            });
            if (res) {
              await loadLevelInfo(res.info, { projectPath: res.projectPath, config: res.config });
              toast(__t('已导入关卡并创建新项目: ') + res.projectPath);
            }
          } else if (ext === 'json') {
            toast('请使用“导入 StoryBoard JSON”或项目设置加载');
          } else if (ext === 'txt') {
            toast('请通过项目设置的“谱面”加载');
          } else {
            toast('不支持的文件格式: .' + ext, true);
          }
        } catch (err) {
          toast(__t('读取拖入文件失败: ') + err.message, true);
        }
      }
    });

    // Mouse wheel over the preview scrubs the timeline
    wrap.addEventListener('wheel', (e) => {
      if (document.body.classList.contains('welcome-mode')) return;
      e.preventDefault();
      step(e.deltaY > 0 ? 0.05 : -0.05);
    }, { passive: false });

    // Drop library assets onto the preview to create sprites (editor-style)
    wrap.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    });
    wrap.addEventListener('drop', (e) => {
      const name = e.dataTransfer.getData('text/asset-name');
      if (name) {
        e.preventDefault();
        addSpriteFromDrop(name, e.clientX, e.clientY);
      }
    });

    // 外部图片/视频可直接拖进素材库（会自动拷贝进项目文件夹）。
    const assetListEl = $('#assetList');
    const IMG_VIDEO_RE = /\.(png|jpe?g|mp4|webm)$/i;
    assetListEl.addEventListener('dragover', (e) => {
      if (e.dataTransfer && Array.prototype.includes.call(e.dataTransfer.types, 'Files')) {
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'copy';
      }
    });
    assetListEl.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const files = Array.from((e.dataTransfer && e.dataTransfer.files) || []);
      for (const f of files) {
        let p = null;
        try {
          p = window.sbAPI.getPathForFile ? window.sbAPI.getPathForFile(f) : (f.path || null);
        } catch (err) {
          p = null;
        }
        if (!p) continue;
        if (IMG_VIDEO_RE.test(p)) addAssetByPath(p);
        else toast('仅支持图片/视频拖入素材库', true);
      }
    });

    // Load settings
    try {
      const s = await window.sbAPI.getSettings();
      if (s) state.settings = { ...state.settings, ...s };
    } catch (e) {}
    // 语言初始化：应用保存的语言并翻译静态 DOM 与属性面板 schema。
    if (window.SBi18n) {
      window.SBi18n.setLanguage(state.settings.language || 'zh-CN', false);
      window.SBi18n.applyStatic();
      window.SBi18n.localizeSchema();
      const wl = $('#welcomeLang');
      if (wl) wl.value = window.SBi18n.getLanguage();
    }
    // Restore the remembered volume onto the slider and the audio player.
    const savedVol = typeof state.settings.volume === 'number' && isFinite(state.settings.volume)
      ? Math.min(1, Math.max(0, state.settings.volume))
      : 1;
    state.volume = savedVol;
    if (timeline && timeline.volSlider) {
      timeline.volSlider.value = String(Math.round(savedVol * 100));
    }
    if (preview.audio) preview.audio.volume = savedVol;

    // File association: a .ctr / .ctdsber double-click (or a second instance
    // launch with a project file) is delivered by the main process.
    window.sbAPI.onOpenProjectFile((filePath) => {
      openProjectFilePath(filePath).catch((e) => toast(__t('打开项目失败: ') + e.message, true));
    });
    // note 选择器外部窗口开关：属性页 Note 输入框的显示随其同步。
    if (window.sbAPI && window.sbAPI.nsOnWindowState) {
      window.sbAPI.nsOnWindowState((s) => {
        const open = !!(s && s.open);
        if (state.nsWindowOpen !== open) {
          state.nsWindowOpen = open;
          if (!document.body.classList.contains('welcome-mode')) renderProperties();
        }
      });
    }
    window.sbAPI.rendererReady();

    showWelcome();
    requestAnimationFrame(loop);
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  document.addEventListener('DOMContentLoaded', init);

  // Test/debug hooks
  window.__sb = {
    loadLevelInfo,
    chooseChart,
    projectSettingsFlow,
    difficultyDisplayLabel,
    openNoteSelectorEditor,
    openProjectFilePath,
    setTime,
    refreshAll,
    togglePlay,
    showWelcome,
    hideWelcome,
    state,
    timeline,
    preview,
    deleteSelection,
    copySelection,
    undo,
    redo,
    selectObject,
    selectKeyframe,
    selectObjects,
    shiftClips,
    moveKeyframes,
    shiftObjectOrder,
    loadThumbnail,
    storyboardJson,
    storyboardCompiledJson,
    switchDifficultyFlow,
    addKeyframeAtPlayhead,
    copyKeyframe,
    copyKeyframesToClipboard,
    pasteKeyframesAtPlayhead,
    copyObjectsToClipboard,
    pasteObjectsAtPlayhead,
    reorderObjectLane,
    readCysterTrackGroups,
    collectNoteSelectorMeta,
    reconstructNoteSelectors,
    collectNoteIds,
    scanLostNoteMappings,
    resolveAllLaneOverlaps,
    objectKeyframesAllNotes,
    ensureNoteSelectorParent,
    noteControllerIdWithHandoff,
    createNoteControllerWithIdHandoff,
    setNoteSelectorMerge,
    repairMergedBlocks,
    nsWriteTime,
    pickNoteToSelector,
    nsBridge: (method, args) => {
      const a = args || [];
      if (method === 'getContext') return nsGetContext();
      if (method === 'apply') return nsApply(a[0] || {});
      if (method === 'highlight') return nsHighlight(a[0]);
      if (method === 'pick') return nsSetPick(!!a[0]);
      if (method === 'clearTarget') { state.nsTimeTarget = null; return true; }
      if (method === 'writeTime') return nsWriteTime(a[0] || {});
      if (method === 'draft') return nsDraftSet(a[0] || {});
      if (method === 'discard') { nsDraft = null; return true; }
      return null;
    },
    collectNoteTimeTokens,
    applyNoteTimeTokens,
    renderProperties,
    captureLanePushState,
    finalizeLanePushes,
    sortAllObjectStates,
    saveStoryboard,
    relinkAsset,
    addAssetByPath
  };
})();
