# -*- coding: utf-8 -*-
"""Export shader assets from a Cytoid Unity bundle to a folder.

Usage:
  python tools/export_cytoid_shaders.py <bundle.unity3d> <out_dir>

Each shader is written as <out_dir>/<path_id>_<sanitized name>.shader
"""
import os
import re
import sys

import UnityPy


def sanitize(name):
    return re.sub(r'[^0-9A-Za-z_\-]+', '_', name or 'unnamed')


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        return 1
    bundle, out_dir = sys.argv[1], sys.argv[2]
    os.makedirs(out_dir, exist_ok=True)
    env = UnityPy.load(bundle)
    written = []
    failed = []
    for obj in env.objects:
        if obj.type.name != "Shader":
            continue
        try:
            data = obj.read()
            parsed = getattr(data, "m_ParsedForm", None)
            name = ""
            if parsed is not None:
                name = getattr(parsed, "m_Name", "") or ""
            text = data.export()
            path = os.path.join(out_dir, "{}_".format(obj.path_id) + sanitize(name) + ".shader")
            with open(path, "w", encoding="utf-8", newline="\n") as fh:
                fh.write(text)
            written.append((obj.path_id, name, len(text)))
        except Exception as exc:  # noqa: BLE001
            failed.append((obj.path_id, "{}: {}".format(type(exc).__name__, exc)))

    with open(os.path.join(out_dir, "_export_summary.txt"), "w", encoding="utf-8") as fh:
        for pid, name, size in written:
            fh.write("{}\t{}\t{}\n".format(pid, name, size))
        for pid, err in failed:
            fh.write("{}\t<FAILED>\t{}\n".format(pid, err))

    print("written:", len(written), "failed:", len(failed))
    for item in written:
        print(item)
    for item in failed:
        print("FAIL", item)
    return 0


if __name__ == "__main__":
    sys.exit(main())
