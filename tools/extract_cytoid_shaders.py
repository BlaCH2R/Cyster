# -*- coding: utf-8 -*-
"""List asset types + shader assets inside Cytoid Android bundles (analysis only).

Usage:
  python tools/extract_cytoid_shaders.py <bundle.unity3d> [more.unity3d ...]

Writes JSON to stdout: per bundle, object/type counts, shader names with path_ids,
and a sample of container (bundle path) entries.
"""
import collections
import json
import os
import sys

import UnityPy


def analyze(path):
    result = {"file": os.path.basename(path), "objects": 0,
              "types": {}, "shaders": [], "containers": []}
    try:
        env = UnityPy.load(path)
    except Exception as exc:  # noqa: BLE001
        result["fatal"] = "{}: {}".format(type(exc).__name__, exc)
        return result

    type_counter = collections.Counter()
    for obj in env.objects:
        result["objects"] += 1
        try:
            type_counter[obj.type.name] += 1
        except Exception:  # noqa: BLE001
            type_counter["<unknown>"] += 1
        if obj.type.name == "Shader":
            entry = {"path_id": obj.path_id, "container": obj.container}
            try:
                data = obj.read()
                parsed = getattr(data, "m_ParsedForm", None)
                if parsed is not None:
                    name = getattr(parsed, "m_Name", None) or getattr(parsed, "name", "")
                else:
                    name = getattr(data, "m_Name", "") or ""
                entry["name"] = name
            except Exception as exc:  # noqa: BLE001
                entry["read_error"] = "{}: {}".format(type(exc).__name__, exc)
            result["shaders"].append(entry)

    result["types"] = dict(sorted(type_counter.items(), key=lambda kv: -kv[1]))
    for path_id, container in list(env.container.items())[:200]:
        result["containers"].append({"path_id": path_id, "path": container})
    return result


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        return 1
    out = [analyze(p) for p in sys.argv[1:]]
    print(json.dumps(out, indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
