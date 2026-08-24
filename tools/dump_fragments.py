# -*- coding: utf-8 -*-
"""Print the FRAGMENT bodies of the extracted Cytoid shader GLSL files.
Usage: python tools/dump_fragments.py [path_id ...]  (default: all CameraFilterPack+Sleek)
"""
import os
import re
import sys

BASE = r"V:\cytoid storyboarder\reference\Cytoid-2.1.5-apk\programs"
ALL = [127, 133, 136, 137, 139, 142, 143, 144, 147, 148, 149, 150,
       151, 152, 153, 156, 160, 161, 162, 164, 165]


def fragment_body(path_id):
    candidates = [f for f in os.listdir(BASE)
                  if f.startswith(str(path_id) + "_") and "_p9_" in f]
    for fn in candidates:
        txt = open(os.path.join(BASE, fn), encoding="utf-8").read()
        if "#ifdef FRAGMENT" not in txt:
            continue
        frag = txt.split("#ifdef FRAGMENT")[1]
        # uniforms block
        uni = re.findall(r"uniform\s+[^;]+;", frag)
        body = frag.split("void main()")[1].split("#endif")[0]
        return fn, uni, body
    return None, [], ""


def main():
    ids = [int(x) for x in sys.argv[1:]] or ALL
    for pid in ids:
        fn, uni, body = fragment_body(pid)
        print("#" * 30, pid, fn or "<missing>")
        if not fn:
            continue
        print("UNIFORMS:", " | ".join(u.strip() for u in uni))
        print(body.strip())
    return 0


if __name__ == "__main__":
    sys.exit(main())
