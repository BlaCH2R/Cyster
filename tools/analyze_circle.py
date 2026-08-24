from PIL import Image
import numpy as np
img = Image.open(r"C:\Users\Bc\AppData\Local\Temp\codex-clipboard-7a3fffcf-7938-4921-9668-45fcfee1f765.png").convert('RGB')
a = np.asarray(img).astype(int)
r,g,b = a[...,0],a[...,1],a[...,2]
red = (r>170)&(g<90)&(b<90)
ys,xs = np.where(red)
# cluster by x-gaps
xs_sorted = xs[np.argsort(xs)]
clusters = []
start = xs_sorted[0]; prev = start
for x in xs_sorted[1:]:
    if x - prev > 60:
        clusters.append((start, prev)); start = x
    prev = x
clusters.append((start, prev))
print("x clusters:", clusters)
for (x0,x1) in clusters:
    sel = (xs>=x0)&(xs<=x1)
    cxs = xs[sel]; cys = ys[sel]
    print("cluster", x0, x1, "red count", len(cxs), "center", (cxs.mean().round(0), cys.mean().round(0)), "bbox y", cys.min(), cys.max())
