import os, glob, tempfile, re

d = None
for cand in glob.glob(os.path.join(tempfile.gettempdir(), "cytoid_style_*")):
    if os.path.exists(os.path.join(cand, "level.json")):
        d = cand
        break
print("dir:", d)
lvl = open(os.path.join(d, "level.json"), encoding="utf8").read()
m = re.search(r'"storyboard"\s*:\s*\{\s*"path"\s*:\s*"([^"]+)"', lvl)
print("storyboard path:", m.group(1) if m else None)
if m:
    p = os.path.join(d, m.group(1))
    txt = open(p, encoding="utf8").read()
    print(txt[:4000])
