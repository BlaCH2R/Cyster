// Game-view preview renderer for the Storyboarder.
// Draws the Cytoid play field (notes, scanline, background, minimal UI) plus
// storyboard stage objects and controller effects, at a given time.
(() => {
  const SB = (typeof window !== 'undefined' ? window.SBEngine.storyboard : require('../engine/storyboard.js'));
  const ChartMod = (typeof window !== 'undefined' ? window.SBEngine.chart : require('../engine/chart.js'));
  const Colors = (typeof window !== 'undefined' ? window.SBEngine.colors : require('../engine/colors.js'));
  const Effects = (typeof window !== 'undefined' ? window.SBEffects : require('./effects.js'));

  const NOTE_SIZE_FACTOR = {
    // Exact NoteSizes from the decompiled GameConfig (x Click size)
    click: 1.9717, hold: 1.9717, long_hold: 1.9717,
    // drag head = 64% of click; drag/c-drag children = 56% * 0.8 (scaled to
    // 80% of their previous size per the latest requirement)
    drag_head: 1.9717 * 0.64, drag_child: 1.2816 * 0.448,
    flick: 2.218, c_drag_head: 1.9717, c_drag_child: 1.2816 * 0.448
  };

  const ALIGN_MAP = {
    upperleft: ['left', 'top'], uppercener: ['center', 'top'], uppercenerr: ['center', 'top'],
    uppercenerrr: ['center', 'top'], uppercenerrrr: ['center', 'top'],
    uppercenter: ['center', 'top'], upperright: ['right', 'top'],
    middleleft: ['left', 'middle'], middlecenter: ['center', 'middle'], middleright: ['right', 'middle'],
    lowerleft: ['left', 'bottom'], lowercenter: ['center', 'bottom'], lowerright: ['right', 'bottom']
  };

  const FONT_WEIGHT = { regular: '400', extralight: '200', bold: '700', extrabold: '800' };
  const WHITE = { r: 1, g: 1, b: 1, a: 1 };
  const SB_FONT_FAMILY = "'Nunito', 'Source Han Sans HW TC', sans-serif";
  const FONT_FILES = [
    ['Nunito', 'Nunito-ExtraLight.ttf', 200, 'normal'],
    ['Nunito', 'Nunito-Regular.ttf', 400, 'normal'],
    ['Nunito', 'Nunito-Bold.ttf', 700, 'normal'],
    ['Nunito', 'Nunito-ExtraBold.ttf', 800, 'normal'],
    ['Source Han Sans HW TC', 'SourceHanSansHWTC-Regular.otf', 400, 'normal']
  ];

  // Loads the official Cytoid fonts (Nunito weights + Source Han Sans CJK
  // fallback, mirroring the Unity fontNames/fallback config) into the renderer.
  async function loadSbFonts() {
    if (typeof window === 'undefined' || !window.sbAPI) return [];
    const loaded = [];
    for (const [family, file, weight, style] of FONT_FILES) {
      try {
        const r = await window.sbAPI.getAsset('fonts/' + file);
        if (!r || !r.data) continue;
        const mime = file.toLowerCase().endsWith('.otf') ? 'font/opentype' : 'font/ttf';
        const face = new FontFace(family, `url(data:${mime};base64,${r.data})`, {
          weight: String(weight),
          style
        });
        await face.load();
        document.fonts.add(face);
        loaded.push(family + ':' + weight);
      } catch (e) {
        /* font unavailable; canvas falls back to sans-serif */
      }
    }
    return loaded;
  }

  class PreviewRenderer {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.chart = null;
      this.compiled = null;
      this.levelDir = null;
      this.level = null;
      this.time = 0;
      this.playing = false;
      this.audio = null;
      this.backgroundImage = null;
      this.imageCache = {};
      this.videoCache = {};
      this.lastNoteEval = null;
      this.ui = {
        opacity: 1,
        show: true,
        showNotes: true,
        showNoteIds: true,
        accent: '#5bc0eb'
      };
      this.effectBudget = { maxFramePx: 1280 * 720 };
      this.canvasRatio = 16 / 9;
      this.effectsEnabled = true;
      this.richEffects = true;
      // Editor zoom-out scale: <1 renders the playfield smaller and centered
      // so storyboard content beyond the canvas edges stays visible.
      this.sceneScale = 1;
      this._lastScanY = null;
      this._boundaryFlashTop = 0;
      this._boundaryFlashBottom = 0;
      this.flickAssets = null;
      this.flickAssetsPromise = null;
      this.playerAssets = null;
      this.playerAssetsPromise = null;
      // Perspective sprite warp caches: warped results are reused while a
      // sprite's transform / image / tint stay identical (most sprites are
      // static between frames), and downscaled tinted sources are cached per
      // image+tint so animated sprites don't re-tint / re-read every frame.
      this._warpCache = new Map();
      this._warpSourceCache = new Map();
      // Warp resolution cap (long side in px). Set to 512 per user request:
      // quality-first, so the adaptive lowering below 512 was removed.
      this._warpMax = 512;
      this.lastRenderedTime = null;
      this._dirty = true;
    }

    async loadLevel(level, levelDir, chartText, storyboardJson) {
      this.level = level;
      this.levelDir = levelDir;
      this.chart = new ChartMod.Chart(chartText || '{}', { screenRatio: this.canvasRatio });
      this.compiled = storyboardJson
        ? new SB.StoryboardCompiler(storyboardJson, this.chart).compile()
        : null;
      this.imageCache = {};
      this.videoCache = {};
      this.backgroundImage = null;
      this._warpCache.clear();
      this._warpSourceCache.clear();
      this._dirty = true;
      this.ensurePlayerAssets();
      this.preloadImages();
      const bgPath = level && level.background && level.background.path;
      if (bgPath) {
        try {
          this.backgroundImage = await this.loadImage(bgPath);
        } catch (e) {
          this.backgroundImage = null;
        }
      }
    }

    setStoryboard(storyboardJson) {
      this.compiled = storyboardJson
        ? new SB.StoryboardCompiler(storyboardJson, this.chart).compile()
        : null;
      this._warpCache.clear();
      this._warpSourceCache.clear();
      this._dirty = true;
      this.preloadVideos();
      this.preloadImages();
    }

    // Objects / notes excluded from rendering by the editor's eye toggles.
    // hiddenObjIds holds compiled (substituted) object ids; hiddenNoteIds
    // holds chart note ids hidden through note_controller toggles.
    setVisibility(hiddenObjIds, hiddenNoteIds) {
      this.hiddenObjIds = hiddenObjIds || new Set();
      this.hiddenNoteIds = hiddenNoteIds || new Set();
      this._dirty = true;
    }

    // Editor selection highlight: objIds = stage objects to outline,
    // noteIds = notes to ring (used when a note_controller is selected).
    setHighlight(objId, noteIds) {
      this.highlightObjIds = objId ? new Set([objId]) : null;
      this.highlightNotes = noteIds || null;
      this._dirty = true;
    }

    setHighlights(objIds, noteIds) {
      this.highlightObjIds = objIds && objIds.size ? new Set(objIds) : null;
      this.highlightNotes = noteIds || null;
      this._dirty = true;
    }

    setTime(t) {
      this.time = t;
      this._dirty = true;
    }

    setPlaying(p, startTime) {
      this.playing = p;
      if (this.audio) {
        if (p) this.audio.play(startTime != null ? startTime : this.time);
        else this.audio.pause();
      }
    }

    attachAudio(audioEl) {
      this.audio = audioEl;
      if (audioEl && typeof audioEl.addEventListener === 'function') {
        audioEl.addEventListener('timeupdate', () => {
          if (this.playing) this.time = audioEl.currentTime;
        });
      }
    }

    markDirty() {
      this._dirty = true;
    }

    async loadImage(relPath) {
      if (this.imageCache[relPath]) return this.imageCache[relPath];
      this._imagePromises = this._imagePromises || {};
      if (this._imagePromises[relPath]) return this._imagePromises[relPath];
      const promise = (async () => {
      const full = this.resolveAssetPath(relPath);
      const res = await window.sbAPI.readFileBuffer(full);
      const buf = new Uint8Array(atob(res.data).split('').map((c) => c.charCodeAt(0)));
      const blob = new Blob([buf], { type: relPath.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg' });
      const url = URL.createObjectURL(blob);
      const img = new Image();
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = url;
      });
      this.imageCache[relPath] = img;
      this._dirty = true;
      delete this._imagePromises[relPath];
      return img;
      })().catch((e) => {
        delete this._imagePromises[relPath];
        throw e;
      });
      this._imagePromises[relPath] = promise;
      return promise;
    }

    // Library asset paths may be relative to the level dir or absolute (files
    // referenced in place without copying). Resolve both to a readable path.
    resolveAssetPath(p) {
      const s = String(p || '').replace(/\\/g, '/');
      if (!s) return '';
      if (/^[A-Za-z]:\//.test(s) || s.startsWith('//') || s.startsWith('/')) return s;
      return this.levelDir ? this.levelDir.replace(/\\/g, '/') + '/' + s : s;
    }

    // Start loading every image referenced by storyboard sprites right away so
    // the first frame that needs them doesn't wait for a per-frame load.
    preloadImages() {
      if (!this.compiled) return;
      const seen = new Set();
      for (const r of this.compiled.sprites || []) {
        for (const st of r.states || []) {
          if (st.path && !seen.has(st.path)) {
            seen.add(st.path);
            this.loadImage(st.path).catch(() => {});
          }
        }
      }
    }

    ensureFlickAssets() {
      if (this.flickAssets) return this.flickAssets;
      if (this.flickAssetsPromise) return this.flickAssetsPromise;
      this.flickAssetsPromise = (async () => {
        const load = async (name) => {
          const res = await window.sbAPI.getAsset(name);
          const buf = new Uint8Array(atob(res.data).split('').map((c) => c.charCodeAt(0)));
          const blob = new Blob([buf], { type: 'image/png' });
          const url = URL.createObjectURL(blob);
          const img = new Image();
          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            img.src = url;
          });
          this.warmTexture(img);
          return img;
        };
        const [blue, red] = await Promise.all([load('bluef.png'), load('redf.png')]);
        this.flickAssets = { blue, red };
        this._dirty = true;
        return this.flickAssets;
      })().catch((e) => {
        this.flickAssetsPromise = null;
        console.warn('flick assets load failed', e);
      });
      return this.flickAssetsPromise;
    }

    // Force Chromium to decode/upload a texture right after loading, so the
    // first note that uses it doesn't stall for ~12ms on its first draw.
    warmTexture(img) {
      try {
        if (!img || !img.complete) return;
        const c = document.createElement('canvas');
        c.width = 4;
        c.height = 4;
        const cc = c.getContext('2d');
        cc.drawImage(img, 0, 0, 4, 4);
      } catch (e) {}
    }

    ensurePlayerAssets() {
      if (this.playerAssets) return this.playerAssets;
      if (this.playerAssetsPromise) return this.playerAssetsPromise;
      this.playerAssetsPromise = (async () => {
        const names = [
          'player/note_ring.png', 'player/note_fill.png',
          'player/flick_ring.png', 'player/flick_fill.png',
          'player/flick_left.png', 'player/flick_right.png',
          'player/hold_line.png', 'player/hold_triangle.png', 'player/hold_ring.png',
          'player/c_drag_fill.png', 'player/drag_line.png'
        ];
        const load = async (name) => {
          const res = await window.sbAPI.getAsset(name);
          const buf = new Uint8Array(atob(res.data).split('').map((c) => c.charCodeAt(0)));
          const blob = new Blob([buf], { type: 'image/png' });
          const url = URL.createObjectURL(blob);
          const img = new Image();
          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            img.src = url;
          });
          this.warmTexture(img);
          return img;
        };
        const loaded = await Promise.all(names.map(load));
        const assets = {};
        const keys = ['noteRing', 'noteFill', 'flickRing', 'flickFill', 'flickLeft', 'flickRight',
          'holdLine', 'holdTriangle', 'holdRing', 'cDragFill', 'dragLine'];
        keys.forEach((k, i) => { assets[k] = loaded[i]; });
        this.playerAssets = assets;
        this._dirty = true;
        return this.playerAssets;
      })().catch((e) => {
        this.playerAssetsPromise = null;
        console.warn('player assets load failed', e);
      });
      return this.playerAssetsPromise;
    }

    async loadVideo(relPath) {
      if (this.videoCache[relPath]) return this.videoCache[relPath];
      const full = this.resolveAssetPath(relPath);
      const res = await window.sbAPI.readFileBuffer(full);
      const bin = atob(res.data);
      const buf = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
      const blob = new Blob([buf], { type: 'video/mp4' });
      const url = URL.createObjectURL(blob);
      const video = document.createElement('video');
      video.src = url;
      video.muted = true;
      video.preload = 'auto';
      this.videoCache[relPath] = video;
      return video;
    }

    // Start loading every video referenced by the storyboard right away so it
    // is buffered by the time playback reaches it (lazy per-frame loading plus
    // per-frame seeking used to stall videos at readyState 1).
    preloadVideos() {
      if (!this.compiled) return;
      const seen = new Set();
      for (const r of this.compiled.videos || []) {
        for (const st of r.states || []) {
          if (st.path && !seen.has(st.path)) {
            seen.add(st.path);
            this.loadVideo(st.path).catch(() => {});
          }
        }
      }
    }

    // ----------------------------------------------------------------
    // Coordinate helpers
    // ----------------------------------------------------------------
    ctxInfo() {
      const W = this.canvas.width, H = this.canvas.height;
      const ctrl = this.mergedCtrl || {};
      const perspective = ctrl.perspective === true;
      let ortho = ctrl.size != null ? ctrl.size : 5;
      const camZ = ctrl.zPx != null ? ctrl.zPx : -10;
      let S;
      if (perspective) {
        const fov = ctrl.fov != null ? ctrl.fov : 53.2;
        // Camera at z = camZ, notes at z = 0 -> distance = -camZ (default camZ=-10 => dist 10)
        const dist = Math.max(0.15, -camZ);
        // 正交尺寸 (size) is a GLOBAL camera zoom that keeps working even in
        // perspective mode: the effective half-height is dist * tan(fov/2) *
        // (size / 5), so a smaller size zooms in exactly like ortho mode.
        const zoom = (ortho != null ? ortho : 5) / 5;
        S = (H / 2) / (Math.tan(fov * Math.PI / 360) * dist * zoom) * this.sceneScale;
      } else {
        S = H / (2 * ortho) * this.sceneScale;
      }
      const camXpx = ctrl.xPx != null ? ctrl.xPx : 0;
      const camYpx = ctrl.yPx != null ? ctrl.yPx : 0;
      const rotZ = ctrl.rot_z != null ? ctrl.rot_z * Math.PI / 180 : 0;
      // The controller camera rot_x keeps the previously verified convention
      // (a positive rot_x brings the field's TOP edge nearer). rot_y keeps
      // its own verified convention too.
      const rotX = ctrl.rot_x != null ? ctrl.rot_x * Math.PI / 180 : 0;
      const rotY = ctrl.rot_y != null ? ctrl.rot_y * Math.PI / 180 : 0;
      const sxF = Math.max(0.05, Math.cos(rotY));
      const syF = Math.max(0.05, Math.cos(rotX));
      // Camera center on screen: the camera sits at world (0,0).
      const camCX = W / 2 - camXpx;
      const camCY = H / 2 + camYpx;
      // Perspective camera model (matches the Unity storyboard camera):
      // camera at z = camZ (default -10), looking along +z at the note plane
      // (z = 0). rot_x / rot_y are real 3D rotations of the camera around its
      // own X/Y axes (Unity euler convention: +rot_x pitches the camera down,
      // so the playfield's top edge recedes and the bottom edge comes nearer).
      const D = Math.max(0.15, camZ != null ? -camZ : 10);
      // Focal length in px: at the plane (depth D) this reproduces the exact
      // current scale S (screen_y = f * vy / vz, with vz = D -> f * vy / D).
      const f = S * D;
      return { W, H, S, ortho, camXpx, camYpx, camCX, camCY, rotZ, sxF, syF,
               perspective, D, f, rotX, rotY, ctrl };
    }

    // world (x up-right) -> canvas px (y down)
    worldToPx(wx, wy, info, wz) {
      const { W, H, S, camXpx, camYpx, rotZ } = info;
      // Camera position in world units (y-up). It is part of the 3D view
      // transform (P - C), so camera offsets compose with rot_x / rot_y like
      // the native camera instead of a flat 2D screen shift.
      const camWX = S > 0 ? camXpx / S : 0;
      const camWY = S > 0 ? camYpx / S : 0;
      const pwx = wx - camWX;
      const pwy = wy - camWY;
      let sx, sy, depth = 1;
      const { D, rotX, rotY } = info;
      const cX = Math.cos(rotX), sX = Math.sin(rotX);
      const cY = Math.cos(rotY), sY = Math.sin(rotY);
      // Point relative to the camera: p = (pwx, pwy, D + wz); wz is the note's
      // own z offset (default 0 = playfield plane).
      const zr = D + (wz || 0);
      // Unity euler order (verified against engine sprite combos):
      // Ry(rotY) first, then Rx(rotX), left-handed, y-up -> R = Rz.Rx.Ry.
      const x1 = pwx * cY - zr * sY;
      const z1 = pwx * sY + zr * cY;
      const y2 = pwy * cX + z1 * sX;
      const z2 = -pwy * sX + z1 * cX;
      const x2 = x1;
      if (info.perspective) {
        const { f } = info;
        const invZ = 1 / Math.max(0.05, z2);
        sx = f * x2 * invZ;          // y-up px offset from the screen center
        sy = f * y2 * invZ;
        depth = Math.max(0.05, Math.min(3, D * invZ));
      } else {
        sx = x2 * S;
        sy = y2 * S;
      }
      const ux = sx;
      const uy = -sy;
      const c = Math.cos(rotZ), s = Math.sin(rotZ);
      return {
        x: W / 2 + ux * c - uy * s,
        y: H / 2 + ux * s + uy * c,
        depth
      };
    }

    // Projected y (y-up, px offset from the screen center) of a world-space
    // point on the note plane (x = 0) through the 3D camera rotation. Used by
    // the scanline and its fixed boundaries so they follow the camera tilt
    // AND the camera y offset (composed with the rotation, like worldToPx).
    projectedY(wy, info) {
      const { S, camYpx, D, rotX, rotY } = info;
      const camWY = S > 0 ? camYpx / S : 0;
      const pwy = wy - camWY;
      const cX = Math.cos(rotX), sX = Math.sin(rotX);
      const cY = Math.cos(rotY), sY = Math.sin(rotY);
      // Camera-space rotation (left-handed, y-up), point p = (0, pwy, D).
      // Unity euler order: Ry first (x=0 so it only affects z), then Rx.
      const x1 = -D * sY;
      const z1 = D * cY;
      const y1 = pwy * cX + z1 * sX;
      const z2 = -pwy * sX + z1 * cX;
      if (!info.perspective) return y1 * S;
      const { f } = info;
      return f * y1 / Math.max(0.05, z2);
    }

    // Editor zoom factor for canvas-space drawing (<1 when zoomed out).
    sceneFactor() {
      return this.sceneScale || 1;
    }

    // Set the canvas CTM so every canvas-space pixel scales uniformly around
    // the canvas center (the "screen was shrunk" zoom-out look). Identity at
    // 100%. World-derived coordinates (already scaled through the projection)
    // must NOT go through this.
    sceneTransform(ctx, W, H) {
      const z = this.sceneFactor();
      if (z === 1) { ctx.setTransform(1, 0, 0, 1, 0, 0); return; }
      const cx = W / 2, cy = H / 2;
      ctx.setTransform(z, 0, 0, z, cx * (1 - z), cy * (1 - z));
    }

    unitWorld(u, info) {
      if (!u) return 0;
      const ch = this.chart;
      const ortho = info.ortho;
      const aspect = info.W / info.H;
      switch (u.unit) {
        case 'stagex': return u.value / 800 * ortho * aspect;
        case 'stagey': return u.value / 600 * ortho;
        // Position semantics: noteX:0 is the left edge, noteX:0.5 the center,
        // noteX:1 the right edge (likewise noteY bottom→top).
        case 'notex': return ch.convertChartXToScreenX(u.value);
        case 'notey': return ch.convertChartYToScreenY(u.value);
        case 'camerax': return u.value * ortho * aspect;
        case 'cameray': return u.value * ortho;
        default: return u.value;
      }
    }

    // Stage-object unit -> canvas px offset from the screen center (canvas
    // fills screen). For noteX/noteY, `span` selects the width/height
    // semantics (convert(value) - convert(0)); positions use the plain
    // conversion so 0.5 lands on the field center.
    unitPx(u, info, span) {
      if (!u) return 0;
      const ch = this.chart;
      const { W, H, S } = info;
      switch (u.unit) {
        case 'stagex': return u.value / 800 * W * this.sceneFactor();
        case 'stagey': return u.value / 600 * H * this.sceneFactor();
        case 'notex': return (ch.convertChartXToScreenX(u.value) - (span ? ch.convertChartXToScreenX(0) : 0)) * S;
        case 'notey': return (ch.convertChartYToScreenY(u.value) - (span ? ch.convertChartYToScreenY(0) : 0)) * S;
        case 'camerax': return u.value * W * this.sceneFactor();
        case 'cameray': return u.value * H * this.sceneFactor();
        default: return u.value * S;
      }
    }

    // Canvas conversion for storyboard objects (sprite/text/video/line).
    // These live on their own 800x600 canvas, independent of the game camera:
    // stageX/stageY/cameraX/cameraY stay fixed. The noteX/noteY coordinate
    // system itself follows the (perspective) camera, so noteX/noteY units map
    // through the CURRENT camera scale (fov/z/ortho size) instead of a fixed
    // base — a sprite at noteX:0.5 tracks the playfield's zoom.
    stageUnitPx(u, info, span) {
      if (!u) return 0;
      const ch = this.chart;
      const { W, H, S } = info;
      switch (u.unit) {
        case 'stagex': return u.value / 800 * W * this.sceneFactor();
        case 'stagey': return u.value / 600 * H * this.sceneFactor();
        // sprite/text/video noteX/noteY live in the note field, which follows
        // the (perspective) camera scale: the field zooms with fov/z/ortho
        // size (Unity GenericStateParser divides by the CURRENT ortho size).
        case 'notex': return (ch.convertChartXToScreenX(u.value) - (span ? ch.convertChartXToScreenX(0) : 0)) * S;
        case 'notey': return (ch.convertChartYToScreenY(u.value) - (span ? ch.convertChartYToScreenY(0) : 0)) * S;
        // Unity camera units: value * ortho * aspect (world), then scaled to
        // canvas: value * canvasWidth (= W px here) / value * canvasHeight.
        case 'camerax': return u.value * W * this.sceneFactor();
        case 'cameray': return u.value * H * this.sceneFactor();
        default: return u.value * S;
      }
    }

    // Stage-object Z (depth) -> canvas px. Matches the native GenericStateParser:
    // z is a UnitFloat with scaleToCanvas=true, so every unit first converts to
    // CANVAS units (world/stagex/stagey stay raw; camerax uses the canvas width
    // 800, cameray the canvas height 600; notex/notey go through the chart field
    // conversion), and those canvas units map 1:1 to our depth px (verified
    // against the real engine's perspective scale).
    stageZPx(u, info) {
      if (!u) return 0;
      const ch = this.chart;
      const ortho = info.ortho || 5;
      const aspect = info.W / info.H;
      switch (u.unit) {
        case 'camerax': return u.value * 800;
        case 'cameray': return u.value * 600;
        case 'notex': {
          const w = ch ? ch.convertChartXToScreenX(u.value) : u.value;
          return w / (2 * ortho * aspect) * 800;
        }
        case 'notey': {
          const w = ch ? ch.convertChartYToScreenY(u.value) : u.value;
          return w / (2 * ortho) * 600;
        }
        default: return u.value; // world / stagex / stagey
      }
    }

    // ----------------------------------------------------------------
    // Evaluation
    // ----------------------------------------------------------------
    evaluate(time) {
      const t = Math.max(0, time);
      const res = this.compiled ? SB.evaluateStoryboard(this.compiled, t) : null;
      this.evalResult = res;
      if (res) {
        // Merge controllers in parse order (later writes win), like the engine.
        const merged = {};
        const inf = this.ctxInfo(); // uses previous merged ctrl; ok as base
        for (const r of res.controllers) {
          const from = r.from; // already resolved (interpolated) by the engine
          for (const f of SB.CONTROLLER_FIELDS) {
            if (from[f] === undefined) continue;
            const fromV = from[f];
            // Convert units at the end
            if (f === 'x' || f === 'y') {
              // The controller moves the real game camera, whose X/Y is set
              // in WORLD units (scaleToCanvas=false): CameraX = value * ortho
              // * aspect, CameraY = value * ortho. Convert to world first and
              // scale by the current projection so the on-screen offset
              // matches the engine (value * canvasWidth/2), and composes with
              // camera rotation / perspective through worldToPx.
              merged[f + 'Px'] = this.unitWorld(fromV, inf) * inf.S;
            } else if (f === 'z') {
              // Camera z is a world-space UnitFloat (scaleToCanvas=false);
              // convert prefixed units the same way the native parser does.
              merged[f + 'Px'] = this.unitWorld(fromV, inf);
            } else if (f === 'scanline_pos') {
              merged[f + 'Px'] = this.chart.convertChartYToScreenY(
                (typeof fromV === 'number' ? fromV : (fromV ? fromV.value : 0))
              );
            } else {
              merged[f] = fromV;
            }
          }
        }
        // Compute x/y px with the final camera info (recursive once)
        this.mergedCtrl = merged;
        const inf2 = this.ctxInfo();
        for (const r of res.controllers) {
          const from = r.from; // resolved
          if (from.x !== undefined) merged.xPx = this.unitWorld(from.x, inf2) * inf2.S;
          if (from.y !== undefined) merged.yPx = this.unitWorld(from.y, inf2) * inf2.S;
          if (from.z !== undefined) {
            merged.zPx = this.unitWorld(from.z, inf2);
          }
          if (from.scanline_pos !== undefined) {
            const sv = from.scanline_pos;
            merged.scanline_posPx = this.chart.convertChartYToScreenY(typeof sv === 'number' ? sv : (sv ? sv.value : 0));
          }
        }
        this.mergedCtrl = merged;
      } else {
        this.mergedCtrl = {};
      }

      // Note controller overrides
      this.noteOverrides = {};
      if (res) {
        const inf = this.ctxInfo();
        for (const r of res.noteControllers) {
          const from = r.from; // resolved
          const noteId = from.note != null ? from.note : r.obj.note;
          if (noteId == null) continue;
          const ovr = this.noteOverrides[noteId] || {};
          const pickNum = (f) => from[f] === undefined ? undefined : from[f];
          const pickUnitPx = (f) => from[f] === undefined ? undefined : this.unitWorld(from[f], inf);
          if (from.override_x !== undefined) {
            ovr.x = from.override_x ? (from.x !== undefined ? pickUnitPx('x') : 0.5) : undefined;
          }
          if (from.override_y !== undefined) {
            ovr.y = from.override_y ? (from.y !== undefined ? pickUnitPx('y') : 0.5) : undefined;
          }
          // Note Z override: normalize to a world-space number (the parser
          // keeps unit objects), so negative/positive z both take effect in
          // the perspective projection.
          if (from.override_z !== undefined) {
            ovr.z = from.override_z ? (from.z !== undefined ? this.unitWorld(from.z, inf) : 0) : undefined;
          }
          if (from.override_rot_x !== undefined) ovr.rot_x = from.override_rot_x ? pickNum('rot_x') : undefined;
          if (from.override_rot_y !== undefined) ovr.rot_y = from.override_rot_y ? pickNum('rot_y') : undefined;
          if (from.override_rot_z !== undefined) ovr.rot_z = from.override_rot_z ? pickNum('rot_z') : undefined;
          if (from.override_ring_color !== undefined) {
            ovr.ring_color = from.override_ring_color ? from.ring_color : undefined;
          }
          if (from.override_fill_color !== undefined) {
            ovr.fill_color = from.override_fill_color ? from.fill_color : undefined;
          }
          if (from.opacity_multiplier !== undefined) ovr.opacity = pickNum('opacity_multiplier');
          if (from.size_multiplier !== undefined) ovr.size = pickNum('size_multiplier');
          if (from.x_multiplier !== undefined) ovr.x_mult = pickNum('x_multiplier');
          if (from.y_multiplier !== undefined) ovr.y_mult = pickNum('y_multiplier');
          if (from.dx !== undefined) ovr.dx = pickNum('dx');
          if (from.dy !== undefined) ovr.dy = pickNum('dy');
          if (from.hold_direction !== undefined) ovr.hold_dir = from.hold_direction;
          if (from.style !== undefined) ovr.style = from.style;
          this.noteOverrides[noteId] = ovr;
        }
      }
    }

    noteScreenPos(note, info) {
      const ovr = this.noteOverrides ? this.noteOverrides[note.id] : null;
      let wx = note.worldX;
      let wy = note.worldY;
      let wz = 0;
      if (ovr) {
        if (ovr.x != null) wx = ovr.x;
        else if (ovr.x_mult != null || ovr.dx != null) {
          wx = this.chart.convertChartXToScreenX(note.x * (ovr.x_mult != null ? ovr.x_mult : 1) + (ovr.dx != null ? ovr.dx : 0));
        }
        if (ovr.y != null) wy = ovr.y;
        else if (ovr.y_mult != null || ovr.dy != null) {
          wy = this.chart.convertChartYToScreenY(note.chartY * (ovr.y_mult != null ? ovr.y_mult : 1) + (ovr.dy != null ? ovr.dy : 0));
        }
        if (ovr.z != null) wz = ovr.z;
      }
      const p = this.worldToPx(wx, wy, info, wz);
      p.worldX = wx;
      p.worldY = wy;
      return p;
    }

    // ----------------------------------------------------------------
    // Rendering
    // ----------------------------------------------------------------
    render() {
      const ctx = this.ctx;
      const W = this.canvas.width, H = this.canvas.height;
      if (!W || !H) return;
      if (!this._dirty && this.time === this.lastRenderedTime && !this.playing) return;
      this._dirty = false;
      this.lastRenderedTime = this.time;
      this.evaluate(this.time);
      const info = this.ctxInfo();
      const ctrl = this.mergedCtrl || {};
      const storyboardOpacity = ctrl.storyboard_opacity != null ? ctrl.storyboard_opacity : 1;

      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, W, H);

      // 1. Background
      this.drawBackground(ctx, W, H, ctrl);

      // 2. Storyboard layer 0 (below notes)
      this.drawStageLayer(ctx, info, 0, storyboardOpacity);

      // 3. Storyboard layer 1：位于 note 之下（事件文字绘制在其上）。
      this.drawStageLayer(ctx, info, 1, storyboardOpacity);

      // 3.5 变速/消息事件文字：绘制图层位于 note 之下、所有 layer=0/1 的
      // stage 对象之上（透明度仍隶属 UI）。
      this.drawEventPresentation(ctx, info, ctrl.ui_opacity != null ? ctrl.ui_opacity : 1);

      // 4. Notes + scanline
      this.drawWorld(ctx, info, ctrl, storyboardOpacity);

      // 5. Storyboard layer 2
      this.drawStageLayer(ctx, info, 2, storyboardOpacity);

      // 6. UI
      this.drawUI(ctx, W, H, ctrl);

      ctx.restore();

      // 7. Effects
      if (this.effectsEnabled) Effects.applyEffects(ctx, this.canvas, W, H, ctrl, this.time, this.richEffects);

      // 8. Editor selection highlight (after filters so it stays crisp).
      this.drawSelectionHighlight(ctx, W, H);
    }

    drawBackground(ctx, W, H, ctrl) {
      ctx.save();
      // The whole background is canvas-space: shrink it with the scene too.
      this.sceneTransform(ctx, W, H);
      if (this.backgroundImage && this.backgroundImage.complete) {
        const iw = this.backgroundImage.naturalWidth, ih = this.backgroundImage.naturalHeight;
        const scale = Math.max(W / iw, H / ih);
        const dw = iw * scale, dh = ih * scale;
        ctx.drawImage(this.backgroundImage, (W - dw) / 2, (H - dh) / 2, dw, dh);
      } else {
        ctx.fillStyle = '#111318';
        ctx.fillRect(0, 0, W, H);
      }
      const dim = ctrl.background_dim != null ? ctrl.background_dim : 0.65;
      // background_dim = opacity of the black overlay (1 = fully black, 0 = bright)
      if (dim > 0) {
        ctx.fillStyle = `rgba(0,0,0,${Math.min(1, Math.max(0, dim))})`;
        ctx.fillRect(0, 0, W, H);
      }
      ctx.restore();
    }

    drawWorld(ctx, info, ctrl, storyboardOpacity) {
      const ch = this.chart;
      if (!ch) return;
      const { W, H, S, camXpx, camYpx, rotZ, sxF, syF } = info;
      const noteOpacityMult = ctrl.note_opacity_multiplier != null ? ctrl.note_opacity_multiplier : 1;
      const ringColorGlobal = ctrl.note_ring_color || null;
      const fillColors = ctrl.note_fill_colors || null;
      const t = this.time;

      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.translate(W / 2 - camXpx, H / 2 + camYpx);
      ctx.rotate(rotZ);
      ctx.scale(sxF * S, syF * S);

      // Draw drag connector lines first. Lines are drawn in reverse trigger
      // order so the earlier (first-triggered) connectors sit on top.
      const dragLines = ch.notes.filter((n) => n.next_id > 0 && ch.noteMap[n.next_id]);
      dragLines.sort((a, b) => b.start_time - a.start_time);
      for (const note of dragLines) {
        if (this.hiddenNoteIds && this.hiddenNoteIds.has(note.id)) continue;
        if (note.next_id > 0 && ch.noteMap[note.next_id]) {
          const to = ch.noteMap[note.next_id];
          const { lineStart } = this.dragLineWindow(note, to);
          if (t < lineStart || t > to.start_time) continue;
          // Link endpoints are the FIXED screen positions of the two nodes.
          // The connector is eliminated by the portion the chain's drag/c-drag
          // HEAD has already swept: before the link's source triggers the whole
          // connector is visible (normal fade-in); while the head sweeps this
          // link the visible part starts at the head's current position; once
          // the head has passed the link's target the connector is gone.
          const a = this.noteScreenPos(note, info);
          const b = this.noteScreenPos(to, info);
          let ax = a.x, ay = a.y;
          if (t >= note.start_time) {
            if (t >= to.start_time) continue;    // head already swept past this link
            const span = Math.max(0.001, to.start_time - note.start_time);
            const pr = Math.min(1, Math.max(0, (t - note.start_time) / span));
            ax = a.x + (b.x - a.x) * pr;         // visible part starts at the head
            ay = a.y + (b.y - a.y) * pr;
          }
          ctx.save();
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          const dx = b.x - ax, dy = b.y - ay;
          const len = Math.max(1, Math.hypot(dx, dy));
          const ang = Math.atan2(dy, dx);
          ctx.translate((ax + b.x) / 2, (ay + b.y) / 2);
          ctx.rotate(ang);
          // Dense white dashed connector between drag nodes (dash density
          // matches the native game reference).
          const lw = Math.max(1.5, 0.09 * info.S);
          // The connector's opacity tracks the EARLIER node's appearance
          // opacity, so it fades in in sync with that node (not a fixed
          // linear window over the gap).
          const alpha = this.dragLineAlpha(note, to, t, noteOpacityMult);
          const dashLen = Math.max(2, 0.06 * info.S);
          const gapLen = Math.max(1.5, 0.032 * info.S);
          ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
          ctx.lineWidth = lw;
          ctx.setLineDash([dashLen, gapLen]);
          ctx.beginPath();
          ctx.moveTo(-len / 2, 0);
          ctx.lineTo(len / 2, 0);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.restore();
        }
      }

      const vis = [];
      for (const note of ch.notes) {
        if (this.hiddenNoteIds && this.hiddenNoteIds.has(note.id)) continue;
        const clearTime = this.noteClearTime(note);
        if (t < note.intro_time || t > clearTime) continue;
        vis.push(note);
      }
      // Earlier notes render on top of later ones, matching the native game
      // (sorting order is based on note id, smaller id = higher layer).
      vis.sort((a, b) => b.id - a.id);

      if (this.ui.showNotes !== false) {
        // Holdbars render BELOW every note (including notes that appear later),
        // in their own pass before the note bodies.
        for (const note of vis) {
          if (note.type === 1 || note.type === 2) {
            this.drawHoldBars(ctx, info, note, noteOpacityMult, ringColorGlobal, fillColors, t);
          }
        }
        // Note clear effects render BELOW every note body (native layer
        // order): the ripple is part of the playfield layer, so note bodies
        // drawn afterwards stay on top of it.
        this.drawClearEffects(ctx, info, t);
        for (const note of vis) {
          this.drawNote(ctx, info, note, noteOpacityMult, ringColorGlobal, fillColors, t);
        }
      }

      // Scanline
      const scanOpacity = ctrl.scanline_opacity != null ? ctrl.scanline_opacity : 1;
      const overridePos = ctrl.override_scanline_pos === true;
      let scanY;
      if (overridePos) scanY = ctrl.scanline_posPx != null ? ctrl.scanline_posPx : 0;
      else scanY = ch.getScannerPositionY(t);
      // controller 覆盖扫描线颜色时事件色不生效；无覆盖时事件色（变速红/青）生效。
      let scanColor = ctrl.scanline_color || ch.scannerColorAt(t);
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      // The scanline and its boundaries are part of the rotating playfield:
      // draw them as horizontal lines in the pre-rotation frame offset by the
      // camera position, then rotate around the screen center. The camera
      // offset rotates with the playfield (identity composition when rotZ=0).
      ctx.translate(info.W / 2, info.H / 2);
      ctx.rotate(info.rotZ);
      // projectedY already includes the camera y offset (composed with the
      // rotation), so the pre-rotation canvas offset is just its negation.
      const unrotY = -this.projectedY(scanY, info);
      // Native scanline: thin solid line (0.05 world units), event colors, no glow
      // 隐藏 UI（TAB / 视图选项卡）时扫描线本体一并隐藏。
      const a = (scanColor.a != null ? scanColor.a : 1) * scanOpacity * (this.ui.show === false ? 0 : 1);
      const rgba = (alpha) => `rgba(${Math.round(scanColor.r * 255)},${Math.round(scanColor.g * 255)},${Math.round(scanColor.b * 255)},${alpha})`;
      ctx.strokeStyle = rgba(a);
      ctx.lineWidth = Math.max(1.5, 0.05 * info.S);
      // The scanline is treated as infinitely long: extend it far beyond the
      // canvas so rotation never leaves gaps in the preview.
      const INF = 4 * (W + H);
      ctx.beginPath();
      ctx.moveTo(-INF, unrotY);
      ctx.lineTo(W + INF, unrotY);
      ctx.stroke();
      // Game boundary sprites: dashed scan-edge lines at the playfield edges
      // (noteY=1 and noteY=0). The top edge's dashes flow LEFT, the bottom
      // edge's dashes flow RIGHT (matching the original game's boundary
      // look), with BoundaryOpacity 0.2 x storyboardOpacity x uiOpacity
      // and a brief per-edge flash only when the scanner hits that edge.
      // 页长变更：边界线随当前页的可见带（PageFunction）变化，而非固定全高。
      const curPage = ch.pageIndexAtTime(t);
      const topWorldY = ch.getPageBoundaryScreenY(curPage, false);
      const bottomWorldY = ch.getPageBoundaryScreenY(curPage, true);
      const prevScan = this._lastScanY;
      if (prevScan != null) {
        const cross = (a, b, edge) => (a >= edge && b < edge) || (a <= edge && b > edge);
        if (cross(prevScan, scanY, topWorldY)) this._boundaryFlashTop = 1;
        if (cross(prevScan, scanY, bottomWorldY)) this._boundaryFlashBottom = 1;
      }
      this._lastScanY = scanY;
      this._boundaryFlashTop = Math.max(0, this._boundaryFlashTop - 0.06);
      this._boundaryFlashBottom = Math.max(0, this._boundaryFlashBottom - 0.06);
      const sbOp = storyboardOpacity != null ? storyboardOpacity : 1;
      const uiEvOp = ctrl.ui_opacity != null ? ctrl.ui_opacity : 1;
      const baseAlpha = 0.2 * sbOp * uiEvOp;
      // Boundaries are independent of the scanline's own alpha: their overall
      // opacity follows only storyboardOpacity x uiOpacity.
      if (this.ui.show && baseAlpha > 0.004) {
        const flashTop = this._boundaryFlashTop || 0;
        const flashBottom = this._boundaryFlashBottom || 0;
        const alphaTop = Math.min(0.9, baseAlpha + flashTop * 0.55);
        const alphaBottom = Math.min(0.9, baseAlpha + flashBottom * 0.55);
        const topPx = -this.projectedY(topWorldY, info);
        const bottomPx = -this.projectedY(bottomWorldY, info);
        const dashLen = Math.max(2, 0.11 * info.S);
        const gapLen = Math.max(2, 0.07 * info.S);
        const flow = (this.time * 90) % (dashLen + gapLen);
        ctx.save();
        ctx.strokeStyle = `rgba(255,255,255,${alphaTop})`;
        ctx.lineWidth = Math.max(1, 0.05 * info.S);
        ctx.setLineDash([dashLen, gapLen]);
        // Canvas: positive lineDashOffset slides dashes LEFT, negative RIGHT.
        // Top edge slides left; bottom edge slides right.
        ctx.lineDashOffset = flow;
        ctx.beginPath();
        ctx.moveTo(-INF, topPx);
        ctx.lineTo(W + INF, topPx);
        ctx.stroke();
        ctx.strokeStyle = `rgba(255,255,255,${alphaBottom})`;
        ctx.lineDashOffset = -flow;
        ctx.beginPath();
        ctx.moveTo(-INF, bottomPx);
        ctx.lineTo(W + INF, bottomPx);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.lineDashOffset = 0;
        ctx.restore();
      }
      ctx.restore();
      ctx.restore();
    }

    // 变速/消息事件的文字演示（SPEED UP / SPEED DOWN / 自定义消息）：
    // 位于当前页扫描线上边界上方，字号与 noteID 默认大小一致（固定），
    // 文字颜色 = 事件目标色（SpeedUp 红 / SpeedDown 青 / 消息自定义色）。
    drawEventPresentation(ctx, info, uiOpacity) {
      if (!this.chart) return;
      // 隐藏 UI（TAB / 视图选项卡）时变速/消息事件文字一并隐藏。
      if (this.ui.show === false) return;
      const p = this.chart.eventPresentationAt(this.time);
      if (!p || !p.textAlpha || p.textAlpha <= 0) return;
      let text = p.kind === 'speedup' ? 'SPEED UP'
        : p.kind === 'speeddown' ? 'SPEED DOWN'
        : (p.content || '');
      if (!text) return;
      // noteID 默认大小：与 drawNoteId 相同的公式（默认 click 直径 1.7*S）。
      const size = Math.max(9, Math.min(20, 1.7 * info.S * 0.24));
      ctx.save();
      const tc = p.targetColor || p.color;
      // 文字透明度隶属 UI 透明度，跟随其变化。
      const ui = uiOpacity != null ? uiOpacity : 1;
      ctx.globalAlpha = Math.min(1, p.textAlpha * (tc.a != null ? tc.a : 1) * ui);
      ctx.fillStyle = `rgb(${Math.round(tc.r * 255)},${Math.round(tc.g * 255)},${Math.round(tc.b * 255)})`;
      ctx.font = '700 ' + size + 'px "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const step = size * 0.62 + (p.letterSpacing || 0) / 192 * size * 2;
      // 扫描线上边界上方（当前页上边界线之上留出间距）。
      const curPage = this.chart.pageIndexAtTime(this.time);
      const topWorldY = this.chart.getPageBoundaryScreenY(curPage, false);
      const topPx = this.canvas.height / 2 - this.projectedY(topWorldY, info);
      let x = this.canvas.width / 2 - ((text.length - 1) * step) / 2;
      // 位于扫描线上边界上方、紧贴上边界（无描边/阴影）。
      let y = topPx - size * 0.55;
      y = Math.max(4, Math.min(this.canvas.height - size - 4, y));
      for (const ch of text) {
        ctx.fillText(ch, x, y);
        x += step;
      }
      ctx.restore();
    }

    // Fade-in window for a drag/c-drag connector. The line appears in sync
    // with the EARLIER of the two connected nodes (its intro time), not before
    // it; it reaches full opacity just before the later node appears.
    dragLineWindow(note, to) {
      const lineStart = Math.min(note.intro_time, to.intro_time);
      const lineStop = note.nextdraglinestoptime != null
        ? note.nextdraglinestoptime
        : to.intro_time - 0.132;
      return { lineStart, lineStop };
    }

    // Connector opacity follows the EARLIER of the two connected nodes'
    // appearance fade (same ramp as the note body: full at half the intro
    // window), capped at the base connector alpha; then multiplied by the
    // “时间上后者”drag 的 note 透明度（note_controller 的 opacity_multiplier
    // 覆盖 × 全局 note_opacity_multiplier），所以单独改某个 drag note 的透明度
    // 时，指向它的连接线（以及 C-drag 连接线）同步变化。
    dragLineAlpha(note, to, t, noteOpacityMult) {
      const earlier = note.intro_time <= to.intro_time ? note : to;
      const prE = Math.min(1, Math.max(0, (t - earlier.intro_time) / Math.max(0.001, earlier.start_time - earlier.intro_time)));
      const nodeOpacity = Math.min(1, prE * 2);
      const later = to.start_time >= note.start_time ? to : note;
      const ovrLater = this.noteOverrides ? this.noteOverrides[later.id] : null;
      const laterMult = (ovrLater && ovrLater.opacity != null ? ovrLater.opacity : 1) *
        (noteOpacityMult != null ? noteOpacityMult : 1);
      return nodeOpacity * 0.85 * laterMult;
    }

    noteClearTime(note) {
      // Autoplay: click/flick notes clear at their start time,
      // hold & long hold clear at their end time. A drag/c-drag head follows
      // its chain and only clears after every child in the chain has cleared.
      if (note.type === 1 || note.type === 2) return note.end_time;
      if (note.type === 3 || note.type === 6) {
        let last = note;
        let guard = 0;
        while (last.next_id > 0 && this.chart && this.chart.noteMap[last.next_id] && guard++ < 200) {
          last = this.chart.noteMap[last.next_id];
        }
        return last.start_time;
      }
      return note.start_time;
    }

    // After a drag/c-drag head is triggered it follows its chain: its visual
    // position slides smoothly along the chain links toward the next child.
    dragFollowPos(note, info) {
      if (this.time < note.start_time) return this.noteScreenPos(note, info);
      const lerp = (a, b, t) => ({
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
        worldX: a.worldX + (b.worldX - a.worldX) * t,
        worldY: a.worldY + (b.worldY - a.worldY) * t
      });
      let prev = note;
      let prevPos = this.noteScreenPos(note, info);
      let cur = note;
      let guard = 0;
      while (cur.next_id > 0 && this.chart && this.chart.noteMap[cur.next_id] && guard++ < 200) {
        const next = this.chart.noteMap[cur.next_id];
        if (this.time >= next.start_time) {
          prevPos = this.noteScreenPos(next, info);
          prev = next;
          cur = next;
        } else {
          // Slide along the current chain link between prev and next
          const span = Math.max(0.001, next.start_time - prev.start_time);
          const pr = Math.min(1, Math.max(0, (this.time - prev.start_time) / span));
          return lerp(prevPos, this.noteScreenPos(next, info), pr);
        }
      }
      return prevPos;
    }

    // Rendering/hit-test position for a note: drag/c-drag heads follow their
    // chain once triggered; everything else uses its fixed chart position.
    notePos(note, info) {
      if ((note.type === 3 || note.type === 6) && this.time >= note.start_time) {
        return this.dragFollowPos(note, info);
      }
      return this.noteScreenPos(note, info);
    }

    drawClearEffects(ctx, info, t) {
      const ch = this.chart;
      if (!ch) return;
      const { S } = info;
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = 'lighter';
      // Original Cytoid FlatFX ripple scaled to 0.8x; drag-family effects also
      // scale with the note's actual size.
      const DURATION = 0.4;
      const FINAL_RADIUS = 2.0 * S;
      const START_THICKNESS = 1.066 * S;
      const END_THICKNESS = 0.267 * S;
      const clickD = 1.9717 * ((this.chart.model.size || 1)) * 1.133333 * S;
      for (const note of ch.notes) {
        if (this.hiddenNoteIds && this.hiddenNoteIds.has(note.id)) continue;
        // Drag/c-drag heads aren't removed when triggered, but their clear
        // effect plays at trigger time (not when the whole chain ends).
        const clearTime = (note.type === 3 || note.type === 6)
          ? note.start_time
          : this.noteClearTime(note);
        const age = t - clearTime;
        if (age < 0 || age > DURATION) continue;
        let pos;
        if (note.type === 1 || note.type === 2) {
          const ovr = this.noteOverrides ? this.noteOverrides[note.id] : null;
          if (note.type === 1 && ovr && ovr.style === 2) {
            // style=2 (REGULAR holds only): the holdbar shrinks into the body
            // and there is no trailing bar, so the clear effect plays on the
            // hold BODY itself (its chart position), not at the scanner.
            pos = this.notePos(note, info);
          } else {
            // Default / long-hold: holds clear when the scanner reaches the
            // hold end, so the effect is placed at the scanner's Y while
            // keeping the note's X position. If a controller overrides the
            // scanline position, the effect follows the OVERRIDDEN position
            // (where the scanline actually renders).
            const ctrl = this.mergedCtrl || {};
            const scanY = ctrl.override_scanline_pos === true
              ? (ctrl.scanline_posPx != null ? ctrl.scanline_posPx : 0)
              : this.chart.getScannerPositionY(clearTime);
            pos = this.worldToPx(note.worldX, scanY, info);
          }
        } else if (note.type === 3 || note.type === 6) {
          // Drag/c-drag heads: the clear effect stays at the head's ORIGINAL
          // chart position, not following the head as it slides along the
          // chain after being triggered.
          pos = this.noteScreenPos(note, info);
        } else {
          pos = this.notePos(note, info);
        }
        const p = age / DURATION;
        const easeOut = 1 - Math.pow(1 - p, 3);
        const alpha = Math.max(0, 1 - p);
        const baseSize = (NOTE_SIZE_FACTOR[note.typeName] || 1.5) * ((this.chart.model.size || 1)) * 1.133333;
        const noteD = baseSize * S;
        const sizeScale = (note.type === 4 || note.type === 7)
          ? 0.75
          : ((note.type === 3 || note.type === 6) ? Math.max(0.45, noteD / Math.max(1, clickD)) : 1);
        // Start at a small visible radius so the ripple begins exactly at the clear time
        const r = Math.max(FINAL_RADIUS * 0.15 * sizeScale, FINAL_RADIUS * sizeScale * easeOut);
        const thickness = Math.max(0.5, (START_THICKNESS - (START_THICKNESS - END_THICKNESS) * p) * sizeScale);
        ctx.strokeStyle = `rgba(91,192,235,${alpha})`;
        ctx.lineWidth = thickness;
        ctx.beginPath();
        if (note.type === 5) {
          // Flick notes clear with a diamond (◇) ripple matching their outer frame
          ctx.moveTo(pos.x, pos.y - r);
          ctx.lineTo(pos.x + r, pos.y);
          ctx.lineTo(pos.x, pos.y + r);
          ctx.lineTo(pos.x - r, pos.y);
          ctx.closePath();
        } else {
          ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
        }
        ctx.stroke();
      }
      ctx.restore();
    }

    noteColors(note, ringColorGlobal, fillColors, ctrl) {
      const ovr = this.noteOverrides ? this.noteOverrides[note.id] : null;
      const alt = note.direction > 0;
      const isForward = !!note.is_forward;
      const useAlt = alt ? !isForward : isForward;
      const typePair = {
        click: [0, 1], drag_head: [2, 3], drag_child: [2, 3],
        hold: [4, 5], long_hold: [6, 7], flick: [8, 9],
        c_drag_head: [10, 11], c_drag_child: [10, 11]
      }[note.typeName] || [0, 1];
      let fill;
      if (ovr && ovr.fill_color) fill = ovr.fill_color;
      else if (fillColors) {
        const idx = useAlt ? typePair[0] : typePair[1];
        fill = fillColors[idx] || Colors.DEFAULT_NOTE_FILL[idx];
      } else {
        const idx = useAlt ? typePair[0] : typePair[1];
        fill = Colors.DEFAULT_NOTE_FILL[idx];
      }
      let ring;
      if (ovr && ovr.ring_color) ring = ovr.ring_color;
      else if (ringColorGlobal) ring = ringColorGlobal;
      else if (note.type === 3 || note.type === 4 || note.type === 7) {
        // Drag / sub-drag: dark outline (matches the native Cytoid drag note style)
        ring = { r: 0.11, g: 0.11, b: 0.11, a: 1 };
      }
      // The note ring is fully opaque by default, like the note fill.
      else ring = { r: 1, g: 1, b: 1, a: 1 };
      return { fill, ring };
    }

    // Shared per-note visual parameters (size, approach scale, opacity, d).
    noteVisualParams(note, info, noteOpacityMult, ringColorGlobal, fillColors, t) {
      const ovr = this.noteOverrides ? this.noteOverrides[note.id] : null;
      const p = this.notePos(note, info);
      // GlobalNoteSizeMultiplier = chart.size * (1.133333 + NoteSize setting)
      const baseSize = (NOTE_SIZE_FACTOR[note.typeName] || 1.5) * ((this.chart.model.size || 1)) * 1.133333;
      const sizeMult = ovr && ovr.size != null ? ovr.size : 1;
      const opacityMult = (ovr && ovr.opacity != null ? ovr.opacity : 1) * noteOpacityMult;
      const size = baseSize * sizeMult;
      const { S } = info;
      // Depth-scaled by the camera projection (1 unless perspective + tilt):
      // notes farther from the camera render smaller, nearer notes larger.
      const diameter = size * S * (p.depth || 1);

      let scale = 1;
      let opacity = 1;
      let fillProgress = 1;
      let approach = 1;
      if (t < note.start_time) {
        const span = Math.max(0.001, note.start_time - note.intro_time);
        const pr = Math.min(1, Math.max(0, (t - note.intro_time) / span));
        scale = note.initial_scale + (1 - note.initial_scale) * pr;
        opacity = Math.min(1, pr * 2);
        // Drag/c-drag children grow in from 0.7x (initial_scale) with the fill
        // always filling the current size — no separate fill growth.
        fillProgress = (note.type === 4 || note.type === 7) ? 1 : pr;
        approach = pr;
      }
      opacity *= opacityMult;
      const { fill, ring } = this.noteColors(note, ringColorGlobal, fillColors);
      let d = diameter * scale;
      // Hold/long-hold bodies shrink slightly while triggered for feedback
      if ((note.type === 1 || note.type === 2) && t >= note.start_time && t <= note.end_time) {
        d *= 0.95;
      }
      // Drag head: the outer white ring grows from the inner-fill size (0.33x)
      // to full size; the inner colored fill stays at its final size and only
      // fades in (same intro as sub-drag).
      if (note.type === 3) {
        const prA = t < note.start_time
          ? Math.min(1, Math.max(0, (t - note.intro_time) / Math.max(0.001, note.start_time - note.intro_time)))
          : 1;
        d = diameter * (0.33 + 0.67 * prA);
      }
      return { ovr, p, diameter, scale, opacity, fillProgress, approach, fill, ring, d };
    }

    // Composed 2x2 of the camera rotation and a note's own rotation, built
    // from the same canonical y-up TRS as stage objects. The camera part uses
    // the engine-verified rotation shared with worldToPx (a camera +rot_x
    // brings the FIELD's top edge nearer); the note's own angles are raw
    // storyboard degrees. rxn/ryn/rzn are raw DEGREES (not radians).
    noteGlyph2x2(info, rxn, ryn, rzn) {
      const cam = m4YFlip(m4Mul(m4RotYupX(-info.rotX), m4RotYupY(-info.rotY)));
      const note = canvasTRS(0, 0, 0, rxn, ryn, rzn, 1, 1);
      const M = m4Mul(m4RotZ(info.rotZ), m4Mul(cam, note));
      return { a: M[0], b: M[1], c: M[4], d: M[5] };
    }

    drawNote(ctx, info, note, noteOpacityMult, ringColorGlobal, fillColors, t) {
      const { ovr, p, diameter, opacity, fillProgress, approach, fill, ring, d } =
        this.noteVisualParams(note, info, noteOpacityMult, ringColorGlobal, fillColors, t);
      const fillColor = fill;
      // Note rot_x / rot_y / rot_z use the RAW storyboard values (canonical
      // y-up convention, converted inside noteGlyph2x2). rotX/rotY in radians
      // are kept for the sign-invariant cos foreshortening below.
      const rotZ = ovr && ovr.rot_z != null ? ovr.rot_z * Math.PI / 180 : 0;
      const rotX = ovr && ovr.rot_x != null ? ovr.rot_x * Math.PI / 180 : 0;
      const rotY = ovr && ovr.rot_y != null ? ovr.rot_y * Math.PI / 180 : 0;
      const cosRx = Math.max(0.05, Math.cos(rotX));
      const cosRy = Math.max(0.05, Math.cos(rotY));
      // Full orthographic projection 2x2 of the composed (camera x note) 3D
      // rotation (Unity euler order: Ry first, then Rx, then Rz). Replaces
      // the old "2D rotate + axis-aligned cos scale" approximation, which was
      // only exact for single-axis rotations (shear terms were dropped).
      const gm = this.noteGlyph2x2(info,
        ovr && ovr.rot_x != null ? ovr.rot_x : 0,
        ovr && ovr.rot_y != null ? ovr.rot_y : 0,
        ovr && ovr.rot_z != null ? ovr.rot_z : 0);
      const A = this.playerAssets || {};
      const { S } = info;

      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.translate(p.x, p.y);
      ctx.transform(gm.a, gm.b, gm.c, gm.d, 0, 0);
      // The note body may be fully hidden by storyboard opacity (a single
      // note_controller's opacity_multiplier can go to 0); the body pass is
      // skipped then, but the note ID below stays under the "显示noteID"
      // toggle's control alone.
      if (opacity > 0.003) {
        const ringA = (ring.a != null ? ring.a : 1) * opacity;
        const fillA = (fillColor.a != null ? fillColor.a : 1) * opacity;

      // While a hold is being triggered, keep a looping stack of semi-transparent
      // filled ripples BELOW the hold body (above the holdbar layer).
      if ((note.type === 1 || note.type === 2) && t >= note.start_time && t <= note.end_time) {
        this.drawHoldRipples(ctx, info, p, d, fillColor, t);
      }

      if (note.type === 5) {
        // Flick: double-diamond ring + diamond fill + converging chevrons
        const fs = d * fillProgress;
        if (A.flickFill && A.flickFill.complete && fs > 0.5) {
          this.tintDraw(ctx, A.flickFill, -fs / 2, -fs / 2, fs, fs, fillColor, fillA);
        }
        if (A.flickRing && A.flickRing.complete) {
          this.tintDraw(ctx, A.flickRing, -d / 2, -d / 2, d, d, ring, ringA);
        }
        this.drawFlickArrows(ctx, A, d, ring, opacity, approach, note.direction, S);
      } else {
        const isHold = (note.type === 1 || note.type === 2);
        if (note.type === 3) {
          // Drag head: white outer ring at the current d (grows from the
          // inner-fill size), inner colored fill at its final size (fade-only).
          if (A.noteFill && A.noteFill.complete) {
            this.tintDraw(ctx, A.noteFill, -d / 2, -d / 2, d, d, WHITE, fillA);
            const inner = diameter * 0.33;
            this.tintDraw(ctx, A.noteFill, -inner / 2, -inner / 2, inner, inner, fillColor, fillA);
          }
        } else {
          const fs = isHold ? d : d * fillProgress;
          if (A.noteFill && A.noteFill.complete && fs > 0.5) {
            this.tintDraw(ctx, A.noteFill, -fs / 2, -fs / 2, fs, fs, fillColor, fillA);
          }
        }
        // Ring: click / hold / long-hold / c-drag head. Drag heads and drag
        // children (incl. c-drag children) have no ring.
        if (!(note.type === 3 || note.type === 4 || note.type === 7)) {
          const ringImg = isHold ? (A.holdRing || A.noteRing) : (A.noteRing || A.holdRing);
          if (ringImg && ringImg.complete) {
            this.tintDraw(ctx, ringImg, -d / 2, -d / 2, d, d, ring, ringA);
          }
        }
        // C-Drag head: click-style body plus a white direction arrow at the
        // center pointing to the next node.
        if (note.type === 6 && A.cDragFill && A.cDragFill.complete) {
          const ang = this.cDragArrowAngle(note, info);
          const as = d * 0.56;
          ctx.save();
          // The arrow angle is computed in SCREEN space; this frame carries
          // the full affine glyph transform, so map the screen direction
          // back through the inverse 2x2 to get the local arrow angle.
          const det = gm.a * gm.d - gm.b * gm.c;
          const ia = gm.d / det, ib = -gm.b / det, ic = -gm.c / det, id = gm.a / det;
          const lx = ia * Math.cos(ang) + ib * Math.sin(ang);
          const ly = ic * Math.cos(ang) + id * Math.sin(ang);
          ctx.rotate(Math.atan2(ly, lx));
          this.tintDraw(ctx, A.cDragFill, -as / 2, -as / 2, as, as, WHITE, ringA);
          ctx.restore();
        }
      }

      // Hold progress ring (fills while holding)
      if ((note.type === 1 || note.type === 2) && t >= note.start_time && t <= note.end_time) {
        const progress = (t - note.start_time) / Math.max(0.001, note.end_time - note.start_time);
        const pr = d * 0.62;
        ctx.save();
        ctx.lineWidth = Math.max(1.5, d * 0.07);
        ctx.strokeStyle = Colors.css({ ...fillColor, a: 0.25 * opacity });
        ctx.beginPath();
        ctx.arc(0, 0, pr, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = Colors.css({ ...fillColor, a: opacity });
        ctx.beginPath();
        ctx.arc(0, 0, pr, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
        ctx.stroke();
        ctx.restore();
      }
      }

      ctx.restore();
      // Note IDs are a debug overlay: drawn upright in screen space so they
      // never rotate / foreshorten with the note or the camera.
      if (this.ui.showNoteIds === true) {
        this.drawNoteId(ctx, note, d, p, fillColor);
      }
    }

    // Holdbars render in a dedicated pass BELOW every note (including notes
    // that appear later), so the trail is never covered by the note bodies.
    drawHoldBars(ctx, info, note, noteOpacityMult, ringColorGlobal, fillColors, t) {
      if (note.type !== 1 && note.type !== 2) return;
      const { p, d, diameter, opacity, fill } = this.noteVisualParams(note, info, noteOpacityMult, ringColorGlobal, fillColors, t);
      let barOpacity = opacity;
      if (note.type === 2) {
        // Long-hold bars are a fixed trail: ignore the opacity multiplier of
        // the note's own note_controller (the body may fade, the bar stays).
        const ovr = this.noteOverrides ? this.noteOverrides[note.id] : null;
        const mult = ovr && ovr.opacity != null ? ovr.opacity : 1;
        if (mult > 0.0001) barOpacity = opacity / mult;
      }
      if (barOpacity <= 0.004) return;
      this.drawHoldBar(ctx, info, note, p, d, fill, barOpacity, t, note.type === 2, diameter);
    }

    // Dashed progress bar(s) for hold / long-hold notes, matching the native
    // Cytoid hold trail: a dashed band extends from the note in the scan
    // direction, and a solid completed band grows from the note with progress.
    drawHoldBar(ctx, info, note, p, d, fillColor, opacity, t, isLong, finalD) {
      const { W, H, S } = info;
      // Native hold trail width is roughly half of what we previously drew
      const bandW = Math.max(6, d * 0.36);
      const progress = Math.min(1, Math.max(0, (t - note.start_time) / Math.max(0.001, note.end_time - note.start_time)));
      const dashH = Math.max(2, 0.045 * S);
      const gapH = Math.max(2, 0.165 * S);
      // rot_x is a 3D rotation: the bar's vertical extent foreshortens with
      // the playfield, so spacing and length scale by syF.
      const seg = (dashH + gapH) * info.syF;
      // Pre-rotation position of the note; the whole bar is then placed with
      // the camera (center + R*(P - C)) so the camera x/y offset rotates
      // together with the scene (identity composition when rotZ = 0).
      // Anchor the bar at the note's PROJECTED screen position (the pre-
      // rotation offset that the camera transform maps back to p.x/p.y).
      const cx0 = p.x - info.W / 2, cy0 = p.y - info.H / 2;
      const cz = Math.cos(info.rotZ), sz = Math.sin(info.rotZ);
      // p already contains the camera offset (worldToPx composes it into the
      // 3D transform), so the pre-rotation offset is just Rz^-1 * (p - center).
      const ux = cx0 * cz + cy0 * sz;
      const uy = -cx0 * sz + cy0 * cz;
      // The hold's own rotation applies to the bar as well, but the rotation
      // CENTER is the hold body's center (the bar is not a reference for it).
      const ovr = this.noteOverrides ? this.noteOverrides[note.id] : null;
      // Same sign convention as the note body: canvas rotates clockwise for a
      // positive angle, the native game counterclockwise.
      const ownRotZ = ovr && ovr.rot_z != null ? -ovr.rot_z * Math.PI / 180 : 0;
      const ownRotX = ovr && ovr.rot_x != null ? ovr.rot_x * Math.PI / 180 : 0;
      const ownRotY = ovr && ovr.rot_y != null ? ovr.rot_y * Math.PI / 180 : 0;
      const ownCosRx = Math.max(0.05, Math.cos(ownRotX));
      const ownCosRy = Math.max(0.05, Math.cos(ownRotY));
      // note_controller hold_direction overrides the holdbar's up/down
      // orientation relative to the hold body (native Note.direction).
      const holdDir = ovr && ovr.hold_dir != null ? ovr.hold_dir : note.direction;
      // style=2 (REGULAR holds only): the holdbar shrinks toward the hold
      // body and is completely gone when the hold ends (no growing completed
      // fill). Long holds ignore style and always render the default bar.
      const style2 = !isLong && ovr && ovr.style === 2;
      // True hold length = the distance the scanner travels between the hold
      // start and its clear time. This drives the progress FILL regardless of
      // how far the (possibly infinite) bar extends, so the fill still grows
      // with progress and colors the off-screen extension as it advances.
      const ch = this.chart;
      const scanStart = ch ? ch.getScannerPositionY(note.start_time) : note.worldY;
      const scanEnd = ch ? ch.getScannerPositionY(note.end_time) : note.worldY;
      const holdLen = Math.max(0, Math.abs(scanEnd - scanStart) * S * info.syF);

      const bars = [];
      if (isLong) {
        // Long hold: bars extend to INFINITY in both directions (same margin
        // convention as the scanline), so rotating the playfield / the hold
        // never exposes the bar ends. The progress fill still grows from the
        // note to the visible screen edge (edgeLen); the parts beyond the
        // default screen stay BLANK (uncovered white dashes). The dash loop is
        // clamped to the visible pre-rotation range so the infinite length
        // costs nothing.
        const INF = 4 * (W + H);
        const hz = H / 2 * this.sceneFactor();
        bars.push({ y: uy - d * 0.5, len: INF, edgeLen: Math.max(0, uy - d * 0.5 + hz + info.camYpx), dir: -1 });   // upward
        bars.push({ y: uy + d * 0.5, len: INF, edgeLen: Math.max(0, hz - info.camYpx - uy - d * 0.5), dir: 1 });    // downward
      } else {
        // The bar is attached to the hold body's CURRENT edge (no gap while
        // the body grows in) and already has its FINAL length (the full-body
        // edge to the clear-time scanner position). As the body expands the
        // whole bar slides outward with the body edge, so its far end extends
        // toward the scanner by exactly the gap that used to sit between the
        // growing body and the bar; it never grows from zero nor shortens.
        const finalLen = Math.max(0, holdLen - (finalD != null ? finalD : d) * 0.5);
        const edge = holdDir > 0 ? uy - d * 0.5 : uy + d * 0.5;
        bars.push({ y: edge, len: finalLen, dir: holdDir > 0 ? -1 : 1 });
      }

      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      // Camera placement: center + R*(P - C) — the camera x/y offset is part
      // of the rotating playfield (outer transform).
      ctx.translate(info.W / 2, info.H / 2);
      ctx.rotate(info.rotZ);
      // Hold's own rotation around the hold body's PRE-ROTATION center
      // (bar follows the body; the body is the rotation center, not the bar).
      ctx.translate(ux, uy);
      // Full orthographic 2x2 of camera (minus the already-applied rotZ) and
      // the hold's own rotation, matching the note body's affine frame.
      const hgm = this.noteGlyph2x2({ rotX: info.rotX, rotY: info.rotY, rotZ: 0 },
        ovr && ovr.rot_x != null ? ovr.rot_x : 0,
        ovr && ovr.rot_y != null ? ovr.rot_y : 0,
        ovr && ovr.rot_z != null ? ovr.rot_z : 0);
      ctx.transform(hgm.a, hgm.b, hgm.c, hgm.d, 0, 0);
      ctx.translate(-ux, -uy);
      for (const bar of bars) {
        const absLen = Math.abs(bar.len);
        // style=2: visible length shrinks with progress, gone at hold end.
        const effLen = style2 ? (bar.edgeLen != null ? bar.edgeLen : absLen) * (1 - progress) : absLen;
        // Clamp the dash range to the visible pre-rotation y window so the
        // infinite long-hold bars don't iterate over offscreen dashes.
        const visibleMax = bar.dir > 0 ? (2 * H - bar.y) / seg : (bar.y + 2 * H) / seg;
        const nDashes = Math.min(Math.floor(effLen / seg), Math.max(0, Math.ceil(visibleMax)));
        for (let i = 0; i < nDashes; i++) {
          const cy = bar.dir > 0
            ? bar.y + i * seg + seg / 2
            : bar.y - i * seg - seg / 2;
          if (cy < -2 * H || cy > 2 * H) continue;
          // Each dash is "painted" with the hold color as the progress passes
          // it (the white dashes act as a mask for the solid color), instead of
          // drawing a solid band.
          const dashCenter = bar.dir > 0 ? (cy - bar.y) : (bar.y - cy);
          // Render the bar's 3D rotation: the bar is a child of the rotated
          // note and follows the same child rule as other children, so its
          // perspective depth direction is OPPOSITE to the note body's own
          // rot_x. Each dash at distance (cy - uy) from the note center gains
          // depth -(cy - uy)*sin(ownRotX) and is perspective-projected
          // (position and size scale by f/(f+Z)). Identity when not in
          // perspective mode or without rot_x.
          let cyProj = cy, bw = bandW, dh2 = dashH;
          if (info.perspective && ownRotX !== 0) {
            const perspF = info.f || (info.S * info.D);
            const dz = -(cy - uy) * Math.sin(ownRotX);
            const persp = perspF / Math.max(0.05, perspF + dz);
            cyProj = uy + (cy - uy) * persp;
            bw = Math.max(1, bandW * persp);
            dh2 = Math.max(0.5, dashH * persp);
          }
          // Regular holds: the scanner starts at the note's CENTER (inside
          // the body) and travels holdLen over the hold, so measured from the
          // body edge (where the bar starts) it sits at holdLen*progress -
          // d/2; the fill reaches exactly the scanline instead of running
          // ahead. Long holds keep their own edge-based fill (grows from the
          // body toward the visible screen edge with progress).
          const covered = style2
            ? false
            : (bar.edgeLen != null
                ? (dashCenter <= bar.edgeLen * progress)
                : (dashCenter <= holdLen * progress - d * 0.5));
          ctx.fillStyle = covered
            ? Colors.css({ ...fillColor, a: 0.95 * opacity })
            : Colors.css({ r: 1, g: 1, b: 1, a: 0.55 * opacity });
          ctx.fillRect(ux - bw / 2, cyProj - dh2 / 2, bw, dh2);
        }
      }
      ctx.restore();
    }

    // Looping layered semi-transparent filled ripples under a triggered
    // hold/long-hold, colored with the hold's fill color (native effect).
    drawHoldRipples(ctx, info, p, d, fillColor, t) {
      const layers = 4;
      // Ripples expand from the note body up to 1.2x the hold's outer
      // progress-ring radius; each layer peaks at 0.85 opacity.
      const baseR = d * 0.45;
      const maxR = d * 0.62 * 1.2;
      const period = 0.9;
      // 不重置变换：沿用调用方（drawNote）已应用的 note 3D 投影矩阵，涟漪
      // 随 hold 本体的 rot_x/rot_y/rot_z 一起旋转/压扁；原点已是 note 中心。
      for (let i = 0; i < layers; i++) {
        const ph = ((t / period) + i / layers) % 1;
        const r = baseR + (maxR - baseR) * ph;
        const alpha = 0.85 * (1 - ph);
        ctx.fillStyle = Colors.css({ ...fillColor, a: alpha });
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Flick chevrons: start far from the note and converge toward the diamond
    // frame as the note approaches, exactly like the native renderer.
    drawFlickArrows(ctx, A, d, color, opacity, approach, direction, S) {
      if (!A.flickLeft || !A.flickLeft.complete || !A.flickRight || !A.flickRight.complete) return;
      const maxOff = 1.5 * S;
      // Chevron tips converge toward the diamond frame when fully approached
      // (they rest just outside the diamond).
      const targetOff = 0;
      const off = maxOff + (targetOff - maxOff) * approach;
      const aw = d * 2.0, ah = d * 1.0;
      const flip = direction > 0 ? -1 : 1;
      ctx.save();
      ctx.translate(-off, 0);
      ctx.scale(1, flip);
      this.tintDraw(ctx, A.flickLeft, -aw / 2, -ah / 2, aw, ah, color, opacity);
      ctx.restore();
      ctx.save();
      ctx.translate(off, 0);
      ctx.scale(1, flip);
      this.tintDraw(ctx, A.flickRight, -aw / 2, -ah / 2, aw, ah, color, opacity);
      ctx.restore();
    }

    // Angle (canvas space) from a c-drag head to its next node, so the arrow
    // texture (which points "up") rotates toward the direction of travel.
    cDragArrowAngle(note, info) {
      // Point to the first child that has not been triggered yet, so the arrow
      // updates live as each child is cleared.
      let cur = note;
      let target = null;
      let guard = 0;
      while (cur.next_id > 0 && this.chart && this.chart.noteMap[cur.next_id] && guard++ < 200) {
        const next = this.chart.noteMap[cur.next_id];
        if (next.start_time > this.time) {
          target = next;
          break;
        }
        cur = next;
      }
      if (!target) {
        // All children already triggered: point toward the last child
        let last = note;
        guard = 0;
        while (last.next_id > 0 && this.chart && this.chart.noteMap[last.next_id] && guard++ < 200) {
          last = this.chart.noteMap[last.next_id];
        }
        target = last;
      }
      const a = this.notePos(note, info);
      const b = this.notePos(target, info);
      return Math.atan2(b.y - a.y, b.x - a.x) + Math.PI / 2;
    }

    // Legacy fallback (unused but kept for clarity)
    cDragArrowAngleOld(note, info) {
      if (note.next_id > 0 && this.chart && this.chart.noteMap[note.next_id]) {
        const to = this.chart.noteMap[note.next_id];
        const a = this.notePos(note, info);
        const b = this.notePos(to, info);
        return Math.atan2(b.y - a.y, b.x - a.x) + Math.PI / 2;
      }
      return note.direction > 0 ? 0 : Math.PI;
    }

    // ------------------------------------------------------------------
    // Hit testing: used by the editor to click notes in the preview.
    // ------------------------------------------------------------------
    noteRadiusAtTime(note, info, t) {
      const ovr = this.noteOverrides ? this.noteOverrides[note.id] : null;
      const baseSize = (NOTE_SIZE_FACTOR[note.typeName] || 1.5) * ((this.chart.model.size || 1)) * 1.133333;
      const sizeMult = ovr && ovr.size != null ? ovr.size : 1;
      let scale = 1;
      if (t < note.start_time) {
        const span = Math.max(0.001, note.start_time - note.intro_time);
        scale = note.initial_scale + (1 - note.initial_scale) * Math.min(1, Math.max(0, (t - note.intro_time) / span));
      }
      return baseSize * sizeMult * info.S * scale * 0.55;
    }

    hitTestNote(px, py) {
      if (!this.chart) return null;
      const t = this.time;
      const info = this.ctxInfo();
      for (const note of this.chart.notes) {
        if (this.hiddenNoteIds && this.hiddenNoteIds.has(note.id)) continue;
        const clearTime = this.noteClearTime(note);
        if (t < note.intro_time || t > clearTime) continue;
        const pos = this.notePos(note, info);
        const r = this.noteRadiusAtTime(note, info, t);
        const dx = px - pos.x, dy = py - pos.y;
        if (dx * dx + dy * dy <= r * r) return note;
      }
      return null;
    }

    // ---- Editor pick: hit-test objects of a selection layer ----
    // Projected 4 corners of a stage object (sprite/text/video) in canvas px.
    stageObjectCorners(kind, r, info) {
      const from = r.from;
      const zf = this.sceneFactor();
      // 原版 Sprite 预制体默认 200x200 UI 矩形；Storyboard Canvas 缩放器为
      // 800x600、MatchWidthOrHeight=0.5（等比中项），所以缺省框是
      // 200*sqrt((W/800)*(H/600)) 的正方形（宽高同值）。
      const defBox = 200 * Math.sqrt((info.W / 800) * (info.H / 600)) * zf;
      const w = from.width !== undefined ? this.stageUnitPx(from.width, info, true) : defBox;
      const h = from.height !== undefined ? this.stageUnitPx(from.height, info, true) : defBox;
      const pivotX = from.pivot_x != null ? from.pivot_x : 0.5;
      const pivotY = from.pivot_y != null ? from.pivot_y : 0.5;
      const x0 = -pivotX * w, x1 = (1 - pivotX) * w;
      const y0 = -(1 - pivotY) * h, y1 = pivotY * h;
      const m3 = this.stageMatrix3(r.obj, r, info);
      if (info.perspective) {
        return [
          this.stageProjectPoint(m3, x0, y0, info),
          this.stageProjectPoint(m3, x1, y0, info),
          this.stageProjectPoint(m3, x1, y1, info),
          this.stageProjectPoint(m3, x0, y1, info),
        ];
      }
      const aff = extractAffine2(m3);
      const T = (u, v) => ({ x: aff.a * u + aff.c * v + aff.e, y: aff.b * u + aff.d * v + aff.f });
      return [T(x0, y0), T(x1, y0), T(x1, y1), T(x0, y1)];
    }

    pointInQuad(px, py, q) {
      let inside = false;
      for (let i = 0, j = q.length - 1; i < q.length; j = i++) {
        const xi = q[i].x, yi = q[i].y, xj = q[j].x, yj = q[j].y;
        if (((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi)) inside = !inside;
      }
      return inside;
    }

    hitTestStage(px, py, mode, opts) {
      if (!this.evalResult) return null;
      const info = this.ctxInfo();
      const group = { sprite: 'sprites', text: 'texts', video: 'videos' }[mode];
      if (!group) return null;
      const items = (this.evalResult[group] || []).slice().sort((a, b) =>
        ((a.from.layer != null ? a.from.layer : 0) - (b.from.layer != null ? b.from.layer : 0)) ||
        ((a.from.order != null ? a.from.order : 0) - (b.from.order != null ? b.from.order : 0)));
      for (let i = items.length - 1; i >= 0; i--) {
        const r = items[i];
        if (opts && opts.skip && opts.skip.has(r.obj.id)) continue;
        const corners = this.stageObjectCorners(mode, r, info);
        if (corners && this.pointInQuad(px, py, corners)) return r.obj.id;
      }
      return null;
    }

    hitTestLine(px, py, opts) {
      if (!this.evalResult) return null;
      const info = this.ctxInfo();
      const lines = this.evalResult.lines || [];
      for (let i = lines.length - 1; i >= 0; i--) {
        const r = lines[i];
        if (opts && opts.skip && opts.skip.has(r.obj.id)) continue;
        const pts = this.linePointsToPx(r.from, info);
        const wv = r.from.width != null
          ? (typeof r.from.width === 'number' ? r.from.width : (r.from.width.value != null ? r.from.width.value : 0.05))
          : 0.05;
        const tol = Math.max(6, wv * info.S / 2 + 4);
        for (let j = 1; j < pts.length; j++) {
          const a = pts[j - 1], b = pts[j];
          const dx = b.x - a.x, dy = b.y - a.y;
          const len2 = dx * dx + dy * dy;
          let t = len2 ? ((px - a.x) * dx + (py - a.y) * dy) / len2 : 0;
          t = Math.max(0, Math.min(1, t));
          if (Math.hypot(px - (a.x + t * dx), py - (a.y + t * dy)) <= tol) return r.obj.id;
        }
      }
      return null;
    }

    // Editor drag: hit-test a line endpoint handle (12px grab radius).
    // Returns { id, index } of the closest endpoint on the topmost line.
    hitTestLineEndpoint(px, py, opts) {
      if (!this.evalResult) return null;
      const info = this.ctxInfo();
      const lines = this.evalResult.lines || [];
      // The grab radius scales with the canvas so a tiny / zoomed-out preview
      // does not swallow the whole line with one oversized handle.
      const tol = Math.max(5, Math.min(14, 12 * this.canvas.width / 800));
      let best = null;
      let bestD = tol;
      for (let i = lines.length - 1; i >= 0; i--) {
        const r = lines[i];
        if (opts && opts.skip && opts.skip.has(r.obj.id)) continue;
        const pts = this.linePointsToPx(r.from, info);
        for (let j = 0; j < pts.length; j++) {
          const d = Math.hypot(px - pts[j].x, py - pts[j].y);
          if (d <= bestD) {
            bestD = d;
            best = { id: r.obj.id, index: j };
          }
        }
      }
      return best;
    }

    // Topmost object of the given pick mode at (px,py). Notes are returned as
    // "rawId::noteId" (the app's per-note entry convention).
    // 'stage' 模式合并 sprite / text / video / line，按 (layer, order) 取最上层。
    hitTestStageAny(px, py, opts) {
      if (!this.evalResult) return null;
      let best = null;
      let bestKey = -1;
      for (const key of ['sprites', 'texts', 'videos', 'lines']) {
        let r = null;
        if (key === 'lines') {
          const id = this.hitTestLine(px, py, opts);
          if (id) r = (this.evalResult.lines || []).find((e) => e.obj.id === id);
        } else {
          const id = this.hitTestStage(px, py, key.slice(0, -1), opts);
          if (id) r = (this.evalResult[key] || []).find((e) => e.obj.id === id);
        }
        if (!r) continue;
        const layer = r.from.layer != null ? Math.min(2, Math.max(0, r.from.layer)) : 0;
        const order = r.from.order != null ? r.from.order : 0;
        const k = layer * 1000000 + order;
        if (k > bestKey) { best = r.obj.id; bestKey = k; }
      }
      return best;
    }

    hitTestPick(px, py, mode, opts) {
      if (mode === 'note') {
        const note = this.hitTestNote(px, py);
        if (note && !(opts && opts.skip && opts.skip.has('note::' + note.id))) return 'note::' + note.id;
        return null;
      }
      if (mode === 'stage') return this.hitTestStageAny(px, py, opts);
      if (mode === 'line') return this.hitTestLine(px, py, opts);
      return this.hitTestStage(px, py, mode, opts);
    }

    // Objects of the pick mode whose screen box intersects the rectangle.
    hitTestPickRect(x1, y1, x2, y2, mode, opts) {
      const l = Math.min(x1, x2), r2 = Math.max(x1, x2), t2 = Math.min(y1, y2), b2 = Math.max(y1, y2);
      const info = this.ctxInfo();
      const out = [];
      const skip = opts && opts.skip;
      const t = this.time;
      if (mode === 'note') {
        if (!this.chart) return out;
        for (const note of this.chart.notes) {
          if (this.hiddenNoteIds && this.hiddenNoteIds.has(note.id)) continue;
          if (skip && skip.has('note::' + note.id)) continue;
          const clearTime = this.noteClearTime(note);
          if (t < note.intro_time || t > clearTime) continue;
          const pos = this.notePos(note, info);
          if (pos.x >= l && pos.x <= r2 && pos.y >= t2 && pos.y <= b2) out.push('note::' + note.id);
        }
        return out;
      }
      if (mode === 'stage') {
        const out2 = [];
        for (const m of ['sprite', 'text', 'video', 'line']) {
          out2.push(...this.hitTestPickRect(x1, y1, x2, y2, m, opts));
        }
        return [...new Set(out2)];
      }
      if (!this.evalResult) return out;
      if (mode === 'line') {
        for (const r of this.evalResult.lines || []) {
          if (skip && skip.has(r.obj.id)) continue;
          const pts = this.linePointsToPx(r.from, info);
          if (pts.some((p) => p.x >= l && p.x <= r2 && p.y >= t2 && p.y <= b2)) out.push(r.obj.id);
        }
        return out;
      }
      const group = { sprite: 'sprites', text: 'texts', video: 'videos' }[mode];
      for (const r of (this.evalResult[group] || [])) {
        if (skip && skip.has(r.obj.id)) continue;
        const corners = this.stageObjectCorners(mode, r, info);
        const bx1 = Math.min(...corners.map((p) => p.x)), bx2 = Math.max(...corners.map((p) => p.x));
        const by1 = Math.min(...corners.map((p) => p.y)), by2 = Math.max(...corners.map((p) => p.y));
        if (bx1 <= r2 && bx2 >= l && by1 <= b2 && by2 >= t2) out.push(r.obj.id);
      }
      return out;
    }

    tintDraw(ctx, img, x, y, w, h, color, alpha) {
      // Fast path: fully-white tint is a plain draw (with the given alpha).
      if (!color || (color.r === 1 && color.g === 1 && color.b === 1 && color.a === 1)) {
        ctx.save();
        ctx.globalAlpha = Math.min(1, Math.max(0, alpha != null ? alpha : 1));
        ctx.drawImage(img, x, y, w, h);
        ctx.restore();
        return;
      }
      // Tint through pooled offscreen canvases with source-in. Doing the
      // composite on an untransformed offscreen context is reliable even under
      // software GL. Each (w,h) size gets its own cached canvas so a frame
      // never pays for repeated canvas resizes (which cost ~10ms each under
      // software rendering when flick/ring/fill sizes alternate).
      // Quantize the tint canvas size to a 16px grid so approaching notes
      // (whose drawn size drifts every frame) reuse the same pooled canvases
      // instead of creating a new one per frame — software canvas creation
      // costs ~2ms each and was the source of playback stutters.
      const Q = 16;
      const tw = Math.max(Q, Math.ceil(Math.ceil(w) / Q) * Q);
      const th = Math.max(Q, Math.ceil(Math.ceil(h) / Q) * Q);
      const pool = this._tintPool || (this._tintPool = new Map());
      const key = tw + 'x' + th;
      let tc = pool.get(key);
      if (!tc) {
        tc = document.createElement('canvas');
        tc.width = tw;
        tc.height = th;
        pool.set(key, tc);
      }
      const tctx = tc.getContext('2d');
      tctx.setTransform(1, 0, 0, 1, 0, 0);
      tctx.clearRect(0, 0, tc.width, tc.height);
      tctx.globalAlpha = 1;
      tctx.drawImage(img, 0, 0, tc.width, tc.height);
      tctx.globalCompositeOperation = 'source-in';
      tctx.fillStyle = Colors.css(color);
      tctx.fillRect(0, 0, tc.width, tc.height);
      tctx.globalCompositeOperation = 'source-over';
      ctx.save();
      ctx.globalAlpha = Math.min(1, Math.max(0, alpha != null ? alpha : 1));
      ctx.drawImage(tc, x, y, w, h);
      ctx.restore();
    }

    // Tint a storyboard sprite while keeping its opaque pixels' exact alpha.
    // Unlike tintDraw (which renders into a 16px-quantized box and destroys
    // thin sub-pixel content such as line.png's 7px line), this tints at the
    // image's NATURAL resolution and lets the single final drawImage do the
    // downscale - so a thin line keeps its full color/alpha, exactly like the
    // untinted path. The old source-atop pass on the live canvas was worse
    // still: it repainted the entire sprite rect, because the destination
    // canvas underneath is already opaque.
    spriteTintDraw(ctx, img, x, y, w, h, color, alpha) {
      if (!color || (color.r === 1 && color.g === 1 && color.b === 1 && color.a === 1)) {
        ctx.save();
        ctx.globalAlpha = Math.min(1, Math.max(0, alpha != null ? alpha : 1));
        ctx.drawImage(img, x, y, w, h);
        ctx.restore();
        return;
      }
      const iw = img.naturalWidth || 1;
      const ih = img.naturalHeight || 1;
      const pool = this._spriteTintPool || (this._spriteTintPool = new Map());
      const key = iw + 'x' + ih;
      let tc = pool.get(key);
      if (!tc) {
        tc = document.createElement('canvas');
        tc.width = iw;
        tc.height = ih;
        pool.set(key, tc);
      }
      const tctx = tc.getContext('2d');
      tctx.setTransform(1, 0, 0, 1, 0, 0);
      tctx.clearRect(0, 0, iw, ih);
      tctx.globalAlpha = 1;
      tctx.globalCompositeOperation = 'source-over';
      tctx.drawImage(img, 0, 0, iw, ih);
      tctx.globalCompositeOperation = 'source-in';
      tctx.fillStyle = Colors.css(color);
      tctx.fillRect(0, 0, iw, ih);
      tctx.globalCompositeOperation = 'source-over';
      ctx.save();
      ctx.globalAlpha = Math.min(1, Math.max(0, alpha != null ? alpha : 1));
      ctx.drawImage(tc, x, y, w, h);
      ctx.restore();
    }

    drawNoteId(ctx, note, d, p, fillColor) {
      if (this.ui.showNoteIds !== true) return;
      // Native note IDs use a contrasting color: dark on bright fills (drag,
      // light-colored flicks), white on dark fills (click / hold / cdrag).
      const lum = fillColor
        ? 0.299 * fillColor.r + 0.587 * fillColor.g + 0.114 * fillColor.b
        : 0;
      const darkText = lum > 0.6;
      const size = Math.max(9, Math.min(20, d * 0.24));
      ctx.save();
      // Reset to screen space so the ID is never rotated or scaled with the
      // note; visibility is controlled ONLY by the "显示noteID" toggle.
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.font = `700 ${size}px "Segoe UI", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.globalAlpha = 1;
      ctx.shadowColor = darkText ? 'rgba(255,255,255,0.75)' : 'rgba(0,0,0,0.9)';
      ctx.shadowBlur = darkText ? 2 : 3;
      ctx.fillStyle = darkText ? 'rgba(18,18,18,0.95)' : '#ffffff';
      ctx.fillText(String(note.id), p.x, p.y);
      ctx.shadowBlur = 0;
      ctx.restore();
    }

    drawStageLayer(ctx, info, layer, storyboardOpacity) {
      if (!this.evalResult) return;
      const items = [];
      const push = (r, kind) => {
        if (this.hiddenObjIds && this.hiddenObjIds.has(r.obj.id)) return;
        const from = r.from;
        const l = from.layer != null ? Math.min(2, Math.max(0, from.layer)) : 0;
        const o = from.order != null ? from.order : 0;
        items.push({ l, o, r, kind });
      };
      for (const r of this.evalResult.texts) push(r, 'text');
      for (const r of this.evalResult.sprites) push(r, 'sprite');
      for (const r of this.evalResult.videos) push(r, 'video');
      for (const r of this.evalResult.lines) push(r, 'line');
      items.sort((a, b) => (a.l - b.l) || (a.o - b.o));

      // Warped sprites are batched into a single WebGL pass per layer so the
      // GL->2D compositing happens once. The batch is flushed BEFORE any
      // direct-drawn item (flat sprite / text / video / line) so objects keep
      // their exact (layer, order) interleaving, matching Unity's sorting.
      const warpBatch = [];
      const flush = () => {
        this.flushWarpBatch(ctx, info, warpBatch);
        warpBatch.length = 0;
      };
      for (const it of items) {
        if (it.l !== layer) continue;
        if (it.kind === 'line') {
          if (warpBatch.length) flush();
          this.drawLine(ctx, info, it.r, storyboardOpacity);
        } else {
          this.drawStageObject(ctx, info, it.r, it.kind, storyboardOpacity, warpBatch, flush);
        }
      }
      if (warpBatch.length) flush();
    }

    // Compute the canvas transform for a stage object, walking parent chain.
    // The returned 2D affine is the exact orthographic projection of the
    // object's full 3D transform (stageLocal3 / stageMatrix3) and is also the
    // exact projection of a flat plane in perspective mode. All 3D rotation
    // state lives in stageLocal3 / stageMatrix3 so both render paths share
    // one source of truth (sign conventions, euler order, parent hierarchy).
    stageMatrix(obj, r, info) {
      const from = r.from;
      // Stage Y points UP (stageY/noteY positive = upward), while the canvas
      // Y grows downward — stageLocal3 negates the offset so +y lands above
      // the center. Position and rotation are handled by stageLocal3.
      if (obj.parentId || obj.targetId) {
        const pid = obj.parentId || obj.targetId;
        // Note controller parent?
        if (this.compiled) {
          // A note selector expands into several note controllers sharing the
          // same id (one per selected note). Prefer the entry whose note is
          // currently active (intro..end), falling back to the first, so a
          // child parented to a multi-note controller follows the relevant
          // note instead of always the first one.
          const t = this.time;
          const ncList = this.compiled.noteControllers.filter((n) => n.id === pid);
          const nc = ncList.find((n) => {
            const nt = this.chart ? this.chart.noteById(n.note) : null;
            return nt && t >= nt.intro_time && t <= nt.end_time + 0.05;
          }) || ncList[0];
          if (nc && nc.note != null) {
            const note = this.chart.noteById(nc.note);
            if (note) {
              // Unity: the note controller's transform follows the note's
              // game object only while that note exists on screen (spawned at
              // its intro and destroyed once cleared). Before the intro and
              // after the clear the placeholder falls back to the world
              // origin, which projects to the canvas center through the
              // current camera. Using the chart position unconditionally
              // pinned the whole parented subtree to a far-away note's
              // position (e.g. bottom-left) long before that note appeared.
              const t = this.time;
              // The note object lingers through its clear animation, so the
              // existence window is at least end_time + 0.05 (same window the
              // multi-note selector above uses); drag heads persist through
              // their whole chain via noteClearTime.
              const clearTime = Math.max(this.noteClearTime(note), note.end_time + 0.05);
              const spawned = t >= note.intro_time && t <= clearTime;
              const p = spawned ? this.notePos(note, info) : this.worldToPx(0, 0, info, 0);
              // Unity's note-controller placeholder carries ONLY a position
              // (identity rotation): the child's own canvas-space transform
              // is placed at that point without the game camera's rotation /
              // foreshortening applied to its local frame (native
              // CanvasTransform behavior).
              return extractAffine2(m4Mul(m4Translate(p.x, p.y, 0), this.stageLocal3(from, info)));
            }
          }
        }
        // Stage object parent: the parent is the child's 3D reference frame.
        // The parent's position is the frame origin; its rot_x / rot_y /
        // rot_z and scale rotate / scale that frame like a camera viewing the
        // child's content (native Unity transform hierarchy), instead of a
        // flat 2D attribute inheritance.
        const parent = this.findEvalItem(pid);
        if (parent) {
          return extractAffine2(this.stageMatrix3(obj, r, info));
        }
      }
      // Storyboard objects are UI-layer elements on their own 800x600 canvas:
      // they are independent of the game camera (no camera x/y/z/rotation).
      // rot_x / rot_y are real 3D rotations around the object's own center,
      // orthographically projected to the canvas (so both axes compose like
      // Unity rotations instead of separate 2D squashes).
      return extractAffine2(m4Mul(m4Translate(info.W / 2, info.H / 2, 0), this.stageLocal3(from, info)));
    }

    // Resolve a parent_id / target_id that points at a note controller. A
    // note selector expands into several controllers sharing one id; prefer
    // the entry whose note is currently on screen, falling back to the first.
    noteControllerParent(pid) {
      if (!this.compiled || pid == null) return null;
      const t = this.time;
      const ncList = this.compiled.noteControllers.filter((n) => n.id === pid);
      const nc = ncList.find((n) => {
        const nt = this.chart ? this.chart.noteById(n.note) : null;
        return nt && t >= nt.intro_time && t <= nt.end_time + 0.05;
      }) || ncList[0];
      if (!nc || nc.note == null) return null;
      const note = this.chart ? this.chart.noteById(nc.note) : null;
      return { nc, note };
    }

    // An object's OWN local 3D transform. Built from the canonical y-up TRS
    // with RAW storyboard angles (canvasTRS), then converted to the y-down
    // canvas space — the single source of rotation conventions for every
    // stage object (sprites / texts / videos and their parents/children).
    stageLocal3(from, info) {
      const xC = from.x !== undefined ? this.stageUnitPx(from.x, info) : 0;
      const yC = from.y !== undefined ? -this.stageUnitPx(from.y, info) : 0;
      const z = from.z !== undefined ? this.stageZPx(from.z, info) : 0;
      const us = from.scale !== undefined ? from.scale : 1;
      const sx = (from.scale_x !== undefined ? from.scale_x : 1) * us;
      const sy = (from.scale_y !== undefined ? from.scale_y : 1) * us;
      return canvasTRS(xC, yC, z,
        from.rot_x !== undefined ? from.rot_x : 0,
        from.rot_y !== undefined ? from.rot_y : 0,
        from.rot_z !== undefined ? from.rot_z : 0,
        sx, sy);
    }

    // Full 3D transform of a stage object, walking the parent chain like the
    // native Unity transform hierarchy. Standalone objects sit on the canvas
    // (base translate = canvas center); stage parents compose their whole 3D
    // transform onto the child; note-controller parents embed their 2D result.
    // _fromOverride lets the editor compute the object's transform with
    // synthetic x/y unit values (used by drag coordinate conversion).
    stageMatrix3(obj, r, info, _depth, _seen, _fromOverride) {
      const from = _fromOverride || r.from;
      const local3 = this.stageLocal3(from, info);
      if (obj.parentId || obj.targetId) {
        const pid = obj.parentId || obj.targetId;
        // Guard against cyclic parent_id / target_id chains (invalid input):
        // cap the walk so a malformed storyboard can never hang the renderer.
        const depth = _depth || 0;
        const seen = _seen || new Set();
        if (depth > 32 || seen.has(pid)) {
          return m4Mul(m4Translate(info.W / 2, info.H / 2, 0), local3);
        }
        seen.add(pid);
        const ncParent = this.noteControllerParent(pid);
        if (ncParent && ncParent.note) {
          // Keep the child's own 3D transform (incl. its rot_x/rot_y depth)
          // instead of flattening to the 2D result, so sprites parented to a
          // note controller still project as trapezoids in perspective mode.
          const note = ncParent.note;
          const clearTime = Math.max(this.noteClearTime(note), note.end_time + 0.05);
          const spawned = this.time >= note.intro_time && this.time <= clearTime;
          const p = spawned ? this.notePos(note, info) : this.worldToPx(0, 0, info, 0);
          return m4Mul(m4Translate(p.x, p.y, 0), this.stageLocal3(from, info));
        }
        const parent = this.findEvalItem(pid);
        if (parent) {
          return m4Mul(this.stageMatrix3(parent.r.obj, parent.r, info, depth + 1, seen), local3);
        }
      }
      return m4Mul(m4Translate(info.W / 2, info.H / 2, 0), local3);
    }

    findEvalItem(id) {
      if (!this.evalResult) return null;
      // target_id controllers are merged into their terminal entity; resolve
      // the chain so children (parent_id) attach to the shared transform.
      let resolvedId = id;
      const seen = new Set([id]);
      if (this.compiled) {
        for (const key of ['texts', 'sprites', 'videos', 'lines']) {
          const src = this.compiled[key] || [];
          let obj = src.find((x) => x.id === resolvedId);
          while (obj && obj.targetId && !seen.has(obj.targetId)) {
            seen.add(obj.targetId);
            resolvedId = obj.targetId;
            obj = src.find((x) => x.id === resolvedId);
          }
          if (obj) break;
        }
      }
      for (const key of ['texts', 'sprites', 'videos', 'lines']) {
        const r = this.evalResult[key].find((x) => x.obj.id === resolvedId);
        if (r) return { r, kind: key };
      }
      return null;
    }

    drawStageObject(ctx, info, r, kind, storyboardOpacity, batch, flush) {
      const from = r.from;
      const obj = r.obj;
      // Opacity cascades down the sprite parent chain (Unity CanvasGroup
      // alpha multiplies the whole hierarchy): the child's final opacity is
      // its own value times every stage ancestor's opacity. Coordinate-axis
      // attributes (x/y/z/rotations) are inherited via the 3D matrix, and
      // scale / scale_x / scale_y inherit through the composed transform.
      const opacity = (from.opacity != null ? from.opacity : 0) * storyboardOpacity * this.stageInheritedOpacity(obj, r);
      if (opacity <= 0.004) return;
      // Sprites render through ONE unified 3D pipeline, matching the native
      // World-Space canvas + camera: in ortho mode the affine projection of
      // the 3D transform is exact; in perspective mode every sprite goes
      // through the perspective homography (which degenerates to the affine
      // case for a flat plane), so crossing 0° is continuous with no
      // threshold switch. Children inherit the parent's full 3D transform.
      // Compute the 3D matrix once per sprite: the warp path needs it and the
      // affine path only builds its own 2D matrix when actually used.
      const warpM3 = kind === 'sprite' ? this.stageMatrix3(obj, r, info) : null;
      const warp = kind === 'sprite' && info.perspective;
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      if (!warp) {
        if (batch && batch.length && flush) flush();
        const M = this.stageMatrix(obj, r, info);
        ctx.transform(M.a, M.b, M.c, M.d, M.e, M.f);
      }
      ctx.globalAlpha = Math.min(1, Math.max(0, opacity));

      const w = from.width !== undefined ? this.stageUnitPx(from.width, info, true) : null;
      const h = from.height !== undefined ? this.stageUnitPx(from.height, info, true) : null;
      const fillWidth = from.fill_width === true;
      const zf = this.sceneFactor();
      const pivotX = from.pivot_x != null ? from.pivot_x : 0.5;
      const pivotY = from.pivot_y != null ? from.pivot_y : 0.5;
      // preserve_aspect has priority over scaling: the image is always fitted
      // into the width/height box keeping its intrinsic ratio (no distortion),
      // while scale / scale_x / scale_y still scale the fitted size visibly.
      const preserveAspect = from.preserve_aspect !== false;

      if (kind === 'sprite') {
        if (!from.path) { ctx.restore(); return; }
        let img = this.imageCache[from.path];
        if (!img || !img.complete) {
          // Kick off the load on first draw (preloadImages covers the common
          // case; this covers paths added/edited while the project is open).
          this.loadImage(from.path).catch(() => {});
          ctx.restore();
          return;
        }
        const iw = img.naturalWidth, ih = img.naturalHeight;
        let dw = w != null ? w : 200 * Math.sqrt((info.W / 800) * (info.H / 600)) * zf;
        let dh = h != null ? h : 200 * Math.sqrt((info.W / 800) * (info.H / 600)) * zf;
        if (fillWidth) {
          dw = info.W * zf;
          dh = 10000 * zf;
        }
        if (preserveAspect && w == null && h == null) {
          // preserve intrinsic aspect at default 200x200 box
          if (iw > ih) dh = dw * ih / iw;
          else dw = dh * iw / ih;
        } else if (preserveAspect && (w != null || h != null)) {
          const scale = Math.min(dw / iw, dh / ih);
          dw = iw * scale;
          dh = ih * scale;
        }
        // sprite 颜色以 50% 透明度叠加：让原图透过一半，而不是整块不透明填充。
        // 白色（未设颜色）保持原样；对象自身 opacity 仍按原逻辑乘算。
        const rawColor = from.color || { r: 1, g: 1, b: 1, a: 1 };
        const color = (rawColor.r === 1 && rawColor.g === 1 && rawColor.b === 1 && rawColor.a === 1)
          ? rawColor
          : { ...rawColor, a: (rawColor.a != null ? rawColor.a : 1) * 0.5 };
        if (warp) {
          this.drawSpriteWarped(ctx, img, obj, r, info, dw, dh, pivotX, pivotY, color, opacity, warpM3, batch);
        } else {
          // Tint ONLY the image's opaque pixels at natural resolution. The old
          // source-atop pass on the live canvas repainted the entire sprite rect
          // with the tint color, because the destination canvas underneath is
          // already opaque - a line.png sprite (a 7px-wide line inside a
          // 2045x369 frame) then rendered as a solid red band spanning the whole
          // playfield.
          this.spriteTintDraw(ctx, img, -pivotX * dw, -(1 - pivotY) * dh, dw, dh, color, opacity);
        }
      } else if (kind === 'text') {
        this.drawText(ctx, from, info, w, h, pivotX, pivotY);
      } else if (kind === 'video') {
        let v = this.videoCache[from.path];
        if (!v) {
          this.loadVideo(from.path).catch(() => {});
          ctx.restore();
          return;
        }
        if (!v.readyState || v.readyState < 2) {
          ctx.restore();
          return;
        }
        // The video's playback starts at its CREATION time in the storyboard
        // (the first/base state's time). Using the current evaluated state's
        // time would reset the progress whenever another property (opacity,
        // scale, ...) changes. During continuous playback the muted video
        // actually plays (keeps data buffered and stays near the audio clock);
        // on scrub/pause we seek directly. This avoids a per-frame seek storm
        // that used to drop readyState to 1.
        const firstStates = (r.obj && r.obj.states) || [];
        const firstT = firstStates.length ? firstStates[0].time : 0;
        const videoStart = (typeof firstT === 'number' && isFinite(firstT) && firstT < 1e15) ? firstT : 0;
        const vt = Math.max(0, this.time - videoStart);
        if (this.playing) {
          if (Math.abs(v.currentTime - vt) > 0.25) {
            try { v.currentTime = vt; } catch (e) {}
          }
          if (v.paused) v.play().catch(() => {});
        } else {
          if (!v.paused) v.pause();
          if (Math.abs(v.currentTime - vt) > 0.06) {
            try { v.currentTime = vt; } catch (e) {}
          }
        }
        let dw = w != null ? w : info.W * zf;
        let dh = h != null ? h : info.H * zf;
        if (fillWidth) { dw = info.W * zf; dh = 10000 * zf; }
        const vw = v.videoWidth, vh = v.videoHeight;
        if (vw && vh && preserveAspect) {
          const scale = Math.min(dw / vw, dh / vh);
          dw = vw * scale;
          dh = vh * scale;
        }
        ctx.drawImage(v, -pivotX * dw, -(1 - pivotY) * dh, dw, dh);
      }
      ctx.restore();
    }

    // Editor-overlay heuristic: whether a sprite's plane is tilted out of the
    // screen (rot_x / rot_y somewhere in the parent chain). Used ONLY by the
    // selection highlight to decide between the exact alpha silhouette (flat
    // plane) and the transformed box. The actual sprite render no longer uses
    // this — in perspective mode every sprite goes through the unified
    // projection, so there is no render-path threshold.
    spriteNeedsWarp(obj, r, info, m3) {
      const m3v = m3 || this.stageMatrix3(obj, r, info);
      // m3[2] / m3[6] are the Z components of the local X / Y axes: non-zero
      // means the plane is tilted out of the canvas.
      return Math.abs(m3v[2]) > 0.02 || Math.abs(m3v[6]) > 0.02;
    }

    // Apply the full 3D transform (parent chain + own rotation/scale) to a
    // local box point (u, v) and project it through the current camera. In
    // perspective mode the depth Z of the tilted plane produces the native
    // trapezoid; in ortho mode this degenerates to the affine result.
    stageProjectPoint(m3, u, v, info) {
      const X = m3[0] * u + m3[4] * v + m3[12];
      const Y = m3[1] * u + m3[5] * v + m3[13];
      const Z = m3[2] * u + m3[6] * v + m3[14];
      if (!info.perspective) return { x: X, y: Y, z: Z };
      const f = info.f || (info.S * info.D);
      const depth = Math.max(0.05, f + Z);
      const s = f / depth;
      return {
        x: info.W / 2 + (X - info.W / 2) * s,
        y: info.H / 2 + (Y - info.H / 2) * s,
        z: Z
      };
    }

    // Tint a sprite's opaque pixels at NATURAL resolution into a pooled
    // offscreen canvas (shared with spriteTintDraw) so the warped path can
    // draw strips of the tinted source.
    tintSpriteCanvas(img, iw, ih, color) {
      const pool = this._spriteTintPool || (this._spriteTintPool = new Map());
      const key = iw + 'x' + ih;
      let tc = pool.get(key);
      if (!tc) {
        tc = document.createElement('canvas');
        tc.width = iw;
        tc.height = ih;
        pool.set(key, tc);
      }
      const tctx = tc.getContext('2d');
      tctx.setTransform(1, 0, 0, 1, 0, 0);
      tctx.clearRect(0, 0, iw, ih);
      tctx.globalAlpha = 1;
      tctx.globalCompositeOperation = 'source-over';
      tctx.drawImage(img, 0, 0, iw, ih);
      if (color && !(color.r === 1 && color.g === 1 && color.b === 1 && color.a === 1)) {
        tctx.globalCompositeOperation = 'source-in';
        tctx.fillStyle = Colors.css(color);
        tctx.fillRect(0, 0, iw, ih);
        tctx.globalCompositeOperation = 'source-over';
      }
      return tc;
    }

    // Draw a sprite warped through the perspective projection of its full 3D
    // transform: the tilted square becomes a trapezoid exactly like the
    // native game, and a parented child inherits the parent's tilt because
    // its corners go through the parent's transform too. The plane is first
    // clipped against the camera near plane (f + z >= NEAR) so a sprite whose
    // corners go behind the camera only renders its visible part instead of
    // exploding to huge coordinates. The visible region is then rasterized
    // per-pixel on a low-resolution offscreen canvas through the inverse
    // perspective homography and upscaled with smoothing, which removes the
    // horizontal strip seams of the old affine approximation.
    drawSpriteWarped(ctx, img, obj, r, info, dw, dh, pivotX, pivotY, color, alpha, m3, batch) {
      const m3v = m3 || this.stageMatrix3(obj, r, info);
      const iw = img.naturalWidth || 1;
      const ih = img.naturalHeight || 1;
      const uL = -pivotX * dw;
      const uR = uL + dw;
      const vT = -(1 - pivotY) * dh;
      const vB = vT + dh;
      if (!(uR > uL) || !(vB > vT)) return;
      if (!info.perspective) return;

      const W = info.W, H = info.H;
      const W2 = W / 2, H2 = H / 2;
      const f = info.f || (info.S * info.D);
      // Plane coefficients (canvas px, y-down): x(u,v) = x0 + x1*u + x2*v ...
      const x0 = m3v[12], x1 = m3v[0], x2 = m3v[4];
      const y0 = m3v[13], y1 = m3v[1], y2 = m3v[5];
      const z0 = m3v[14], z1 = m3v[2], z2 = m3v[6];

      // Flat plane (parallel to the screen, no depth offset): the perspective
      // projection degenerates to an exact affine map — draw directly at full
      // resolution (crisp, identical to the ortho affine path). This keeps 0°
      // continuous with ±small angles and avoids the warp rasterizer's
      // resolution cap for the common no-rotation case.
      if (Math.abs(z1) < 1e-6 && Math.abs(z2) < 1e-6 && Math.abs(z0) < 1e-6 && !(batch && batch.length)) {
        const aff = extractAffine2(m3v);
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.transform(aff.a, aff.b, aff.c, aff.d, aff.e, aff.f);
        this.spriteTintDraw(ctx, img, uL, vT, dw, dh, color, alpha);
        ctx.restore();
        return;
      }

      // Clip the source quad against the near plane f + z >= NEAR (z is
      // linear in u,v, so this is a straight half-plane cut).
      const NEAR = 0.05;
      const corners = [
        { u: uL, v: vT, z: z0 + z1 * uL + z2 * vT },
        { u: uR, v: vT, z: z0 + z1 * uR + z2 * vT },
        { u: uR, v: vB, z: z0 + z1 * uR + z2 * vB },
        { u: uL, v: vB, z: z0 + z1 * uL + z2 * vB },
      ];
      const insideNear = (p) => f + p.z >= NEAR;
      const poly = [];
      for (let i = 0; i < 4; i++) {
        const a = corners[i], b = corners[(i + 1) % 4];
        const ai = insideNear(a), bi = insideNear(b);
        if (ai) poly.push(a);
        if (ai !== bi) {
          const da = f + a.z - NEAR;
          const db = f + b.z - NEAR;
          const t = da / (da - db);
          poly.push({ u: a.u + (b.u - a.u) * t, v: a.v + (b.v - a.v) * t, z: a.z + (b.z - a.z) * t });
        }
      }
      // Fully behind the camera (or degenerate): nothing is visible.
      if (poly.length < 3) return;

      // Project the clipped polygon to the screen to get the visible bounds.
      const proj = (p) => {
        const d = Math.max(NEAR, f + p.z);
        const s = f / d;
        const X = x0 + x1 * p.u + x2 * p.v;
        const Y = y0 + y1 * p.u + y2 * p.v;
        return { x: W2 + (X - W2) * s, y: H2 + (Y - H2) * s };
      };
      const screenPoly = poly.map(proj);
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const q of screenPoly) {
        if (q.x < minX) minX = q.x;
        if (q.y < minY) minY = q.y;
        if (q.x > maxX) maxX = q.x;
        if (q.y > maxY) maxY = q.y;
      }
      if (!isFinite(minX) || !isFinite(minY) || !isFinite(maxX) || !isFinite(maxY)) return;
      const bx1 = Math.max(0, minX), by1 = Math.max(0, minY);
      const bx2 = Math.min(W, maxX), by2 = Math.min(H, maxY);
      const boxW = bx2 - bx1, boxH = by2 - by1;
      if (boxW < 1 || boxH < 1) return;

      const p = { uL, uR, vT, vB, x0, x1, x2, y0, y1, y2, z0, z1, z2 };
      // Per-layer batching: collect the quad for the shared WebGL pass so the
      // GL->2D readback happens once per layer instead of once per sprite.
      if (batch && this.ensureWarpGL()) {
        const imgKey = (r.from && r.from.path) || img.src || obj.id;
        batch.push({
          img, imgKey, obj, r, dw, dh, pivotX, pivotY, color, alpha, m3: m3v,
          bx1, by1, boxW, boxH, p,
        });
        return;
      }

      // Immediate GPU path: rasterize the quad through the perspective camera
      // in WebGL. The hardware clipper handles the near plane (clip.z = w),
      // so the CPU side only computes the visible bounds above. Falls back to
      // the CPU scanline rasterizer below when WebGL is unavailable.
      if (this.drawSpriteWarpedGL(ctx, img, obj, r, info, bx1, by1, boxW, boxH, {
        ...p,
      }, color, alpha)) {
        return;
      }

      // Static-sprite cache: while the resolved 3D matrix, image, tint and
      // projected bounds stay identical, reuse the previously warped canvas
      // (one drawImage blit) instead of re-rasterizing every frame.
      const tintKey = Math.round(color.r * 255) + ',' + Math.round(color.g * 255) + ',' + Math.round(color.b * 255);
      const imgKey = (r.from && r.from.path) || img.src || obj.id;
      const mKey = m3v[0].toFixed(4) + ',' + m3v[1].toFixed(4) + ',' + m3v[2].toFixed(4) + ',' + m3v[3].toFixed(4) + ',' +
                   m3v[4].toFixed(4) + ',' + m3v[5].toFixed(4) + ',' + m3v[6].toFixed(4) + ',' + m3v[7].toFixed(4) + ',' +
                   m3v[8].toFixed(4) + ',' + m3v[9].toFixed(4) + ',' + m3v[10].toFixed(4) + ',' + m3v[11].toFixed(4) + ',' +
                   m3v[12].toFixed(4) + ',' + m3v[13].toFixed(4) + ',' + m3v[14].toFixed(4) + ',' + m3v[15].toFixed(4);
      const key = imgKey + '|' + tintKey + '|' + dw + 'x' + dh + '|' + pivotX + ',' + pivotY + '|' +
                  W + 'x' + H + '|' + f.toFixed(1) + '|' + mKey;
      const cache = this._warpCache;
      const hit = cache && cache.get(key);
      if (hit) {
        // LRU refresh.
        cache.delete(key);
        cache.set(key, hit);
        // Blit the cached ImageData through the shared scratch canvas.
        if (!this._warpCanvas) this._warpCanvas = document.createElement('canvas');
        if (this._warpCanvas.width !== hit.rw || this._warpCanvas.height !== hit.rh) {
          this._warpCanvas.width = hit.rw;
          this._warpCanvas.height = hit.rh;
        }
        this._warpCanvas.getContext('2d').putImageData(hit.img, 0, 0);
        ctx.globalAlpha = Math.min(1, Math.max(0, alpha != null ? alpha : 1));
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(this._warpCanvas, 0, 0, hit.rw, hit.rh, bx1, by1, boxW, boxH);
        return;
      }

      // Forward homography (u,v) -> screen (x,y): the projective map
      // x = (f*x(u,v) + W2*z(u,v)) / (f + z(u,v)).
      const M = [
        f * x1 + W2 * z1, f * x2 + W2 * z2, f * x0 + W2 * z0,
        f * y1 + H2 * z1, f * y2 + H2 * z2, f * y0 + H2 * z0,
        z1, z2, f + z0,
      ];
      // 3x3 inverse (adjugate) -> maps screen px back to (u,v).
      const det = M[0] * (M[4] * M[8] - M[5] * M[7])
                - M[1] * (M[3] * M[8] - M[5] * M[6])
                + M[2] * (M[3] * M[7] - M[4] * M[6]);
      if (!isFinite(det) || Math.abs(det) < 1e-12) return;
      const inv = [
        (M[4] * M[8] - M[5] * M[7]) / det, (M[2] * M[7] - M[1] * M[8]) / det, (M[1] * M[5] - M[2] * M[4]) / det,
        (M[5] * M[6] - M[3] * M[8]) / det, (M[0] * M[8] - M[2] * M[6]) / det, (M[2] * M[3] - M[0] * M[5]) / det,
        (M[3] * M[7] - M[4] * M[6]) / det, (M[1] * M[6] - M[0] * M[7]) / det, (M[0] * M[4] - M[1] * M[3]) / det,
      ];

      // Warp resolution cap (long side in px); quality-first at 512.
      const warpMax = this._warpMax || 512;
      const scale = Math.min(1, warpMax / Math.max(boxW, boxH));
      const rw = Math.max(2, Math.round(boxW * scale));
      const rh = Math.max(2, Math.round(boxH * scale));

      // Downscaled tinted source, cached per image + tint so repeated warps
      // (animated sprites) don't re-tint / re-read the pixels every frame.
      const srcCap = 512;
      const srcScale = Math.min(1, srcCap / Math.max(iw, ih));
      const sw = Math.max(1, Math.round(iw * srcScale));
      const sh = Math.max(1, Math.round(ih * srcScale));
      const srcKey = imgKey + '|' + tintKey + '|' + sw + 'x' + sh;
      let srcHit = this._warpSourceCache.get(srcKey);
      if (!srcHit) {
        const tc = this.tintSpriteCanvas(img, iw, ih, color);
        if (!this._warpSrcCanvas) this._warpSrcCanvas = document.createElement('canvas');
        const sc = this._warpSrcCanvas;
        if (sc.width !== sw || sc.height !== sh) { sc.width = sw; sc.height = sh; }
        const sctx = sc.getContext('2d');
        sctx.setTransform(1, 0, 0, 1, 0, 0);
        sctx.clearRect(0, 0, sw, sh);
        sctx.imageSmoothingEnabled = true;
        sctx.drawImage(tc, 0, 0, sw, sh);
        srcHit = sctx.getImageData(0, 0, sw, sh);
        this._warpSourceCache.set(srcKey, srcHit);
        if (this._warpSourceCache.size > 24) {
          const first = this._warpSourceCache.keys().next().value;
          this._warpSourceCache.delete(first);
        }
      }
      const src = srcHit.data;

      // Rasterize into a shared scratch canvas; the raw ImageData is what gets
      // cached, so no per-entry canvas objects are retained. Scanline fill:
      // per row, intersect the projected convex polygon edges to get the
      // x-span, then walk only those pixels with an incrementally evaluated
      // inverse homography.
      if (!this._warpCanvas) this._warpCanvas = document.createElement('canvas');
      const wc = this._warpCanvas;
      if (wc.width !== rw || wc.height !== rh) { wc.width = rw; wc.height = rh; }
      const wctx = wc.getContext('2d');
      const out = wctx.createImageData(rw, rh);
      const od = out.data;
      const uSpan = uR - uL, vSpan = vB - vT;
      const uScale = sw / uSpan, vScale = sh / vSpan;
      const dxCanvas = boxW / rw;
      const inv0 = inv[0], inv1 = inv[1], inv2 = inv[2];
      const inv3 = inv[3], inv4 = inv[4], inv5 = inv[5];
      const inv6 = inv[6], inv7 = inv[7], inv8 = inv[8];
      const dup = inv0 * dxCanvas, dvp = inv3 * dxCanvas, dwp = inv6 * dxCanvas;
      const n = screenPoly.length;
      for (let ty = 0; ty < rh; ty++) {
        const sy = by1 + (ty + 0.5) / rh * boxH;
        let lo = Infinity, hi = -Infinity;
        for (let i = 0; i < n; i++) {
          const a = screenPoly[i], b = screenPoly[(i + 1) % n];
          const y0 = a.y, y1 = b.y;
          if (sy < Math.min(y0, y1) || sy > Math.max(y0, y1)) continue;
          const tt = y1 !== y0 ? (sy - y0) / (y1 - y0) : 0.5;
          const ix = a.x + (b.x - a.x) * tt;
          if (ix < lo) lo = ix;
          if (ix > hi) hi = ix;
        }
        if (!isFinite(lo) || !isFinite(hi)) continue;
        const txa = Math.max(0, Math.floor((lo - bx1) / boxW * rw));
        const txb = Math.min(rw - 1, Math.ceil((hi - bx1) / boxW * rw));
        if (txa > txb) continue;
        const sx0 = bx1 + (txa + 0.5) / rw * boxW;
        let up = inv0 * sx0 + inv1 * sy + inv2;
        let vp = inv3 * sx0 + inv4 * sy + inv5;
        let wp = inv6 * sx0 + inv7 * sy + inv8;
        for (let tx = txa; tx <= txb; tx++) {
          if (Math.abs(wp) > 1e-12) {
            const u = up / wp;
            if (u >= uL && u <= uR) {
              const v = vp / wp;
              if (v >= vT && v <= vB) {
                let px = u * uScale - uL * uScale;
                let py = v * vScale - vT * vScale;
                if (px < 0) px = 0; else if (px > sw - 1) px = sw - 1;
                if (py < 0) py = 0; else if (py > sh - 1) py = sh - 1;
                // Nearest sampling on the low-res source; the final smoothed
                // upscale drawImage interpolates between warp pixels, so the
                // result stays continuous without paying 4 reads + weights
                // per output pixel.
                const si = ((py | 0) * sw + (px | 0)) * 4;
                const oi = (ty * rw + tx) * 4;
                od[oi] = src[si];
                od[oi + 1] = src[si + 1];
                od[oi + 2] = src[si + 2];
                od[oi + 3] = src[si + 3];
              }
            }
          }
          up += dup; vp += dvp; wp += dwp;
        }
      }
      wctx.putImageData(out, 0, 0);

      cache.set(key, { img: out, rw, rh });
      if (cache.size > 96) {
        const first = cache.keys().next().value;
        cache.delete(first);
      }

      ctx.globalAlpha = Math.min(1, Math.max(0, alpha != null ? alpha : 1));
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(wc, 0, 0, rw, rh, bx1, by1, boxW, boxH);
    }

    // Lazily create the shared WebGL context used to rasterize warped
    // sprites. Returns null when WebGL is unavailable (the CPU path is then
    // used for the lifetime of the renderer).
    ensureWarpGL() {
      if (this._warpGL !== undefined) return this._warpGL;
      try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl', {
          alpha: true, premultipliedAlpha: true, preserveDrawingBuffer: true,
          antialias: false, depth: false, stencil: false,
        }) || canvas.getContext('experimental-webgl', {
          alpha: true, premultipliedAlpha: true, preserveDrawingBuffer: true,
          antialias: false, depth: false, stencil: false,
        });
        if (!gl) { this._warpGL = null; return null; }
        const VS = [
          'attribute vec2 aUV;',
          'uniform vec3 uX;',  // x0, x1, x2
          'uniform vec3 uY;',
          'uniform vec3 uZ;',
          'uniform vec4 uRect;', // uL, uR, vT, vB
          'uniform vec4 uBox;', // bx1, by1, boxW, boxH
          'uniform vec2 uSize;', // W, H
          'uniform float uF;',
          'varying vec2 vUV;',
          'void main(){',
          '  float u = aUV.x;',
          '  float v = aUV.y;',
          '  float X = uX.x + uX.y * u + uX.z * v;',
          '  float Y = uY.x + uY.y * u + uY.z * v;',
          '  float Z = uZ.x + uZ.y * u + uZ.z * v;',
          '  float w = uF + Z;',
          '  vUV = vec2((u - uRect.x) / (uRect.y - uRect.x), (v - uRect.z) / (uRect.w - uRect.z));',
          // Normalize the projection against the VISIBLE bounding box so the
          // framebuffer only needs to be box-sized (no full-canvas readback).
          '  float bx1 = uBox.x, by1 = uBox.y, bw = uBox.z, bh = uBox.w;',
          '  gl_Position = vec4(',
          '    (2.0 * uF * X + (uSize.x - 2.0 * bx1 - bw) * w - uF * uSize.x) / bw,',
          '    ((2.0 * by1 + bh - uSize.y) * w - 2.0 * uF * Y + uF * uSize.y) / bh,',
          '    w, w);', // clip.z = clip.w -> the GPU near-clips at w = 0
          '}',
        ].join('\n');
        const FS = [
          'precision mediump float;',
          'uniform sampler2D uTex;',
          'uniform vec3 uTint;',
          'uniform float uTintA;',
          'uniform float uAlpha;',
          'uniform float uFlat;', // 1 = flat tint color, 0 = texture color
          'varying vec2 vUV;',
          'void main(){',
          '  vec4 t = texture2D(uTex, vUV);',
          '  vec3 rgb = uFlat > 0.5 ? uTint : t.rgb;',
          // Premultiplied output so the GL->2D readback composites
          // semi-transparent sprites without losing the color.
          '  float a = t.a * uTintA * uAlpha;',
          '  gl_FragColor = vec4(rgb * a, a);',
          '}',
        ].join('\n');
        const mk = (type, src) => {
          const s = gl.createShader(type);
          gl.shaderSource(s, src);
          gl.compileShader(s);
          if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
            throw new Error('warp GL: ' + gl.getShaderInfoLog(s));
          }
          return s;
        };
        const prog = gl.createProgram();
        gl.attachShader(prog, mk(gl.VERTEX_SHADER, VS));
        gl.attachShader(prog, mk(gl.FRAGMENT_SHADER, FS));
        gl.linkProgram(prog);
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
          throw new Error('warp GL link: ' + gl.getProgramInfoLog(prog));
        }
        this._warpGL = {
          canvas, gl, prog,
          buf: gl.createBuffer(),
          loc: {
            aUV: gl.getAttribLocation(prog, 'aUV'),
            uX: gl.getUniformLocation(prog, 'uX'),
            uY: gl.getUniformLocation(prog, 'uY'),
            uZ: gl.getUniformLocation(prog, 'uZ'),
            uRect: gl.getUniformLocation(prog, 'uRect'),
            uBox: gl.getUniformLocation(prog, 'uBox'),
            uSize: gl.getUniformLocation(prog, 'uSize'),
            uF: gl.getUniformLocation(prog, 'uF'),
            uTex: gl.getUniformLocation(prog, 'uTex'),
            uTint: gl.getUniformLocation(prog, 'uTint'),
            uTintA: gl.getUniformLocation(prog, 'uTintA'),
            uAlpha: gl.getUniformLocation(prog, 'uAlpha'),
            uFlat: gl.getUniformLocation(prog, 'uFlat'),
          },
        };
        return this._warpGL;
      } catch (e) {
        this._warpGL = null;
        return null;
      }
    }

    // Upload (or reuse) the sprite image as a GL texture, downscaled to a
    // safe cap for very large sources.
    warpTexture(gl, imgKey, img) {
      if (!this._warpTextureCache) this._warpTextureCache = new Map();
      const hit = this._warpTextureCache.get(imgKey);
      if (hit) return hit;
      const iw = img.naturalWidth || 1;
      const ih = img.naturalHeight || 1;
      const cap = 2048;
      const sc = Math.min(1, cap / Math.max(iw, ih));
      const sw = Math.max(1, Math.round(iw * sc));
      const sh = Math.max(1, Math.round(ih * sc));
      let src = img;
      if (sw !== iw || sh !== ih) {
        if (!this._warpTexCanvas) this._warpTexCanvas = document.createElement('canvas');
        const tcv = this._warpTexCanvas;
        tcv.width = sw;
        tcv.height = sh;
        const tctx = tcv.getContext('2d');
        tctx.clearRect(0, 0, sw, sh);
        tctx.imageSmoothingEnabled = true;
        tctx.drawImage(img, 0, 0, sw, sh);
        src = tcv;
      }
      const t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
      const tex = { texture: t, w: sw, h: sh };
      this._warpTextureCache.set(imgKey, tex);
      if (this._warpTextureCache.size > 24) {
        const first = this._warpTextureCache.keys().next().value;
        const ev = this._warpTextureCache.get(first);
        this._warpTextureCache.delete(first);
        if (ev) gl.deleteTexture(ev.texture);
      }
      return tex;
    }

    // GPU sprite warp: one textured quad with perspective-correct UVs. The
    // near-plane clip is done by the hardware (clip.z = clip.w), and the
    // result is blitted 1:1 into the 2D canvas at the visible bounds.
    drawSpriteWarpedGL(ctx, img, obj, r, info, bx1, by1, boxW, boxH, p, color, alpha) {
      const wgl = this.ensureWarpGL();
      if (!wgl) return false;
      const { gl, canvas, prog, buf, loc } = wgl;
      // The vertex shader normalizes against the visible bounding box, so the
      // framebuffer only needs to be box-sized; the 1:1 drawImage blit avoids
      // reading back the whole preview canvas.
      const rw = Math.max(1, Math.round(boxW));
      const rh = Math.max(1, Math.round(boxH));
      if (canvas.width !== rw || canvas.height !== rh) {
        canvas.width = rw;
        canvas.height = rh;
      }
      gl.viewport(0, 0, rw, rh);
      gl.disable(gl.CULL_FACE);
      gl.disable(gl.BLEND);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(prog);

      const imgKey = (r.from && r.from.path) || img.src || obj.id;
      const tex = this.warpTexture(gl, imgKey, img);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tex.texture);
      gl.uniform1i(loc.uTex, 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        p.uL, p.vT, p.uR, p.vT, p.uR, p.vB,
        p.uL, p.vT, p.uR, p.vB, p.uL, p.vB,
      ]), gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(loc.aUV);
      gl.vertexAttribPointer(loc.aUV, 2, gl.FLOAT, false, 0, 0);

      gl.uniform3f(loc.uX, p.x0, p.x1, p.x2);
      gl.uniform3f(loc.uY, p.y0, p.y1, p.y2);
      gl.uniform3f(loc.uZ, p.z0, p.z1, p.z2);
      gl.uniform4f(loc.uRect, p.uL, p.uR, p.vT, p.vB);
      gl.uniform4f(loc.uBox, bx1, by1, boxW, boxH);
      gl.uniform2f(loc.uSize, info.W, info.H);
      gl.uniform1f(loc.uF, info.f || (info.S * info.D));
      const flat = !(color.r === 1 && color.g === 1 && color.b === 1 && color.a === 1);
      gl.uniform3f(loc.uTint, color.r, color.g, color.b);
      gl.uniform1f(loc.uTintA, color.a != null ? color.a : 1);
      gl.uniform1f(loc.uAlpha, alpha != null ? alpha : 1);
      gl.uniform1f(loc.uFlat, flat ? 1 : 0);
      gl.drawArrays(gl.TRIANGLES, 0, 6);

      ctx.globalAlpha = 1;
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(canvas, 0, 0, rw, rh, bx1, by1, boxW, boxH);
      return true;
    }

    // Draw every collected warped sprite into ONE full-size WebGL canvas (in
    // draw order, alpha-blended) and composite it with a single drawImage, so
    // the GL->2D readback happens once per layer instead of once per sprite.
    flushWarpBatch(ctx, info, batch) {
      if (!batch || !batch.length) return;
      const wgl = this.ensureWarpGL();
      if (!wgl) {
        // GL became unavailable between collection and flush: redraw each
        // request through the normal (CPU-fallback) path.
        for (const q of batch) {
          this.drawSpriteWarped(ctx, q.img, q.obj, q.r, info, q.dw, q.dh,
            q.pivotX, q.pivotY, q.color, q.alpha, q.m3);
        }
        return;
      }
      const { gl, canvas, prog, buf, loc } = wgl;
      const W = Math.max(1, Math.round(info.W));
      const H = Math.max(1, Math.round(info.H));
      if (canvas.width !== W || canvas.height !== H) {
        canvas.width = W;
        canvas.height = H;
      }
      gl.viewport(0, 0, W, H);
      gl.disable(gl.CULL_FACE);
      gl.enable(gl.BLEND);
      // Premultiplied-alpha blending (matches the shader's premultiplied
      // output and the premultipliedAlpha:true readback).
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(prog);
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.enableVertexAttribArray(loc.aUV);
      gl.vertexAttribPointer(loc.aUV, 2, gl.FLOAT, false, 0, 0);
      gl.uniform2f(loc.uSize, info.W, info.H);
      gl.uniform1f(loc.uF, info.f || (info.S * info.D));
      for (const q of batch) {
        const tex = this.warpTexture(gl, q.imgKey, q.img);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, tex.texture);
        gl.uniform1i(loc.uTex, 0);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
          q.p.uL, q.p.vT, q.p.uR, q.p.vT, q.p.uR, q.p.vB,
          q.p.uL, q.p.vT, q.p.uR, q.p.vB, q.p.uL, q.p.vB,
        ]), gl.DYNAMIC_DRAW);
        gl.uniform3f(loc.uX, q.p.x0, q.p.x1, q.p.x2);
        gl.uniform3f(loc.uY, q.p.y0, q.p.y1, q.p.y2);
        gl.uniform3f(loc.uZ, q.p.z0, q.p.z1, q.p.z2);
        gl.uniform4f(loc.uRect, q.p.uL, q.p.uR, q.p.vT, q.p.vB);
        // The batch framebuffer is the FULL preview canvas, so the quad is
        // normalized against the full canvas (not its own bounding box).
        gl.uniform4f(loc.uBox, 0, 0, W, H);
        const flat = !(q.color.r === 1 && q.color.g === 1 && q.color.b === 1 && q.color.a === 1);
        gl.uniform3f(loc.uTint, q.color.r, q.color.g, q.color.b);
        gl.uniform1f(loc.uTintA, q.color.a != null ? q.color.a : 1);
        gl.uniform1f(loc.uAlpha, q.alpha != null ? q.alpha : 1);
        gl.uniform1f(loc.uFlat, flat ? 1 : 0);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
      }
      ctx.globalAlpha = 1;
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(canvas, 0, 0, W, H);
    }

    // Product of all stage ancestors' opacities (excluding the object's own),
    // so children fade with their parents like Unity's CanvasGroup cascade.
    // Note-controller parents only carry a position and never fade children.
    stageInheritedOpacity(obj, r) {
      let o = 1;
      let cur = { obj, r };
      let guard = 0;
      while (cur && cur.obj && (cur.obj.parentId || cur.obj.targetId) && guard++ < 32) {
        const pid = cur.obj.parentId || cur.obj.targetId;
        const ncParent = this.noteControllerParent(pid);
        if (ncParent && ncParent.note) break;
        const parent = this.findEvalItem(pid);
        if (!parent) break;
        const po = parent.r.from.opacity;
        if (po != null) o *= po;
        // findEvalItem returns { r, kind }; keep walking with the obj + r pair.
        cur = { obj: parent.r.obj, r: parent.r };
      }
      return o;
    }

    drawText(ctx, from, info, w, h, pivotX, pivotY) {
      const text = from.text != null ? String(from.text) : '';
      if (!text) return;
      const size = (from.size != null ? from.size : 20) * this.sceneFactor();
      const align = ALIGN_MAP[String(from.align || 'middleCenter').toLowerCase()] || ['center', 'middle'];
      const color = from.color || { r: 1, g: 1, b: 1, a: 1 };
      const weight = FONT_WEIGHT[String(from.font_weight || 'regular').toLowerCase()] || '400';
      const spacing = from.letter_spacing != null ? from.letter_spacing : 0;
      // Unity LetterSpacing: letterOffset = Spacing * fontSize / 100, glyphs are
      // shifted by letterOffset * charIndex within each line (spaces counted in
      // the index but not shifted), with a per-line centering correction.
      const letterOffset = (spacing * size) / 100;
      const lines = text.split('\n');
      const lineHeight = size * 1.2;
      const totalH = lines.length * lineHeight;
      // Rect height: explicit height, or the text block itself. The text block
      // is aligned inside the rect (top / middle / bottom). Lines are drawn
      // with textBaseline 'middle' so their visual centers are exact (an
      // alphabetic baseline would shift the whole text upward by font-metric
      // dependent amounts).
      const Hr = h != null ? h : totalH;
      const blockTop = -(1 - pivotY) * Hr;
      const alignV = align[1];
      const blockCenter = alignV === 'top'
        ? blockTop + totalH / 2
          : alignV === 'bottom'
            ? blockTop + (Hr - totalH) + totalH / 2
            : blockTop + (Hr - totalH) / 2 + totalH / 2;
      const alignH = align[0];
      const alignFactor = alignH === 'left' ? 0 : alignH === 'right' ? 1 : 0.5;
      for (let li = 0; li < lines.length; li++) {
        const line = lines[li];
        const runs = parseRichText(line);
        const plainLen = line.replace(/<[^>]*>/g, '').length;
        const lineOffset = (plainLen - 1) * letterOffset * alignFactor;
        const y0 = blockCenter + (li - (lines.length - 1) / 2) * lineHeight;
        // Width of the unspaced text block (Unity aligns the unspaced layout,
        // then LetterSpacing shifts glyphs around the alignment anchor).
        let unspacedW = 0;
        for (const run of runs) {
          ctx.font = this.runFont(run, weight, size);
          for (const ch of run.text) unspacedW += ctx.measureText(ch).width;
        }
        let x0 = alignH === 'left' ? 0 : alignH === 'right' ? -(w != null ? w : unspacedW) : -unspacedW / 2;
        ctx.textBaseline = 'middle';
        let acc = 0;
        let ci = 0;
        for (const run of runs) {
          ctx.font = this.runFont(run, weight, size);
          ctx.fillStyle = Colors.css(run.color || color);
          if (run.italic) ctx.font = `italic ${ctx.font}`;
          for (const ch of run.text) {
            ctx.fillText(ch, x0 + acc + letterOffset * ci - lineOffset, y0);
            acc += ctx.measureText(ch).width;
            ci++;
          }
        }
      }
    }

    runFont(run, weight, size) {
      let w = weight;
      if (run && run.bold) w = 700;
      const px = run && run.size != null ? run.size : size;
      return `${w} ${px}px ${SB_FONT_FAMILY}`;
    }

    drawLine(ctx, info, r, storyboardOpacity) {
      const from = r.from;
      const opacity = (from.opacity != null ? from.opacity : 0) * storyboardOpacity;
      if (opacity <= 0.004 || !from.pos || !from.pos.length) return;
      const pts = this.linePointsToPx(from, info);
      // width may be a unit object ({value, unit}) or a plain number in the
      // wild; both map to world units here.
      // Real engine: line width is a world-space value (LineStateParser uses
      // ReferenceUnit.World, scaleToCanvas=false), rendered through the
      // CURRENT camera projection (world * H/(2*ortho) = world * S), so it
      // scales with the camera's size like every other world object.
      const wv = from.width == null
        ? 0.05
        : (typeof from.width === 'number' ? from.width : this.unitWorld(from.width, info));
      const width = Math.max(0.5, wv * info.S);
      const color = from.color || { r: 1, g: 1, b: 1, a: 1 };
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.strokeStyle = Colors.css({ ...color, a: (color.a != null ? color.a : 1) * opacity });
      ctx.lineWidth = Math.max(0.5, width);
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.stroke();
      ctx.restore();
    }

    // Line endpoints are world-space in the real engine (LineRenderer is
    // IsOnCanvas=false, scaleToCanvas=false for every unit): noteX/noteY go
    // through the chart field conversion, stageX/stageY convert to world
    // units via the camera size (value/800*ortho*aspect, value/600*ortho),
    // world stays raw, and the endpoint z is applied too. Everything then
    // goes through the full camera projection (rotation / perspective /
    // camera x/y), exactly like the native line object.
    linePointsToPx(from, info) {
      return (from.pos || []).map((p) => {
        const gx = this.unitWorld(p.x, info);
        const gy = this.unitWorld(p.y, info);
        const gz = this.unitWorld(p.z, info);
        const gp = this.worldToPx(gx, gy, info, gz);
        return { x: gp.x, y: gp.y };
      });
    }

    // Editor drag: project the local origin of a stage object for an
    // arbitrary x/y unit pair. The object's own transform (rotation, scale,
    // parent chain, perspective) is applied, so the returned canvas offset is
    // exactly where the object's center lands for those x/y values.
    stageOriginPx(obj, from, info, xu, yu) {
      // Raw storyboard objects store parent_id / target_id in snake_case;
      // the transform walker expects the compiled camelCase fields.
      const o = (obj.parentId != null || obj.targetId != null || (obj.parent_id == null && obj.target_id == null))
        ? obj
        : { ...obj, parentId: obj.parent_id, targetId: obj.target_id };
      const m3 = this.stageMatrix3(o, { from }, info, 0, null, { ...from, x: xu, y: yu });
      const p = this.stageProjectPoint(m3, 0, 0, info);
      return { x: p.x, y: p.y };
    }

    // Canvas-space drag basis for a stage object: how +1 of its X/Y units
    // moves the object center (handles parent rotation, perspective and
    // per-unit scales). xu/yu are {value, unit} pairs.
    stageOriginDragBasis(obj, from, info, xu, yu) {
      const p0 = this.stageOriginPx(obj, from, info, xu, yu);
      const px = this.stageOriginPx(obj, from, info, { value: xu.value + 1, unit: xu.unit }, yu);
      const py = this.stageOriginPx(obj, from, info, xu, { value: yu.value + 1, unit: yu.unit });
      return {
        bx: { x: px.x - p0.x, y: px.y - p0.y },
        by: { x: py.x - p0.x, y: py.y - p0.y }
      };
    }

    // Screen point of a world-unit triple through the current camera
    // (shared by line endpoints and note_controller override positions).
    worldUnitPx(xu, yu, zu, info) {
      const gp = this.worldToPx(
        this.unitWorld(xu, info),
        this.unitWorld(yu, info),
        info,
        this.unitWorld(zu, info)
      );
      return { x: gp.x, y: gp.y };
    }

    // Canvas-space drag basis for world-unit targets (line endpoints, note
    // controller overrides): +1 of each unit through unitWorld -> worldToPx.
    worldUnitDragBasis(xu, yu, zu, info) {
      const p0 = this.worldUnitPx(xu, yu, zu, info);
      const px = this.worldUnitPx({ value: xu.value + 1, unit: xu.unit }, yu, zu, info);
      const py = this.worldUnitPx(xu, { value: yu.value + 1, unit: yu.unit }, zu, info);
      return {
        bx: { x: px.x - p0.x, y: px.y - p0.y },
        by: { x: py.x - p0.x, y: py.y - p0.y }
      };
    }

    // Editor overlay: outline the selected stage object (or ring the notes of
    // a selected note_controller) with the app's accent color.
    drawSelectionHighlight(ctx, W, H) {
      const ids = this.highlightObjIds;
      if ((!ids || !ids.size) && !(this.highlightNotes && this.highlightNotes.size)) return;
      const info = this.ctxInfo();
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.setLineDash([5, 4]);
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(91, 192, 235, 0.95)';
      ctx.fillStyle = 'rgba(91, 192, 235, 0.08)';

      if (this.evalResult && ids) {
        for (const id of ids) {
        // Stage objects: outline their real shape (sprites use the actual
        // alpha silhouette; text/video use the transformed box).
        for (const key of ['texts', 'sprites', 'videos']) {
          const r = (this.evalResult[key] || []).find((e) => e.obj.id === id);
          if (!r) continue;
          const from = r.from;
          const M = this.stageMatrix(r.obj, r, info);
          const zf = this.sceneFactor();
          const defBox = 200 * Math.sqrt((W / 800) * (H / 600)) * zf;
          const w = from.width !== undefined ? this.stageUnitPx(from.width, info, true) : defBox;
          const h = from.height !== undefined ? this.stageUnitPx(from.height, info, true) : defBox;
          const pivotX = from.pivot_x != null ? from.pivot_x : 0.5;
          const pivotY = from.pivot_y != null ? from.pivot_y : 0.5;
          const T = (px, py) => ({ x: M.a * px + M.c * py + M.e, y: M.b * px + M.d * py + M.f });

          // Full-screen objects: highlight the screen border instead of the
          // (huge) original box.
          if (from.fill_width === true) {
            ctx.setLineDash([8, 6]);
            ctx.lineWidth = 3;
            ctx.strokeStyle = 'rgba(91, 192, 235, 0.95)';
            ctx.beginPath();
            const x0 = W / 2 - (W / 2 - 5) * zf, y0 = H / 2 - (H / 2 - 5) * zf;
            ctx.rect(x0, y0, (W - 10) * zf, (H - 10) * zf);
            ctx.stroke();
            break;
          }

          let drew = false;
          if (key === 'sprites' && from.path) {
            // Irregular PNG edge: trace the visible (alpha) silhouette.
            const img = this.imageCache[from.path];
            const warp = info.perspective && this.spriteNeedsWarp(r.obj, r, info, this.stageMatrix3(r.obj, r, info));
            if (img && img.complete && !warp) {
              const iw = img.naturalWidth, ih = img.naturalHeight;
              // The image is FIT into the box with the same rules as the draw
              // path (preserve_aspect), so the silhouette aligns exactly.
              let dw = w != null ? w : 200 * Math.sqrt((W / 800) * (H / 600)) * zf;
              let dh = h != null ? h : 200 * Math.sqrt((W / 800) * (H / 600)) * zf;
              const preserveAspect = from.preserve_aspect !== false;
              if (preserveAspect && w == null && h == null) {
                if (iw > ih) dh = dw * ih / iw;
                else dw = dh * iw / ih;
              } else if (preserveAspect && (w != null || h != null)) {
                const scale = Math.min(dw / iw, dh / ih);
                dw = iw * scale;
                dh = ih * scale;
              }
              const polys = this.spriteSilhouette(from.path);
              if (polys && polys.length) {
                const localOf = (u, v) => ({
                  x: -pivotX * dw + (u / iw) * dw,
                  y: -(1 - pivotY) * dh + (v / ih) * dh
                });
                for (const poly of polys) {
                  ctx.beginPath();
                  poly.forEach(([u, v], i) => {
                    const p = T(localOf(u, v).x, localOf(u, v).y);
                    if (i === 0) ctx.moveTo(p.x, p.y);
                    else ctx.lineTo(p.x, p.y);
                  });
                  ctx.closePath();
                  ctx.stroke();
                }
                drew = true;
              }
            }
          }
          if (!drew) {
            // Fallback / text / video: transformed bounding box (pivot-aware,
            // matching how the object is actually drawn). In perspective mode
            // project the corners through the same camera as the render so the
            // outline matches the warped trapezoid.
            const x0 = -pivotX * w, x1 = (1 - pivotX) * w;
            const y0 = -(1 - pivotY) * h, y1 = pivotY * h;
            let corners;
            if (info.perspective) {
              const m3 = this.stageMatrix3(r.obj, r, info);
              corners = [
                this.stageProjectPoint(m3, x0, y0, info),
                this.stageProjectPoint(m3, x1, y0, info),
                this.stageProjectPoint(m3, x1, y1, info),
                this.stageProjectPoint(m3, x0, y1, info),
              ];
            } else {
              corners = [T(x0, y0), T(x1, y0), T(x1, y1), T(x0, y1)];
            }
            ctx.beginPath();
            ctx.moveTo(corners[0].x, corners[0].y);
            for (let i = 1; i < 4; i++) ctx.lineTo(corners[i].x, corners[i].y);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
          }
          break;
        }
        // Lines: outline the path and mark every endpoint.
        const line = (this.evalResult.lines || []).find((e) => e.obj.id === id);
        if (line) {
          const pts = this.linePointsToPx(line.from, info);
          if (pts.length >= 2) {
            ctx.beginPath();
            ctx.moveTo(pts[0].x, pts[0].y);
            for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
            ctx.stroke();
          }
          for (const p of pts) {
            ctx.beginPath();
            ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(91, 192, 235, 0.9)';
            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 1.5;
            ctx.stroke();
          }
        }
        }
      }

      // note_controller: ring every currently visible note it controls.
      if (this.highlightNotes && this.highlightNotes.size && this.chart) {
        const t = this.time;
        for (const note of this.chart.notes) {
          if (!this.highlightNotes.has(note.id)) continue;
          const clearTime = this.noteClearTime(note);
          if (t < note.intro_time || t > clearTime) continue;
          const pos = this.notePos(note, info);
          const r = Math.max(10, this.noteRadiusAtTime(note, info, t) + 4);
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(91, 192, 235, 0.08)';
          ctx.fill();
          ctx.strokeStyle = 'rgba(91, 192, 235, 0.95)';
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    // Trace the visible (alpha > threshold) silhouette of an image into one or
    // more polylines in IMAGE space, cached per path (the silhouette does not
    // change while the object transform does). Marching squares over a coarse
    // alpha grid keeps this fast; the outline is re-projected each frame.
    spriteSilhouette(path) {
      if (!path) return null;
      if (!this._silhouetteCache) this._silhouetteCache = {};
      if (this._silhouetteCache[path]) return this._silhouetteCache[path];
      const img = this.imageCache && this.imageCache[path];
      if (!img || !img.complete || !img.naturalWidth) return null;
      const iw = img.naturalWidth, ih = img.naturalHeight;
      const MAX = 96;
      const gw = Math.max(2, Math.min(MAX, iw));
      const gh = Math.max(2, Math.round(gw * ih / iw));
      const c = document.createElement('canvas');
      c.width = gw; c.height = gh;
      const cx = c.getContext('2d', { willReadFrequently: true });
      cx.drawImage(img, 0, 0, gw, gh);
      let d;
      try { d = cx.getImageData(0, 0, gw, gh).data; } catch (e) { return null; }
      const g = new Uint8Array(gw * gh);
      for (let i = 0; i < gw * gh; i++) g[i] = d[i * 4 + 3] > 8 ? 1 : 0;
      const at = (x, y) => (x < 0 || y < 0 || x >= gw || y >= gh ? 0 : g[y * gw + x]);
      const px = (x) => (x + 0.5) / gw * iw;
      const py = (y) => (y + 0.5) / gh * ih;
      const segs = [];
      for (let y = 0; y < gh - 1; y++) {
        for (let x = 0; x < gw - 1; x++) {
          const a = at(x, y), b = at(x + 1, y), cc = at(x + 1, y + 1), dd = at(x, y + 1);
          const mids = [];
          if (a !== b) mids.push([px(x + 0.5), py(y)]);
          if (b !== cc) mids.push([px(x + 1), py(y + 0.5)]);
          if (cc !== dd) mids.push([px(x + 0.5), py(y + 1)]);
          if (dd !== a) mids.push([px(x), py(y + 0.5)]);
          if (mids.length === 2) {
            segs.push([mids[0], mids[1]]);
          } else if (mids.length === 4) {
            segs.push([mids[0], mids[1]]);
            segs.push([mids[2], mids[3]]);
          }
        }
      }
      // Chain segments that share endpoints into closed polylines.
      const key = (p) => p[0].toFixed(3) + ',' + p[1].toFixed(3);
      const adj = new Map();
      for (let i = 0; i < segs.length; i++) {
        for (const ep of [segs[i][0], segs[i][1]]) {
          const k = key(ep);
          if (!adj.has(k)) adj.set(k, []);
          adj.get(k).push(i);
        }
      }
      const used = new Array(segs.length).fill(false);
      const polys = [];
      for (let i = 0; i < segs.length; i++) {
        if (used[i]) continue;
        used[i] = true;
        const poly = [segs[i][0], segs[i][1]];
        let cur = segs[i][1];
        let guard = 0;
        while (guard++ < segs.length) {
          const k = key(cur);
          const nxt = (adj.get(k) || []).find((j) => !used[j]);
          if (nxt == null) break;
          used[nxt] = true;
          const s = segs[nxt];
          const nextPt = s[0][0] === cur[0] && s[0][1] === cur[1] ? s[1] : s[0];
          poly.push(nextPt);
          cur = nextPt;
        }
        if (poly.length > 3) polys.push(poly);
      }
      this._silhouetteCache[path] = polys.length ? polys : null;
      return this._silhouetteCache[path];
    }

    drawUI(ctx, W, H, ctrl) {
      const opacity = ctrl.ui_opacity != null ? ctrl.ui_opacity : 1;
      if (opacity <= 0.01 || !this.ui.show) return;
      ctx.save();
      // UI is canvas-space: shrink it with the scene like a shrunk screen.
      this.sceneTransform(ctx, W, H);
      ctx.globalAlpha = opacity;
      const level = this.level || {};
      ctx.textBaseline = 'middle';
      // Title / artist
      ctx.font = '600 15px "Segoe UI", sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      const title = level.title || 'Untitled';
      ctx.fillText(title, 18, 22);
      ctx.font = '400 12px "Segoe UI", sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      const sub = [level.artist, level.charter].filter(Boolean).join(' · ');
      ctx.fillText(sub, 18, 42);
      // Time
      ctx.font = '500 14px "Segoe UI", sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      const ss = Math.floor(this.time), ms = Math.floor((this.time - ss) * 1000);
      ctx.fillText(`${ss}.${String(ms).padStart(3, '0')}`, W - 120, 22);
      // Progress
      const endT = this.chart ? this.chart.endTime : 1;
      const pr = Math.min(1, this.time / Math.max(0.001, endT));
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(0, H - 6, W, 3);
      ctx.fillStyle = this.ui.accent;
      ctx.fillRect(0, H - 6, W * pr, 3);
      ctx.restore();
    }
  }

  // Small matrix helpers (canvas-style affine: y down)
  function translate(tx, ty) { return { a: 1, b: 0, c: 0, d: 1, e: tx, f: ty }; }
  function rotate(rad) { const c = Math.cos(rad), s = Math.sin(rad); return { a: c, b: s, c: -s, d: c, e: 0, f: 0 }; }
  function scale(sx, sy) { return { a: sx, b: 0, c: 0, d: sy, e: 0, f: 0 }; }
  function mul(m1, m2) {
    return {
      a: m1.a * m2.a + m1.c * m2.b,
      b: m1.b * m2.a + m1.d * m2.b,
      c: m1.a * m2.c + m1.c * m2.d,
      d: m1.b * m2.c + m1.d * m2.d,
      e: m1.a * m2.e + m1.c * m2.f + m1.e,
      f: m1.b * m2.e + m1.d * m2.f + m1.f
    };
  }

  // Minimal 4x4 (column-major) helpers for the storyboard objects' 3D
  // transforms. Stage objects parent like the native Unity transform
  // hierarchy: the parent is the child's reference frame, so the parent's
  // rot_x / rot_y / rot_z and scale rotate / scale that frame (camera-like)
  // instead of being inherited as flat 2D attributes.
  function m4Identity() {
    return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  }

  function m4Mul(a, b) {
    const o = new Array(16);
    for (let c = 0; c < 4; c++) {
      for (let r = 0; r < 4; r++) {
        o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] +
          a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
      }
    }
    return o;
  }

  function m4Translate(x, y, z) {
    const m = m4Identity();
    m[12] = x;
    m[13] = y;
    m[14] = z;
    return m;
  }

  // Canvas-style z rotations (y-down): positive rot_z spins clockwise,
  // matching the 2D rotate() helper used everywhere else.
  function m4RotZ(rad) {
    const c = Math.cos(rad), s = Math.sin(rad);
    return [c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  }

  // ---------- Canonical world y-up rotations (single sign convention) ----------
  // Unity storyboard space is y-UP with +z toward the camera (camera at
  // z=-D). Storyboard rot_x/rot_y/rot_z are applied RAW as Unity euler angles
  // (order Ry -> Rx -> Rz, matrix R = Rz·Rx·Ry), verified against the real
  // engine: +rot_x brings the BOTTOM edge nearer (wider), +rot_y brings the
  // RIGHT edge nearer (longer), +rot_z rotates counterclockwise on a y-up
  // screen. Every object type (stage objects, notes, holdbars) shares these
  // matrices — there are no per-object sign patches.
  function m4RotYupX(rad) {
    const c = Math.cos(rad), s = Math.sin(rad);
    return [1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1];
  }

  function m4RotYupY(rad) {
    const c = Math.cos(rad), s = Math.sin(rad);
    return [c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1];
  }

  function m4RotYupZ(rad) {
    const c = Math.cos(rad), s = Math.sin(rad);
    return [c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  }

  // Conjugate a y-up transform by the y-flip (Y = diag(1,-1,1,1)) so it acts
  // on our y-down canvas locals: M' = Y·M·Y. This is the ONLY place the
  // y-up <-> y-down sign handling lives.
  function m4YFlip(m) {
    return [m[0], -m[1], m[2], m[3], -m[4], m[5], -m[6], -m[7], m[8], -m[9], m[10], m[11], m[12], -m[13], m[14], m[15]];
  }

  // Canonical y-up TRS with RAW storyboard angles, converted to a y-down
  // canvas matrix: M = Y · T(xC,-yC,z) · Rz(rz) · Rx(rx) · Ry(ry) · S · Y.
  function canvasTRS(xC, yC, z, rxDeg, ryDeg, rzDeg, sx, sy) {
    const rad = (d) => d * Math.PI / 180;
    const up = m4Mul(
      m4Translate(xC, -yC, z),
      m4Mul(m4RotYupZ(rad(rzDeg)),
        m4Mul(m4RotYupX(rad(rxDeg)),
          m4Mul(m4RotYupY(rad(ryDeg)), m4Scale(sx, sy)))));
    return m4YFlip(up);
  }

  function m4Scale(sx, sy) {
    const m = m4Identity();
    m[0] = sx;
    m[5] = sy;
    return m;
  }

  // Orthographic projection of the XY plane (screen y flips) of a 4x4
  // transform -> 2D canvas affine (exact for planar stage objects).
  function extractAffine2(m4) {
    return { a: m4[0], b: m4[1], c: m4[4], d: m4[5], e: m4[12], f: m4[13] };
  }

  // Embed a 2D canvas affine into a 4x4 (identity Z) so note-controller
  // parents can still be composed by deeper 3D parent chains.
  function embedAffine3(m2) {
    return [m2.a, m2.b, 0, 0, m2.c, m2.d, 0, 0, 0, 0, 1, 0, m2.e, m2.f, 0, 1];
  }

  // Rich text: <b>, <i>, <size=N>, <color=#hex>
  function parseRichText(text) {
    const runs = [];
    const re = /<(\/?)(b|i|size|color)(?:\s*=\s*([^>]*))?>/gi;
    let last = 0;
    let bold = false, italic = false, size = null, color = null;
    let m;
    while ((m = re.exec(text)) !== null) {
      if (m.index > last) {
        runs.push({ text: text.slice(last, m.index), bold, italic, size, color });
      }
      const closing = m[1] === '/';
      const tag = m[2].toLowerCase();
      const val = m[3];
      if (closing) {
        if (tag === 'b') bold = false;
        else if (tag === 'i') italic = false;
        else if (tag === 'size') size = null;
        else if (tag === 'color') color = null;
      } else {
        if (tag === 'b') bold = true;
        else if (tag === 'i') italic = true;
        else if (tag === 'size') size = parseInt(val, 10);
        else if (tag === 'color') color = Colors.parseHex(val);
      }
      last = m.index + m[0].length;
    }
    if (last < text.length) runs.push({ text: text.slice(last), bold, italic, size, color });
    return runs;
  }

  function measureRun(ctx, run, spacing) {
    const base = ctx.font;
    ctx.font = run.font || base;
    let w = 0;
    if (spacing) {
      for (const ch of run.text) w += ctx.measureText(ch).width + spacing;
    } else {
      w = ctx.measureText(run.text).width;
    }
    ctx.font = base;
    return w;
  }

  const api = { PreviewRenderer, loadSbFonts };
  if (typeof window !== 'undefined') window.SBPreview = api;
  if (typeof module !== 'undefined') module.exports = api;
})();
