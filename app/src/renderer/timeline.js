// Timeline component: ruler, lanes, clips, keyframes, playhead.
(() => {
  const $t = (s) => (window.SBi18n ? window.SBi18n.t(s) : s);
  const TYPE_LABELS = {
    sprite: 'Sprite', text: 'Text', video: 'Video', line: 'Line',
    controller: 'Controller', note_controller: 'Note Ctrl'
  };

  // Frozen left column width (track-name column); the timeline starts at its right edge
  const LABEL_W = 190;

  class Timeline {
    constructor(root, opts = {}) {
      this.root = root;
      this.opts = opts;
      this.pxPerSec = 60;
      this.time = 0;
      this.duration = 60;
      this.objects = [];
      this.selectedObject = null;
      this.selectedKey = null;
      this.selectedIds = new Set();   // multi-selected object ids
      this.selectedKfs = new Map();   // "objId::kfIdx" -> true
      this.snapStrength = 0.5;
      this.snapTargets = [];
      this.collapsedGroups = {};
      this.snapLineTarget = null;
      this.mergedLanes = null; // 整理轨道后的合并布局（来自 .str 的 _cyster 信息）
      this.lockedOrders = new Set(); // 点击 order 标识锁定的层级（不整理、不换轨）
      this.buildDom();
      this.bindEvents();
    }

    buildDom() {
      this.root.innerHTML = `
        <div id="tlWrap">
          <div id="tlTimelineHead">
            <div id="tlLabelRuler"></div>
            <div id="tlRulerScroll"><canvas id="ruler"></canvas><div id="rulerPlayhead"></div></div>
          </div>
          <div id="tlScrollY">
            <div id="tlInner">
              <div id="tlHeader">
                <div id="tlLabels"></div>
              </div>
              <div id="tlScroll">
                <div id="tlContent">
                  <div id="lanes"></div>
                  <div id="playhead"></div>
                  <div id="snapLine"></div>
                </div>
              </div>
            </div>
          </div>
          <div id="tlHScroll">
            <div id="tlHScrollSpacer"></div>
            <div id="tlHScrollTrack"><div id="tlHScrollThumb"></div></div>
          </div>
        </div>
        <div id="tlFooter">
          <span class="tl-opt">吸附</span>
          <input type="range" id="snapSlider" min="0" max="100" value="50" title="拖动吸附强度（0=关闭）" />
          <span class="tl-opt">音量</span>
          <input type="range" id="volSlider" min="0" max="100" value="100" title="应用整体音量" />
          <span class="tl-right">
            <button id="btnOrganizeTracks" class="mini-btn" title="把同类型且时间不重叠的时间块合并到同一轨道">整理轨道</button>
            <span>缩放</span>
            <input type="range" id="zoomSlider" min="10" max="300" value="60" />
            <span id="zoomLabel">60 px/s</span>
          </span>
        </div>`;
      this.scroll = this.root.querySelector('#tlScroll');
      this.scrollY = this.root.querySelector('#tlScrollY');
      this.content = this.root.querySelector('#tlContent');
      this.labelsEl = this.root.querySelector('#tlLabels');
      this.rulerScroll = this.root.querySelector('#tlRulerScroll');
      this.rulerPlayhead = this.root.querySelector('#rulerPlayhead');
      this.hScrollTrack = this.root.querySelector('#tlHScrollTrack');
      this.hScrollThumb = this.root.querySelector('#tlHScrollThumb');
      this.rulerCanvas = this.root.querySelector('#ruler');
      this.lanes = this.root.querySelector('#lanes');
      this.playhead = this.root.querySelector('#playhead');
      this.snapLine = this.root.querySelector('#snapLine');
      // The detail info window lives OUTSIDE the scroll container so it can
      // float above everything (viewport-fixed, never clipped by #tlScroll).
      this.kfTooltip = document.createElement('div');
      this.kfTooltip.className = 'kf-tooltip';
      this.kfTooltip.id = 'kfTooltip';
      this.root.appendChild(this.kfTooltip);
      this.zoomSlider = this.root.querySelector('#zoomSlider');
      this.zoomLabel = this.root.querySelector('#zoomLabel');
      this.snapSlider = this.root.querySelector('#snapSlider');
      this.volSlider = this.root.querySelector('#volSlider');
      this.organizeBtn = this.root.querySelector('#btnOrganizeTracks');
      this.rctx = this.rulerCanvas.getContext('2d');
      this.zoomSlider.addEventListener('input', () => {
        this.setZoom(parseInt(this.zoomSlider.value, 10));
        if (this.opts.onZoom) this.opts.onZoom(this.pxPerSec);
      });
      this.snapSlider.addEventListener('input', () => {
        this.snapStrength = parseInt(this.snapSlider.value, 10) / 100;
      });
      this.volSlider.addEventListener('input', () => {
        if (this.opts.onVolume) this.opts.onVolume(parseInt(this.volSlider.value, 10) / 100);
      });
      this.organizeBtn.addEventListener('click', () => this.organizeTracks());
    }

    // 手动“整理轨道”：同类型且时间不重叠的时间块合并到同一轨道（原先的自动
    // 合并行为改为手动触发），并把合并结果交回应用层持久化到 .str 文件。
    organizeTracks() {
      const STAGE_TYPES = ['sprite', 'text', 'video', 'line'];
      const stageLanes = [];
      const pos = new Map(this.objects.map((o, i) => [o.id, i]));
      // 锁定的 order 层级：保留当前轨道布局，不参与整理合并、不改写 order。
      const lockedIds = new Set();
      for (const o of this.objects) {
        if (o.order != null && this.lockedOrders.has(o.order)) lockedIds.add(o.id);
      }
      if (lockedIds.size) {
        for (const lane of this.currentLaneList()) {
          if (lane.some((o) => lockedIds.has(o.id))) stageLanes.push(lane.map((o) => o.id));
        }
      }
      // 自动整理：每层内“低 order 优先铺满、向上堆叠”——按 order 升序（小者
      // 在下）逐个处理，每个时间块放入最低的可用 order 层；且重叠对象的层级
      // 必须高于所有已放置的与其重叠对象（order 大者在上，锁定层级不破坏此序）。
      const byLayer = new Map();
      const lockedByLayer = new Map();
      for (const o of this.objects) {
        if (!STAGE_TYPES.includes(o.type)) continue;
        const l = o.layer != null ? o.layer : 0;
        if (lockedIds.has(o.id)) {
          if (!lockedByLayer.has(l)) lockedByLayer.set(l, new Map());
          const od = o.order != null ? o.order : 0;
          if (!lockedByLayer.get(l).has(od)) lockedByLayer.get(l).set(od, []);
          lockedByLayer.get(l).get(od).push(o.id);
          continue;
        }
        if (!byLayer.has(l)) byLayer.set(l, []);
        byLayer.get(l).push(o);
      }
      const overlaps = (a, b) => {
        const sa = a.clipStart != null ? a.clipStart : 0;
        const ea = a.clipEnd != null ? a.clipEnd : sa + 0.1;
        const sb = b.clipStart != null ? b.clipStart : 0;
        const eb = b.clipEnd != null ? b.clipEnd : sb + 0.1;
        return sa < eb - 0.001 && sb < ea - 0.001;
      };
      const objOf = (id) => this.objects.find((o) => o.id === id);
      const allLayers = new Set([...byLayer.keys(), ...lockedByLayer.keys()]);
      const reordered = [];
      for (const layer of [...allLayers].sort((a, b) => b - a)) {
        // 该层已有轨道（含锁定 order）：order -> ids
        const levels = new Map();
        const locked = lockedByLayer.get(layer);
        if (locked) for (const [od, ids] of locked) levels.set(od, ids.slice());
        // 低 order 优先处理（同 order 按原数组顺序稳定）。
        const objs = (byLayer.get(layer) || []).slice().sort((a, b) => {
          const oa = a.order != null ? a.order : 0;
          const ob = b.order != null ? b.order : 0;
          if (oa !== ob) return oa - ob;
          return this.objects.indexOf(a) - this.objects.indexOf(b);
        });
        for (const o of objs) {
          // 重叠对象层级下限：高于所有已放置且与其时间重叠的“自由对象”的层级；
          // 锁定层级只在“该锁定 order 小于本对象 order 且重叠”时才要求本对象
          // 在其上，否则锁定层仅作占用（不把自由对象抬到锁定层之上）。
          let minLevel = 0;
          for (const [lvl, ids] of levels) {
            const hit = ids.some((id) => {
              const x = objOf(id);
              return x && overlaps(x, o);
            });
            if (!hit) continue;
            if (locked && locked.has(lvl)) {
              if (o.order != null && lvl < o.order) minLevel = Math.max(minLevel, lvl + 1);
            } else {
              minLevel = Math.max(minLevel, lvl + 1);
            }
          }
          let i = minLevel;
          for (;;) {
            if (!levels.has(i)) { levels.set(i, [o.id]); break; }
            const conflict = levels.get(i).some((id) => {
              const x = objOf(id);
              return x && overlaps(x, o);
            });
            if (!conflict) { levels.get(i).push(o.id); break; }
            i++;
          }
        }
        // 该层轨道：顶层（高 order）优先输出。
        const orders = [...levels.keys()].sort((a, b) => a - b);
        for (const od of orders.slice().reverse()) reordered.push(levels.get(od).slice());
      }
      stageLanes.splice(0, stageLanes.length, ...reordered);
      // note_controller 不带层级概念：直接按时间不重叠打包。
      const ncLanes = [];
      const ncList = this.objects.filter((o) => o.type === 'note_controller');
      for (const lane of this.packNonOverlapping(ncList)) ncLanes.push(lane.map((o) => o.id));
      ncLanes.sort((a, b) => (pos.get(a[0]) ?? 0) - (pos.get(b[0]) ?? 0));
      // controller 没有层级概念：保留用户已设定的隐性轨道顺序（每个控制器一轨）。
      const ctlLanes = (this.mergedLanes && this.mergedLanes.controller)
        ? this.mergedLanes.controller
          .map((ids) => ids.map((id) => this.objects.find((o) => o.id === id)).filter(Boolean))
          .map((lane) => lane.map((o) => o.id))
          .filter((l) => l.length)
        : this.objects.filter((o) => o.type === 'controller').map((o) => [o.id]);
      this.mergedLanes = {
        stage: stageLanes.length ? stageLanes : [],
        note_controller: ncLanes.length ? ncLanes : [],
        controller: ctlLanes.length ? ctlLanes : []
      };
      if (this.opts.onTracksOrganized) this.opts.onTracksOrganized(this.mergedLanes);
      this.renderLanes();
      this.renderPlayhead();
    }

    // 当前 stage 轨道布局（合并布局或默认一对象一轨），用于锁定 order 层级的保留。
    currentLaneList() {
      const STAGE_TYPES = ['sprite', 'text', 'video', 'line'];
      const stageList = this.objects.filter((o) => STAGE_TYPES.includes(o.type));
      if (this.mergedLanes && this.mergedLanes.stage && this.mergedLanes.stage.length) {
        const lanes = this.mergedLanes.stage
          .map((ids) => ids.map((id) => stageList.find((o) => o.id === id)).filter(Boolean))
          .filter((l) => l.length);
        const covered = new Set();
        for (const lane of lanes) for (const o of lane) covered.add(o.id);
        for (const o of stageList) if (!covered.has(o.id)) lanes.push([o]);
        return lanes;
      }
      return stageList.map((o) => [o]);
    }

    // 同类型时间块按时间不重叠打包进共享轨道（贪心）。
    packNonOverlapping(list) {
      const sorted = list.slice().sort((a, b) => (a.clipStart || 0) - (b.clipStart || 0));
      const lanes = [];
      for (const obj of sorted) {
        const start = obj.clipStart != null ? obj.clipStart : 0;
        const end = obj.clipEnd != null ? obj.clipEnd : start + 0.1;
        let li = lanes.findIndex((l) => start >= l.lastEnd - 0.001);
        if (li < 0) {
          li = lanes.length;
          lanes.push({ lastEnd: end, objs: [] });
        } else {
          lanes[li].lastEnd = Math.max(lanes[li].lastEnd, end);
        }
        lanes[li].objs.push(obj);
      }
      return lanes.map((l) => l.objs);
    }

    // 读取持久化的合并轨道布局（来自 .str 的 _cyster 信息）。
    setMergedLanes(lanes) {
      this.mergedLanes = lanes && (lanes.stage || lanes.note_controller || lanes.controller) ? lanes : null;
      this.renderLanes();
      this.renderPlayhead();
    }

    // 读取持久化的 order 锁定层级（来自 .str 的 _cyster 信息）。
    setLockedOrders(orders) {
      this.lockedOrders = new Set(Array.isArray(orders) ? orders : []);
      this.renderLanes();
      this.renderPlayhead();
    }

    setZoom(px) {
      this.pxPerSec = px;
      this.zoomSlider.value = px;
      this.zoomLabel.textContent = px + ' px/s';
      this.render();
    }

    // Auto-fit the zoom so the timeline shows ~1.5x the chart length at
    // minimum zoom; the zoom range uses the original scheme (max 300 px/s).
    setAutoZoom(duration) {
      const avail = Math.max(240, this.root.clientWidth - LABEL_W - 160);
      const minPx = Math.max(5, avail / Math.max(1, duration * 1.5));
      const maxPx = 300;
      this.zoomSlider.min = Math.round(minPx);
      this.zoomSlider.max = maxPx;
      this.zoomSlider.value = Math.round(Math.max(minPx, Math.min(maxPx, minPx)));
      this.pxPerSec = this.zoomSlider.value;
      this.zoomLabel.textContent = this.pxPerSec + ' px/s';
      this.render();
    }

    setData(objects, duration) {
      this.objects = objects || [];
      this.duration = Math.max(5, duration || 60);
      this.snapTargets = [];
      for (const obj of this.objects) {
        for (const kf of obj.keyframes || []) this.snapTargets.push(kf.time);
        if (obj.clipStart != null) this.snapTargets.push(obj.clipStart, obj.clipEnd);
      }
      this.render();
    }

    // Snap a raw time to the nearest target (playhead or other objects) within
    // the configured snap strength.
    snapTime(raw) {
      if (!this.snapStrength) {
        this.showSnapLine(null);
        return raw;
      }
      const tolerance = this.snapStrength * 0.25;
      let best = raw;
      let bestD = tolerance;
      let target = null;
      const candidates = [this.time].concat(this.snapTargets);
      for (const t of candidates) {
        const d = Math.abs(t - raw);
        if (d < bestD) {
          bestD = d;
          best = t;
          target = t;
        }
      }
      this.showSnapLine(target);
      return best;
    }

    showSnapLine(t) {
      this.snapLineTarget = t;
      if (t == null) {
        this.snapLine.style.display = 'none';
        this.playhead.classList.remove('snapped');
        return;
      }
      // 表头是独立模块：吸附线只在时间轴体内定位。
      const maxX = this.duration * this.pxPerSec;
      const x = Math.min(maxX, Math.max(0, t * this.pxPerSec));
      this.snapLine.style.display = 'block';
      this.snapLine.style.left = x + 'px';
      this.playhead.classList.toggle('snapped', Math.abs(t - this.time) < 0.001);
    }

    setTime(t) {
      // Never let the playhead travel past the music/chart length.
      this.time = Math.max(0, Math.min(t, this.duration));
      this.renderPlayhead();
    }

    setSelection(objId, keyIdx) {
      this.selectedObject = objId;
      this.selectedKey = keyIdx;
      this.selectedIds = objId != null ? new Set([objId]) : new Set();
      this.selectedKfs = objId != null && keyIdx != null
        ? new Map([[objId + '::' + keyIdx, true]])
        : new Map();
      this.renderLanes();
      this.renderPlayhead();
    }

    // Apply an app-level multi-selection (ids: string[], kfs: [{objId,index}]).
    setMultiSelection(sel) {
      this.selectedIds = new Set(sel && sel.ids ? sel.ids : []);
      this.selectedKfs = new Map();
      if (sel && sel.kfs) {
        for (const kf of sel.kfs) this.selectedKfs.set(kf.objId + '::' + kf.index, true);
      }
      this.selectedObject = this.selectedIds.size ? [...this.selectedIds][0] : null;
      this.selectedKey = this.selectedKfs.size ? +[...this.selectedKfs.keys()][0].split('::')[1] : null;
      this.renderLanes();
      this.renderPlayhead();
    }

    notifySelection() {
      if (this.opts.onSelectionChange) {
        this.opts.onSelectionChange({
          ids: [...this.selectedIds],
          kfs: [...this.selectedKfs.keys()].map((k) => {
            const i = k.lastIndexOf('::');
            return { objId: k.slice(0, i), index: Number(k.slice(i + 2)) };
          })
        });
      }
    }

    // Locate a keyframe element by object id + keyframe index (the DOM is
    // rebuilt often, so lookups must go through the live document).
    findKfElement(objId, kfIdx) {
      if (!this.root) return null;
      return this.root.querySelector(
        '.kf[data-id="' + CSS.escape(objId) + '"][data-kf="' + kfIdx + '"]'
      );
    }

    hideKfTooltip() {
      if (this.kfTooltip) this.kfTooltip.style.display = 'none';
    }

    // While a context menu is open above the keyframe, keep the floating
    // detail window hidden so the two never overlap. Restoring the flag
    // re-syncs the tooltip with the current selection.
    suppressKfTooltip(flag) {
      this._tooltipSuppressed = !!flag;
      if (flag) this.hideKfTooltip();
      else this.updateKfTooltip();
    }

    // Show the detail info window near a keyframe. Priority: the pinned
    // (selected) keyframe, then a hovered keyframe. Viewport-fixed so it is
    // always topmost and never clipped by the timeline's scroll container.
    // 防挡：实时避开鼠标当前位置（优先下方，若鼠标会压住则换到上/右/左）。
    updateKfTooltip() {
      const tt = this.kfTooltip;
      if (!tt) return;
      if (this._tooltipSuppressed) {
        tt.style.display = 'none';
        return;
      }
      const src = this.tooltipPinned || this._hoverTooltip;
      if (!src) {
        tt.style.display = 'none';
        return;
      }
      let el = src.el;
      if (src.objId != null) el = this.findKfElement(src.objId, src.kfIdx);
      if (!el || !el.isConnected) {
        tt.style.display = 'none';
        return;
      }
      const kf = src.kf;
      const fromT = kf.fromText || '';
      const toT = kf.toText || '';
      tt.textContent =
        `时间: ${fmtTime(src.time)}\n` +
        `缓动: ${src.ease || 'linear'}\n` +
        (fromT ? `起始: ${fromT}\n` : '') +
        (toT ? `结束: ${toT}` : '');
      tt.style.display = 'block';
      const r = el.getBoundingClientRect();
      const tw = tt.offsetWidth;
      const th = tt.offsetHeight;
      const vw = window.innerWidth, vh = window.innerHeight;
      const m = this._mousePos;
      const anchor = {
        left: r.left, right: r.right, top: r.top, bottom: r.bottom,
        cx: r.left + r.width / 2, cy: r.top + r.height / 2
      };
      const cands = [
        { left: anchor.cx - tw / 2, top: anchor.bottom + 4 },
        { left: anchor.cx - tw / 2, top: anchor.top - th - 4 },
        { left: anchor.right + 6, top: anchor.cy - th / 2 },
        { left: anchor.left - tw - 6, top: anchor.cy - th / 2 }
      ];
      let pick = cands[0];
      if (m) {
        for (const c of cands) {
          const overlap = m.x >= c.left - 8 && m.x <= c.left + tw + 8 &&
                          m.y >= c.top - 8 && m.y <= c.top + th + 8;
          if (!overlap) { pick = c; break; }
        }
      }
      let left = pick.left;
      let top = pick.top;
      if (left < 6) left = 6;
      if (left + tw > vw - 6) left = Math.max(6, vw - tw - 6);
      if (top + th > vh - 6) top = Math.max(6, vh - th - 6);
      // 视口夹取后仍被鼠标压住时，向远离鼠标的方向微调。
      if (m) {
        const overlap = m.x >= left - 6 && m.x <= left + tw + 6 &&
                        m.y >= top - 6 && m.y <= top + th + 6;
        if (overlap) {
          if (m.y < top) top = Math.min(vh - th - 6, top + th + 10);
          else if (m.y > top + th) top = Math.max(6, top - th - 10);
          else if (m.x < left) left = Math.min(vw - tw - 6, left + tw + 10);
          else if (m.x > left + tw) left = Math.max(6, left - tw - 10);
          else {
            // 鼠标位于工具内部：向空间更大的一侧平移。
            const rightRoom = vw - tw - 6 - left;
            const leftRoom = left - 6;
            if (leftRoom >= rightRoom) left = Math.max(6, left - tw - 10);
            else left = Math.min(vw - tw - 6, left + tw + 10);
          }
          if (top < 6) top = 6;
          if (top + th > vh - 6) top = vh - th - 6;
          if (left < 6) left = 6;
          if (left + tw > vw - 6) left = vw - tw - 6;
        }
      }
      tt.style.left = left + 'px';
      tt.style.top = top + 'px';
    }

    // Keep the pinned info window in sync with the current keyframe
    // selection (called after every lane rebuild so it follows re-renders).
    syncPinnedFromSelection() {
      if (this.selectedKfs && this.selectedKfs.size) {
        const keys = [...this.selectedKfs.keys()];
        const key = keys[keys.length - 1];
        const i = key.lastIndexOf('::');
        const objId = key.slice(0, i);
        const kfIdx = Number(key.slice(i + 2));
        const entry = this.objects.find(
          (o) => o.id === objId || o.id.indexOf(objId + '::') === 0
        );
        const kf = entry && (entry.keyframes || []).find((x) => x.index === kfIdx);
        if (kf) {
          this.tooltipPinned = {
            objId, kfIdx, kf,
            time: kf.time,
            ease: kf.easing || '',
          };
        } else {
          this.tooltipPinned = null;
        }
      } else {
        this.tooltipPinned = null;
      }
      this.updateKfTooltip();
    }

    isObjSelected(entryId) {
      if (this.selectedIds.has(entryId)) return true;
      const i = entryId.indexOf('::');
      if (i > 0 && this.selectedIds.has(entryId.slice(0, i))) return true;
      return false;
    }

    isKeySelected(objId, kfIdx) {
      return this.selectedKfs.has(objId + '::' + kfIdx);
    }

    // 被锁定的内容在时间轴上不可选取。
    isLockedEntry(entryId) {
      return !!(this.opts.isLocked && this.opts.isLocked(entryId));
    }

    // Single-click selection (replaces the whole selection).
    selectOnly(objId, keyIdx) {
      if (objId != null && this.isLockedEntry(objId)) return;
      this.selectedObject = objId;
      this.selectedKey = keyIdx != null ? keyIdx : null;
      this.selectedIds = objId != null ? new Set([objId]) : new Set();
      this.selectedKfs = objId != null && keyIdx != null
        ? new Map([[objId + '::' + keyIdx, true]])
        : new Map();
      this.notifySelection();
      this.renderLanes();
      this.renderPlayhead();
    }

    // Ctrl/Cmd toggle an object in the multi-selection.
    toggleObject(objId) {
      if (this.isLockedEntry(objId)) return;
      if (this.selectedIds.has(objId)) {
        this.selectedIds.delete(objId);
        if (this.selectedObject === objId) {
          this.selectedObject = this.selectedIds.size ? [...this.selectedIds][0] : null;
        }
      } else {
        this.selectedIds.add(objId);
        this.selectedObject = objId;
        this.selectedKey = null;
      }
      this.selectedKfs = new Map();
      this.notifySelection();
      this.renderLanes();
      this.renderPlayhead();
    }

    // Shift-click: add an object to the multi-selection.
    addObject(objId) {
      if (this.isLockedEntry(objId)) return;
      this.selectedIds.add(objId);
      this.selectedObject = objId;
      this.selectedKey = null;
      this.notifySelection();
      this.renderLanes();
      this.renderPlayhead();
    }

    // Ctrl/Cmd toggle a keyframe in the multi-selection (its object joins too).
    toggleKey(objId, kfIdx) {
      const key = objId + '::' + kfIdx;
      if (this.selectedKfs.has(key)) {
        this.selectedKfs.delete(key);
      } else {
        this.selectedKfs.set(key, true);
        this.selectedIds.add(objId);
        this.selectedObject = objId;
        this.selectedKey = kfIdx;
      }
      this.notifySelection();
      this.renderLanes();
      this.renderPlayhead();
    }

    // Shift-click on a keyframe: add it (and its object) to the selection.
    addKey(objId, kfIdx) {
      this.selectedKfs.set(objId + '::' + kfIdx, true);
      this.selectedIds.add(objId);
      this.selectedObject = objId;
      this.selectedKey = kfIdx;
      this.notifySelection();
      this.renderLanes();
      this.renderPlayhead();
    }

    contentWidth() {
      // Right edge is limited to the music/chart length (plus a small margin)
      // 表头为独立模块：内容宽度以时间轴体（#tlScroll）自身宽度为准。
      return Math.max(this.scroll.clientWidth - 8, this.duration * this.pxPerSec + 20);
    }

    render() {
      const w = this.contentWidth();
      this.content.style.width = w + 'px';
      // 表头是独立模块：时间轴体的标尺从自身内容区起点开始，铺满整个宽度。
      this.rulerCanvas.width = Math.max(10, w);
      this.rulerCanvas.style.marginLeft = '0px';
      this.rulerCanvas.style.width = Math.max(10, w) + 'px';
      this.rulerCanvas.height = 28;
      this.renderRuler();
      this.renderLanes();
      this.renderPlayhead();
      this.updateHScrollThumb();
    }

    renderRuler() {
      const ctx = this.rctx;
      const w = this.rulerCanvas.width;
      ctx.clearRect(0, 0, w, 28);
      ctx.fillStyle = '#1b2027';
      ctx.fillRect(0, 0, w, 28);
      const step = this.chooseStep();
      ctx.fillStyle = '#8b97a8';
      ctx.font = '10px "Segoe UI"';
      ctx.textBaseline = 'middle';
      for (let t = 0; t <= this.duration + 0.001; t += step) {
        const x = t * this.pxPerSec;
        ctx.fillRect(x, 16, 1, 12);
        if (step < 1) {
          // Show ss.mmm ticks when zoomed in
          const ss = Math.floor(t), ms = Math.floor((t - ss) * 1000);
          ctx.fillText(`${ss}.${String(ms).padStart(3, '0')}`, x + 3, 12);
        } else {
          const ss = Math.floor(t);
          ctx.fillText(String(ss), x + 3, 12);
        }
      }
      ctx.fillStyle = '#2e3744';
      ctx.fillRect(0, 26, w, 2);
    }

    chooseStep() {
      const raw = [0.001, 0.002, 0.005, 0.01, 0.02, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60];
      for (const s of raw) {
        if (s * this.pxPerSec >= 55) return s;
      }
      return 120;
    }

    renderLanes() {
      // Rebuilding #lanes innerHTML collapses the scrollable height, which
      // makes the browser clamp the vertical position back to the top. Preserve
      // the scroll position across the rebuild so interacting with nodes does
      // not yank the view back to the beginning.
      const sc = this.scroll;
      const scY = this.scrollY;
      const prevTop = scY ? scY.scrollTop : 0;
      const prevLeft = sc ? sc.scrollLeft : 0;
      this.lanes.innerHTML = '';
      this.labelsEl.innerHTML = '';
      // 表头模块（左列）与时间轴体模块各占一行，高度一一对应。
      const tlbSpacer = (cls) => {
        const d = document.createElement('div');
        d.className = cls;
        return d;
      };
      const groups = {};
      for (const obj of this.objects) {
        (groups[obj.type] = groups[obj.type] || []).push(obj);
      }
      // sprite / text / line / video 合并为同一个大类 “Stage”。
      const STAGE_TYPES = ['sprite', 'text', 'video', 'line'];
      // 保持 this.objects 的顺序（应用层已按 order 全局排序）。
      const stageList = this.objects.filter((o) => STAGE_TYPES.includes(o.type));
      if (stageList.length) {
        const collapsed = !!this.collapsedGroups.stage;
        const gHidden = this.opts.isGroupHidden && this.opts.isGroupHidden('stage');
        const gh = document.createElement('div');
        gh.className = 'group-header' + (collapsed ? ' collapsed' : '');
        const eyeHtml = `<span class="gh-eye${gHidden ? ' off' : ''}" title="${$t(gHidden ? '显示' : '隐藏')}${$t('整个分类')}">${svgIcon(gHidden ? 'eyeOff' : 'eye')}</span>`;
        const stageLocked = this.opts.isCategoryLocked && this.opts.isCategoryLocked('stage');
        const lockHtml = `<span class="gh-lock${stageLocked ? ' locked' : ''}" title="${$t(stageLocked ? '解锁 Stage 全部对象' : '锁定 Stage 全部对象')}">${svgIcon(stageLocked ? 'lock' : 'unlock')}</span>`;
        gh.innerHTML = `<span class="gh-label">${eyeHtml}<span class="gh-text">Stage (${stageList.length})${collapsed ? svgIcon('chevronRight', 10, true) : svgIcon('chevronDown', 10, true)}</span>${lockHtml}</span><span class="gh-track"></span>`;
        gh.addEventListener('click', () => {
          this.collapsedGroups.stage = !this.collapsedGroups.stage;
          this.renderLanes();
          this.renderPlayhead();
        });
        gh.querySelector('.gh-eye').addEventListener('click', (e) => {
          e.stopPropagation();
          if (this.opts.onToggleGroupVisibility) this.opts.onToggleGroupVisibility('stage');
        });
        gh.querySelector('.gh-lock').addEventListener('click', (e) => {
          e.stopPropagation();
          if (this.opts.onToggleCategoryLock) this.opts.onToggleCategoryLock('stage');
        });
        this.labelsEl.appendChild(gh);
        this.lanes.appendChild(tlbSpacer('tlb-group'));
        if (!collapsed) {
          let lanes;
          if (this.mergedLanes && this.mergedLanes.stage && this.mergedLanes.stage.length) {
            lanes = this.mergedLanes.stage
              .map((ids) => ids.map((id) => stageList.find((o) => o.id === id)).filter(Boolean))
              .filter((l) => l.length);
            if (!lanes.length) lanes = stageList.map((o) => [o]);
            // 新建的对象不在合并布局里：作为独立轨道补到末尾，保证始终可见。
            const covered = new Set();
            for (const lane of lanes) for (const o of lane) covered.add(o.id);
            for (const o of stageList) {
              if (!covered.has(o.id)) lanes.push([o]);
            }
          } else {
            // 默认不自动合并：每个对象一条轨道（按 order 排序后的顺序）。
            lanes = stageList.map((o) => [o]);
          }
          let lastLayer = null;
          for (const lane of lanes) {
            const l = lane[0].layer != null ? lane[0].layer : 0;
            if (l !== lastLayer) {
              const sep = document.createElement('div');
              sep.className = 'lane-layer-sep';
              const lab = document.createElement('span');
              lab.className = 'lane-layer-sep-label';
              const layerLocked = this.opts.isCategoryLocked && this.opts.isCategoryLocked('layer:' + l);
              lab.innerHTML = 'Layer ' + l +
                `<span class="sep-lock${layerLocked ? ' locked' : ''}" title="${$t(layerLocked ? '解锁 Layer ' : '锁定 Layer ')}${l}${$t(' 全部对象')}">${svgIcon(layerLocked ? 'lock' : 'unlock')}</span>`;
              lab.querySelector('.sep-lock').addEventListener('click', (e) => {
                e.stopPropagation();
                if (this.opts.onToggleCategoryLock) this.opts.onToggleCategoryLock('layer:' + l);
              });
              const bar = document.createElement('span');
              bar.className = 'lane-layer-sep-bar';
              sep.appendChild(lab);
              sep.appendChild(bar);
              this.labelsEl.appendChild(sep);
              this.lanes.appendChild(tlbSpacer('tlb-layer'));
              lastLayer = l;
            }
            this.renderLaneLabel(lane, lane[0].type);
            this.renderLaneTrack(lane, lane[0].type);
          }
        }
      }
      // Controller / Note Ctrl 保留各自分类（每个控制器一条轨道）。
      for (const type of ['controller', 'note_controller']) {
        const list = groups[type];
        if (!list || !list.length) continue;
        const collapsed = !!this.collapsedGroups[type];
        const gh = document.createElement('div');
        gh.className = 'group-header' + (collapsed ? ' collapsed' : '');
        // controller / note_controller 均支持批量锁定（stage 用眼睛/锁定分列）。
        const hasLock = type === 'controller' || type === 'note_controller';
        const catLocked = hasLock && this.opts.isCategoryLocked && this.opts.isCategoryLocked(type);
        const lockHtml = hasLock
          ? `<span class="gh-lock${catLocked ? ' locked' : ''}" title="${$t(catLocked ? '解锁' : '锁定')} ${TYPE_LABELS[type]} ${$t('全部对象')}">${svgIcon(catLocked ? 'lock' : 'unlock')}</span>`
          : '';
        gh.innerHTML = `<span class="gh-label"><span class="gh-text">${TYPE_LABELS[type]} (${list.length})${collapsed ? svgIcon('chevronRight', 10, true) : svgIcon('chevronDown', 10, true)}</span>${lockHtml}</span><span class="gh-track"></span>`;
        gh.addEventListener('click', () => {
          this.collapsedGroups[type] = !this.collapsedGroups[type];
          this.renderLanes();
          this.renderPlayhead();
        });
        if (hasLock) {
          gh.querySelector('.gh-lock').addEventListener('click', (e) => {
            e.stopPropagation();
            if (this.opts.onToggleCategoryLock) this.opts.onToggleCategoryLock(type);
          });
        }
        this.labelsEl.appendChild(gh);
        this.lanes.appendChild(tlbSpacer('tlb-group'));
        if (collapsed) continue;
        if (type === 'controller') {
          // controller 没有层级概念：按 .ctr 中持久化的隐性轨道顺序排列。
          const merged = this.mergedLanes && this.mergedLanes.controller;
          const lanes = merged && merged.length
            ? merged.map((ids) => ids.map((id) => list.find((o) => o.id === id)).filter(Boolean))
              .filter((l) => l.length)
            : [];
          const covered = new Set();
          for (const lane of lanes) for (const o of lane) covered.add(o.id);
          for (const o of list) if (!covered.has(o.id)) lanes.push([o]);
          for (const lane of lanes) {
            this.renderLaneLabel(lane, type);
            this.renderLaneTrack(lane, type);
          }
          continue;
        }
        // note_controller：无层级概念的合并轨道（整理轨道后按分组显示）。
        const merged = this.mergedLanes && this.mergedLanes.note_controller;
        if (merged && merged.length) {
          const lanes = merged
            .map((ids) => ids.map((id) => list.find((o) => o.id === id)).filter(Boolean))
            .filter((l) => l.length);
          const covered = new Set();
          for (const lane of lanes) for (const o of lane) covered.add(o.id);
          for (const o of list) if (!covered.has(o.id)) lanes.push([o]);
          for (const lane of lanes) {
            this.renderLaneLabel(lane, type);
            this.renderLaneTrack(lane, type);
          }
        } else {
          for (const obj of list) {
            this.renderLaneLabel([obj], type);
            this.renderLaneTrack([obj], type);
          }
        }
      }
      if (sc) sc.scrollLeft = prevLeft;
      if (scY) scY.scrollTop = prevTop;
      // Re-anchor the pinned detail window after every rebuild.
      this.syncPinnedFromSelection();
    }

    renderLaneLabel(objs, type) {
      const row = document.createElement('div');
      const obj = objs[0];
      const selected = objs.some((o) => this.isObjSelected(o.id));
      row.className = 'tlh-lane' + (selected ? ' selected' : '');
      const isCtrl = type === 'controller';
      const allHidden = !isCtrl && objs.every((o) => this.opts.isObjHidden && this.opts.isObjHidden(o.id));
      const label = document.createElement('div');
      label.className = 'lane-label' + (selected ? ' selected' : '') +
        (allHidden ? ' hidden-obj' : '') + (obj.mergedSelector ? ' selector-merged' : '');
      const name = objs.length === 1
        ? (obj.label || obj.id)
        : `${TYPE_LABELS[type] || type} × ${objs.length}`;
      const eyeHtml = isCtrl ? '' : `<span class="lane-eye${allHidden ? ' off' : ''}" title="${$t(allHidden ? '显示' : '隐藏')}${$t('对象')}">${svgIcon(allHidden ? 'eyeOff' : 'eye')}</span>`;
      // controller 无可见性开关（不显示眼睛），但支持锁定/解锁。
      const locked = objs.every((o) => this.opts.isLocked && this.opts.isLocked(o.id));
      const lockHtml = `<span class="lane-lock${locked ? ' locked' : ''}" title="${$t(locked ? '解锁' : '锁定')}${$t('（锁定的对象在预览中不可直接点选）')}">${svgIcon(locked ? 'lock' : 'unlock')}</span>`;
      // 轨道 order 数字显示在锁定按钮左侧（合并轨道显示该轨道的共享 order）；
      // controller / note_controller 没有层级概念，不显示。
      const showOrder = !isCtrl && objs[0].type !== 'note_controller' && objs[0].order != null;
      const orderVal = showOrder ? objs[0].order : null;
      const orderLocked = showOrder && this.lockedOrders.has(orderVal);
      const orderHtml = showOrder
        ? `<span class="lane-order${orderLocked ? ' locked' : ''}" title="${$t(orderLocked ? '解锁该 order 层级' : '点击锁定该 order 层级：锁定后该层级不参与整理轨道与切换轨道')}">${escapeHtml(String(orderVal))}</span>`
        : '';
      label.innerHTML = `${eyeHtml}<span class="nm">${escapeHtml(name)}</span>${orderHtml}${lockHtml}`;
      label.title = objs.map((o) => o.id).join(', ');
      label.addEventListener('click', (e) => {
        e.stopPropagation();
        if (e.ctrlKey || e.metaKey) this.toggleObject(objs[0].id);
        else if (e.shiftKey) this.addObject(objs[0].id);
        // 合并轨道的名称列点击：与轨道空白处一致，显示轨道统计而非自动选中第一个。
        else if (objs.length > 1 && this.opts.onLaneInfoClick) this.opts.onLaneInfoClick(objs);
        else this.selectObject(objs[0].id, null);
      });
      label.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (this.opts.onObjectContextMenu) this.opts.onObjectContextMenu(objs[0].id, e.clientX, e.clientY);
      });
      if (!isCtrl) {
        const orderEl = label.querySelector('.lane-order');
        if (orderEl) {
          orderEl.addEventListener('click', (e) => {
            e.stopPropagation();
            if (this.lockedOrders.has(orderVal)) this.lockedOrders.delete(orderVal);
            else this.lockedOrders.add(orderVal);
            if (this.opts.onOrderLockChange) this.opts.onOrderLockChange([...this.lockedOrders]);
            this.renderLanes();
            this.renderPlayhead();
          });
        }
        const eyeEl = label.querySelector('.lane-eye');
        if (eyeEl) {
          eyeEl.addEventListener('click', (e) => {
            e.stopPropagation();
            if (this.opts.onToggleVisibility) this.opts.onToggleVisibility(objs.map((o) => o.id));
          });
        }
        const lockEl = label.querySelector('.lane-lock');
        if (lockEl) {
          lockEl.addEventListener('click', (e) => {
            e.stopPropagation();
            // 合并轨道（多个对象）锁定统一切换整条轨道。
            if (this.opts.onToggleLock) this.opts.onToggleLock(objs.map((o) => o.id));
          });
        }
      }
      row.appendChild(label);
      this.labelsEl.appendChild(row);
    }

    renderLaneTrack(objs, type) {
      const row = document.createElement('div');
      const selected = objs.some((o) => this.isObjSelected(o.id));
      row.className = 'lane-row' + (selected ? ' selected' : '');
      const obj = objs[0];
      const track = document.createElement('div');
      track.className = 'lane-track';
      track.style.width = this.contentWidth() + 'px';

      for (const o of objs) {
        const oSelected = this.isObjSelected(o.id);
        // Clip
        if (!o.noClip && o.clipStart != null) {
          const clip = document.createElement('div');
          clip.className = 'clip' + (oSelected ? ' selected' : '');
          if (o.mergedSelector) clip.classList.add('selector-merged');
          // 谱面变更后原映射失效（note 不存在/无命中）：红色描边提示。
          if (o.invalidNote) clip.classList.add('invalid-note');
          // 被自动移动/排序的时间块：临时明黄高亮（下次点击消失）。
          if (this.opts.isAutoMoved && this.opts.isAutoMoved(o.id)) {
            clip.classList.add('auto-moved');
          }
          clip.dataset.id = o.id;
          const x = o.clipStart * this.pxPerSec;
          const w = Math.max(4, (o.clipEnd - o.clipStart) * this.pxPerSec);
          clip.style.left = x + 'px';
          clip.style.width = w + 'px';
          // 合并的 note 选择器时间块：中央显示命中数量徽标（亮蓝色 N×）。
          if (o.mergedSelector && o.noteCount) {
            const cnt = document.createElement('span');
            cnt.className = 'clip-count';
            cnt.textContent = o.noteCount + '×';
            clip.appendChild(cnt);
          }
          clip.title = (o.lifecycle ? $t('生命周期: ') : '') + fmtTime(o.clipStart) + ' -> ' + fmtTime(o.clipEnd);
          // Sprite / video clips show an asset thumbnail inside the block.
          if ((type === 'sprite' || type === 'video') && o.path) {
            const thumb = document.createElement('img');
            thumb.className = 'clip-thumb';
            thumb.alt = '';
            thumb.dataset.path = o.path;
            clip.appendChild(thumb);
            if (this.opts.loadThumbnail) {
              this.opts.loadThumbnail(o.path, (url) => {
                if (!url) return;
                // The callback can run synchronously while this element is
                // still detached (lane under construction) or asynchronously
                // after a re-render. Set the element itself (detached src is
                // kept when attached) and every live element with the path.
                thumb.src = url;
                document.querySelectorAll('.clip-thumb[data-path="' + CSS.escape(o.path) + '"]')
                  .forEach((t) => { t.src = url; });
              });
            }
          }
          clip.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return;
            e.stopPropagation();
            if (this.isLockedEntry(o.id)) return; // 锁定的时间块不可选取/不可拖动
            if (e.ctrlKey || e.metaKey) { this.toggleObject(o.id); return; }
            if (e.shiftKey) { this.addObject(o.id); return; }
            // 双击检测：选中会重建轨道 DOM，原生 dblclick 会因元素被替换而失效，
            // 因此用 mousedown 时间戳判断（同一对象 750ms 内第二次按下）。
            const now = Date.now();
            const isDouble = this._lastClipDown && this._lastClipDown.id === o.id &&
              now - this._lastClipDown.t < 750;
            this._lastClipDown = { id: o.id, t: now };
            if (isDouble) {
              e.preventDefault();
              // 双击时间块：选中该时间块上的全部关键帧。
              if (this.opts.onSelectAllKeyframes) this.opts.onSelectAllKeyframes(o.id);
              return;
            }
            // Read the geometry BEFORE selecting: selecting re-renders the
            // lanes and detaches this element, which would zero out
            // getBoundingClientRect() and make the edge resize unreachable.
            const rect = clip.getBoundingClientRect();
            const localX = e.clientX - rect.left;
            const HANDLE = 5;
            if (!this.isObjSelected(o.id)) this.selectObject(o.id, null);
            // Resize handles live on the outer 5px of each edge. A clip that is
            // too narrow to have a usable body drags as a WHOLE BLOCK (move).
            if (rect.width > 16 && localX < HANDLE) {
              this.startResizeClip(e, o, 'start');
            } else if (rect.width > 16 && localX > rect.width - HANDLE) {
              this.startResizeClip(e, o, 'end');
            } else {
              this.startDragClip(e, o);
            }
          });
          clip.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (this.opts.onObjectContextMenu) this.opts.onObjectContextMenu(o.id, e.clientX, e.clientY);
          });
          // 双击兜底：第一次 mousedown 会重建轨道 DOM，大谱面下同步渲染可能
          // 超过 mousedown 时间戳窗口导致双击识别失败；原生 dblclick 落在
          // 重建后的新元素上，这里单独挂监听保证双击全选始终生效（与
          // mousedown 检测路径幂等，重复触发无副作用）。
          clip.addEventListener('dblclick', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (e.target.closest('.kf')) return; // 关键帧标记自身的双击不触发全选
            if (this.isLockedEntry(o.id)) return;
            if (this.opts.onSelectAllKeyframes) this.opts.onSelectAllKeyframes(o.id);
          });
          track.appendChild(clip);
        }

        // Controller active-range segments: the interval between two state
        // times, labeled with the fields in effect during that interval.
        for (const seg of o.segments || []) {
          const s = document.createElement('div');
          s.className = 'lane-seg';
          s.style.left = seg.start * this.pxPerSec + 'px';
          s.style.width = Math.max(2, (seg.end - seg.start) * this.pxPerSec) + 'px';
          s.title = $t('生效区间 ') + fmtTime(seg.start) + ' -> ' + fmtTime(seg.end) + ' (' + seg.label + ')';
          s.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return;
            e.stopPropagation();
            this.selectObject(o.id, null);
            // controller 无时间块：用状态区段启动垂直换轨（轨道层级管理）。
            // 点击周期段只选中对象，不把播放头跳转到该段起始关键帧。
            this.startLaneReorderDrag(e, o);
          });
          s.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (this.opts.onObjectContextMenu) this.opts.onObjectContextMenu(o.id, e.clientX, e.clientY);
          });
          track.appendChild(s);
        }

        // Keyframes: badge shows the easing full name; hover shows values.
        for (const kf of o.keyframes || []) {
          const k = document.createElement('div');
          k.className = 'kf' + (this.isKeySelected(o.id, kf.index) ? ' selected' : '') +
            (kf.destroy ? ' destroy' : '') + (kf.merged ? ' selector-merged' : '');
          k.dataset.id = o.id;
          k.dataset.kf = kf.index;
          k.style.left = kf.time * this.pxPerSec + 'px';
          const easeName = kf.easing || '';
          k.innerHTML = `<span class="kf-ease">${escapeHtml(easeName)}</span>`;
          k.title = `${kf.label} @ ${fmtTime(kf.time)}`;
          k.addEventListener('mouseenter', () => {
            this._hoverTooltip = { el: k, kf, time: kf.time, ease: easeName };
            this.updateKfTooltip();
          });
          k.addEventListener('mouseleave', () => {
            this._hoverTooltip = null;
            this.updateKfTooltip();
          });
          k.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return;
            e.stopPropagation();
            // 合并时间块的展示性关键帧（最早/最晚）：点击等同于选中整个
            // 合并时间块并跳转到其属性界面；不可拖动。
            if (kf.displayOnly) {
              if (this.isLockedEntry(o.id)) return; // 锁定的时间块不可选取
              if (e.ctrlKey || e.metaKey) { this.toggleObject(o.id); return; }
              if (e.shiftKey) { this.addObject(o.id); return; }
              this.selectObject(o.id, null);
              return;
            }
            if (this.isLockedEntry(o.id)) return; // 锁定对象的关键帧不可选取
            if (e.ctrlKey || e.metaKey) { this.toggleKey(o.id, kf.index); return; }
            if (e.shiftKey) { this.addKey(o.id, kf.index); return; }
            this._hoverTooltip = null;
            // Dragging an already-selected keyframe keeps the multi-selection
            // so the whole batch moves together; otherwise select it first.
            if (!this.isKeySelected(o.id, kf.index)) {
              this.selectObject(o.id, kf.index);
              // Select the keyframe and reveal its properties, but do NOT move
              // the playhead to its time (null skips the jump in the app).
              if (this.opts.onSelectKeyframe) this.opts.onSelectKeyframe(o.id, kf.index, null);
            }
            if (kf.draggable) this.startDragKey(e, o, kf);
          });
          k.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (this.opts.onKeyframeContextMenu) {
              this.opts.onKeyframeContextMenu(o.id, kf.index, kf.time, e.clientX, e.clientY);
            }
          });
          track.appendChild(k);
        }
      }

      track.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        if (e.target === track) this.startMarqueeOrClick(e, objs);
      });
      // 记录该轨道所属分组与组内序号，供垂直换轨时定位（所有分组共用同一容器）。
      row.dataset.laneGroup = ['sprite', 'text', 'video', 'line'].includes(type) ? 'stage' : type;
      // 轨道共享的 order（锁定层级判断用；controller / note_controller 无层级）。
      row.dataset.laneOrder = (objs[0] && objs[0].order != null) ? String(objs[0].order) : '';
      let laneIdx = 0;
      for (let i = this.lanes.children.length - 1; i >= 0; i--) {
        const s = this.lanes.children[i];
        if (s.classList.contains('tlb-group')) break;
        if (s.classList.contains('lane-row')) laneIdx++;
      }
      row.dataset.laneIndex = String(laneIdx);
      row.appendChild(track);
      this.lanes.appendChild(row);
    }

    // Left-drag on empty timeline space box-selects clips / keyframes; a plain
    // click keeps the previous behavior (select the lane's object).
    startMarqueeOrClick(e, laneObjs) {
      const startClientX = e.clientX, startClientY = e.clientY;
      const crect0 = this.content.getBoundingClientRect();
      const startX = startClientX - crect0.left;
      const startY = startClientY - crect0.top;
      let moved = false;
      let marquee = null;
      const move = (ev) => {
        if (!moved && Math.hypot(ev.clientX - startClientX, ev.clientY - startClientY) > 4) {
          moved = true;
          marquee = document.createElement('div');
          marquee.className = 'tl-marquee';
          this.content.appendChild(marquee);
          this.content.classList.add('marquee-active');
        }
        if (marquee) {
          // 使用内容坐标定位选框：滚动视图时选框随内容移动而不失效。
          const rect = this.content.getBoundingClientRect();
          const cx = ev.clientX - rect.left;
          const cy = ev.clientY - rect.top;
          marquee.style.left = Math.min(startX, cx) + 'px';
          marquee.style.top = Math.min(startY, cy) + 'px';
          marquee.style.width = Math.abs(cx - startX) + 'px';
          marquee.style.height = Math.abs(cy - startY) + 'px';
        }
        // 鼠标到达可视区边界：自动滚动视图扩展选取范围。
        this.marqueeEdgeScroll(ev);
      };
      const up = (ev) => {
        document.removeEventListener('mousemove', move);
        document.removeEventListener('mouseup', up);
        this._marqueeEdge = null;
        if (this._marqueeRaf) { cancelAnimationFrame(this._marqueeRaf); this._marqueeRaf = null; }
        if (marquee) {
          marquee.remove();
          this.content.classList.remove('marquee-active');
        }
        if (moved) {
          const rect = this.content.getBoundingClientRect();
          this.applyMarquee(startX, startY, ev.clientX - rect.left, ev.clientY - rect.top, ev.ctrlKey || ev.metaKey);
        } else if (laneObjs && laneObjs.length) {
          if (ev.ctrlKey || ev.metaKey) this.toggleObject(laneObjs[0].id);
          else if (ev.shiftKey) this.addObject(laneObjs[0].id);
          // 合并轨道（多个时间块）空白处点击：显示轨道统计信息而非自动选中第一个。
          else if (laneObjs.length > 1 && this.opts.onLaneInfoClick) this.opts.onLaneInfoClick(laneObjs);
          else this.selectObject(laneObjs[0].id, null);
        }
      };
      document.addEventListener('mousemove', move);
      document.addEventListener('mouseup', up);
    }

    // 框选时鼠标进入可视区边缘：记录方向并启动连续自动滚动。
    marqueeEdgeScroll(e) {
      const sc = this.scroll;
      if (!sc) return;
      const r = sc.getBoundingClientRect();
      const EDGE = 28;
      let ex = 0, ey = 0;
      if (e.clientX < r.left + EDGE) ex = -1;
      else if (e.clientX > r.right - EDGE) ex = 1;
      if (e.clientY < r.top + EDGE) ey = -1;
      else if (e.clientY > r.bottom - EDGE) ey = 1;
      this._marqueeEdge = (ex || ey) ? { x: ex, y: ey } : null;
      this.startMarqueeAutoScroll();
    }

    startMarqueeAutoScroll() {
      if (this._marqueeRaf) return;
      const step = () => {
        this._marqueeRaf = null;
        const edge = this._marqueeEdge;
        if (!edge || (!edge.x && !edge.y)) return;
        const sc = this.scroll;
        if (sc) {
          sc.scrollLeft = Math.max(0, Math.min(sc.scrollWidth - sc.clientWidth, sc.scrollLeft + edge.x * 14));
          sc.scrollTop = Math.max(0, Math.min(sc.scrollHeight - sc.clientHeight, sc.scrollTop + edge.y * 14));
        }
        this._marqueeRaf = requestAnimationFrame(step);
      };
      this._marqueeRaf = requestAnimationFrame(step);
    }

    applyMarquee(x1, y1, x2, y2, append) {
      const l = Math.min(x1, x2), r = Math.max(x1, x2);
      const t = Math.min(y1, y2), b = Math.max(y1, y2);
      const crect = this.content.getBoundingClientRect();
      const clips = [];
      const kfs = [];
      for (const el of this.lanes.querySelectorAll('.clip')) {
        const rc = el.getBoundingClientRect();
        const ex1 = rc.left - crect.left, ey1 = rc.top - crect.top;
        const ex2 = rc.right - crect.left, ey2 = rc.bottom - crect.top;
        if (ex2 >= l && ex1 <= r && ey2 >= t && ey1 <= b && !this.isLockedEntry(el.dataset.id)) clips.push(el.dataset.id);
      }
      for (const el of this.lanes.querySelectorAll('.kf')) {
        const rc = el.getBoundingClientRect();
        const ex1 = rc.left - crect.left, ey1 = rc.top - crect.top;
        const ex2 = rc.right - crect.left, ey2 = rc.bottom - crect.top;
        if (ex2 >= l && ex1 <= r && ey2 >= t && ey1 <= b && !this.isLockedEntry(el.dataset.id)) {
          kfs.push({ objId: el.dataset.id, index: parseInt(el.dataset.kf, 10) });
        }
      }
      if (this.opts.onMarqueeSelect) {
        this.opts.onMarqueeSelect({ clipIds: clips, kfs }, append);
      } else if (clips.length) {
        this.selectedIds = new Set(clips);
        this.selectedObject = clips[clips.length - 1];
        this.selectedKfs = new Map();
        this.renderLanes();
        this.notifySelection();
      }
    }

    selectObject(id, keyIdx) {
      if (id != null && this.isLockedEntry(id)) return;
      this.selectedObject = id;
      this.selectedKey = keyIdx != null ? keyIdx : null;
      this.selectedIds = id != null ? new Set([id]) : new Set();
      this.selectedKfs = id != null && keyIdx != null
        ? new Map([[id + '::' + keyIdx, true]])
        : new Map();
      if (keyIdx == null) {
        this.tooltipPinned = null;
        this._hoverTooltip = null;
        this.hideKfTooltip();
      }
      this.notifySelection();
      this.renderLanes();
      this.renderPlayhead();
      if (this.opts.onSelectObject) this.opts.onSelectObject(id, keyIdx);
    }

    renderPlayhead() {
      // 表头是独立模块：播放头只在时间轴体内定位（x 从内容区起点算）。
      const maxX = this.duration * this.pxPerSec;
      const x = Math.min(maxX, Math.max(0, this.time * this.pxPerSec));
      this.playhead.style.left = x + 'px';
      // 播放头本体嵌入时间标尺：标尺内同步显示游标。
      if (this.rulerPlayhead) this.rulerPlayhead.style.left = x + 'px';
      const s = this.scroll;
      if (s) {
        const vw = s.clientWidth;
        if (x < s.scrollLeft) s.scrollLeft = Math.max(0, x);
        else if (x > s.scrollLeft + vw - 10) s.scrollLeft = x - vw + 10;
      }
    }

    updateHScrollThumb() {
      const s = this.scroll;
      if (!this.hScrollThumb || !this.hScrollTrack || !s) return;
      const trackW = this.hScrollTrack.clientWidth;
      const max = Math.max(0, s.scrollWidth - s.clientWidth);
      const thumbW = max > 0
        ? Math.max(24, Math.min(trackW, trackW * s.clientWidth / s.scrollWidth))
        : trackW;
      this.hScrollThumb.style.width = thumbW + 'px';
      this.hScrollThumb.style.left = (max > 0 ? s.scrollLeft / max * Math.max(0, trackW - thumbW) : 0) + 'px';
    }

    timeFromEvent(e) {
      const rect = this.content.getBoundingClientRect();
      // 表头是独立模块：点击位置直接换算时间轴体内的时间。
      const x = Math.max(0, e.clientX - rect.left);
      return Math.min(this.duration, Math.max(0, x / this.pxPerSec));
    }

    bindEvents() {
      // Keep the detail info window following the keyframe while scrolling.
      this.scroll.addEventListener('scroll', () => {
        if (this.kfTooltip && this.kfTooltip.style.display !== 'none') {
          this.updateKfTooltip();
        }
      });
      // 标尺与时间轴体横向滚动保持同步（标尺常驻顶部）。
      this.rulerScroll.addEventListener('scroll', () => {
        this.scroll.scrollLeft = this.rulerScroll.scrollLeft;
      });
      this.scroll.addEventListener('scroll', () => {
        this.rulerScroll.scrollLeft = this.scroll.scrollLeft;
        this.updateHScrollThumb();
      });
      // 常驻横向滚动条：拖动滑块 / 点击轨道控制时间轴体横向滚动。
      this.hScrollThumb.addEventListener('mousedown', (e) => {
        e.preventDefault();
        const startX = e.clientX;
        const startLeft = this.scroll.scrollLeft;
        const move = (ev) => {
          const max = Math.max(0, this.scroll.scrollWidth - this.scroll.clientWidth);
          const usable = Math.max(1, this.hScrollTrack.clientWidth - this.hScrollThumb.offsetWidth);
          this.scroll.scrollLeft = Math.max(0, Math.min(max, startLeft + (ev.clientX - startX) / usable * max));
        };
        const up = () => {
          document.removeEventListener('mousemove', move);
          document.removeEventListener('mouseup', up);
        };
        document.addEventListener('mousemove', move);
        document.addEventListener('mouseup', up);
      });
      this.hScrollTrack.addEventListener('mousedown', (e) => {
        if (e.target === this.hScrollThumb) return;
        const rect = this.hScrollTrack.getBoundingClientRect();
        const max = Math.max(0, this.scroll.scrollWidth - this.scroll.clientWidth);
        this.scroll.scrollLeft = Math.max(0, Math.min(max, (e.clientX - rect.left) / rect.width * max));
      });
      // 防挡：跟踪鼠标位置，浮窗实时避开光标。
      document.addEventListener('mousemove', (e) => {
        this._mousePos = { x: e.clientX, y: e.clientY };
        if (this.kfTooltip && this.kfTooltip.style.display !== 'none') {
          this.updateKfTooltip();
        }
      });
      // Scrub on ruler
      this.rulerCanvas.addEventListener('mousedown', (e) => {
        if (this.opts.onScrubStart) this.opts.onScrubStart();
        const t = this.timeFromEvent(e);
          this.setTime(t);
          if (this.opts.onScrub) this.opts.onScrub(t);
          const move = (ev) => {
          const tt = this.snapTime(this.timeFromEvent(ev));
            this.setTime(tt);
            if (this.opts.onScrub) this.opts.onScrub(tt);
        };
        const up = () => {
          document.removeEventListener('mousemove', move);
          document.removeEventListener('mouseup', up);
          this.showSnapLine(null);
          if (this.opts.onScrubEnd) this.opts.onScrubEnd();
        };
        document.addEventListener('mousemove', move);
        document.addEventListener('mouseup', up);
      });
      // 左键在轨道空白区域框选时间块 / 关键帧。
      this.lanes.addEventListener('mousedown', (e) => {
        if (e.button !== 0 || e.target !== this.lanes) return;
        this.startMarqueeOrClick(e, null);
      });
      this.playhead.addEventListener('mousedown', (e) => {
          e.preventDefault();
          if (this.opts.onScrubStart) this.opts.onScrubStart();
          const move = (ev) => {
          const tt = this.snapTime(this.timeFromEvent(ev));
            this.setTime(tt);
            if (this.opts.onScrub) this.opts.onScrub(tt);
        };
        const up = () => {
          document.removeEventListener('mousemove', move);
          document.removeEventListener('mouseup', up);
          this.showSnapLine(null);
          if (this.opts.onScrubEnd) this.opts.onScrubEnd();
        };
        document.addEventListener('mousemove', move);
        document.addEventListener('mouseup', up);
      });
      // Accept controller option cards dragged from the properties panel:
      // dropping onto the timeline adds that option block at the drop time.
      this.content.addEventListener('dragover', (e) => {
        if (e.dataTransfer && e.dataTransfer.types &&
            Array.prototype.includes.call(e.dataTransfer.types, 'application/x-cytoid-ctrl-card')) {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'copy';
          this.content.classList.add('card-drop-target');
        }
      });
      this.content.addEventListener('dragleave', (e) => {
        if (!this.content.contains(e.relatedTarget)) this.content.classList.remove('card-drop-target');
      });
      this.content.addEventListener('drop', (e) => {
        this.content.classList.remove('card-drop-target');
        const raw = e.dataTransfer && e.dataTransfer.getData('application/x-cytoid-ctrl-card');
        if (!raw) return;
        e.preventDefault();
        try {
          const payload = JSON.parse(raw);
          payload.time = this.timeFromEvent(e);
          if (this.opts.onControllerCardDrop) this.opts.onControllerCardDrop(payload);
        } catch (err) { /* malformed drag payload */ }
      });
      // Right-click on the timeline background (clips / keyframes / labels stop
      // propagation) opens the timeline context menu, e.g. paste keyframes.
      this.content.addEventListener('contextmenu', (e) => {
        if (!this.opts.onTimelineContextMenu) return;
        e.preventDefault();
        this.opts.onTimelineContextMenu(e.clientX, e.clientY);
      });
    }

    startDragClip(e, obj) {
      e.preventDefault();
      const startX = e.clientX;
      const startY = e.clientY;
      // Batch move: when the clicked clip belongs to a multi-selection, all
      // selected objects shift together (relative spacing preserved).
      const ids = this.selectedIds.size
        ? [...this.selectedIds]
        : [obj.id];
      if (this.opts.onDragStart) this.opts.onDragStart(ids);
      let reorder = null; // 垂直拖拽换轨模式 { lastIdx, laneIndex, laneGroup }
      let reorderLive = false; // 实时换轨已应用（mouseup 不再重复提交）
      const move = (ev) => {
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        // 垂直方向明显大于水平方向时进入“上下拖动改层级”模式。
        if (!reorder && Math.abs(dy) > 14 && Math.abs(dy) > Math.abs(dx) * 1.5) {
          reorder = { lastIdx: -1, laneIndex: -1, laneGroup: null };
          this.content.classList.add('reorder-active');
        }
        if (reorder) {
          const rows = this.lanes.querySelectorAll('.lane-row');
          let idx = -1;
          for (let i = 0; i < rows.length; i++) {
            const rc = rows[i].getBoundingClientRect();
            if (ev.clientY >= rc.top && ev.clientY <= rc.bottom) { idx = i; break; }
          }
          rows.forEach((r, i) => r.classList.toggle('drop-target', i === idx));
          // 目标行携带其分组与组内序号（stage / controller / note_controller）。
          const target = rows[idx];
          const laneGroup = target && target.dataset && target.dataset.laneGroup
            ? target.dataset.laneGroup
            : (['sprite', 'text', 'video', 'line'].includes(obj.type) ? 'stage' : obj.type);
          const laneIndex = target ? Number(target.dataset.laneIndex) : -1;
          const objGroup = ['sprite', 'text', 'video', 'line'].includes(obj.type) ? 'stage' : obj.type;
          // 锁定的 order 层级不能拖入：拖动时自动跳过（不标记 drop-target，
          // 不触发换轨）；controller / note_controller 无层级概念不受限。
          const targetOrder = Number(target && target.dataset ? target.dataset.laneOrder : '');
          const targetLocked = objGroup === 'stage' && Number.isFinite(targetOrder) &&
            this.lockedOrders.has(targetOrder);
          const crossed = idx !== reorder.lastIdx || laneGroup !== reorder.laneGroup;
          if (idx >= 0 && crossed && !targetLocked && laneIndex >= 0 && laneGroup === objGroup &&
              this.opts.onReorderLive) {
            // 实时换轨：order 数字标识与轨道布局随拖动即时更新。
            reorder.lastIdx = idx;
            reorder.laneIndex = laneIndex;
            reorder.laneGroup = laneGroup;
            reorderLive = true;
            this.opts.onReorderLive(obj.id, laneGroup, laneIndex);
            // 实时应用会重建轨道 DOM：重新标记目标行并刷新当前对象引用。
            const rows2 = this.lanes.querySelectorAll('.lane-row');
            rows2.forEach((r) => {
              const rOrder = Number(r.dataset && r.dataset.laneOrder != null ? r.dataset.laneOrder : '');
              const rLocked = objGroup === 'stage' && Number.isFinite(rOrder) && this.lockedOrders.has(rOrder);
              r.classList.toggle('drop-target',
                !rLocked && r.dataset.laneGroup === laneGroup &&
                Number(r.dataset.laneIndex) === laneIndex);
            });
            const cur = this.objects.find((o) => o.id === obj.id);
            if (cur) obj = cur;
          } else {
            reorder.lastIdx = idx;
            reorder.laneIndex = laneIndex;
            reorder.laneGroup = laneGroup;
          }
          return;
        }
        const dt = dx / this.pxPerSec;
        const snapped = this.snapTime(obj.clipStart + dt) - obj.clipStart;
        const inc = snapped - (this._dragLastSnap || 0);
        this._dragLastSnap = snapped;
        if (this.opts.onShiftClips) this.opts.onShiftClips(ids, inc);
        else if (this.opts.onShiftClip) this.opts.onShiftClip(obj.id, inc);
        this._dragLastDt = dt;
      };
      const up = () => {
        this._dragLastDt = 0;
        this._dragLastSnap = 0;
        this.content.classList.remove('reorder-active');
        this.lanes.querySelectorAll('.lane-row').forEach((r) => r.classList.remove('drop-target'));
        document.removeEventListener('mousemove', move);
        document.removeEventListener('mouseup', up);
        this.showSnapLine(null);
        // 实时换轨已在拖动中应用，mouseup 不需要重复提交。
        if (reorder && reorder.laneIndex >= 0 && this.opts.onReorderClip && !reorderLive) {
          this.opts.onReorderClip(obj.id, reorder.laneGroup, reorder.laneIndex);
        }
        // 拖动结束：恢复被“挤开”但未被真正占用原位的对象。
        if (this.opts.onDragEnd) this.opts.onDragEnd(ids);
      };
      document.addEventListener('mousemove', move);
      document.addEventListener('mouseup', up);
    }

    // 垂直拖动换轨（controller 专用）：controller 没有可拖的时间块，状态区段
    // 只负责选择/定位，竖直方向超过阈值后进入轨道层级拖拽（无水平时间平移）。
    startLaneReorderDrag(e, obj) {
      if (this.opts.onDragStart) this.opts.onDragStart();
      const startY = e.clientY;
      let active = false;
      let lastTarget = null;
      const move = (ev) => {
        const dy = ev.clientY - startY;
        if (!active && Math.abs(dy) > 14) {
          active = true;
          this.content.classList.add('reorder-active');
        }
        if (!active) return;
        const rows = this.lanes.querySelectorAll('.lane-row');
        let idx = -1;
        for (let i = 0; i < rows.length; i++) {
          const rc = rows[i].getBoundingClientRect();
          if (ev.clientY >= rc.top && ev.clientY <= rc.bottom) { idx = i; break; }
        }
        rows.forEach((r, i) => r.classList.toggle('drop-target', i === idx));
        const target = rows[idx];
        if (!target) return;
        const laneGroup = (target.dataset && target.dataset.laneGroup) || 'controller';
        const laneIndex = Number(target.dataset.laneIndex);
        const key = laneGroup + ':' + laneIndex;
        if (key !== lastTarget && laneGroup === 'controller' && this.opts.onReorderLive) {
          lastTarget = key;
          this.opts.onReorderLive(obj.id, laneGroup, laneIndex);
          const rows2 = this.lanes.querySelectorAll('.lane-row');
          rows2.forEach((r) => r.classList.toggle('drop-target',
            r.dataset.laneGroup === laneGroup && Number(r.dataset.laneIndex) === laneIndex));
        }
      };
      const up = () => {
        this.content.classList.remove('reorder-active');
        this.lanes.querySelectorAll('.lane-row').forEach((r) => r.classList.remove('drop-target'));
        document.removeEventListener('mousemove', move);
        document.removeEventListener('mouseup', up);
      };
      document.addEventListener('mousemove', move);
      document.addEventListener('mouseup', up);
    }

    // Resize a clip's start/end edge by dragging, snapping included.
    startResizeClip(e, obj, side) {
      e.preventDefault();
      if (this.opts.onDragStart) this.opts.onDragStart();
      const startX = e.clientX;
      const orig = side === 'start' ? obj.clipStart : obj.clipEnd;
      const move = (ev) => {
        const dt = (ev.clientX - startX) / this.pxPerSec;
        const nt = this.snapTime(Math.max(0, orig + dt));
        if (this.opts.onResizeClip) this.opts.onResizeClip(obj.id, side, nt);
      };
      const up = () => {
        document.removeEventListener('mousemove', move);
        document.removeEventListener('mouseup', up);
        this.showSnapLine(null);
        if (this.opts.onDragEnd) this.opts.onDragEnd([obj.id]);
      };
      document.addEventListener('mousemove', move);
      document.addEventListener('mouseup', up);
    }

    startDragKey(e, obj, kf) {
      e.preventDefault();
      if (this.opts.onDragStart) this.opts.onDragStart();
      const startX = e.clientX;
      const startT = kf.time;
      // Batch move: all selected keyframes move together.
      const items = this.selectedKfs.size
        ? [...this.selectedKfs.keys()].map((key) => {
            const i = key.lastIndexOf('::');
            return { objId: key.slice(0, i), index: Number(key.slice(i + 2)) };
          })
        : [{ objId: obj.id, index: kf.index }];
      this._dragLastKfT = startT;
      const move = (ev) => {
        const dt = (ev.clientX - startX) / this.pxPerSec;
        const nt = this.snapTime(Math.max(0, startT + dt));
        const inc = nt - (this._dragLastKfT != null ? this._dragLastKfT : startT);
        this._dragLastKfT = nt;
        if (this.opts.onMoveKeyframes) this.opts.onMoveKeyframes(items, inc);
        else if (this.opts.onMoveKeyframe) this.opts.onMoveKeyframe(obj.id, kf.index, nt);
      };
      const up = () => {
          this._dragLastKfT = null;
          document.removeEventListener('mousemove', move);
          document.removeEventListener('mouseup', up);
          this.showSnapLine(null);
          if (this.opts.onKeyframeDragEnd) this.opts.onKeyframeDragEnd();
        };
      document.addEventListener('mousemove', move);
      document.addEventListener('mouseup', up);
    }
  }

  function fmtTime(t) {
    if (t == null || isNaN(t)) return '0.000';
    const ss = Math.floor(t);
    const ms = Math.floor((t - ss) * 1000);
    return `${ss}.${String(ms).padStart(3, '0')}`;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  const api = { Timeline, fmtTime };
  window.SBTimeline = api;
})();
