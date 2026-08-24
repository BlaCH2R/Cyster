// 渲染前预处理：docx-preview 不渲染 DrawingML 文本框（wps:txbx），只渲染
// VML 文本框（v:textbox）。这里把 wps:txbx 摊平成「带边框的单格表格」，
// 恢复文本框内的文字与方框外观，再交给 docx-preview。
// 用法：const out = await flattenManualTextboxes(arrayBuffer|blob|uint8array)
window.flattenManualTextboxes = (function () {
  'use strict';

  const RUN_RE = /<w:r(?:\s[^>]*)?>[\s\S]*?<\/w:r>/g;
  const MEANINGFUL_RUN = /<(?:w:t|w:tab|w:br|w:cr|w:drawing|w:pict|w:object|w:fldChar|w:instrText)\b/;
  const WRAPPERS = ['<mc:AlternateContent', '<w:drawing', '<w:pict'];

  // 包含 [txStart, txEnd) 的段落。w:p 会嵌套在 txbxContent 内，必须用栈配对
  // 开/闭标签，而不是正则非贪婪匹配（会错误地停在文本框内层段落的 </w:p>）。
  function enclosingParagraph(xml, txStart, txEnd) {
    const OPEN = /<w:p(?:\s[^>]*)?>/g;
    const CLOSE = /<\/w:p>/g;
    const events = [];
    let m;
    OPEN.lastIndex = 0;
    while ((m = OPEN.exec(xml)) !== null) events.push({ pos: m.index, open: true });
    CLOSE.lastIndex = 0;
    while ((m = CLOSE.exec(xml)) !== null) events.push({ pos: m.index, open: false });
    events.sort((a, b) => a.pos - b.pos);
    const stack = [];
    for (const ev of events) {
      if (ev.open) {
        stack.push(ev.pos);
        continue;
      }
      if (!stack.length) continue;
      const top = stack.pop();
      if (ev.pos > txEnd && top < txStart) {
        return { index: top, end: ev.pos };
      }
    }
    return null;
  }

  // 包含文本框的外层元素（mc:AlternateContent / w:drawing / w:pict）跨度。
  // 优先取最外层（开标签最早且能完整包住文本框的），这样 AlternateContent
  // 连同其 Fallback 一起移除，不会残留空壳。
  function wrapperSpan(xml, txStart, txEnd) {
    let best = null;
    for (const open of WRAPPERS) {
      const close = open.replace('<', '</');
      let s = xml.lastIndexOf(open, txStart);
      while (s >= 0) {
        const e = xml.indexOf(close, s);
        if (e >= 0 && e + close.length > txEnd) {
          if (!best || s < best.s) best = { s, e: e + close.length };
          break;
        }
        s = xml.lastIndexOf(open, s - 1);
      }
    }
    return best;
  }

  // 包住 wrapper 的 <w:r> run 跨度（文本框的 drawing 通常独占一个 run）。
  function runSpan(xml, wrap) {
    const OPEN = /<w:r(?:\s[^>]*)?>/g;
    const CLOSE = /<\/w:r>/g;
    let m, lastOpen = null;
    OPEN.lastIndex = 0;
    while ((m = OPEN.exec(xml)) !== null) {
      if (m.index >= wrap.s) break;
      lastOpen = m;
    }
    if (!lastOpen) return null;
    // 配对扫描：跳过 wrapper 内部（txbxContent 内层 run）的开/闭，找出外层 run 自己的闭合。
    const ev = [];
    let mm;
    OPEN.lastIndex = lastOpen.index + 1;
    while ((mm = OPEN.exec(xml)) !== null) ev.push({ pos: mm.index, open: true });
    CLOSE.lastIndex = lastOpen.index + 1;
    while ((mm = CLOSE.exec(xml)) !== null) ev.push({ pos: mm.index, open: false });
    ev.sort((a, b) => a.pos - b.pos);
    let depth = 0;
    for (const e of ev) {
      if (e.open) depth++;
      else if (depth === 0) {
        if (e.pos <= wrap.e) return null; // 该 run 不包含 wrapper
        return {
          open: lastOpen.index,
          openEnd: lastOpen.index + lastOpen[0].length,
          close: e.pos,
          closeEnd: e.pos + '</w:r>'.length,
          openTag: lastOpen[0]
        };
      } else depth--;
    }
    return null;
  }

  function buildBorderedTable(innerPs) {
    const borders = ['top', 'left', 'bottom', 'right']
      .map((s) => `<w:${s} w:val="single" w:sz="4" w:space="0" w:color="000000"/>`).join('');
    const cellMar = ['top', 'left', 'bottom', 'right']
      .map((s) => `<w:${s} w:w="108" w:type="dxa"/>`).join('');
    return '<w:tbl>' +
      '<w:tblPr>' +
      '<w:tblW w:w="0" w:type="auto"/>' +
      '<w:tblBorders>' + borders + '</w:tblBorders>' +
      '<w:tblCellMar>' + cellMar + '</w:tblCellMar>' +
      '</w:tblPr>' +
      '<w:tblGrid><w:gridCol w:w="9600"/></w:tblGrid>' +
      '<w:tr><w:tc>' +
      '<w:tcPr><w:tcW w:w="9600" w:type="dxa"/>' +
      '<w:shd w:val="clear" w:color="auto" w:fill="FFFFFF"/></w:tcPr>' +
      innerPs +
      '</w:tc></w:tr>' +
      '</w:tbl>';
  }

  // 去掉不含文字/图形的空 run（文本框所在段落里通常只有这种占位 run）。
  function stripEmptyRuns(seg) {
    RUN_RE.lastIndex = 0;
    return seg.replace(RUN_RE, (run) => (MEANINGFUL_RUN.test(run) ? run : ''));
  }

  function meaningful(seg) {
    return Boolean(seg.replace(/<[^>]+>/g, '').trim()) ||
      /<(?:w:t|w:tab|w:br|w:cr|w:drawing|w:pict|w:object|w:fldChar|w:instrText)\b/.test(seg);
  }

  // 找下一个 DrawingML 文本框（VML 文本框 docx-preview 原生渲染，跳过）。
  function nextDrawingmlTextbox(xml) {
    const txClose = '</w:txbxContent>';
    let idx = 0;
    while (idx < xml.length) {
      const txStart = xml.indexOf('<w:txbxContent', idx);
      if (txStart < 0) return null;
      const openEnd = xml.indexOf('>', txStart) + 1;
      const txEnd = xml.indexOf(txClose, openEnd);
      if (txEnd < 0) return null;
      const txEndPos = txEnd + txClose.length;
      const wrap = wrapperSpan(xml, txStart, txEndPos);
      if (!wrap) return null;
      if (xml.slice(wrap.s, wrap.s + '<w:pict'.length) === '<w:pict') {
        idx = txEndPos; // VML：跳过，不摊平
        continue;
      }
      return { txStart, openEnd, txEnd, txEndPos, wrap };
    }
    return null;
  }

  function flattenXml(xml) {
    let guard = 0;
    let tb;
    while ((tb = nextDrawingmlTextbox(xml)) && guard++ < 300) {
      const { txStart, openEnd, txEnd, txEndPos, wrap } = tb;
      const p = enclosingParagraph(xml, txStart, txEndPos);
      if (!p) break;
      const innerPs = xml.slice(openEnd, txEnd);
      const pEnd = p.end + '</w:p>'.length;
      let prefix = xml.slice(p.index, wrap.s);
      let suffix = xml.slice(wrap.e, pEnd);
      const run = runSpan(xml, wrap);
      if (run) {
        const runBefore = xml.slice(run.openEnd, wrap.s);
        const runAfter = xml.slice(wrap.e, run.close);
        const rb = meaningful(runBefore);
        const ra = meaningful(runAfter);
        if (!rb && !ra) {
          // run 里只有文本框 drawing：整个去掉
          prefix = xml.slice(p.index, run.open);
          suffix = xml.slice(run.closeEnd, pEnd);
        } else {
          // run 里还有别的文字：保留拆分后的 run
          prefix = xml.slice(p.index, run.open) + (rb ? run.openTag + runBefore + '</w:r>' : '');
          suffix = (ra ? run.openTag + runAfter + '</w:r>' : '') + xml.slice(run.closeEnd, pEnd);
        }
      }
      prefix = stripEmptyRuns(prefix);
      suffix = stripEmptyRuns(suffix);
      const pOpen = xml.slice(p.index, xml.indexOf('>', p.index) + 1);
      const table = buildBorderedTable(innerPs);
      let repl = table;
      if (meaningful(prefix)) repl = pOpen + prefix + '</w:p>' + repl;
      if (meaningful(suffix)) repl = repl + pOpen + suffix + '</w:p>';
      xml = xml.slice(0, p.index) + repl + xml.slice(pEnd);
    }
    return xml;
  }

  return async function flattenManualTextboxes(input) {
    const zip = await window.JSZip.loadAsync(input);
    const parts = Object.keys(zip.files).filter((f) => /^word\/.*\.xml$/.test(f));
    for (const name of parts) {
      let xml = await zip.file(name).async('string');
      // docx-preview 不渲染 w14 3D 特效（描边/阴影/发光）：白色文字+黑色描边的
      // ★ 会白底白字直接隐形。把「白色 run 里的 ★」换成 emoji 星星 ⭐ 补可见性；
      // 其余红/蓝/黑等彩色星标保持原样。
      xml = xml.replace(
        /(<w:r>[\s\S]*?<w:color\b[^>]*w:val="FFFFFF"[^>]*\/>[\s\S]*?<w:t(?:\s[^>]*)?>)★(<\/w:t>[\s\S]*?<\/w:r>)/g,
        '$1⭐$2');
      if (!xml.includes('<w:txbxContent')) {
        zip.file(name, xml);
        continue;
      }
      zip.file(name, flattenXml(xml));
    }
    return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
  };
})();
