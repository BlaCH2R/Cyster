import re

txt = open(r"V:\cytoid storyboarder\tools\doc_text.txt", encoding="utf-8").read()
i = txt.find("chromatical")
seg = txt[max(0, i - 100) : i + 2000].replace("\n", " ")
out = []
for field in ["chromatical_fade", "chromatical_intensity", "chromatical_speed", "bloom", "bloom_intensity",
              "radial_blur", "radial_blur_intensity", "color_adjustment", "brightness", "saturation", "contrast",
              "color_filter", "gray_scale", "gray_scale_intensity", "noise", "noise_intensity", "sepia",
              "sepia_intensity", "dream", "dream_intensity", "fisheye", "fisheye_intensity", "glitch",
              "glitch_intensity", "arcade", "arcade_intensity", "shockwave", "shockwave_speed", "focus",
              "focus_size", "focus_speed", "focus_intensity", "tape"]:
    m = re.search(re.escape(field) + r"\s*:\s*[^。]*", seg)
    if m:
        out.append(m.group(0)[:260])
with open(r"V:\cytoid storyboarder\tools\doc_fx_scan.txt", "w", encoding="utf-8") as f:
    f.write("\n---\n".join(out))
print("done", len(out))
