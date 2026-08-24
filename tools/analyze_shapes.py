from PIL import Image
import numpy as np

def ascii_region(path, box, w=44, h=22, thr=110, dark=False):
    img = Image.open(path).convert('RGB')
    region = img.crop(box)
    r = region.resize((w, h))
    a = np.asarray(r).astype(int)
    mx = a.max(axis=2)
    print(f"--- {path} box={box} ---")
    for y in range(h):
        row = ''
        for x in range(w):
            v = mx[y, x]
            if dark:
                if v < 90: row += '#'
                elif v < 150: row += '.'
                else: row += ' '
            else:
                if v > 230: row += '#'
                elif v > thr: row += '.'
                else: row += ' '
        print(row)

# image4: white vertical strips
ascii_region(r"C:\Users\Bc\Pictures\4.jpg", (105, 255, 170, 370))
ascii_region(r"C:\Users\Bc\Pictures\4.jpg", (250, 255, 305, 370))
# image7: dark maroon blobs (flick?)
ascii_region(r"C:\Users\Bc\Pictures\7.jpg", (725, 495, 800, 575), dark=True)
ascii_region(r"C:\Users\Bc\Pictures\7.jpg", (900, 385, 960, 450), dark=True)
ascii_region(r"C:\Users\Bc\Pictures\7.jpg", (905, 430, 970, 505), dark=True)
ascii_region(r"C:\Users\Bc\Pictures\7.jpg", (865, 515, 920, 570), dark=True)
# image7: green note with ring
ascii_region(r"C:\Users\Bc\Pictures\7.jpg", (335, 455, 395, 545))
# image1: yellow note
ascii_region(r"C:\Users\Bc\Pictures\1.jpg", (325, 180, 400, 250))
# image3: big blue note
ascii_region(r"C:\Users\Bc\Pictures\3.jpg", (525, 395, 730, 570), 60, 30)
