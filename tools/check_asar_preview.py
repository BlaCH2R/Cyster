import json
import struct

p = r"V:\cytoid storyboarder\app\dist\win-unpacked\resources\app.asar"
with open(p, "rb") as f:
    data = f.read()

idx = data.find(b'{"files":')
depth = 0
end = idx
in_str = False
esc = False
for i in range(idx, len(data)):
    c = data[i]
    if in_str:
        if esc:
            esc = False
        elif c == 0x5C:
            esc = True
        elif c == 0x22:
            in_str = False
        continue
    if c == 0x22:
        in_str = True
    elif c == 0x7B:
        depth += 1
    elif c == 0x7D:
        depth -= 1
        if depth == 0:
            end = i + 1
            break
header = json.loads(data[idx:end].decode("utf-8"))
header_len = struct.unpack("<I", data[4:8])[0]
json_len = struct.unpack("<I", data[12:16])[0]
content_base = 8 + header_len + json_len


def find(node, name):
    for n, ch in node.get("files", {}).items():
        if n == name and "files" not in ch:
            return ch
        if "files" in ch:
            r = find(ch, name)
            if r:
                return r
    return None


ch = find(header, "preview.js")
off = int(ch["offset"])
print("preview.js offset", off, "size", ch["size"])
txt = data[content_base + off : content_base + off + ch["size"]].decode("utf-8")
print("has flickRing:", "A.flickRing" in txt)
print("has holdRing:", "A.holdRing" in txt)
print("has drawHoldBar:", "drawHoldBar" in txt)
print("has noteRing:", "A.noteRing" in txt)
print("has cDragFill:", "A.cDragFill" in txt)
print("has old square fillRect(-d/2,-d/2,d,d):", "fillRect(-d / 2, -d / 2, d, d)" in txt)

# Dump the whole drawNote body
i = txt.find("drawNote(ctx")
end = txt.find("tintDraw(ctx", i)
print("---- drawNote body (asar) ----")
print(txt[i:end])
