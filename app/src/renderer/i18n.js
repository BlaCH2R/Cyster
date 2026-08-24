// 国际化核心：语言设置（简体/繁体/英文）。
// - 繁体：用 OpenCC（vendor/opencc.js，s2twp）运行时转换，全量覆盖且带台湾用词；
// - 英文：查 i18n_dict.js 词典，未收录词条回退简体中文；
// - 简体：源串原样。
(function () {
  'use strict';

  const EN = Object.assign({}, window.CYSTER_I18N_EN || {}, window.CYSTER_MANUAL_EN || {});
  let lang = 'zh-CN';
  let twConv = null;
  try {
    twConv = window.OpenCC && window.OpenCC.Converter({ from: 'cn', to: 'twp' });
  } catch (e) {
    twConv = null;
  }

  function t(str) {
    if (str == null || typeof str !== 'string') return str;
    if (lang === 'zh-TW') {
      try { return twConv ? twConv(str) : str; } catch (e) { return str; }
    }
    if (lang === 'en') return EN[str] != null ? EN[str] : str;
    return str;
  }

  // 语言括号样式：中文用全角，英文用半角。
  function paren(str) {
    return lang === 'en' ? '(' + str + ')' : '（' + str + '）';
  }

  function setLanguage(l, persist) {
    lang = l === 'zh-TW' || l === 'en' ? l : 'zh-CN';
    try {
      document.documentElement.lang = lang === 'zh-TW' ? 'zh-Hant' : lang === 'en' ? 'en' : 'zh-CN';
    } catch (e) {}
    if (persist !== false && window.sbAPI) {
      window.sbAPI.getSettings().then((s) => {
        s = s || {};
        s.language = lang;
        window.sbAPI.setSettings(s).catch(() => {});
      }).catch(() => {});
    }
  }

  function getLanguage() { return lang; }

  // 静态 DOM：[data-i18n] 元素；[data-i18n-attr] 指定要更新的属性名（如 title）。
  function applyStatic(root) {
    const scope = root || document;
    scope.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      const val = t(key);
      if (val == null) return;
      const attr = el.getAttribute('data-i18n-attr');
      if (attr) el.setAttribute(attr, val);
      else el.textContent = val;
    });
  }

  // 本地化属性面板 schema 标签（在 schema.js 加载后调用；切换语言时再次调用）。
  function localizeSchema() {
    const Schema = window.SBSchema;
    if (!Schema || !Schema.SCHEMAS) return;
    const walkFields = (fields) => {
      for (const f of fields || []) {
        if (!f) continue;
        for (const key of ['label', 'placeholder', 'tip']) {
          if (f[key]) {
            const srcKey = '_i18n' + key;
            if (f[srcKey] == null) f[srcKey] = f[key];
            f[key] = t(f[srcKey]);
          }
        }
        if (Array.isArray(f.options)) {
          for (const o of f.options) {
            if (o && o.label) {
              if (o._i18nSrc == null) o._i18nSrc = o.label;
              o.label = t(o._i18nSrc);
            }
          }
        }
      }
    };
    for (const type of Object.keys(Schema.SCHEMAS)) {
      const s = Schema.SCHEMAS[type];
      if (!s) continue;
      if (s.label) {
        if (s._i18nSrc == null) s._i18nSrc = s.label;
        s.label = t(s._i18nSrc);
      }
      walkFields(s.fields);
    }
    for (const c of Schema.CONTROLLER_CARDS || []) {
      if (!c) continue;
      if (c.label) {
        if (c._i18nSrc == null) c._i18nSrc = c.label;
        c.label = t(c._i18nSrc);
      }
      walkFields(c.fields);
    }
  }

  window.SBi18n = { t, paren, setLanguage, getLanguage, applyStatic, localizeSchema };
})();
