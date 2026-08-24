// Chart parsing and timing math, ported from Cytoid v2.0.2 (Chart.cs / ChartModel.cs)
(() => {
  const J = (typeof window !== 'undefined' ? window.SBEngine.json : require('./json.js'));
  const C = (typeof window !== 'undefined' ? window.SBEngine.colors : require('./colors.js'));

  const NOTE_TYPES = {
    // Exact NoteType enum from the decompiled CytoidPlayer (Assembly-CSharp.dll)
    0: 'click', 1: 'hold', 2: 'long_hold', 3: 'drag_head', 4: 'drag_child',
    5: 'flick', 6: 'c_drag_head', 7: 'c_drag_child'
  };

  const SPEED_UP_COLOR = { r: 0.82352, g: 0.33725, b: 0.41176, a: 1 };
  const SPEED_DOWN_COLOR = { r: 0.6289, g: 0.78125, b: 0.75, a: 1 };
  const WHITE = { r: 1, g: 1, b: 1, a: 1 };

  // ChartEventType（游戏 ChartUiEventTimeline.cs）
  const CHART_EVENT_TYPES = {
    SpeedUp: 0, SpeedDown: 1, ShowUi: 2, HideUi: 3,
    FadeInUi: 4, FadeOutUi: 5, AnimationInUi: 6, AnimationOutUi: 7, Message: 8
  };
  const EVENT_KINDS = {};
  for (const k of Object.keys(CHART_EVENT_TYPES)) EVENT_KINDS[CHART_EVENT_TYPES[k]] = k;

  // 变速/消息事件的演示时间轴常量（游戏 ChartEventPresentationTimeline.cs）
  const PRESENT_FADE_IN = 1;
  const PRESENT_HOLD = 3;
  const PRESENT_FADE_OUT = 1;
  const PRESENT_TOTAL = PRESENT_FADE_IN + PRESENT_HOLD + PRESENT_FADE_OUT;
  const PRESENT_TEXT_DURATION = 1.5;
  const PRESENT_TEXT_FADE = 0.4;
  const PRESENT_TEXT_HOLD = PRESENT_TEXT_DURATION - PRESENT_TEXT_FADE * 2;
  const PRESENT_MAX_LETTER_SPACING = 192;

  const lerpColor = (a, b, t) => ({
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t,
    a: a.a != null && b.a != null ? a.a + (b.a - a.a) * t : (b.a != null ? b.a : 1)
  });

  class Chart {
    constructor(text, opts = {}) {
      this.opts = opts;
      this.horizontalMargin = opts.horizontalMargin != null ? opts.horizontalMargin : 3;
      this.verticalMargin = opts.verticalMargin != null ? opts.verticalMargin : 3;
      // Matches the player's default setting (scanner smoothing on)
      this.useScannerSmoothing = opts.useScannerSmoothing !== undefined ? !!opts.useScannerSmoothing : true;
      this.baseSize = opts.baseSize || 5;
      this.orthoSize = this.baseSize;
      this.screenRatio = opts.screenRatio || 16 / 9;
      this.currentEventId = 0;

      let model = null;
      try {
        model = J.parse(text);
      } catch (e) {
        model = null;
      }
      if (!model || typeof model !== 'object' || (!Array.isArray(model.page_list) && !Array.isArray(model.note_list))) {
        // Original Cytoid falls back to the legacy text format when JSON parsing fails
        model = this.fromLegacyChart(text);
      }
      this.model = model;
      this.prepare();
    }

    prepare() {
      const m = this.model;
      m.time_base = m.time_base || 480;
      m.tempo_list = m.tempo_list || [{ tick: 0, value: 1000000 }];
      m.page_list = m.page_list || [];
      m.note_list = m.note_list || [];
      m.event_order_list = m.event_order_list || [];
      this.notes = m.note_list;
      this.noteMap = {};

      // Music offset
      this.musicOffset = m.music_offset || 0;

      const height = this.baseSize * 2;
      const width = height * this.screenRatio;
      const topRatio = 0.0966666;
      const bottomRatio = 0.07;
      this.horizontalRatio = 0.8 + (5 - this.horizontalMargin - 1) * 0.02;
      this.verticalRatio = 1 - width * (topRatio + bottomRatio) / height + (3 - this.verticalMargin) * 0.05;
      this.verticalOffset = -(width * 0.013333298);

      for (const ev of m.event_order_list) ev.time = this.convertToTime(ev.tick);
      m.event_order_list.sort((a, b) => a.time - b.time);
      // 读取变速/消息等事件：把 event_order_list 解析为带类型的事件列表。
      this.events = [];
      let seq = 0;
      for (const order of m.event_order_list) {
        if (!order || !Array.isArray(order.event_list)) continue;
        for (const ev of order.event_list) {
          if (!ev || ev.type == null) continue;
          this.events.push({
            time: order.time,
            tick: order.tick,
            type: ev.type,
            kind: EVENT_KINDS[ev.type] || ('Type' + ev.type),
            args: ev.args,
            sequence: seq++
          });
        }
      }
      this.events.sort((a, b) => (a.time - b.time) || (a.sequence - b.sequence));
      // 自动生成变速事件：显式 SpeedUp/SpeedDown 事件 + tempo_list 每次
      // 变速（滚动速度变化）自动生成一条 tempo 变速事件。
      this.speedEvents = [];
      for (const ev of this.events) {
        if (ev.type === CHART_EVENT_TYPES.SpeedUp || ev.type === CHART_EVENT_TYPES.SpeedDown) {
          this.speedEvents.push({
            time: ev.time,
            kind: ev.type === CHART_EVENT_TYPES.SpeedUp ? 'speedup' : 'speeddown',
            explicit: true,
            value: ev.type === CHART_EVENT_TYPES.SpeedUp ? 1 : -1
          });
        }
      }
      for (let i = 1; i < m.tempo_list.length; i++) {
        this.speedEvents.push({
          time: this.convertToTime(m.tempo_list[i].tick),
          kind: 'tempo',
          explicit: false,
          tick: m.tempo_list[i].tick,
          value: m.tempo_list[i].value
        });
      }
      this.speedEvents.sort((a, b) => a.time - b.time);

      for (let i = 0; i < m.page_list.length; i++) {
        const page = m.page_list[i];
        page.start_time = this.convertToTime(page.start_tick);
        page.end_time = this.convertToTime(page.end_tick);
        page.duration = page.end_time - page.start_time;
        page.length_tick = page.end_tick - page.start_tick;
        this.bakePageArgs(page);
        if (i !== 0) {
          page.actual_start_tick = m.page_list[i - 1].end_tick;
          page.actual_start_time = m.page_list[i - 1].end_time;
        } else {
          page.actual_start_tick = 0;
          page.actual_start_time = 0;
        }
      }

      for (const note of m.note_list) {
        const type = note.type;
        this.noteMap[note.id] = note;
        const page = m.page_list[note.page_index] || m.page_list[m.page_list.length - 1];
        note.direction = page.scan_line_direction;
        // Unity Chart: speed = base (scanline-speed) x approachRateMultiplier
        // (mod) x note.approach_rate, clamped to a positive finite value.
        const arMult = this.opts && this.opts.approachRateMultiplier != null
          ? this.opts.approachRateMultiplier : 1;
        const ar = note.approach_rate != null ? Number(note.approach_rate) : 1;
        let speed = (note.page_index === 0 ? 1.0 : this.calculateNoteSpeed(note)) * arMult * ar;
        if (!isFinite(speed) || speed <= 1e-4) speed = 1;
        // Unity Chart.cs: DragHead/DragChild/CDragChild use 0.7; the rest
        // (Click/Hold/LongHold/Flick/CDragHead) use 0.4.
        if (type === 3 || type === 4 || type === 7) note.initial_scale = 0.7;
        else note.initial_scale = 0.4;
        note.start_time = this.convertToTime(note.tick);
        note.end_time = this.convertToTime(note.tick + (note.hold_tick || 0));
        const dragIntro = type === 3 || type === 4 || type === 6 || type === 7;
        note.intro_time = note.start_time - (dragIntro ? 1.175 : 1.367) / speed;
        note.worldX = this.convertChartXToScreenX(note.x);
        note.worldY = this.getNoteScreenY(note);
        note.chartY = this.getNoteChartY(note);
        // 页长变更：hold 长度按页位置函数（EvaluateDisplayY）的实际位移计算，
        // 与游戏 Chart.GetHoldScreenLength 一致；线性页等价于旧公式。
        const hSpan = (page.end_tick - page.start_tick) || 1;
        const p0 = (note.tick - page.start_tick) / hSpan;
        const p1 = (note.tick + (note.hold_tick || 0) - page.start_tick) / hSpan;
        note.holdlength = this.verticalRatio * this.baseSize *
          Math.abs(this.evaluateDisplayY(page, p1) - this.evaluateDisplayY(page, p0));
        note.typeName = NOTE_TYPES[type] || 'click';
      }

      this.endTime = m.page_list.length ? m.page_list[m.page_list.length - 1].end_time : 0;
      this.buildEventPresentation();
    }

    convertToTime(tick) {
      const m = this.model;
      let result = 0;
      let currentTick = 0;
      let currentZone = 0;
      for (let i = 1; i < m.tempo_list.length; i++) {
        if (m.tempo_list[i].tick >= tick) break;
        result += (m.tempo_list[i].tick - currentTick) * 1e-6 * m.tempo_list[i - 1].value / m.time_base;
        currentTick = m.tempo_list[i].tick;
        currentZone++;
      }
      result += (tick - currentTick) * 1e-6 * m.tempo_list[currentZone].value / m.time_base;
      return result;
    }

    convertToTick(time) {
      const m = this.model;
      let currentTime = 0;
      let currentTick = 0;
      let i;
      for (i = 1; i < m.tempo_list.length; i++) {
        const delta = (m.tempo_list[i].tick - m.tempo_list[i - 1].tick) / m.time_base * m.tempo_list[i - 1].value * 1e-6;
        if (currentTime + delta < time) {
          currentTime += delta;
          currentTick = m.tempo_list[i].tick;
        } else break;
      }
      return Math.round(currentTick + (time - currentTime) / m.tempo_list[i - 1].value * 1e6 * m.time_base);
    }

    calculateNoteSpeed(note) {
      const pages = this.model.page_list;
      const page = pages[note.page_index];
      const prev = pages[note.page_index - 1];
      const pageRatio = (note.tick - page.actual_start_tick) / (page.end_tick - page.actual_start_tick);
      const tempo = (page.end_time - page.actual_start_time) * pageRatio +
        (prev.end_time - prev.actual_start_time) * (1.367 - pageRatio);
      return tempo >= 1.367 ? 1.0 : 1.367 / tempo;
    }

    convertChartXToScreenX(x) {
      return (x * 2 * this.horizontalRatio - this.horizontalRatio) * this.baseSize * this.screenRatio;
    }

    convertChartYToScreenY(y) {
      return this.verticalRatio * (-this.baseSize + 2 * this.baseSize * y) + this.verticalOffset;
    }

    getNoteScreenY(note) {
      const page = this.model.page_list[note.page_index];
      const span = (page.end_tick - page.start_tick) || 1;
      const progress = (note.tick - page.start_tick) / span;
      return this.pageDisplayYToScreenY(this.evaluateDisplayY(page, progress));
    }

    getNoteChartY(note) {
      const page = this.model.page_list[note.page_index];
      return page.scan_line_direction * ((note.tick - page.start_tick) / (page.end_tick - page.start_tick));
    }

    getScannerPositionY(time) {
      const pages = this.model.page_list;
      let id = 0;
      while (id < pages.length && time > pages[id].end_time) id++;
      const useSmoothing = this.useScannerSmoothing;
      if (id === pages.length) {
        const last = pages[id - 1];
        // 与游戏 Chart.cs GetScannerPositionY 对齐：平滑分支用 tick 进度
        // （扫描线跟随按 tick 摆放的 note），非平滑分支用时间进度。
        const progress = useSmoothing
          ? ((this.convertToTick(time) - last.end_tick) / ((last.end_tick - last.start_tick) || 1))
          : ((time - last.end_time) / ((last.end_time - last.start_time) || 1));
        return this.pageDisplayYToScreenY(this.evaluateDisplayY(last, progress, -last.scan_line_direction));
      }
      const page = pages[id];
      const progress = useSmoothing
        ? ((this.convertToTick(time) - page.start_tick) / ((page.end_tick - page.start_tick) || 1))
        : ((time - page.start_time) / ((page.end_time - page.start_time) || 1));
      return this.pageDisplayYToScreenY(this.evaluateDisplayY(page, progress));
    }

    pageIndexAtTime(time) {
      const pages = this.model.page_list;
      let id = 0;
      while (id < pages.length && time > pages[id].end_time) id++;
      return Math.min(id, Math.max(0, pages.length - 1));
    }

    // ---- C2 PageFunction（页位置函数 / 页长变更）----
    bakePageArgs(page) {
      const pf = page.position_function;
      let args = null;
      if (pf) {
        if (Array.isArray(pf)) args = pf;
        else if (Array.isArray(pf.arguments)) args = pf.arguments;
        else if (Array.isArray(pf.Arguments)) args = pf.Arguments;
      }
      page.position_function_type = pf
        ? (pf.Type != null ? pf.Type : (pf.type != null ? pf.type : 0))
        : null;
      page.position_arg_a = args && args.length > 0 ? Number(args[0]) : 1;
      page.position_arg_b = args && args.length > 1 ? Number(args[1]) : 0;
    }

    // 归一化播放区 Y ∈ [-1,1]（底 = -1），a=1,b=0 时等价于线性全高扫描。
    evaluateDisplayY(page, progress, scanLineDirection) {
      const a = page.position_arg_a;
      const b = page.position_arg_b;
      if (Math.abs(a) < 1e-6) return Math.max(-1, Math.min(1, b));
      const dir = scanLineDirection == null ? page.scan_line_direction : scanLineDirection;
      const t = dir === 1 ? progress : (1 - progress);
      const y0 = b - a;
      const y1 = b + a;
      const d0 = Math.max(-1, Math.min(1, y0));
      const d1 = Math.max(-1, Math.min(1, y1));
      return d0 + (d1 - d0) * t;
    }

    // 页可见带（用于页边界线，游戏 PositionFunction.GetVisibleBand）。
    getVisibleBand(page) {
      const a = page.position_arg_a;
      const b = page.position_arg_b;
      if (Math.abs(a) < 1e-6) {
        const y = Math.max(-1, Math.min(1, b));
        return { low: y, high: y };
      }
      const sortedLo = Math.min(b - a, b + a);
      const sortedHi = Math.max(b - a, b + a);
      if (sortedHi < -1) return { low: -1, high: -1 };
      if (sortedLo > 1) return { low: 1, high: 1 };
      return { low: Math.max(sortedLo, -1), high: Math.min(sortedHi, 1) };
    }

    // displayY ∈ [-1,1] → 屏幕 Y（游戏 Chart.PageDisplayYToScreenY）。
    pageDisplayYToScreenY(yDisplay) {
      return this.verticalRatio * yDisplay * this.baseSize + this.verticalOffset;
    }

    // 当前页的上/下边界线位置（页长变更时边界随页可见带变化）。
    getPageBoundaryScreenY(pageId, bottom) {
      const page = this.model.page_list[Math.max(0, Math.min(pageId, this.model.page_list.length - 1))];
      const band = this.getVisibleBand(page);
      return this.pageDisplayYToScreenY(bottom ? band.low : band.high);
    }

    // ---- 变速/消息事件演示时间轴（游戏 ChartEventPresentationTimeline）----
    buildEventPresentation() {
      const drafts = [];
      let seq = 0;
      for (const ev of this.events) {
        if (ev.type === CHART_EVENT_TYPES.SpeedUp || ev.type === CHART_EVENT_TYPES.SpeedDown) {
          drafts.push({
            time: ev.time,
            kind: ev.type === CHART_EVENT_TYPES.SpeedUp ? 'speedup' : 'speeddown',
            content: '',
            color: ev.type === CHART_EVENT_TYPES.SpeedUp ? SPEED_UP_COLOR : SPEED_DOWN_COLOR,
            seq: seq++
          });
        } else if (ev.type === CHART_EVENT_TYPES.Message) {
          const parsed = this.parseMessage(ev.args);
          drafts.push({ time: ev.time, kind: 'message', content: parsed.content, color: parsed.color, seq: seq++ });
        }
      }
      drafts.sort((a, b) => (a.time - b.time) || (a.seq - b.seq));
      const snapshots = [];
      for (const d of drafts) {
        if (snapshots.length && Math.abs(snapshots[snapshots.length - 1].time - d.time) < 1e-6) {
          const prev = snapshots[snapshots.length - 1];
          snapshots[snapshots.length - 1] = {
            time: d.time, kind: d.kind, content: d.content,
            startColor: prev.startColor, color: d.color,
            textRunStart: prev.textRunStart, textRunEnd: prev.textRunEnd
          };
          continue;
        }
        const startColor = snapshots.length === 0 ? WHITE : this.resolveScanColor(snapshots[snapshots.length - 1], d.time);
        snapshots.push({
          time: d.time, kind: d.kind, content: d.content, startColor, color: d.color,
          textRunStart: d.time, textRunEnd: d.time + PRESENT_TEXT_DURATION
        });
      }
      // 消息文字共用透明度段（游戏 BuildMessageOpacityRuns）。
      for (let s = 0; s < snapshots.length;) {
        if (snapshots[s].kind !== 'message' || !snapshots[s].content) { s++; continue; }
        let e = s;
        while (e + 1 < snapshots.length && snapshots[e + 1].kind === 'message' &&
          snapshots[e + 1].content && snapshots[e + 1].time < snapshots[e].time + PRESENT_TEXT_DURATION) e++;
        const runStart = snapshots[s].time;
        const holdStart = Math.max(runStart + PRESENT_TEXT_FADE, snapshots[e].time);
        const runEnd = holdStart + PRESENT_TEXT_HOLD + PRESENT_TEXT_FADE;
        for (let idx = s; idx <= e; idx++) {
          snapshots[idx].textRunStart = runStart;
          snapshots[idx].textRunEnd = runEnd;
        }
        s = e + 1;
      }
      this._eventSnapshots = snapshots;
    }

    resolveScanColor(snap, time) {
      const elapsed = time - snap.time;
      if (elapsed < 0 || elapsed >= PRESENT_TOTAL) return WHITE;
      if (elapsed < PRESENT_FADE_IN) return lerpColor(snap.startColor, snap.color, elapsed / PRESENT_FADE_IN);
      if (elapsed < PRESENT_FADE_IN + PRESENT_HOLD) return snap.color;
      return lerpColor(snap.color, WHITE, (elapsed - PRESENT_FADE_IN - PRESENT_HOLD) / PRESENT_FADE_OUT);
    }

    easeOutCubic(p) {
      p = Math.max(0, Math.min(1, p));
      const inv = 1 - p;
      return 1 - inv * inv * inv;
    }

    resolveEventTextAlpha(elapsed, duration) {
      duration = duration || PRESENT_TEXT_DURATION;
      if (elapsed <= 0 || elapsed >= duration) return 0;
      if (elapsed < PRESENT_TEXT_FADE) return this.easeOutCubic(elapsed / PRESENT_TEXT_FADE);
      const fadeOutStart = duration - PRESENT_TEXT_FADE;
      if (elapsed < fadeOutStart) return 1;
      return 1 - this.easeOutCubic((elapsed - fadeOutStart) / PRESENT_TEXT_FADE);
    }

    resolveLetterSpacing(kind, elapsed) {
      const progress = Math.max(0, Math.min(1, elapsed / PRESENT_TEXT_DURATION));
      if (kind === 'message') return PRESENT_MAX_LETTER_SPACING * progress * progress * progress * progress * progress;
      const eased = Math.sqrt(1 - (progress - 1) * (progress - 1));
      return kind === 'speeddown'
        ? PRESENT_MAX_LETTER_SPACING * (1 - eased)
        : PRESENT_MAX_LETTER_SPACING * eased;
    }

    parseMessage(args) {
      args = args || '';
      let sep = -1;
      for (let i = args.length - 1; i >= 0; i--) {
        if (args[i] !== ',') continue;
        if (/^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(args.slice(i + 1).trim())) { sep = i; break; }
      }
      if (sep < 0) {
        for (let i = 0; i < args.length; i++) {
          if (args[i] === '\\' && i + 1 < args.length && (args[i + 1] === ',' || args[i + 1] === '\\')) { i++; continue; }
          if (args[i] === ',') { sep = i; break; }
        }
      }
      const contentText = sep < 0 ? args : args.slice(0, sep);
      const colorText = sep < 0 ? '' : args.slice(sep + 1).trim();
      let out = '';
      for (let i = 0; i < contentText.length; i++) {
        if (contentText[i] === '\\' && i + 1 < contentText.length &&
          (contentText[i + 1] === ',' || contentText[i + 1] === '\\')) out += contentText[++i];
        else out += contentText[i];
      }
      let color = WHITE;
      if (/^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(colorText)) {
        const h = colorText.slice(1);
        color = {
          r: parseInt(h.slice(0, 2), 16) / 255,
          g: parseInt(h.slice(2, 4), 16) / 255,
          b: parseInt(h.slice(4, 6), 16) / 255,
          a: h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1
        };
      }
      return { content: out, color };
    }

    // 当前时刻的变速/消息演示状态；无事件返回 null。
    eventPresentationAt(time) {
      const snaps = this._eventSnapshots || [];
      let idx = -1;
      for (let i = 0; i < snaps.length; i++) {
        if (snaps[i].time <= time) idx = i;
        else break;
      }
      if (idx < 0) return null;
      const snap = snaps[idx];
      const elapsed = time - snap.time;
      if (elapsed < 0 || elapsed >= PRESENT_TOTAL) return null;
      const hasText = snap.kind !== 'message' || !!snap.content;
      const duration = snap.textRunEnd - snap.textRunStart;
      return {
        kind: snap.kind,
        content: snap.content,
        color: this.resolveScanColor(snap, time),
        targetColor: snap.color,
        textAlpha: hasText
          ? this.resolveEventTextAlpha(time - snap.textRunStart, duration)
          : 0,
        letterSpacing: this.resolveLetterSpacing(snap.kind, elapsed)
      };
    }

    getScannerPosition01(time) {
      // position in noteY (0..1 within page) at time
      const pages = this.model.page_list;
      let id = 0;
      while (id < pages.length && time > pages[id].end_time) id++;
      if (id >= pages.length) id = pages.length - 1;
      const page = pages[id];
      const p = page.scan_line_direction * ((time - page.start_time) / (page.end_time - page.start_time));
      return Math.min(1, Math.max(0, p));
    }

    scannerColorAt(time) {
      const p = this.eventPresentationAt(time);
      return p ? p.color : WHITE;
    }

    noteById(id) {
      return this.noteMap[id];
    }

    // Port of the original v2.0.2 Chart.FromLegacyChart (PAGE_SIZE/PAGE_SHIFT/NOTE/LINK text format)
    fromLegacyChart(text) {
      let pageDuration = 0;
      let pageShift = 0;
      const tmpNotes = {};
      const lines = String(text).split('\n');
      for (const raw of lines) {
        const data = raw.trim().split(/\s+/).filter(Boolean);
        if (!data.length) continue;
        const type = data[0].toUpperCase();
        if (type === 'PAGE_SIZE') pageDuration = parseFloat(data[1]);
        else if (type === 'PAGE_SHIFT') pageShift = parseFloat(data[1]);
        else if (type === 'NOTE') {
          const id = parseInt(data[1], 10);
          const note = {
            originalId: id,
            time: parseFloat(data[2]),
            x: parseFloat(data[3]),
            duration: parseFloat(data[4]) || 0,
            type: parseFloat(data[4]) > 0 ? 'hold' : 'click',
            connected: null,
            isChainHead: false
          };
          tmpNotes[id] = note;
        } else if (type === 'LINK') {
          const chain = [];
          for (let i = 1; i < data.length; i++) {
            const id = parseInt(data[i], 10);
            if (!isNaN(id) && tmpNotes[id]) {
              tmpNotes[id].type = 'drag';
              if (!chain.includes(tmpNotes[id])) chain.push(tmpNotes[id]);
            }
          }
          for (let i = 0; i < chain.length - 1; i++) chain[i].connected = chain[i + 1];
          if (chain.length) chain[0].isChainHead = true;
        }
      }
      pageShift += pageDuration;

      const sorted = Object.values(tmpNotes).sort((a, b) => a.time - b.time);
      const chronologicalIds = sorted.map((n) => n.originalId);
      let newId = 0;
      for (const noteId of chronologicalIds) {
        tmpNotes[noteId].id = newId;
        newId++;
      }

      const root = {
        time_base: 480,
        tempo_list: [{ tick: 0, value: Math.max(1, Math.round(pageDuration * 1000000)) }],
        page_list: [],
        note_list: [],
        event_order_list: [],
        music_offset: 0
      };
      let finalPageShift = pageShift;
      if (finalPageShift < 0) finalPageShift = finalPageShift + 2 * pageDuration;
      const pageShiftTickOffset = (finalPageShift / pageDuration) * 480;

      const tempoValue = Math.max(1, pageDuration * 1000000);
      let pageCount = 0;
      for (const note of Object.values(tmpNotes)) {
        const obj = {
          type: note.type === 'click' ? 0 : note.type === 'hold' ? 1 : (note.isChainHead ? 3 : 4),
          id: note.id,
          x: note.x,
          tick: note.time * 480 * 1000000 / tempoValue + pageShiftTickOffset,
          hold_tick: note.type === 'hold' ? note.duration * 480 * 1000000 / tempoValue : 0,
          next_id: note.type === 'drag' ? (note.connected ? note.connected.id : -1) : 0,
          has_sibling: false,
          is_forward: false
        };
        const page = Math.floor(obj.tick / 480);
        obj.page_index = page;
        pageCount = Math.max(pageCount, page);
        root.note_list.push(obj);
      }

      let direction = false;
      let t = 0;
      for (let i = 0; i <= pageCount; i++) {
        root.page_list.push({
          scan_line_direction: direction ? 1 : -1,
          start_tick: t,
          end_tick: t + 480
        });
        direction = !direction;
        t += 480;
      }
      root.music_offset = pageShiftTickOffset / 480 / 1000000 * (pageDuration * 1000000);
      return root;
    }
  }

  const api = { Chart, NOTE_TYPES };
  if (typeof window !== 'undefined') {
    if (!window.SBEngine) window.SBEngine = {};
    window.SBEngine.chart = api;
  }
  if (typeof module !== 'undefined') module.exports = api;
})();
