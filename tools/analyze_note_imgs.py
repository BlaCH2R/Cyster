from PIL import Image
import numpy as np, os

def analyze(path):
    img = Image.open(path).convert('RGB')
    W, H = img.size
    a = np.asarray(img).astype(int)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    print(f"\n===== {os.path.basename(path)} {W}x{H} =====")
    # Dominant colors (quantized 24)
    q = (a // 24 * 24)
    flat = q.reshape(-1, 3)
    uniq, counts = np.unique(flat, axis=0, return_counts=True)
    order = np.argsort(-counts)[:14]
    print("top colors:")
    for i in order:
        c = uniq[i]
        frac = counts[i] / len(flat)
        if frac > 0.004:
            print(f"  rgb{tuple(c)}  {frac*100:.1f}%")
    # saturated note mask: colorful or bright
    mx = a.max(axis=2)
    mn = a.min(axis=2)
    sat_mask = (mx - mn) > 55
    bright_mask = mx > 205
    mask = sat_mask | bright_mask
    # connected components (8-conn) via simple flood fill on downscaled
    scale = max(1, W // 640)
    small = Image.fromarray((mask[::scale, ::scale] * 255).astype('uint8'))
    comp = np.zeros(small.size[::-1], dtype=int)
    label = 0
    from collections import deque
    sm = np.asarray(small) > 128
    h, w = sm.shape
    for y in range(h):
        for x in range(w):
            if sm[y, x] and comp[y, x] == 0:
                label += 1
                qq = deque([(y, x)])
                comp[y, x] = label
                while qq:
                    yy, xx = qq.popleft()
                    for dy in (-1, 0, 1):
                        for dx in (-1, 0, 1):
                            ny, nx = yy + dy, xx + dx
                            if 0 <= ny < h and 0 <= nx < w and sm[ny, nx] and comp[ny, nx] == 0:
                                comp[ny, nx] = label
                                qq.append((ny, nx))
    sizes = np.bincount(comp.ravel())
    big = [i for i in range(1, label + 1) if sizes[i] >= 60]
    print("blobs (scaled x{}):".format(scale))
    for lb in sorted(big, key=lambda i: -sizes[i])[:18]:
        ys, xs = np.where(comp == lb)
        y0, y1, x0, x1 = ys.min(), ys.max(), xs.min(), xs.max()
        bh, bw = (y1 - y0 + 1) * scale, (x1 - x0 + 1) * scale
        if bw < 12 or bh < 12:
            continue
        cy, cx = int(ys.mean()) * scale, int(xs.mean()) * scale
        # sample colors: center (fill) and ring (edge)
        cc = a[cy, cx]
        edge = a[min(H - 1, cy + bh // 2), min(W - 1, cx)]
        # mean color of blob
        mean = a[comp == lb].mean(axis=0).astype(int)
        print(f"  blob#{lb} c=({cx},{cy}) size={bw}x{bh} center=rgb{tuple(cc)} ring~rgb{tuple(edge)} mean=rgb{tuple(mean)}")
    # scanline: rows with > 45% bright pixels
    row_bright = (bright_mask.sum(axis=1) / W)
    for y in np.where(row_bright > 0.5)[0][::max(1, len(np.where(row_bright > 0.5)[0]) // 8)][:8]:
        print(f"  bright row y={y}: {row_bright[y]*100:.0f}%")

for i in range(1, 8):
    p = rf"C:\Users\Bc\Pictures\{i}.jpg"
    if os.path.exists(p):
        analyze(p)
