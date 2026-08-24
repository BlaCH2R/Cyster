# -*- coding: utf-8 -*-
"""Print VERTEX sections of extracted shader GLSL files.
Usage: python tools/dump_vertex.py <path_id> [path_id ...]
"""
import os
import sys

BASE = r"V:\cytoid storyboarder\reference\Cytoid-2.1.5-apk\programs"


def main():
    ids = [int(x) for x in sys.argv[1:]]
    for pid in ids:
        for f in sorted(os.listdir(BASE)):
            if not f.startswith(str(pid) + "_") or "_p9_" not in f:
                continue
            txt = open(os.path.join(BASE, f), encoding="utf-8").read()
            if "#ifdef VERTEX" not in txt:
                continue
            vert = txt.split("#ifdef VERTEX")[1].split("#endif")[0]
            body = vert.split("void main()")[1]
            print("#" * 25, pid, f)
            print(body.strip())
    return 0


if __name__ == "__main__":
    sys.exit(main())
