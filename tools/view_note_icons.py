from PIL import Image
import numpy as np
img = Image.open(r"C:\Users\Bc\AppData\Local\Temp\note_style.jpg").convert('RGB')
a = np.asarray(img).astype(int)
blobs = {
  "blue1 (y108)": (20,76,108,156),
  "blue2 (y216)": (8,112,216,312),
  "green_small1 (y356)": (108,136,356,384),
  "green_small2 (y380)": (32,60,380,408),
  "green (y516)": (12,76,516,580),
  "pink1 (y728)": (48,100,728,780),
  "pink2 (y924)": (60,120,924,988),
  "yellow (y1132)": (4,244,1132,1392),
}
for name,(x0,x1,y0,y1) in blobs.items():
    region = a[y0:y1, x0:x1]
    # background is white-ish; mark non-white
    mx = region.max(axis=2)
    nonwhite = mx < 230
    small = nonwhite[::max(1,(y1-y0)//24), ::max(1,(x1-x0)//36)]
    print("====", name, "====")
    for row in small:
        print(''.join('#' if v else ' ' for v in row))
