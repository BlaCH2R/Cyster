// Easing functions ported 1:1 from Cytoid v2.0.2 (Assets/Scripts/Utils/Easings.cs)
// (C) Robert Penner / C.J. Kimberlin, MIT/BSD licensed in the original.
(() => {
  const clamp01 = (v) => Math.min(1, Math.max(0, v));
  const PI = Math.PI;

  const fns = {
    none: (s, e, v) => s,
    linear: (s, e, v) => s + (e - s) * v,
    spring: (s, e, v) => {
      v = clamp01(v);
      v = (Math.sin(v * PI * (0.2 + 2.5 * v * v * v)) * Math.pow(1 - v, 2.2) + v) * (1 + 1.2 * (1 - v));
      return s + (e - s) * v;
    },
    easeinquad: (s, e, v) => s + (e - s) * v * v,
    easeoutquad: (s, e, v) => s - (e - s) * v * (v - 2),
    easeinoutquad: (s, e, v) => {
      v /= 0.5;
      if (v < 1) return s + (e - s) * 0.5 * v * v;
      v--;
      return s - (e - s) * 0.5 * (v * (v - 2) - 1);
    },
    easeincubic: (s, e, v) => s + (e - s) * v * v * v,
    easeoutcubic: (s, e, v) => {
      v--;
      return s + (e - s) * (v * v * v + 1);
    },
    easeinoutcubic: (s, e, v) => {
      v /= 0.5;
      if (v < 1) return s + (e - s) * 0.5 * v * v * v;
      v -= 2;
      return s + (e - s) * 0.5 * (v * v * v + 2);
    },
    easeinquart: (s, e, v) => s + (e - s) * v * v * v * v,
    easeoutquart: (s, e, v) => {
      v--;
      return s - (e - s) * (v * v * v * v - 1);
    },
    easeinoutquart: (s, e, v) => {
      v /= 0.5;
      if (v < 1) return s + (e - s) * 0.5 * v * v * v * v;
      v -= 2;
      return s - (e - s) * 0.5 * (v * v * v * v - 2);
    },
    easeinquint: (s, e, v) => s + (e - s) * v * v * v * v * v,
    easeoutquint: (s, e, v) => {
      v--;
      return s + (e - s) * (v * v * v * v * v + 1);
    },
    easeinoutquint: (s, e, v) => {
      v /= 0.5;
      if (v < 1) return s + (e - s) * 0.5 * v * v * v * v * v;
      v -= 2;
      return s + (e - s) * 0.5 * (v * v * v * v * v + 2);
    },
    easeinsine: (s, e, v) => s - (e - s) * Math.cos(v * PI * 0.5) + (e - s),
    easeoutsine: (s, e, v) => s + (e - s) * Math.sin(v * PI * 0.5),
    easeinoutsine: (s, e, v) => s - (e - s) * 0.5 * (Math.cos(PI * v) - 1),
    easeinexpo: (s, e, v) => s + (e - s) * Math.pow(2, 10 * (v - 1)),
    easeoutexpo: (s, e, v) => s + (e - s) * (-Math.pow(2, -10 * v) + 1),
    easeinoutexpo: (s, e, v) => {
      v /= 0.5;
      if (v < 1) return s + (e - s) * 0.5 * Math.pow(2, 10 * (v - 1));
      v--;
      return s + (e - s) * 0.5 * (-Math.pow(2, -10 * v) + 2);
    },
    easeincirc: (s, e, v) => s - (e - s) * (Math.sqrt(1 - v * v) - 1),
    easeoutcirc: (s, e, v) => {
      v--;
      return s + (e - s) * Math.sqrt(1 - v * v);
    },
    easeinoutcirc: (s, e, v) => {
      v /= 0.5;
      if (v < 1) return s - (e - s) * 0.5 * (Math.sqrt(1 - v * v) - 1);
      v -= 2;
      return s + (e - s) * 0.5 * (Math.sqrt(1 - v * v) + 1);
    },
    easeinbounce: (s, e, v) => {
      const d = 1;
      return s + (e - s) - fns.easeoutbounce(0, e - s, d - v);
    },
    easeoutbounce: (s, e, v) => {
      v /= 1;
      const d = e - s;
      if (v < 1 / 2.75) return s + d * 7.5625 * v * v;
      else if (v < 2 / 2.75) {
        v -= 1.5 / 2.75;
        return s + d * (7.5625 * v * v + 0.75);
      } else if (v < 2.5 / 2.75) {
        v -= 2.25 / 2.75;
        return s + d * (7.5625 * v * v + 0.9375);
      } else {
        v -= 2.625 / 2.75;
        return s + d * (7.5625 * v * v + 0.984375);
      }
    },
    easeinoutbounce: (s, e, v) => {
      const d = 1;
      if (v < d * 0.5) return fns.easeinbounce(0, e - s, v * 2) * 0.5 + s;
      return fns.easeoutbounce(0, e - s, v * 2 - d) * 0.5 + (e - s) * 0.5 + s;
    },
    easeinback: (s, e, v) => {
      const k = 1.70158;
      return s + (e - s) * v * v * ((k + 1) * v - k);
    },
    easeoutback: (s, e, v) => {
      const k = 1.70158;
      v = v - 1;
      return s + (e - s) * (v * v * ((k + 1) * v + k) + 1);
    },
    easeinoutback: (s, e, v) => {
      let k = 1.70158;
      v /= 0.5;
      if (v < 1) {
        k *= 1.525;
        return s + (e - s) * 0.5 * (v * v * ((k + 1) * v - k));
      }
      v -= 2;
      k *= 1.525;
      return s + (e - s) * 0.5 * (v * v * ((k + 1) * v + k) + 2);
    },
    easeinelastic: (s, e, v) => {
      const d = 1, p = d * 0.3;
      let a = 0;
      if (v === 0) return s;
      if (v / d === 1) return s + (e - s);
      if (a === 0 || a < Math.abs(e - s)) {
        a = e - s;
        var sv = p / 4;
      } else {
        sv = p / (2 * PI) * Math.asin((e - s) / a);
      }
      return -(a * Math.pow(2, 10 * (v -= 1)) * Math.sin((v * d - sv) * (2 * PI) / p)) + s;
    },
    easeoutelastic: (s, e, v) => {
      const d = 1, p = d * 0.3;
      let a = 0;
      if (v === 0) return s;
      if (v / d === 1) return s + (e - s);
      if (a === 0 || a < Math.abs(e - s)) {
        a = e - s;
        var sv = p * 0.25;
      } else {
        sv = p / (2 * PI) * Math.asin((e - s) / a);
      }
      return (a * Math.pow(2, -10 * v) * Math.sin((v * d - sv) * (2 * PI) / p) + (e - s) + s);
    },
    easeinoutelastic: (s, e, v) => {
      const d = 1, p = d * 0.3;
      let a = 0;
      if (v === 0) return s;
      if (v / (d * 0.5) === 2) return s + (e - s);
      if (a === 0 || a < Math.abs(e - s)) {
        a = e - s;
        var sv = p / 4;
      } else {
        sv = p / (2 * PI) * Math.asin((e - s) / a);
      }
      if (v < 1) return -0.5 * (a * Math.pow(2, 10 * (v -= 1)) * Math.sin((v * d - sv) * (2 * PI) / p)) + s;
      return a * Math.pow(2, -10 * (v -= 1)) * Math.sin((v * d - sv) * (2 * PI) / p) * 0.5 + (e - s) + s;
    },
    blink: (s, e, v) => {
      const d = 0.005;
      v = 1 - v;
      if (v >= 1 / 21 - d && v <= 1 / 21 + d) return e;
      if (v >= 3 / 21 - d && v <= 3 / 21 + d) return e;
      if (v >= 6 / 21 - d && v <= 6 / 21 + d) return e;
      if (v >= 10 / 21 - d && v <= 10 / 21 + d) return e;
      if (v >= 15 / 21 - d && v <= 15 / 21 + d) return e;
      return s;
    }
  };

  const aliases = {
    easein: 'easeinquad',
    easeout: 'easeoutquad',
    easeinout: 'easeinoutquad'
  };

  // The dropdown only lists real easing functions. The aliases above are
  // legacy no-ops (they just resolve to the quad variants), so they are kept
  // only for reading old files, never offered as options.
  const EASING_NAMES = Object.keys(fns);

  function resolve(name) {
    if (!name) return fns.linear;
    const key = String(name).toLowerCase();
    const real = aliases[key] || key;
    return fns[real] || fns.linear;
  }

  // Expose both on window and as CommonJS for tests
  const api = { fns, aliases, resolve, EASING_NAMES };
  if (typeof window !== 'undefined') {
    if (!window.SBEngine) window.SBEngine = {};
    window.SBEngine.easing = api;
  }
  if (typeof module !== 'undefined') module.exports = api;
})();
