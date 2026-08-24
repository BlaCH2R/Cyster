from PIL import Image
import numpy as np
for p in [r"C:\Users\Bc\AppData\Local\Temp\codex-clipboard-7a3fffcf-7938-4921-9668-45fcfee1f765.png", r"C:\Users\Bc\Pictures\note样式解析.jpg"]:
    img = Image.open(p).convert('RGB')
    a = np.asarray(img).astype(int)
    r,g,b = a[...,0],a[...,1],a[...,2]
    print(p, img.size)
    # red-ish pixels
    red = (r>170)&(g<90)&(b<90)
    print("red px:", int(red.sum()))
    ys,xs = np.where(red)
    if len(xs):
        print("red bbox x", xs.min(), xs.max(), "y", ys.min(), ys.max())
    print("mean rgb:", r.mean().round(0), g.mean().round(0), b.mean().round(0))
