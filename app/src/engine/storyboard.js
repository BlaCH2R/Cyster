// StoryBoard engine: compile raw storyboard JSON (per the Cytoid wiki spec v2.0.2)
// into concrete objects, then evaluate object state at any time.
// Semantics follow Cytoid v2.0.2 source (Storyboard.cs, GenericStateParser.cs, easers).
(() => {
  const J = (typeof window !== 'undefined' ? window.SBEngine.json : require('./json.js'));

  const NOTE_TIME_RE = /^(start|end|intro|at):(.+?)(?::(.*))?$/;

  const STAGE_FIELDS = [
    'x', 'y', 'z', 'width', 'height',
    'rot_x', 'rot_y', 'rot_z', 'scale', 'scale_x', 'scale_y', 'opacity',
    'pivot_x', 'pivot_y', 'layer', 'order', 'fill_width', 'preserve_aspect'
  ];

  const CONTROLLER_FIELDS = [
    'storyboard_opacity', 'ui_opacity', 'scanline_opacity', 'background_dim',
    'note_opacity_multiplier', 'scanline_color', 'note_ring_color', 'note_fill_colors',
    'override_scanline_pos', 'scanline_pos',
    'perspective', 'size', 'fov', 'x', 'y', 'z', 'rot_x', 'rot_y', 'rot_z',
    'chromatical', 'chromatical_fade', 'chromatical_intensity', 'chromatical_speed',
    'bloom', 'bloom_intensity',
    'radial_blur', 'radial_blur_intensity',
    'color_adjustment', 'brightness', 'saturation', 'contrast',
    'color_filter', 'color_filter_color',
    'gray_scale', 'gray_scale_intensity',
    'noise', 'noise_intensity',
    'sepia', 'sepia_intensity',
    'chromatic', 'chromatic_intensity', 'chromatic_start', 'chromatic_end',
    'dream', 'dream_intensity',
    'fisheye', 'fisheye_intensity',
    'shockwave', 'shockwave_speed',
    'focus', 'focus_size', 'focus_color', 'focus_speed', 'focus_intensity',
    'glitch', 'glitch_intensity',
    'artifact', 'artifact_intensity', 'artifact_colorisation', 'artifact_parasite', 'artifact_noise',
    'arcade', 'arcade_intensity', 'arcade_interference_size', 'arcade_interference_speed', 'arcade_contrast',
    'tape', 'scanline_smoothing'
  ];

  const NOTE_CONTROLLER_FIELDS = [
    'override_x', 'x', 'override_y', 'y', 'override_z', 'z',
    'override_rot_x', 'rot_x', 'override_rot_y', 'rot_y', 'override_rot_z', 'rot_z',
    'override_ring_color', 'ring_color', 'override_fill_color', 'fill_color',
    'opacity_multiplier', 'size_multiplier', 'hitbox_multiplier', 'x_multiplier', 'y_multiplier', 'dx', 'dy',
    'hold_direction', 'style'
  ];

  // Units used by UnitFloat parsing
  function parseUnitValue(token, defaultUnit) {
    if (token == null) return null;
    if (typeof token === 'number') return { value: token, unit: defaultUnit };
    if (typeof token === 'string') {
      const parts = token.split(':');
      if (parts.length === 1) return { value: parseFloat(parts[0]), unit: defaultUnit };
      const unit = parts[0].toLowerCase();
      if (['world', 'stagex', 'stagey', 'notex', 'notey', 'camerax', 'cameray'].includes(unit)) {
        return { value: parseFloat(parts[1]), unit };
      }
      return { value: parseFloat(token), unit: defaultUnit };
    }
    // Accept pre-parsed unit objects ({value, unit}) defensively — the
    // property panel and some tools may write them directly.
    if (typeof token === 'object' && token.value != null) {
      const unit = token.unit || defaultUnit;
      return { value: Number(token.value), unit };
    }
    return null;
  }

  function parseColor(token) {
    if (typeof token !== 'string') return null;
    const C = (typeof window !== 'undefined' ? window.SBEngine.colors : require('./colors.js'));
    return C.parseHex(token);
  }

  // ------------------------------------------------------------------
  // Chart interface: supplied externally (see chart.js). We only need:
  //   chart.noteById(id) -> {intro_time, start_time, end_time}
  // ------------------------------------------------------------------

  class StoryboardCompiler {
    constructor(storyboardJson, chart) {
      this.chart = chart;
      this.root = storyboardJson || {};
      this.templates = {};
      this.compiled = { texts: [], sprites: [], lines: [], videos: [], controllers: [], noteControllers: [] };
      this.replacements = {};
    }

    compile() {
      // Templates
      if (this.root.templates) {
        for (const key of Object.keys(this.root.templates)) {
          this.templates[key] = this.root.templates[key];
        }
      }
      const groups = [
        ['texts', 'text'],
        ['sprites', 'sprite'],
        ['videos', 'video'],
        ['lines', 'line'],
        ['note_controllers', 'note_controller'],
        ['controllers', 'controller']
      ];
      for (const [key, type] of groups) {
        const arr = this.root[key] || [];
        let objIndex = 0;
        for (const raw of arr) {
          if (!raw || typeof raw !== 'object') continue;
          // Populate time arrays / note selectors at object level
          const populated = this.populateJObjects(raw);
          for (const obj of populated) {
            if (type === 'controller' || type === 'note_controller') {
              if (obj.time == null) obj.time = 0;
            }
            if (obj.id == null) {
              obj.id = `${type}_auto_${objIndex}`;
              objIndex++;
            }
            this.compileObject(obj, type);
          }
        }
      }
      // Unity SpawnObjects validation (matches the engine's hard errors):
      //  - target_id must reference an existing object of the SAME type
      //    ("target_id 所指对象必须与其属于同一种对象").
      //  - parent_id must reference an existing object ("does not exist").
      // The doc additionally scopes parent_id to texts and sprites; videos and
      // lines are accepted (the engine allows them) but warned.
      const stageByType = new Map();
      for (const key of ['texts', 'sprites', 'videos', 'lines']) {
        stageByType.set(key, new Set());
        for (const o of this.compiled[key]) {
          if (o.id != null) stageByType.get(key).add(o.id);
        }
      }
      const allIds = new Set();
      for (const key of Object.keys(this.compiled)) {
        for (const o of this.compiled[key]) {
          if (o.id != null) allIds.add(o.id);
        }
      }
      for (const key of ['texts', 'sprites', 'videos', 'lines']) {
        for (const o of this.compiled[key]) {
          if (o.targetId != null) {
            const targetType = [...stageByType.entries()].find(([, s]) => s.has(o.targetId));
            if (!targetType) {
              throw new Error(`Storyboard: target_id "${o.targetId}" 不存在`);
            }
            if (targetType[0] !== key) {
              throw new Error(`Storyboard: target_id "${o.targetId}" 与对象类型不一致（${targetType[0]}）`);
            }
          }
          if (o.parentId != null && !allIds.has(o.parentId)) {
            throw new Error(`Storyboard: parent_id "${o.parentId}" 不存在`);
          }
          if (o.parentId != null && key !== 'texts' && key !== 'sprites') {
            if (typeof console !== 'undefined') {
              console.warn(`Storyboard: 文档建议 parent_id 仅用于 texts/sprites（对象 ${o.id}）`);
            }
          }
        }
      }
      return this.compiled;
    }

    // Expand time arrays and note selectors/arrays at any object level.
    populateJObjects(obj) {
      const timeKeys = ['relative_time', 'add_time', 'time'];
      let expanded = [obj];
      for (const key of timeKeys) {
        const token = obj[key];
        if (Array.isArray(token)) {
          const next = [];
          for (const e of expanded) {
            for (const v of token) {
              const clone = JSON.parse(JSON.stringify(e));
              clone[key] = v;
              next.push(clone);
            }
          }
          expanded = next;
        }
      }
      const result = [];
      for (const e of expanded) {
        const noteToken = e.note;
        if (noteToken != null) {
          const noteIds = this.resolveNoteSelector(noteToken);
          for (const id of noteIds) {
            const clone = JSON.parse(JSON.stringify(e));
            clone.note = id;
            // 展开产物 id 保持唯一：id 含 "$note" 时由替换机制自然唯一
            // （如 wave_$note → wave_669）；否则多 note 时追加 "::note号"
            // （编辑器读取时据此重建回单个选择器控制器）。
            if (e.id != null && noteIds.length > 1 && String(e.id).indexOf('$note') < 0) {
              clone.id = e.id + '::' + id;
            }
            result.push(clone);
          }
        } else {
          result.push(e);
        }
      }
      return result;
    }

    resolveNoteSelector(noteToken) {
      if (Array.isArray(noteToken)) return noteToken.map(Number);
      if (typeof noteToken === 'number') return [noteToken];
      if (typeof noteToken === 'object') {
        const chartNotes = this.chart ? this.chart.notes : [];
        const sel = noteToken;
        const types = sel.type == null
          ? [0, 1, 2, 3, 4, 5, 6, 7]
          : (Array.isArray(sel.type) ? sel.type.map(Number) : [Number(sel.type)]);
        const start = sel.start == null ? -2147483648 : sel.start;
        const end = sel.end == null ? 2147483647 : sel.end;
        const minX = sel.min_x == null ? -2147483648 : sel.min_x;
        const maxX = sel.max_x == null ? 2147483647 : sel.max_x;
        const direction = sel.direction == null ? null : sel.direction;
        const ids = [];
        for (const n of chartNotes) {
          if (!types.includes(n.type)) continue;
          if (!(start <= n.id && end >= n.id)) continue;
          if (!(minX <= n.x && maxX >= n.x)) continue;
          if (direction != null && direction !== n.direction) continue;
          ids.push(n.id);
        }
        return ids;
      }
      return [];
    }

    substituteNoteId(str) {
      if (typeof str !== 'string') return str;
      return str.replace(/\$note/g, String(this.replacements.note));
    }

    // “独立即让位”：stage 对象的 $note parent 模板按 note 解析父级时，若该 note
    // 已由真实 note_controller（非纯 ID 载体、id 不是模板本身）覆盖，父级指向
    // 该控制器（选择器控制器指向其逐 note 克隆 id），而不是载体的 parent_<n>
    // 占位；否则按模板替换（parent_<n>，由载体提供）。这样 ④（先有控制器再建
    // 选择器）与 ③（控制器让 note 独立）行为一致：真实控制器承接父级引用，
    // 载体不再重复覆盖同一个 note。
    resolveStageParent(obj, template) {
      const substituted = this.substituteNoteId(template);
      const nid = obj.note != null ? Number(obj.note) : null;
      if (nid == null || Number.isNaN(nid)) return substituted;
      for (const nc of (this.root.note_controllers || [])) {
        if (!nc || nc.note == null) continue;
        if (nc.id === template) continue; // 载体（或旧版同模板真实控制器）由替换结果承接
        if (nc.id === substituted) continue; // 具体 parent_<n> 控制器：替换结果即可
        const ids = this.resolveNoteSelector(nc.note);
        if (!ids.includes(nid)) continue;
        if (ids.length > 1 && String(nc.id).indexOf('$note') < 0) {
          // 选择器控制器展开为逐 note 克隆：指向克隆 id（note_controller_1::5）
          return String(nc.id) + '::' + nid;
        }
        return String(nc.id).indexOf('$note') >= 0 ? this.substituteNoteId(String(nc.id)) : String(nc.id);
      }
      return substituted;
    }

    parseTimeString(token) {
      if (typeof token === 'number') return token;
      if (typeof token !== 'string') return null;
      const m = NOTE_TIME_RE.exec(token);
      if (!m) return null;
      const kind = m[1];
      let idStr = m[2];
      const offsetStr = m[3];
      let offset = 0;
      if (offsetStr != null) offset = parseFloat(offsetStr);
      if (idStr === '$note') idStr = String(this.replacements.note);
      const id = parseInt(idStr, 10);
      const note = this.chart ? this.chart.noteById(id) : null;
      if (!note) return null;
      const round = (t) => Math.round(t * 1e6) / 1e6;
      switch (kind) {
        case 'intro': return round(note.intro_time + offset);
        case 'start': return round(note.start_time + offset);
        case 'end': return round(note.end_time + offset);
        case 'at': return round(note.start_time + (note.end_time - note.start_time) * offset);
      }
      return null;
    }

    compileObject(rawObj, type) {
      const obj = JSON.parse(JSON.stringify(rawObj));
      // Unity keeps the $note context in `replacements` permanently: it is
      // only overwritten by a later object that carries a note field, never
      // cleared. Objects without a note field inherit the last note, so e.g.
      // `parent_id: "wave_$note"` resolves against the current context.
      if (obj.note != null) this.replacements.note = obj.note;
      const targetId = obj.target_id != null ? this.substituteNoteId(String(obj.target_id)) : null;
      const parentId = obj.parent_id != null ? this.resolveStageParent(obj, String(obj.parent_id)) : null;
      if (targetId != null && parentId != null) throw new Error(`Storyboard: 对象 ${id} 不能同时拥有 target_id 和 parent_id`);
      // Unity assigns a random id when a stage object (e.g. a target_id
      // controller) omits id. Keep such objects in the compiled list so their
      // states merge onto the target entity instead of being dropped.
      let id = obj.id != null ? this.substituteNoteId(String(obj.id)) : null;
      if (id == null && targetId != null) {
        this._anonTargetSeq = (this._anonTargetSeq || 0) + 1;
        id = '__tgt_' + this._anonTargetSeq + '_' + Math.random().toString(36).slice(2, 8);
      }
      if (id == null) return;

      const states = [];
      const initial = this.createState(null, obj, type);
      // Only keep the object-level (initial) state when the object itself
      // carries state fields. Raw wiki-style files often put everything in
      // `states[0]` and leave the object level empty; emitting that empty
      // initial would add a phantom "Text:null / Time:0" state to the compiled
      // output, which blanks the object's text in the real engine (both states
      // land at Time 0 and the null one wins).
      const isStage = type === 'text' || type === 'sprite' || type === 'video' || type === 'line';
      const hasInline = Array.isArray(obj.states) && obj.states.length > 0;
      const skipEmptyInitial = isStage || type === 'controller' || (type === 'note_controller' && hasInline);
      if (!skipEmptyInitial || !this.isPhantomState(initial, type)) states.push(initial);

      // Template states
      if (obj.template != null) {
        const tpl = this.templates[obj.template];
        if (tpl) {
          const baseTime = this.parseTimeToken(obj, obj.time);
          this.addStates(states, initial, tpl, baseTime, type);
        }
      }
      // Inline states
      const baseTime = this.parseTimeToken(obj, obj.time);
      this.addStates(states, initial, obj, baseTime, type);

      states.sort((a, b) => a.time - b.time);
      // 图片/视频路径只能在初始帧指定：后续所有帧一律沿用初始帧的路径，
      // 旧数据里关键帧自带的 path 会被忽略（与编辑器规则保持一致）。
      if (type === 'sprite' || type === 'video') {
        const firstPath = states.length ? states[0].path : null;
        for (const st of states) st.path = firstPath;
      }
      // order 同 path 一样是对象的唯一值：读取时以第一个出现的为准，自动同步
      // 到全部关键帧（旧数据里关键帧自带的 order 会被忽略）。
      if (type === 'sprite' || type === 'text' || type === 'video' || type === 'line') {
        const firstOrder = states.length ? states[0].order : null;
        for (const st of states) st.order = firstOrder;
      }
      // Unity 端对空 States 对象会崩（IsManuallySpawned → States[0] 越界）：
      // 没有任何关键帧的对象没有效果，导出时直接跳过。
      if (!states.length) return;
      const entry = { id, type, targetId, parentId, states };
      // Keep the chart reference so evaluation can interpolate across units
      // (unit conversion needs the chart's note-coordinate functions).
      entry.chart = this.chart;
      if (obj.note != null) entry.note = obj.note;
      this.compiled[this.groupFor(type)].push(entry);
    }

    groupFor(type) {
      return {
        text: 'texts',
        sprite: 'sprites',
        video: 'videos',
        line: 'lines',
        note_controller: 'noteControllers',
        controller: 'controllers'
      }[type];
    }

    parseTimeToken(obj, token) {
      const t = this.parseTimeString(token);
      if (t != null) return t;
      // fallback for non-time tokens
      return null;
    }

    addStates(states, baseState, rootObject, rootBaseTime, type) {
      let baseTime = this.parseTimeToken(rootObject, rootObject.time);
      if (baseTime == null) baseTime = rootBaseTime != null ? rootBaseTime : Number.MAX_VALUE;
      if (rootObject.states && Array.isArray(rootObject.states)) {
        let lastTime = baseTime;
        const allStates = [];
        for (const child of rootObject.states) {
          const populated = this.populateJObjects(child);
          for (const c of populated) allStates.push(c);
        }
        for (const stateJson of allStates) {
          const st = JSON.parse(JSON.stringify(stateJson));
          const objectState = this.createState(baseState, st, type);
          if (objectState.time !== Number.MAX_VALUE) baseTime = objectState.time;
          const relativeTime = st.relative_time;
          if (relativeTime != null) {
            objectState.time = baseTime + relativeTime;
          }
          const addTime = st.add_time;
          if (addTime != null) {
            objectState.time = lastTime + addTime;
          }
          states.push(objectState);
          baseState = objectState;
          lastTime = objectState.time;
          if (st.states && Array.isArray(st.states)) {
            this.addStates(states, baseState, st, rootBaseTime, type);
          }
        }
      }
    }

    createState(baseState, stateObject, type) {
      let stateJson = stateObject;
      if (stateJson.reset === true) baseState = null;

      // Template merge
      let templateObject = null;
      if (stateJson.template != null) {
        templateObject = this.templates[stateJson.template];
        if (templateObject) {
          if (stateJson.relative_time == null) stateJson.relative_time = templateObject.relative_time;
          if (stateJson.add_time == null) stateJson.add_time = templateObject.add_time;
          if (stateJson.states == null) stateJson.states = templateObject.states;
        }
      }

      const state = baseState ? JSON.parse(JSON.stringify(baseState)) : this.emptyState(type);
      const time = this.parseTimeToken(stateJson, stateJson.time);
      if (time != null) state.time = time;
      if (stateJson.easing != null) state.easing = String(stateJson.easing);
      if (stateJson.destroy != null) state.destroy = !!stateJson.destroy;

      this.applyFields(state, stateJson, type);
      return state;
    }

    emptyState(type) {
      const s = { time: Number.MAX_VALUE, easing: 'linear' };
      if (type === 'text') s.text = null;
      if (type === 'sprite' || type === 'video') { s.path = null; }
      if (type === 'line') s.pos = [];
      return s;
    }

    // The object-level (initial) state is only a real keyframe when the object
    // actually carries state fields of its own; see compileObject.
    isPhantomState(state, type) {
      const empty = this.emptyState(type);
      const keys = new Set([...Object.keys(state || {}), ...Object.keys(empty)]);
      for (const k of keys) {
        if (k === 'time' || k === 'easing') continue;
        if (JSON.stringify(state[k]) !== JSON.stringify(empty[k])) return false;
      }
      return true;
    }

    applyFields(state, json, type) {
      const copy = (key) => {
        if (json[key] !== undefined) state[key] = json[key];
      };
      const copyNum = (key) => {
        if (json[key] !== undefined) state[key] = Number(json[key]);
      };
      const copyBool = (key) => {
        if (json[key] !== undefined) state[key] = !!json[key];
      };
      const copyUnit = (key, unit) => {
        if (json[key] !== undefined) state[key] = parseUnitValue(json[key], unit);
      };
      const copyColor = (key) => {
        if (json[key] !== undefined) {
          const c = parseColor(json[key]);
          if (c) state[key] = c;
          else state[key] = null;
        }
      };

      // time / easing / destroy handled in createState
      if (type === 'text' || type === 'sprite' || type === 'video' || type === 'line') {
        for (const f of STAGE_FIELDS) {
          if (f === 'x' || f === 'y') copyUnit(f, f === 'x' ? 'stagex' : 'stagey');
          else if (f === 'z' || f === 'width') copyUnit(f, f === 'z' ? 'world' : 'stagex');
          else if (f === 'height') copyUnit(f, 'stagey');
          else if (['rot_x', 'rot_y', 'rot_z', 'scale_x', 'scale_y', 'opacity', 'pivot_x', 'pivot_y'].includes(f)) copyNum(f);
          else if (['layer', 'order'].includes(f)) copyNum(f);
          else if (f === 'fill_width') copyBool(f);
        }
        // scale overrides scale_x/scale_y
        if (json.scale !== undefined) {
          state.scale_x = Number(json.scale);
          state.scale_y = Number(json.scale);
        }
      }
      if (type === 'sprite' || type === 'video') {
        copy('path');
        copyColor('color');
        if (type === 'sprite') copyBool('preserve_aspect');
      }
      if (type === 'text') {
        copy('text');
        copy('font');
        copyColor('color');
        if (json.size !== undefined) state.size = Number(json.size);
        copy('align');
        copy('font_weight');
        if (json.letter_spacing !== undefined) state.letter_spacing = Number(json.letter_spacing);
      }
      if (type === 'line') {
        if (json.pos !== undefined && Array.isArray(json.pos)) {
          state.pos = json.pos.map((p) => ({
            x: parseUnitValue(p.x, 'notex'),
            y: parseUnitValue(p.y, 'notey'),
            z: parseUnitValue(p.z, 'world'),
            width: p.width !== undefined ? Number(p.width) : null,
            color: p.color !== undefined ? parseColor(p.color) : null
          }));
        }
        copyUnit('width', 'world');
        copyColor('color');
        copyNum('opacity');
        copyNum('layer');
        copyNum('order');
      }
      if (type === 'note_controller') {
        for (const f of NOTE_CONTROLLER_FIELDS) {
          if (json[f] === undefined) continue;
          if (f === 'x') state.x = parseUnitValue(json.x, 'notex');
          else if (f === 'y') state.y = parseUnitValue(json.y, 'notey');
          else if (f === 'z') state.z = parseUnitValue(json.z, 'world');
          else if (f === 'ring_color' || f === 'fill_color') {
            if (json[f] === null) state[f] = null;
            else copyColor(f);
          }
          else if (['override_x', 'override_y', 'override_z', 'override_rot_x', 'override_rot_y', 'override_rot_z', 'override_ring_color', 'override_fill_color'].includes(f)) copyBool(f);
          else copyNum(f);
        }
      }
      if (type === 'controller') {
        for (const f of CONTROLLER_FIELDS) {
          if (json[f] === undefined) continue;
          if (f === 'x' || f === 'y') state[f] = parseUnitValue(json[f], f === 'x' ? 'camerax' : 'cameray');
          else if (f === 'z' || f === 'scanline_pos') state[f] = parseUnitValue(json[f], f === 'z' ? 'world' : 'notey');
          else if (f === 'scanline_color' || f === 'note_ring_color' || f === 'color_filter_color' || f === 'focus_color') copyColor(f);
          else if (f === 'note_fill_colors') {
            if (Array.isArray(json[f])) {
              state[f] = json[f].map((c) => (c == null ? null : parseColor(c)));
            }
          }
          else if (['chromatical', 'chromatic', 'bloom', 'radial_blur', 'color_adjustment', 'color_filter', 'gray_scale', 'noise', 'sepia', 'dream', 'fisheye', 'shockwave', 'focus', 'glitch', 'artifact', 'arcade', 'tape', 'perspective', 'override_scanline_pos', 'scanline_smoothing'].includes(f)) copyBool(f);
          else copyNum(f);
        }
      }
    }
  }

  // ------------------------------------------------------------------
  // Evaluation
  // ------------------------------------------------------------------
  function findStates(states, time) {
    if (!states.length) return [null, null];
    for (let i = 0; i < states.length; i++) {
      if (states[i].time > time) {
        return [i > 0 ? states[i - 1] : null, states[i]];
      }
    }
    return [states[states.length - 1], states[states.length - 1]];
  }

  function lerpNum(a, b, t) { return a + (b - a) * t; }

  function isColorLike(v) {
    return v && typeof v === 'object' && typeof v.r === 'number' && typeof v.g === 'number' && typeof v.b === 'number';
  }

  function getColors() {
    return (typeof window !== 'undefined' ? window.SBEngine.colors : require('./colors.js'));
  }

  // Interpolate one field between two states: numbers, colors, color arrays
  // (e.g. note_fill_colors) and unit objects all transition with the easing.
  // Unit objects with DIFFERENT units are interpolated in a common world space
  // (each endpoint converted with its own unit), so e.g. camerax -> notex
  // transitions continuously instead of jumping at the state time.
  function unitToWorld(u, chart) {
    if (!u || u.value == null) return u ? u.value : null;
    const ortho = (chart && chart.baseSize) || 5;
    const aspect = (chart && chart.screenRatio) || 16 / 9;
    switch (u.unit) {
      case 'notex': return chart && chart.convertChartXToScreenX ? chart.convertChartXToScreenX(u.value) : u.value;
      case 'notey': return chart && chart.convertChartYToScreenY ? chart.convertChartYToScreenY(u.value) : u.value;
      case 'stagex': return u.value / 800 * ortho * aspect;
      case 'stagey': return u.value / 600 * ortho;
      case 'camerax': return u.value * ortho * aspect;
      case 'cameray': return u.value * ortho;
      default: return u.value; // world
    }
  }

  function interpValue(field, from, to, easeFn, t, chart) {
    const fromV = from == null ? undefined : from[field];
    const toV = to == null ? undefined : to[field];
    if (fromV === undefined) return undefined;
    if (toV === undefined) return fromV;
    if (typeof fromV === 'number' && typeof toV === 'number') return easeFn(fromV, toV, t);
    if (isColorLike(fromV) && isColorLike(toV)) {
      return getColors().lerpColor(fromV, toV, easeFn(0, 1, t));
    }
    if (Array.isArray(fromV) && Array.isArray(toV) && fromV.length === toV.length &&
        fromV.every((c) => c == null || isColorLike(c)) && toV.every((c) => c == null || isColorLike(c))) {
      const p = easeFn(0, 1, t);
      return fromV.map((c, i) => (c && toV[i] ? getColors().lerpColor(c, toV[i], p) : (toV[i] == null ? c : toV[i])));
    }
    // Line point arrays: interpolate each point's x/y/z (world or same-unit),
    // width and color so lines animate between keyframes.
    if (field === 'pos' && Array.isArray(fromV) && Array.isArray(toV) && fromV.length === toV.length) {
      const p = easeFn(0, 1, t);
      return fromV.map((fp, i) => {
        const tp = toV[i];
        if (!fp) return tp;
        if (!tp) return fp;
        const out = {};
        for (const k of ['x', 'y', 'z']) {
          const a = fp[k], b = tp[k];
          if (a && b && a.unit === b.unit) {
            out[k] = { value: a.value + (b.value - a.value) * p, unit: a.unit };
          } else if (a && b && typeof a.value === 'number' && typeof b.value === 'number') {
            const aw = unitToWorld(a, chart), bw = unitToWorld(b, chart);
            out[k] = { value: aw + (bw - aw) * p, unit: 'world' };
          } else {
            out[k] = a || b;
          }
        }
        if (typeof fp.width === 'number' && typeof tp.width === 'number') {
          out.width = fp.width + (tp.width - fp.width) * p;
        } else {
          out.width = tp.width !== undefined ? tp.width : fp.width;
        }
        if (fp.color && tp.color && isColorLike(fp.color) && isColorLike(tp.color)) {
          out.color = getColors().lerpColor(fp.color, tp.color, p);
        } else {
          out.color = tp.color || fp.color;
        }
        return out;
      });
    }
    if (fromV && toV && typeof fromV === 'object' && typeof toV === 'object' &&
        'value' in fromV && 'value' in toV &&
        typeof fromV.value === 'number' && typeof toV.value === 'number') {
      if (fromV.unit === toV.unit) {
        return { value: easeFn(fromV.value, toV.value, t), unit: fromV.unit };
      }
      const a = unitToWorld(fromV, chart);
      const b = unitToWorld(toV, chart);
      if (typeof a === 'number' && typeof b === 'number') {
        return { value: easeFn(a, b, t), unit: 'world' };
      }
      return fromV;
    }
    return fromV;
  }

  // Evaluate a compiled object at `time`; returns {from, to, easing, t, destroyed}
  function evaluateObject(obj, time) {
    const [from, to] = findStates(obj.states, time);
    if (!from) return null;
    if (from.destroy) return { destroyed: true };
    const easing = from.easing || 'linear';
    const easeFn = (typeof window !== 'undefined' ? window.SBEngine.easing : require('./easing.js')).resolve(easing);
    let t = 1;
    if (to && to.time > from.time) t = Math.min(1, Math.max(0, (time - from.time) / (to.time - from.time)));
    // `from` is the resolved (interpolated) state; `to` stays as the raw next
    // state for reference. With t=1 (or no next state) `from` is unchanged.
    let resolved = from;
    if (to && t < 1) {
      resolved = {};
      for (const k of Object.keys(from)) {
        if (k === 'time') { resolved.time = from.time; continue; }
        resolved[k] = interpValue(k, from, to, easeFn, t, obj.chart);
      }
    }
    return { from: resolved, to, easing, t, easeFn };
  }

  function evaluateStoryboard(compiled, time) {
    const out = {
      texts: [], sprites: [], videos: [], lines: [], controllers: [], noteControllers: [],
      destroyed: new Set()
    };
    // Note controllers first so that destroyed parents are known early.
    for (const key of ['noteControllers', 'controllers', 'texts', 'sprites', 'videos', 'lines']) {
      for (const obj of compiled[key]) {
        const r = evaluateObject(obj, time);
        if (!r) continue;
        if (r.destroyed) {
          out.destroyed.add(obj.id);
          // Unity semantics: destroying a target_id controller destroys the
          // target entity it controls (and, via the cascade, all children).
          if (obj.targetId) out.destroyed.add(obj.targetId);
          continue;
        }
        out[key].push({ obj, ...r });
      }
    }
    // Cascade destroyed: children of destroyed objects vanish too
    let changed = true;
    while (changed) {
      changed = false;
      for (const key of ['noteControllers', 'texts', 'sprites', 'videos', 'lines']) {
        for (const r of out[key]) {
          const obj = r.obj;
          if (!out.destroyed.has(obj.id)) {
            const parent = obj.parentId || obj.targetId;
            if (parent && out.destroyed.has(parent)) {
              out.destroyed.add(obj.id);
              const idx = out[key].indexOf(r);
              out[key].splice(idx, 1);
              changed = true;
            }
          }
        }
      }
    }
    // Resolve target_id chains (Unity semantics): an object with target_id
    // does not own an entity - it shares and drives the target's transform.
    // Its evaluated fields are merged onto the chain's terminal entity in
    // array order (later entries win per field), and the controller entries
    // are removed from the draw list. Children that reference a controller
    // via parent_id resolve to the same terminal entity in the preview.
    for (const key of ['texts', 'sprites', 'videos', 'lines']) {
      const list = out[key];
      if (!list.length) continue;
      const byId = new Map();
      for (const r of list) byId.set(r.obj.id, r);
      const terminalOf = (id, seen) => {
        let cur = byId.get(id);
        let tid = id;
        while (cur && cur.obj.targetId && !seen.has(cur.obj.targetId)) {
          seen.add(cur.obj.targetId);
          const nxt = byId.get(cur.obj.targetId);
          if (!nxt) break;
          tid = nxt.obj.id;
          cur = nxt;
        }
        return tid;
      };
      const merged = new Map(); // terminalId -> accumulated state (in array order)
      for (const r of list) {
        const tid = terminalOf(r.obj.id, new Set([r.obj.id]));
        const acc = merged.get(tid) || {};
        if (tid === r.obj.id) {
          // Terminal entity: its own state applies at this array position.
          for (const k of Object.keys(r.from)) acc[k] = r.from[k];
        } else {
          // Controller: overrides the shared entity's fields. The image path
          // stays with the entity (Unity never swaps the shared sprite).
          for (const k of Object.keys(r.from)) {
            if (k === 'path') continue;
            acc[k] = r.from[k];
          }
        }
        merged.set(tid, acc);
      }
      out[key] = list
        .filter((r) => !r.obj.targetId)
        .map((r) => {
          const m = merged.get(r.obj.id);
          return m && m !== r.from ? Object.assign({}, r, { from: m }) : r;
        });
    }
    return out;
  }

  // ------------------------------------------------------------------
  // Compiled-format reader (CytoidPlayer's standardized storyboard output)
  // ------------------------------------------------------------------
  // A compiled storyboard is already fully resolved: every object carries a
  // "States" array with absolute numeric Time, PascalCase field names, a
  // numeric Easing enum, Unity colors {R,G,B,A} and UnitFloat objects
  // {Value, Unit, ScaleToCanvas, Span}. This converts it back into the
  // editable lowercase format so the editor/timeline/preview can use it.

  const COMPILED_UNITS = ['world', 'stagex', 'stagey', 'notex', 'notey', 'camerax', 'cameray'];
  const COMPILED_EASINGS = [
    'none', 'EaseInQuad', 'EaseOutQuad', 'EaseInOutQuad', 'EaseInCubic', 'EaseOutCubic',
    'EaseInOutCubic', 'EaseInQuart', 'EaseOutQuart', 'EaseInOutQuart', 'EaseInQuint',
    'EaseOutQuint', 'EaseInOutQuint', 'EaseInSine', 'EaseOutSine', 'EaseInOutSine',
    'EaseInExpo', 'EaseOutExpo', 'EaseInOutExpo', 'EaseInCirc', 'EaseOutCirc', 'EaseInOutCirc',
    'linear', 'Spring', 'EaseInBounce', 'EaseOutBounce', 'EaseInOutBounce', 'EaseInBack',
    'EaseOutBack', 'EaseInOutBack', 'EaseInElastic', 'EaseOutElastic', 'EaseInOutElastic'
  ];

  function camelToSnake(s) {
    return String(s)
      .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
      .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
      .toLowerCase();
  }

  function compiledColorToHex(c) {
    const h = (n) => Math.max(0, Math.min(255, Math.round((n == null ? 1 : n) * 255))).toString(16).padStart(2, '0');
    return '#' + h(c.R) + h(c.G) + h(c.B);
  }

  function convertCompiledValue(v, key) {
    if (v == null) return v;
    if (key === 'Time' || key === 'AddTime') {
      // 时间表达式（如 "start:$note"）原样保留，方便后续编辑；纯数字字符串
      // 仍转回数值。
      if (typeof v === 'number') return v;
      const n = Number(v);
      return String(v).trim() !== '' && isFinite(n) ? n : v;
    }
    if (key === 'Easing') {
      // Return the editable lowercase name so the properties dropdown matches
      // (the option values are lowercase raw names like "easeoutquad").
      const name = COMPILED_EASINGS[Math.round(v)];
      return name ? name.toLowerCase() : 'linear';
    }
    if (key === 'Note' || key === 'Layer' || key === 'Order' || key === 'Style' || key === 'HoldDirection') return v;
    if (Array.isArray(v)) {
      return v.map((item) => {
        if (item && typeof item === 'object') {
          if ('R' in item && 'G' in item && 'B' in item) return compiledColorToHex(item);
          return convertCompiledObject(item);
        }
        return item;
      });
    }
    if (typeof v === 'object') {
      if ('R' in v && 'G' in v && 'B' in v) return compiledColorToHex(v);
      if ('Value' in v && 'Unit' in v) {
        const unit = COMPILED_UNITS[v.Unit] || 'world';
        return unit === 'world' ? v.Value : unit + ':' + v.Value;
      }
      return convertCompiledObject(v);
    }
    return v;
  }

  function convertCompiledObject(obj) {
    const out = {};
    for (const k of Object.keys(obj || {})) {
      if (k === 'States' || k === 'Id' || k === 'Time' || k === 'AddTime' || k === 'Note') continue;
      out[camelToSnake(k)] = convertCompiledValue(obj[k], k);
    }
    return out;
  }

  function fromCompiled(json) {
    const groups = ['texts', 'sprites', 'videos', 'lines', 'controllers', 'note_controllers'];
    const out = { sprites: [], texts: [], videos: [], lines: [], controllers: [], note_controllers: [], templates: {} };
    // Cyster 可视化专属信息（如合并轨道布局）随文件往返保留。
    if (json && json._cyster) out._cyster = json._cyster;
    // The compiled format names note-controller X/Y offsets XOffset / YOffset,
    // while the editable format uses dx / dy (Unity NoteControllerStateParser
    // reads them from "dx" / "dy"). Rename so they survive the round trip.
    const normalizeNC = (s) => {
      if (!s || typeof s !== 'object') return s;
      if (s.x_offset !== undefined) { s.dx = s.x_offset; delete s.x_offset; }
      if (s.y_offset !== undefined) { s.dy = s.y_offset; delete s.y_offset; }
      return s;
    };
    for (const g of groups) {
      out[g] = (json[g] || []).map((obj) => {
        const states = obj.States || [];
        // 空 States 对象在 Unity 端会崩（States[0] 越界）：加载时自愈丢弃。
        if (states.length === 0) return null;
        const first = states[0] || {};
        const base = convertCompiledObject(first);
        // Object-level fields (TargetId / ParentId / Note) live OUTSIDE the
        // States array; merge them in or the parent/target links are lost.
        for (const k of Object.keys(obj || {})) {
          if (k === 'States' || k === 'Id' || k === 'Time' || k === 'AddTime') continue;
          const key = camelToSnake(k);
          if (key === 'note') continue; // note is handled per state below
          base[key] = convertCompiledValue(obj[k], k);
        }
        if (g === 'note_controllers') normalizeNC(base);
        base.id = obj.Id || (g.slice(0, -1) + '_' + Math.random().toString(36).slice(2, 8));
        base.time = first.Time != null ? first.Time : 0;
        if (first.Note != null) base.note = first.Note;
        base.states = states.slice(1).map((st) => {
          const s = convertCompiledObject(st);
          if (g === 'note_controllers') normalizeNC(s);
          s.time = st.Time != null ? st.Time : 0;
          if (s.add_time !== undefined) delete s.add_time; // Time is already absolute
          return s;
        });
        return base;
      }).filter(Boolean);
    }
    return out;
  }

  // ------------------------------------------------------------------
  // Compiled-format writer (inverse of fromCompiled)
  // ------------------------------------------------------------------
  // Produces the CytoidPlayer-standardized ("compiled") StoryBoard JSON:
  // PascalCase fields, a States array with absolute numeric Time, Easing as a
  // Unity enum number, UnitFloat objects {Value, Unit, ScaleToCanvas, Span}
  // and Unity colors {R,G,B,A}. Note selectors / time tokens are expanded to
  // absolute times (per selected note) via the internal compiler.

  function snakeToPascal(s) {
    return String(s).replace(/(^|_)([a-z0-9])/g, (m, p, c) => c.toUpperCase());
  }

  // ScaleToCanvas / Span defaults per field and object type, matching the
  // native state parsers (GenericStateParser / LineStateParser /
  // ControllerStateParser / NoteControllerStateParser).
  function unitFlags(type, field) {
    if (type === 'controller' || type === 'note_controller') return { scaleToCanvas: false, span: false };
    if (type === 'line') return field === 'width' ? { scaleToCanvas: false, span: true } : { scaleToCanvas: false, span: false };
    if (field === 'width') return { scaleToCanvas: true, span: true };
    if (field === 'height') return { scaleToCanvas: true, span: true };
    return { scaleToCanvas: true, span: false }; // x/y/z for stage objects
  }

  const COMPILED_COLOR_FIELDS = new Set([
    'color', 'ring_color', 'fill_color', 'scanline_color',
    'note_ring_color', 'color_filter_color', 'focus_color'
  ]);

  function compiledColor(c) {
    if (c == null) return { R: 1, G: 1, B: 1, A: 1 };
    if (typeof c === 'string') return compiledColor(parseColor(c));
    return {
      R: c.r != null ? c.r : 1,
      G: c.g != null ? c.g : 1,
      B: c.b != null ? c.b : 1,
      A: c.a != null ? c.a : 1
    };
  }

  function toCompiledField(type, key, value) {
    if (key === 'time') {
      const t = typeof value === 'number' && isFinite(value) ? value : 0;
      return { key: 'Time', value: t > 1e15 ? 0 : t };
    }
    if (key === 'easing') {
      // Easing names may be any case in editable storyboards
      // ("easeoutexpo", "EaseOutQuad"...); the enum lookup is case-insensitive.
      const lower = String(value).toLowerCase();
      const idx = COMPILED_EASINGS.findIndex((e) => e.toLowerCase() === lower);
      return { key: 'Easing', value: idx < 0 ? 22 : idx }; // default linear
    }
    if (key === 'note') return { key: 'Note', value: Number(value) };
    if (key === 'target_id') return { key: 'TargetId', value };
    if (key === 'parent_id') return { key: 'ParentId', value };
    // The compiled format names note-controller offsets XOffset / YOffset
    // (Newtonsoft binds them to the engine's NoteControllerState fields);
    // the editable format uses dx / dy, which only the raw parser reads.
    if (key === 'dx') return { key: 'XOffset', value };
    if (key === 'dy') return { key: 'YOffset', value };
    if (key === 'note_fill_colors') {
      const arr = Array.isArray(value) ? value : [];
      const out = [];
      for (let i = 0; i < 12; i++) out.push(compiledColor(arr[i]));
      return { key: 'NoteFillColors', value: out };
    }
    if (key === 'pos') {
      // Line points must always carry X / Y / Z in the compiled format: the
      // engine's LineEaser calls EaseFloat(fromPos.Z, toPos.Z) and throws on a
      // null axis, so a missing Z makes the whole line fail to render. Missing
      // axes default to 0 with the same units as the raw parser (notex/notey/world).
      const axisDefaults = { x: 'notex', y: 'notey', z: 'world' };
      return {
        key: 'Pos',
        value: (Array.isArray(value) ? value : []).map((p) => {
          const out = {};
          for (const k of ['x', 'y', 'z']) {
            if (p && p[k] != null) {
              out[k.toUpperCase()] = toCompiledField('line', k, p[k]).value;
            } else {
              const unitIdx = COMPILED_UNITS.indexOf(axisDefaults[k]);
              out[k.toUpperCase()] = {
                Value: 0,
                Unit: unitIdx < 0 ? 0 : unitIdx,
                ScaleToCanvas: false,
                Span: false
              };
            }
          }
          return out;
        })
      };
    }
    if (COMPILED_COLOR_FIELDS.has(key)) return { key: snakeToPascal(key), value: compiledColor(value) };
    if (value && typeof value === 'object' && value.unit != null && value.value != null) {
      const flags = unitFlags(type, key);
      const unitIdx = COMPILED_UNITS.indexOf(value.unit);
      return {
        key: snakeToPascal(key),
        value: {
          Value: value.value,
          Unit: unitIdx < 0 ? 0 : unitIdx,
          ScaleToCanvas: flags.scaleToCanvas,
          Span: flags.span
        }
      };
    }
    return { key: snakeToPascal(key), value };
  }

  function toCompiled(storyboardJson, chart) {
    const compiler = new StoryboardCompiler(storyboardJson || {}, chart || null);
    const internal = compiler.compile();
    const out = {
      compiled: true,
      sprites: [], texts: [], videos: [], lines: [],
      controllers: [], note_controllers: []
    };
    // Cyster 可视化专属信息（合并轨道布局等）写进输出文件，供 Cyster 读取。
    if (storyboardJson && storyboardJson._cyster) out._cyster = storyboardJson._cyster;
    const groupMap = {
      sprites: 'sprites', texts: 'texts', videos: 'videos',
      lines: 'lines', controllers: 'controllers', noteControllers: 'note_controllers'
    };
    for (const [inkey, outkey] of Object.entries(groupMap)) {
      for (const entry of internal[inkey] || []) {
        const states = (entry.states || []).map((s) => {
          const st = {};
          for (const k of Object.keys(s)) {
            if (k === 'time' || k === 'easing' || k === 'note' || k === 'id') continue;
            const f = toCompiledField(entry.type, k, s[k]);
            st[f.key] = f.value;
          }
          const tf = toCompiledField(entry.type, 'time', s.time);
          st.Time = tf.value;
          st.Easing = toCompiledField(entry.type, 'easing', s.easing).value;
          if (entry.note != null) st.Note = Number(entry.note);
          return st;
        });
        states.sort((a, b) => a.Time - b.Time);
        const outObj = { States: states, Id: entry.id };
        // Preserve parent/target links on the object (outside States), so
        // exported compiled files keep their hierarchy.
        if (entry.targetId) outObj.TargetId = entry.targetId;
        if (entry.parentId) outObj.ParentId = entry.parentId;
        out[outkey].push(outObj);
      }
    }
    return out;
  }

  const api = {
    StoryboardCompiler,
    evaluateObject,
    evaluateStoryboard,
    findStates,
    parseUnitValue,
    parseColor,
    STAGE_FIELDS,
    CONTROLLER_FIELDS,
    NOTE_CONTROLLER_FIELDS,
    fromCompiled,
    toCompiled
  };
  if (typeof window !== 'undefined') {
    if (!window.SBEngine) window.SBEngine = {};
    window.SBEngine.storyboard = api;
  }
  if (typeof module !== 'undefined') module.exports = api;
})();
