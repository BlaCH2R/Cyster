from PIL import Image
import numpy as np

img = Image.open(r"C:\Users\Bc\AppData\Local\Temp\codex-clipboard-7a3fffcf-7938-4921-9668-45fcfee1f765.png").convert('RGB')
W, H = img.size
a = np.asarray(img).astype(int)
r, g, b = a[..., 0], a[..., 1], a[..., 2]
print("image size", W, H)

# Red circle pixels
red = (r > 170) & (g < 100) & (b < 100)
ys, xs = np.where(red)
# cluster by x
order = np.argsort(xs)
xs = xs[order]; ys = ys[order]
clusters = []
start = 0
for i in range(1, len(xs)):
    if xs[i] - xs[i-1] > 80:
        clusters.append((start, i-1))
        start = i
clusters.append((start, len(xs)-1))
print("\nred circle clusters:")
for (i0, i1) in clusters:
    cx = xs[i0:i1+1].mean(); cy = ys[i0:i1+1].mean()
    print(f"  center=({cx:.0f},{cy:.0f}) x[{xs[i0:i1+1].min()}..{xs[i0:i1+1].max()}] y[{ys[i0:i1+1].min()}..{ys[i0:i1+1].max()}] n={i1-i0+1}")

# Detect toolbar button background. Look at row y=54 (button row) and find columns
# where pixel is not background (27,32,39)-ish and not red, then group into buttons.
row = a[54]
bg = (abs(row[:,0]-27)<6) & (abs(row[:,1]-32)<6) & (abs(row[:,2]-39)<8)
isred = (row[:,0]>170) & (row[:,1]<100) & (row[:,2]<100)
mask = (~bg) & (~isred)
runs = []
inrun = False
for x in range(W):
    if mask[x] and not inrun:
        s = x; inrun = True
    elif not mask[x] and inrun:
        runs.append((s, x-1)); inrun = False
if inrun: runs.append((s, W-1))
# merge runs with gap < 6
merged = []
for s, e in runs:
    if merged and s - merged[-1][1] <= 6:
        merged[-1] = (merged[-1][0], e)
    else:
        merged.append((s, e))
print("\nrow-54 content runs (likely buttons):")
for s, e in merged:
    print(f"  x[{s}..{e}] center={(s+e)//2} width={e-s+1}")

# Find vertical extent of each run's button (search rows 40..70 for same x-range non-bg pixels)
print("\nbutton vertical extents:")
for s, e in merged:
    sel = a[40:75, s:e+1]
    rr, gg, bb = sel[...,0], sel[...,1], sel[...,2]
    nonbg = ~((abs(rr-27)<6)&(abs(gg-32)<6)&(abs(bb-39)<8))
    ys2, xs2 = np.where(nonbg)
    if len(ys2):
        print(f"  x[{s}..{e}] y[{40+ys2.min()}..{40+ys2.max()}]")
