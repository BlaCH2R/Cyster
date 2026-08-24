// Color helpers: hex parsing equivalent to Unity's ColorUtility.TryParseHtmlString
// plus conversions used by the preview renderer.
(() => {
  // Returns {r,g,b,a} in 0..1 or null
  function parseHex(str) {
    if (typeof str !== 'string') return null;
    let s = str.trim();
    if (s[0] === '#') s = s.slice(1);
    if (!/^[0-9a-fA-F]+$/.test(s)) return null;
    if (s.length === 3 || s.length === 4) {
      const r = parseInt(s[0] + s[0], 16);
      const g = parseInt(s[1] + s[1], 16);
      const b = parseInt(s[2] + s[2], 16);
      const a = s.length === 4 ? parseInt(s[3] + s[3], 16) : 255;
      return { r: r / 255, g: g / 255, b: b / 255, a: a / 255 };
    }
    if (s.length === 6 || s.length === 8) {
      const r = parseInt(s.slice(0, 2), 16);
      const g = parseInt(s.slice(2, 4), 16);
      const b = parseInt(s.slice(4, 6), 16);
      const a = s.length === 8 ? parseInt(s.slice(6, 8), 16) : 255;
      return { r: r / 255, g: g / 255, b: b / 255, a: a / 255 };
    }
    return null;
  }

  function clamp01(v) {
    return Math.min(1, Math.max(0, v));
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function lerpColor(a, b, t) {
    if (!a) return b || { r: 1, g: 1, b: 1, a: 1 };
    if (!b) return a;
    return {
      r: lerp(a.r, b.r, t),
      g: lerp(a.g, b.g, t),
      b: lerp(a.b, b.b, t),
      a: lerp(a.a, b.a, t)
    };
  }

  function css(c) {
    if (!c) return 'rgba(255,255,255,1)';
    return `rgba(${Math.round(clamp01(c.r) * 255)},${Math.round(clamp01(c.g) * 255)},${Math.round(clamp01(c.b) * 255)},${clamp01(c.a)})`;
  }

  function toHex(c, withAlpha) {
    const h = (n) => Math.round(clamp01(n) * 255).toString(16).padStart(2, '0');
    let s = '#' + h(c.r) + h(c.g) + h(c.b);
    if (withAlpha) s += h(c.a);
    return s;
  }

  const DEFAULT_NOTE_FILL = [
    // Note 默认颜色（[0]=上行 [1]=下行）：
    // click #35A7FF/#FF5964, drag #39E59E/#39E59E, hold #35A7FF/#FF5964,
    // long_hold #F2C85A/#F2C85A, flick #35A7FF/#FF5964, c_drag #39E59E/#39E59E
    { r: 0.2078, g: 0.6549, b: 1.0000, a: 1 }, // click up    #35A7FF
    { r: 1.0000, g: 0.3490, b: 0.3922, a: 1 }, // click down  #FF5964
    { r: 0.2235, g: 0.8980, b: 0.6196, a: 1 }, // drag up     #39E59E
    { r: 0.2235, g: 0.8980, b: 0.6196, a: 1 }, // drag down   #39E59E
    { r: 0.2078, g: 0.6549, b: 1.0000, a: 1 }, // hold up     #35A7FF
    { r: 1.0000, g: 0.3490, b: 0.3922, a: 1 }, // hold down   #FF5964
    { r: 0.9490, g: 0.7843, b: 0.3529, a: 1 }, // long up     #F2C85A
    { r: 0.9490, g: 0.7843, b: 0.3529, a: 1 }, // long down   #F2C85A
    { r: 0.2078, g: 0.6549, b: 1.0000, a: 1 }, // flick up    #35A7FF
    { r: 1.0000, g: 0.3490, b: 0.3922, a: 1 }, // flick down  #FF5964
    { r: 0.2235, g: 0.8980, b: 0.6196, a: 1 }, // cdrag up    #39E59E
    { r: 0.2235, g: 0.8980, b: 0.6196, a: 1 }  // cdrag down  #39E59E
  ];

  const api = { parseHex, clamp01, lerp, lerpColor, css, toHex, DEFAULT_NOTE_FILL };
  if (typeof window !== 'undefined') {
    if (!window.SBEngine) window.SBEngine = {};
    window.SBEngine.colors = api;
  }
  if (typeof module !== 'undefined') module.exports = api;
})();
