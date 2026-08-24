// 独立进程窗口（manual.html）的使用手册查看器。
// 主进程把随应用打包的 docx 读成 base64，这里用 docx-preview（纯 JS）渲染。
const $ = (s) => document.querySelector(s);
const $t = (s) => (window.SBi18n ? window.SBi18n.t(s) : s);
const ZOOMS = [0.5, 0.6, 0.75, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2];
let zoomIdx = 4; // 100%
let baseWidth = 0; // zoom=1 时的文档内容宽度（docx-preview 渲染后测量）

// zoom 缩放元素时 Chromium 会把布局宽度按 zoom 放大（used width = width × zoom），
// 所以 width 保持基础宽度即可，不能再乘 zoom（否则双重缩放、页面超出右侧不居中）。
function applyZoom(zoom) {
  const el = $('#docxContainer');
  el.style.zoom = String(zoom);
  el.style.width = (baseWidth || 820) + 'px';
  $('#manualZoomPct').textContent = Math.round(zoom * 100) + '%';
}

function setZoom(z) {
  zoomIdx = Math.max(0, Math.min(ZOOMS.length - 1, z));
  applyZoom(ZOOMS[zoomIdx]);
}

// 章节目录点击跳转：docx 里的目录是纯文本段落（无超链接/bookmark），
// 渲染后按“0X：”编号配对目录条目与正文章节标题，点击平滑滚动到对应章节。
function wireTocJumps(container) {
  const body = $('#manualBody');
  if (!body || !container) return;
  const ps = Array.from(container.querySelectorAll('.docx-wrapper p'));
  const tocHeader = ps.findIndex((p) => (p.textContent || '').trim().startsWith('章节目录'));
  if (tocHeader < 0) return;
  // 章节标题前可能带 ⭐ 等装饰符号（如“⭐04:中央预览画面介绍”），只允许符号/空格类前缀，
  // 避免把正文里“…请参见07：…”这类句子误判成章节标题。
  const numOf = (t) => { const m = t.match(/^[\p{So}\p{Sk}\p{Zs}\p{Cf}]*0(\d)[：:]/u); return m ? Number(m[1]) : null; };
  const isNum = (t) => /^[\p{So}\p{Sk}\p{Zs}\p{Cf}]*0\d[：:]/u.test(t);

  // 收集目录条目：紧跟“章节目录”之后、编号连续不重复的段落（01..07）。
  const entries = [];
  const seen = new Set();
  for (let i = tocHeader + 1; i < ps.length; i++) {
    const t = (ps[i].textContent || '').trim();
    if (!t) continue; // 条目间的空行
    const n = numOf(t);
    if (!isNum(t) || n == null || seen.has(n)) break; // 非目录内容或编号重复 = 正文开始
    seen.add(n);
    entries.push({ el: ps[i], num: n });
  }
  if (!entries.length) return;

  // 目标章节：目录块之后，正文中编号相同、首次出现的段落。
  const afterIdx = ps.indexOf(entries[entries.length - 1].el) + 1;
  const targets = new Map();
  for (let i = afterIdx; i < ps.length; i++) {
    const t = (ps[i].textContent || '').trim();
    const n = numOf(t);
    if (n == null || !isNum(t) || targets.has(n)) continue;
    targets.set(n, ps[i]);
  }

  const scrollToEl = (el) => {
    const bodyRect = body.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    body.scrollTo({ top: Math.max(0, body.scrollTop + elRect.top - bodyRect.top - 14), behavior: 'smooth' });
    el.classList.add('toc-target-flash');
    setTimeout(() => el.classList.remove('toc-target-flash'), 1400);
  };

  let wired = 0;
  for (const { el, num } of entries) {
    const target = targets.get(num);
    if (!target) continue;
    el.classList.add('toc-jump');
    el.title = $t('点击跳转到本章');
    el.addEventListener('click', () => scrollToEl(target));
    wired++;
  }
  container.dataset.tocWired = String(wired);
  container.dataset.tocEntries = String(entries.length);
  container.dataset.tocTargets = String(targets.size);
}

async function loadManual() {
  const body = $('#manualBody');
  const container = $('#docxContainer');
  const status = $('#manualStatus');
  let res;
  try {
    res = await window.sbAPI.readManual();
  } catch (e) {
    status.textContent = $t('读取手册失败：') + (e && e.message ? e.message : e);
    return;
  }
  if (!res || !res.data) {
    status.textContent = $t('读取手册失败：文档为空');
    return;
  }
  status.textContent = $t('正在渲染…');
  try {
    // base64 → ArrayBuffer（docx-preview 需要 Blob/ArrayBuffer）
    const bin = atob(res.data);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    // docx-preview 不渲染 DrawingML 文本框，先摊平成带边框表格再渲染。
    const flattened = await window.flattenManualTextboxes(blob);
    await window.docx.renderAsync(flattened, container, null, {
      inWrapper: true,
      ignoreLastRenderedPageBreak: true,
      renderFootnotes: true,
      renderEndnotes: true,
      renderChanges: true
    });
    const docxEl = container.querySelector('.docx-wrapper > .docx') || container.querySelector('.docx-wrapper');
    baseWidth = docxEl ? docxEl.offsetWidth : 820;
    setZoom(4);
    wireTocJumps(container);
    status.textContent = '';
  } catch (e) {
    status.textContent = $t('渲染失败：') + (e && e.message ? e.message : e);
  }
}

$('#btnZoomOut').addEventListener('click', () => setZoom(zoomIdx - 1));
$('#btnZoomIn').addEventListener('click', () => setZoom(zoomIdx + 1));
$('#btnZoom100').addEventListener('click', () => setZoom(4));
$('#btnZoomFit').addEventListener('click', () => {
  if (!baseWidth) return;
  const avail = $('#manualBody').clientWidth - 48;
  const z = Math.max(0.3, Math.min(2.5, avail / baseWidth));
  // 找最接近的档位（超出范围时用精确值）
  const exact = Math.round(z * 100);
  zoomIdx = ZOOMS.length - 1;
  for (let i = 0; i < ZOOMS.length; i++) {
    if (Math.round(ZOOMS[i] * 100) <= exact) zoomIdx = i;
  }
  const zoom = Math.round(ZOOMS[zoomIdx] * 100) === exact ? ZOOMS[zoomIdx] : z;
  applyZoom(zoom);
});

// 语言初始化：读取设置里的语言并翻译窗口静态文本。
(async () => {
  try {
    const s = await window.sbAPI.getSettings();
    if (window.SBi18n) {
      window.SBi18n.setLanguage((s && s.language) || 'zh-CN', false);
      window.SBi18n.applyStatic(document);
    }
  } catch (e) {}
})();

loadManual();
