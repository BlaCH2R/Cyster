import sys
from PIL import Image

def blobs(path, scale_to=None):
    img = Image.open(path).convert('RGB')
    if scale_to:
        img = img.resize(scale_to, Image.LANCZOS)
    w, h = img.size
    px = img.load()
    # red-ish mask (sprite red 220,40,40; ignore UI reds by strict threshold)
    mask = [[False] * w for _ in range(h)]
    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y]
            mask[y][x] = r > 150 and g < 100 and b < 100
    # flood fill blobs
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
                if len(xs) > 30:
                    out.append({
                        'n': len(xs),
                        'cx': round(sum(xs)/len(xs), 1),
                        'cy': round(sum(ys)/len(ys), 1),
                        'x0': min(xs), 'x1': max(xs), 'y0': min(ys), 'y1': max(ys)
                    })
    out.sort(key=lambda b: (b['cy'], b['cx']))
    return out

a = blobs(sys.argv[1])
target = Image.open(sys.argv[1]).size
b = blobs(sys.argv[2], scale_to=target)
print('SELF blobs:', len(a))
for x in a: print('  ', x)
print('ENGINE blobs:', len(b))
for x in b: print('  ', x)
