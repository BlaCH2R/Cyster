# -*- coding: utf-8 -*-
# Structural QA for the edited manual: original paragraphs must be unchanged
# (same text, same order), new sections must exist with Heading 5 titles,
# warning callouts must be 黑体 + red prefix, and the doc must reopen cleanly.
import docx, io

SRC = 'Cyster使用手册(ver.0.1beta) - 副本.docx'
d = docx.Document(SRC)
paras = [p for p in d.paragraphs]
out = []

# 1) 原 84 个非空段落（保存前 dump 的索引顺序）应与之前一致
orig = io.open('tools/manual_dump.txt', encoding='utf-8').read()
import re
orig_texts = [l.split(') ', 1)[1] for l in orig.splitlines()
              if l.startswith('[') and not l.startswith('PARAS')]
new_nonempty = [p.text.strip() for p in paras if p.text.strip()]
prefix_ok = new_nonempty[:len(orig_texts)] == orig_texts
out.append('original_prefix_intact=%s' % prefix_ok)
out.append('original_count=%d new_count=%d' % (len(orig_texts), len(new_nonempty)))

# 2) 新章节标题样式
secs = [p for p in paras if p.text.strip().startswith(('06：', '07：', '08：'))]
out.append('sections=%s' % [(p.text, p.style.name) for p in secs])

# 3) 警告段落样式：前缀红色加粗黑体
headings = [p.text for p in secs]
start = min(paras.index(p) for p in secs)
added = paras[start:]
warn_count = 0
for p in added:
    if p.text.startswith('❗请注意：'):
        warn_count += 1
        r0 = p.runs[0]
        r1 = p.runs[1] if len(p.runs) > 1 else None
        east = None
        if r1 is not None and r1.font.element.rPr is not None and \
                r1.font.element.rPr.rFonts is not None:
            east = r1.font.element.rPr.rFonts.get(
                '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}eastAsia')
        color = None
        try:
            color = str(r0.font.color.rgb)
        except Exception:
            pass
        out.append('warn: prefix=%r bold=%s red=%s bodyFont=%s' %
                   (r0.text, r0.bold, color, east))
out.append('warn_count=%d' % warn_count)

# 4) 正文段落样式均为 Normal
bad = [p.text[:20] for p in added if p.style.name != 'Normal' and not p.text.startswith('0')]
out.append('non_normal_in_added=%s' % bad)

with io.open('tools/verify_manual_report.txt', 'w', encoding='utf-8') as fh:
    fh.write('\n'.join(out))
print('verify done')
