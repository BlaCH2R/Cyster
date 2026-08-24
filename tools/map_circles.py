from PIL import Image
import numpy as np
img = Image.open(r"V:\cytoid storyboarder\tools\toolbar_capture.png").convert('RGB')
a = np.asarray(img).astype(int)
r,g,b = a[...,0],a[...,1],a[...,2]
# toolbar bg ~ (27,32,39); button bg ~ (34,41,51)
btn = (abs(r-34)<7)&(abs(g-41)<7)&(abs(b-51)<9)
# take a middle row of the toolbar (y=24)
row = btn[24]
runs = []
inrun = False
for x in range(len(row)):
    if row[x] and not inrun: start=x; inrun=True
    elif not row[x] and inrun: runs.append((start,x-1)); inrun=False
if inrun: runs.append((start,len(row)-1))
# merge runs separated by small gaps (<4)
merged=[]
for s,e in runs:
    if merged and s - merged[-1][1] <= 4: merged[-1]=(merged[-1][0],e)
    else: merged.append((s,e))
print("button runs (x0,x1,center):")
for s,e in merged:
    print((s,e,(s+e)//2))
# circles from user image
for cx in [271,747,1261]:
    best = min(merged, key=lambda m: abs((m[0]+m[1])//2 - cx))
    print(f"circle cx={cx} -> nearest button {best} center {(best[0]+best[1])//2}")
