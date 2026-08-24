import re

txt = open(r"V:\cytoid storyboarder\tools\doc_text.txt", encoding="utf-8").read()
fields = [
    "background_dim",
    "scanline",
    "note_ring_color",
    "note_fill_colors",
    "opacity",
    "ui_opacity",
    "storyboard_opacity",
    "color_filter",
    "chromatical",
    "size",
    "scale",
    "perspective",
    "camera",
    "note",
    "override",
    "easing",
    "add_time",
    "bloom",
    "focus",
    "fisheye",
    "glitch",
    "noise",
    "arcade",
    "tape",
    "radial_blur",
    "gray_scale",
    "sepia",
    "dream",
    "shockwave",
    "scanline_pos",
    "scanline_opacity",
    "note_opacity_multiplier",
    "x", "y", "z",
]
out = []
for f in fields:
    idxs = [m.start() for m in re.finditer(re.escape(f), txt)]
    out.append(f"### {f}: {len(idxs)} mentions")
    for i in idxs[:3]:
        s = max(0, i - 150)
        e = min(len(txt), i + 250)
        out.append("  ..." + txt[s:e].replace("\n", " ") + "...")
with open(r"V:\cytoid storyboarder\tools\doc_fields.txt", "w", encoding="utf-8") as fp:
    fp.write("\n".join(out))
print("done", len(out))
