from PIL import Image
import os
d = r"V:\cytoid storyboarder\reference\player_textures"
for name in ["FlickLeftArrow","FlickRightArrow"]:
    img = Image.open(os.path.join(d, name + ".png")).convert('RGBA')
    w,h = img.size
    px = img.load()
    top = sum(1 for x in range(w) for y in range(h//2) if px[x,y][3] > 60)
    bot = sum(1 for x in range(w) for y in range(h//2,h) if px[x,y][3] > 60)
    left = sum(1 for x in range(w//2) for y in range(h) if px[x,y][3] > 60)
    right = sum(1 for x in range(w//2,w) for y in range(h) if px[x,y][3] > 60)
    xs = [x for x in range(w) for y in range(h) if px[x,y][3] > 60]
    ys = [y for x in range(w) for y in range(h) if px[x,y][3] > 60]
    print(name, 'top/bot', top, bot, 'left/right', left, right, 'bbox', min(xs), min(ys), max(xs), max(ys))
    # ascii
    small = img.resize((48, 16))
    sp = small.load()
    for y in range(16):
        row = ''.join('#' if sp[x,y][3] > 150 else ('.' if sp[x,y][3] > 50 else ' ') for x in range(48))
        print(row)
