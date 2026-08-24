from PIL import Image
import os
d = r"V:\cytoid storyboarder\reference\player_textures"
for name in ["NoteRing","NoteFill","FlickRing","FlickFill","HoldNoteRing","CDragFill"]:
    img = Image.open(os.path.join(d, name + ".png")).convert('RGBA')
    w,h = img.size
    px = img.load()
    cx, cy = w//2, h//2
    profile = []
    for r in range(0, w//2, w//16):
        x = cx + r
        a = px[min(w-1,x), cy][3]
        rr,g,b,_ = px[min(w-1,x), cy]
        profile.append(f"{r/w:.2f}:a{a} rgb{rr},{g},{b}")
    print(name, " | ".join(profile))
