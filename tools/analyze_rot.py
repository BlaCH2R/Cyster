import sys
from PIL import Image

def blobs(path, scale_to=None):
    img = Image.open(path).convert('RGB')
    if scale_to:
        img = img.resize(scale_to, Image.LANCZOS)
    w, h = img.size
    px = img.load()
    mask = [[False] * w for _ in range(h)]
    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y]
            mask[y][x] = r > 130 and g < 100 and b < 100
    # Dilate 8px so the white diagonal doesn't split the square into halves.
    dil = [[False] * w for _ in range(h)]
    for y in range(h):
        for x in range(w):
            if mask[y][x]:
                for dy in range(-8, 9):
                    for dx in range(-8, 9):
                        if dx * dx + dy * dy > 64: continue
                        ny, nx = y + dy, x + dx
                        if 0 <= ny < h and 0 <= nx < w:
                            dil[ny][nx] = True
    mask = dil
    seen = [[False] * w for _ in range(h)]
    out = []
    for y in range(h):
        for x in range(w):
            if mask[y][x] and not seen[y][x]:
                stack = [(x, y)]
                seen[y][x] = True
                xs, ys = [], []
                while stack:
                    cx, cy = stack.pop()
                    xs.append(cx); ys.append(cy)
                    for dx, dy in ((1,0),(-1,0),(0,1),(0,-1)):
                        nx, ny = cx+dx, cy+dy
                        if 0 <= nx < w and 0 <= ny < h and mask[ny][nx] and not seen[ny][nx]:
                            seen[ny][nx] = True
                            stack.append((nx, ny))
                if len(xs) > 60:
                    x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
                    # blue dot within bbox
                    bxs, bys = [], []
                    for yy in range(y0, y1 + 1):
                        for xx in range(x0, x1 + 1):
                            r, g, b = px[xx, yy]
                            if b > 150 and r < 100 and g < 140:
                                bxs.append(xx); bys.append(yy)
                    cx = (x0 + x1) / 2.0
                    cy = (y0 + y1) / 2.0
                    blue = None
                    if bxs:
                        blue = (round(sum(bxs)/len(bxs) - cx, 1), round(sum(bys)/len(bys) - cy, 1))
                    out.append({
                        'n': len(xs), 'cx': round(cx, 1), 'cy': round(cy, 1),
                        'w': x1 - x0 + 1, 'h': y1 - y0 + 1, 'blue': blue
                    })
    out.sort(key=lambda b: (b['cy'], b['cx']))
    return out

a = blobs(sys.argv[1])
target = Image.open(sys.argv[1]).size
b = blobs(sys.argv[2], scale_to=target)
print('SELF blobs:', len(a), ' ENGINE blobs:', len(b))
used = set()
print('matched by nearest position (engine y has ~+18 offset):')
for s in a:
    best = None
    bd = 1e9
    for i, e in enumerate(b):
        if i in used: continue
        d = (e['cx'] - s['cx']) ** 2 + (e['cy'] - s['cy'] - 18) ** 2
        if d < bd:
            bd = d; best = i
    if best is None: continue
    used.add(best)
    e = b[best]
    print('SELF', s['cx'], s['cy'], 'w/h', str(s['w'])+'/'+str(s['h']), 'blue', s['blue'],
          '| ENGINE', e['cx'], e['cy'], 'w/h', str(e['w'])+'/'+str(e['h']), 'blue', e['blue'],
          '| dW/H', s['w']-e['w'], s['h']-e['h'])
