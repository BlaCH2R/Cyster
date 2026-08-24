from PIL import Image
import numpy as np
img = Image.open(r"C:\Users\Bc\Pictures\note样式解析.jpg").convert('RGB')
a = np.asarray(img).astype(int)
h, w, _ = a.shape
print("size", w, h)
# find colored regions (note icons)
mx = a.max(axis=2); mn = a.min(axis=2)
sat = (mx-mn) > 60
# connected components on downsampled
import numpy as np
from collections import deque
small = sat[::4, ::4]
H, W = small.shape
comp = np.zeros((H,W), dtype=int)
label = 0
for y in range(H):
    for x in range(W):
        if small[y,x] and comp[y,x]==0:
            label += 1
            q = deque([(y,x)]); comp[y,x]=label
            while q:
                yy,xx = q.popleft()
                for dy in (-1,0,1):
                    for dx in (-1,0,1):
                        ny,nx = yy+dy, xx+dx
                        if 0<=ny<H and 0<=nx<W and small[ny,nx] and comp[ny,nx]==0:
                            comp[ny,nx]=label; q.append((ny,nx))
sizes = np.bincount(comp.ravel())
big = [i for i in range(1,label+1) if sizes[i]>=25]
print("colored blobs:", len(big))
for lb in sorted(big, key=lambda i: -sizes[i])[:30]:
    ys,xs = np.where(comp==lb)
    y0,y1,x0,x1 = ys.min()*4, ys.max()*4, xs.min()*4, xs.max()*4
    # dominant color
    region = a[y0:y1+1, x0:x1+1]
    rr,gg,bb = region[...,0].mean(), region[...,1].mean(), region[...,2].mean()
    print(f"blob {lb}: x {x0}-{x1} y {y0}-{y1} size {(x1-x0)}x{(y1-y0)} mean rgb ({rr:.0f},{gg:.0f},{bb:.0f})")
