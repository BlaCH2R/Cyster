from PIL import Image, ImageDraw, ImageFont
import os

def make_icon(size):
    # Blue-purple diagonal gradient background
    grad = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    gpx = grad.load()
    c1 = (30, 76, 176, 255)    # blue
    c2 = (120, 64, 166, 255)   # purple
    for y in range(size):
        for x in range(size):
            t = (x / size + y / size) / 2
            gpx[x, y] = tuple(int(c1[i] + (c2[i] - c1[i]) * t) for i in range(4))
    # Rounded square mask
    r = int(size * 0.22)
    mask = Image.new('L', (size, size), 0)
    dm = ImageDraw.Draw(mask)
    dm.rounded_rectangle([0, 0, size - 1, size - 1], radius=r, fill=255)
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    img.paste(grad, (0, 0), mask)
    d = ImageDraw.Draw(img)
    # Inner border
    m = int(size * 0.07)
    d.rounded_rectangle([m, m, size - 1 - m, size - 1 - m], radius=int(r * 0.8), outline=(91, 192, 235, 255), width=max(1, int(size * 0.035)))
    # Diamond (like a note/star)
    cx, cy = size * 0.5, size * 0.5
    s = size * 0.22
    d.polygon([(cx, cy - s), (cx + s, cy), (cx, cy + s), (cx - s, cy)], outline=(91, 192, 235, 255), width=max(1, int(size * 0.045)))
    d.polygon([(cx, cy - s * 0.42), (cx + s * 0.42, cy), (cx, cy + s * 0.42), (cx - s * 0.42, cy)], fill=(91, 192, 235, 255))
    return img

out_dir = r"V:\cytoid storyboarder\app\assets"
os.makedirs(out_dir, exist_ok=True)

sizes = [16, 24, 32, 48, 64, 128, 256]
imgs = [make_icon(s) for s in sizes]
imgs[-1].save(os.path.join(out_dir, 'icon.png'))
imgs[-1].save(os.path.join(out_dir, 'icon.ico'), sizes=[(s, s) for s in sizes])
print('icon saved:', os.path.join(out_dir, 'icon.ico'), os.path.getsize(os.path.join(out_dir, 'icon.ico')))
