from PIL import Image
import os, math
d = r"V:\cytoid storyboarder\reference\player_textures"
for name in ["NoteRing","NoteFill","FlickRing","FlickFill","HoldNoteRing"]:
    img = Image.open(os.path.join(d, name + ".png")).convert('RGBA')
    w,h = img.size
    px = img.load()
    cx, cy = w/2, h/2
    def sample(dx, dy, r):
        x = int(cx + dx*r); y = int(cy + dy*r)
        return px[min(w-1,max(0,x)), min(h-1,max(0,y))][3]
    axis = [sample(1,0,r) for r in range(0, w//2, 32)]
    diag = [sample(1,1,r) for r in range(0, int(w/2), 32)]
    print(name, "axis(0..255):", axis)
    print(" " * len(name), "diag(0..255):", diag)
