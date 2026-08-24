from PIL import Image
for p in [r"D:\sd\Cytoid flies\bluef.png", r"D:\sd\Cytoid flies\redf.png"]:
    img = Image.open(p).convert('RGBA')
    print(p)
    print(' size:', img.size, 'mode:', img.mode)
    px = img.load()
    w, h = img.size
    # alpha stats
    alphas = [px[x,y][3] for x in range(w) for y in range(h)]
    print(' alpha min/max/mean:', min(alphas), max(alphas), round(sum(alphas)/len(alphas),1))
    # dominant non-transparent color
    from collections import Counter
    cnt = Counter()
    for x in range(w):
        for y in range(h):
            r,g,b,a = px[x,y]
            if a > 60:
                cnt[(r//16*16, g//16*16, b//16*16)] += 1
    print(' top colors:', cnt.most_common(5))
    # bounding box of opaque pixels
    xs = [x for x in range(w) for y in range(h) if px[x,y][3] > 60]
    ys = [y for x in range(w) for y in range(h) if px[x,y][3] > 60]
    if xs:
        print(' bbox:', min(xs), min(ys), max(xs), max(ys))
    # coarse alpha profile: is content top-heavy or bottom-heavy?
    top = sum(1 for x in range(w) for y in range(h//2) if px[x,y][3] > 60)
    bot = sum(1 for x in range(w) for y in range(h//2, h) if px[x,y][3] > 60)
    print(' opaque top-half:', top, 'bottom-half:', bot)
