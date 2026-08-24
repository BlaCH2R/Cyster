from PIL import Image
import os
d = r"V:\cytoid storyboarder\reference\player_textures"
for name in ["NoteRing","NoteFill","FlickRing","FlickFill","HoldNoteRing","CDragFill","HoldLine","HoldCompletedLine","HoldTriangle","DragLine","Circle - Filled","FlickLeftArrow","FlickRightArrow","Line - Stroke 10"]:
    p = os.path.join(d, name + ".png")
    if not os.path.exists(p):
        print(name, "MISSING"); continue
    img = Image.open(p).convert('RGBA')
    w,h = img.size
    px = img.load()
    xs=[]; ys=[]
    for y in range(h):
        for x in range(w):
            if px[x,y][3] > 40:
                xs.append(x); ys.append(y)
    if xs:
        bw = max(xs)-min(xs)+1; bh = max(ys)-min(ys)+1
        print(f"{name:22s} {w}x{h}  opaque_bbox={bw}x{bh} center_frac=({bw/w:.2f},{bh/h:.2f})")
    else:
        print(name, "EMPTY")
