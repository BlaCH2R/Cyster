from PIL import Image
for p in [r"D:\sd\Cytoid flies\bluef.png", r"D:\sd\Cytoid flies\redf.png"]:
    img = Image.open(p).convert('RGBA')
    px = img.load()
    w, h = img.size
    left = sum(1 for x in range(w//2) for y in range(h) if px[x,y][3] > 60)
    right = sum(1 for x in range(w//2, w) for y in range(h) if px[x,y][3] > 60)
    print(p, 'opaque left:', left, 'right:', right)
    # ASCII silhouette (downsampled 64x16)
    small = img.resize((64, 16))
    sp = small.load()
    chars = []
    for y in range(16):
        row = ''
        for x in range(64):
            a = sp[x,y][3]
            r,g,b,_ = sp[x,y]
            if a > 200:
                row += ('R' if r>200 and g<120 else 'B' if b>180 and r<150 else '#')
            elif a > 80:
                row += ('.' if b>150 else ';')
            else:
                row += ' '
        chars.append(row)
    print('\n'.join(chars))
    print('---')
