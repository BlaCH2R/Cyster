from PIL import Image
import numpy as np

d = r"V:\cytoid storyboarder\tools\shots"
names = ["click_id2", "hold_id0", "longhold_id3", "drag_id10", "dragchild_id11",
         "flick_id63", "cdrag_id385", "cdragchild_id386"]

for name in names:
    img = Image.open(rf"{d}\style_{name}.png").convert("RGB")
    a = np.asarray(img).astype(int)
    H, W, _ = a.shape
    # Restrict to the preview canvas region
    sub = a[40:560, 250:810]
    # Non-background = clearly lighter or colored vs #111318
    rr, gg, bb = sub[..., 0], sub[..., 1], sub[..., 2]
    nonbg = (rr > 45) | (gg > 45) | (bb > 55)
    ys, xs = np.where(nonbg)
    if len(xs) == 0:
        print(name, "EMPTY")
        continue
    cx, cy = int(xs.mean()), int(ys.mean())
    # histogram in a 160px box around the centroid
    box = sub[max(0, cy-90):cy+90, max(0, cx-90):cx+90]
    br, bg2, bbl = box[..., 0], box[..., 1], box[..., 2]
    mask = (br > 30) | (bg2 > 30) | (bbl > 40)
    vals = np.stack([br[mask], bg2[mask], bbl[mask]], axis=1)
    # quantize
    q = (vals // 16) * 16
    keys = np.apply_along_axis(lambda v: "#" + "".join(format(int(x), "02x") for x in v), 1, q)
    uniq, counts = np.unique(keys, return_counts=True)
    order = np.argsort(-counts)
    top = [(uniq[i], int(counts[i])) for i in order[:6]]
    print(name, "centroid", (cx, cy), "top:", top)
