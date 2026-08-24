from PIL import Image

img = Image.open(r"C:\Users\Bc\Pictures\note样式解析.jpg").convert('RGB')
W, H = img.size
print("size", W, H)

# From analyze_note_style.py output: colored icon blobs (x0,x1,y0,y1)
blobs = [
    (2, 20, 76, 108, 156),      # blue small circle
    (5, 8, 112, 216, 312),      # blue circle
    (7, 108, 136, 356, 384),    # green small
    (8, 32, 60, 380, 408),      # green small 2
    (9, 12, 76, 516, 580),      # green circle
    (14, 48, 100, 728, 780),    # pink circle
    (15, 60, 120, 924, 988),    # pink circle
    (20, 4, 244, 1132, 1392),   # yellow diamond/rectangle
    (21, 76, 176, 1208, 1308),  # yellow center
]
for i, (_, x0, x1, y0, y1) in enumerate(blobs):
    pad = 80
    c = img.crop((max(0, x0 - pad), max(0, y0 - pad), min(W, x1 + pad), min(H, y1 + pad)))
    c = c.resize((c.width * 2, c.height * 2), Image.LANCZOS)
    c.save(rf"V:\cytoid storyboarder\tools\note_icon_{i}.png")
print("saved slices")
