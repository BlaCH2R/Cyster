import sys
from PIL import Image

def diff(a_path, b_path, crop=(0.2, 0.2, 0.8, 0.8), out=None):
    a = Image.open(a_path).convert('RGB')
    b = Image.open(b_path).convert('RGB')
    # resize b to a's size
    b = b.resize(a.size, Image.LANCZOS)
    w, h = a.size
    box = (int(w * crop[0]), int(h * crop[1]), int(w * crop[2]), int(h * crop[3]))
    pa = a.crop(box)
    pb = b.crop(box)
    pa_px = list(pa.getdata())
    pb_px = list(pb.getdata())
    n = len(pa_px)
    total = 0
    over10 = 0
    over30 = 0
    for x, y in zip(pa_px, pb_px):
        d = (abs(x[0]-y[0]) + abs(x[1]-y[1]) + abs(x[2]-y[2])) / 3
        total += d
        if d > 10: over10 += 1
        if d > 30: over30 += 1
    mean = total / n
    print(f'mean_diff={mean:.2f}  pct>10={over10/n*100:.1f}%  pct>30={over30/n*100:.1f}%')
    if out:
        diff_img = Image.new('RGB', (pa.width, pa.height))
        dp = diff_img.load()
        for i in range(pa.width):
            for j in range(pa.height):
                x = pa_px[j*pa.width+i]; y = pb_px[j*pa.width+i]
                d = (abs(x[0]-y[0]) + abs(x[1]-y[1]) + abs(x[2]-y[2])) / 3
                dp[i, j] = (int(min(255, d*8)), 0, 0)
        diff_img.save(out)

if __name__ == '__main__':
    a = sys.argv[1]
    b = sys.argv[2]
    out = sys.argv[3] if len(sys.argv) > 3 else None
    diff(a, b, out=out)
