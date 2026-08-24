// Tolerant JSON parser: strips // and /* */ comments and trailing commas,
// as found in hand-written StoryBoard JSON files (Cytoid wiki style).
(() => {
  function stripComments(src) {
    let out = '';
    let i = 0;
    let inString = false;
    let quote = '';
    while (i < src.length) {
      const c = src[i];
      const n = src[i + 1];
      if (inString) {
        out += c;
        if (c === '\\') {
          out += n || '';
          i += 2;
          continue;
        }
        if (c === quote) inString = false;
        i++;
        continue;
      }
      if (c === '"' || c === "'") {
        inString = true;
        quote = c;
        out += c;
        i++;
        continue;
      }
      if (c === '/' && n === '/') {
        while (i < src.length && src[i] !== '\n') i++;
        continue;
      }
      if (c === '/' && n === '*') {
        i += 2;
        while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i++;
        i += 2;
        continue;
      }
      out += c;
      i++;
    }
    return out;
  }

  function stripTrailingCommas(src) {
    return src.replace(/,\s*([}\]])/g, '$1');
  }

  function parse(src) {
    if (src == null) return null;
    if (typeof src !== 'string') return src;
    let cleaned = stripComments(src);
    cleaned = stripTrailingCommas(cleaned);
    return JSON.parse(cleaned);
  }

  const api = { parse, stripComments, stripTrailingCommas };
  if (typeof window !== 'undefined') {
    if (!window.SBEngine) window.SBEngine = {};
    window.SBEngine.json = api;
  }
  if (typeof module !== 'undefined') module.exports = api;
})();
