from PIL import Image
import os, sys

def analyze(p):
    img = Image.open(p).convert('RGB')
    w, h = img.size
    px = img.load()
    # overall stats
    small = img.resize((160, 90))
    hist = small.histogram()
    nonblack = sum(hist[3:]) / (160*90*3)
    # sample distinct colors
    colors = small.getcolors(160*90)
    print(f"--- {os.path.basename(p)} {w}x{h} nonblack_ratio={nonblack:.3f} unique_colors={len(colors) if colors else '>max'}")
    # check specific rows for scanline accent (255,138,92) in preview area
    found_scan = 0
    for y in range(0, int(h*0.55), 3):
        row_hits = 0
        for x in range(0, w, 4):
            r,g,b = px[x,y]
            if abs(r-255)<18 and abs(g-138)<25 and abs(b-92)<25:
                row_hits += 1
        if row_hits > w/40:
            found_scan += 1
    print("scanline_accent_rows:", found_scan)
    # preview region mean
    region = img.crop((int(w*0.24), 0, int(w*0.75), int(h*0.52)))
    rs = region.resize((120, 70))
    rh = rs.histogram()
    r_nonblack = sum(rh[3:]) / (120*70*3)
    print("preview_nonblack:", round(r_nonblack,3))
    # timeline region: check lane borders (dark) and some colored pixels
    tl = img.crop((0, int(h*0.78), w, h))
    tls = tl.resize((120, 26))
    tlh = tls.histogram()
    print("timeline_nonblack:", round(sum(tlh[3:])/(120*26*3), 3))

if __name__ == '__main__':
    d = r"V:\cytoid storyboarder\tools\shots"
    for f in sorted(os.listdir(d)):
        if f.endswith('.png'):
            analyze(os.path.join(d, f))
