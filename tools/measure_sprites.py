import sys
from PIL import Image

# Sprite centers in self-canvas coordinates (974x546)
CENTERS = {
    's_rz': (219, 164), 's_rx': (487, 164), 's_ry': (755, 164),
    's_xy': (219, 382), 's_yx': (487, 382), 's_xyz': (755, 382)
}

def measure(path, resize_to=None):
    img = Image.open(path).convert('RGB')
    if resize_to:
        img = img.resize(resize_to, Image.LANCZOS)
    w, h = img.size
    px = img.load()
    out = {}
    for name, (cx, cy) in CENTERS.items():
        xs, ys = [], []
        for y in range(max(0, cy - 90), min(h, cy + 90)):
            for x in range(max(0, cx - 90), min(w, cx + 90)):
                r, g, b = px[x, y]
                if r > 150 and g < 100 and b < 100:
                    xs.append(x); ys.append(y)
        if xs:
            out[name] = {
                'w': max(xs) - min(xs) + 1,
                'h': max(ys) - min(ys) + 1,
                'aspect': round((max(xs) - min(xs) + 1) / (max(ys) - min(ys) + 1), 3),
                'cx': round((min(xs) + max(xs)) / 2), 'cy': round((min(ys) + max(ys)) / 2)
            }
        else:
            out[name] = None
    return out

print('ENGINE:', sys.argv[1])
target = Image.open(sys.argv[2]).size
e = measure(sys.argv[1], resize_to=target)
for k in CENTERS:
    print('  ', k, e[k])
print('SELF:', sys.argv[2])
s = measure(sys.argv[2])
for k in CENTERS:
    print('  ', k, s[k])
