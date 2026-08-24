import docx, io

d = docx.Document('Cyster使用手册(ver.0.1beta) - 副本.docx')
W = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
out = []

def runinfo(r):
    f = r.font
    east = None
    if f.element.rPr is not None and f.element.rPr.rFonts is not None:
        east = f.element.rPr.rFonts.get(W + 'eastAsia')
    color = None
    try:
        if f.color is not None and f.color.type is not None:
            color = str(f.color.rgb)
    except Exception:
        pass
    return (r.text[:24], f.name, east, f.size.pt if f.size else None, f.bold, color)

for idx in (1, 5, 28, 29, 45, 47, 122, 126):
    p = d.paragraphs[idx]
    pf = p.paragraph_format
    out.append('--- para[%d] style=%s align=%s ---' % (idx, p.style.name, p.alignment))
    out.append('    before=%s after=%s line=%s' % (pf.space_before, pf.space_after, pf.line_spacing))
    for r in p.runs[:5]:
        out.append('    run %r' % (runinfo(r),))

for sname in ('Normal', 'Heading 5', 'Heading 1'):
    try:
        st = d.styles[sname]
        f = st.font
        color = None
        try:
            if f.color is not None and f.color.type is not None:
                color = str(f.color.rgb)
        except Exception:
            pass
        out.append('STYLE %s: font=%s size=%s bold=%s color=%s' % (sname, f.name,
                   f.size.pt if f.size else None, f.bold, color))
        rpr = st.element.find('.//' + W + 'rFonts')
        if rpr is not None:
            out.append('  rFonts ascii=%s eastAsia=%s' % (rpr.get(W + 'ascii'), rpr.get(W + 'eastAsia')))
    except KeyError:
        out.append('STYLE %s: missing' % sname)

with io.open('tools/manual_styles.txt', 'w', encoding='utf-8') as fh:
    fh.write('\n'.join(out))
print('ok')
