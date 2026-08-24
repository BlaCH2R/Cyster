import sys
from PIL import Image

CENTERS = {
    's_rz': (219, 164), 's_rx': (487, 164), 's_ry': (755, 164),
    's_xy': (219, 382), 's_yx': (487, 382), 's_xyz': (755, 382)
}

src = sys.argv[1]
outdir = sys.argv[2]
img = Image.open(src).convert('RGB')
for name, (cx, cy) in CENTERS.items():
    crop = img.crop((cx - 90, cy - 90, cx + 90, cy + 90)).resize((360, 360), Image.LANCZOS)
    crop.save(f'{outdir}/{name}.png')
print('cropped to', outdir)
