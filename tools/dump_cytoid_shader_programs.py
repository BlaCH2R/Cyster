# -*- coding: utf-8 -*-
"""Dump compiled shader subprograms (GLSL for GLES3, metadata for others) from
a Cytoid Unity bundle. Analysis tool for porting CameraFilterPack math.

Usage:
  python tools/dump_cytoid_shader_programs.py <bundle.unity3d> <out_dir> [path_id ...]

If path_ids are omitted, all Shader assets are dumped.
"""
import json
import os
import re
import sys

import UnityPy
from UnityPy.helpers import CompressionHelper
from UnityPy.streams import EndianBinaryReader


PLATFORM_NAMES = {
    0: "GL", 1: "D3D9", 2: "XBox360", 3: "PS3", 4: "D3D11",
    5: "GLES20", 6: "NaCl", 7: "Flash", 8: "D3D11_9x", 9: "GLES3Plus",
    10: "PSP2", 11: "PS4", 12: "XboxOne", 13: "PSM", 14: "Metal",
    15: "OpenGLCore", 16: "N3DS", 17: "WiiU", 18: "Vulkan", 19: "Switch",
    20: "XboxOneD3D12",
}

PROGRAM_TYPE_NAMES = {
    0: "unknown", 1: "GLES", 2: "GLES3", 3: "GLES31", 4: "GLES31AEP",
    5: "GLCore32", 6: "GLCore41", 7: "GLCore43", 8: "GLLegacy",
    9: "MetalVS", 10: "MetalFS", 11: "D3D9VS20", 12: "D3D9VS30",
    13: "D3D9PS20", 14: "D3D9PS30", 15: "DX11VS40", 16: "DX11VS50",
    17: "DX11PS40", 18: "DX11PS50", 19: "DX11GS40", 20: "DX11GS50",
    21: "DX11HS50", 22: "DX11DS50", 23: "ConsoleVS", 24: "ConsoleFS",
    25: "ConsoleHS", 26: "ConsoleDS", 27: "ConsoleGS", 28: "SPIRV",
    29: "DX10Level9VS", 30: "DX10Level9PS",
}


def clean(value):
    """Remove lone surrogates so JSON dump never fails."""
    if isinstance(value, str):
        return value.encode("utf-8", errors="replace").decode("utf-8")
    return value


def parse_subprograms(blob, version):
    reader = EndianBinaryReader(blob, endian="<")
    capacity = reader.read_int()
    entry_size = 12 if version >= (2019, 3) else 8
    entries = []
    for i in range(capacity):
        reader.Position = 4 + i * entry_size
        offset = reader.read_int()
        entries.append(offset)
    subprograms = []
    for i, offset in enumerate(entries):
        reader.Position = offset
        sub = {"index": i, "offset": offset}
        try:
            sub["blob_version"] = reader.read_int()
            sub["program_type"] = reader.read_int()
            reader.Position += 12
            if sub["blob_version"] >= 201608170:
                reader.Position += 4
            kw_size = reader.read_int()
            sub["keywords"] = [clean(reader.read_aligned_string()) for _ in range(kw_size)]
            if 201806140 <= sub["blob_version"] < 202012090:
                lk_size = reader.read_int()
                sub["local_keywords"] = [clean(reader.read_aligned_string()) for _ in range(lk_size)]
            else:
                sub["local_keywords"] = []
            code_size = reader.read_int()
            code = reader.read_bytes(code_size)
            sub["code_size"] = code_size
            sub["code_hex_head"] = code[:16].hex()
            if sub["program_type"] in (1, 2, 3, 4, 5, 6, 7, 8):
                sub["code_text"] = code.decode("utf-8", errors="replace")
            elif sub["program_type"] == 28:  # SPIR-V
                sub["code_text"] = None
                sub["spirv_words"] = len(code) // 4
            else:
                sub["code_text"] = None
        except Exception as exc:  # noqa: BLE001
            sub["error"] = "{}: {}".format(type(exc).__name__, exc)
        subprograms.append(sub)
    return subprograms


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        return 1
    bundle, out_dir = sys.argv[1], sys.argv[2]
    wanted = {int(x) for x in sys.argv[3:]} if len(sys.argv) > 3 else None
    os.makedirs(out_dir, exist_ok=True)
    env = UnityPy.load(bundle)
    summary = []
    for obj in env.objects:
        if obj.type.name != "Shader":
            continue
        if wanted is not None and obj.path_id not in wanted:
            continue
        try:
            data = obj.read()
        except Exception as exc:  # noqa: BLE001
            summary.append({"path_id": obj.path_id, "error": str(exc)})
            continue
        parsed = getattr(data, "m_ParsedForm", None)
        name = getattr(parsed, "m_Name", "") if parsed is not None else ""
        entry = {"path_id": obj.path_id, "name": clean(name),
                 "platforms": [PLATFORM_NAMES.get(p, p) for p in data.platforms],
                 "subprograms": []}
        cb = bytes(data.compressedBlob)
        for i, plat in enumerate(data.platforms):
            try:
                cl = data.compressedLengths[i][0]
                dl = data.decompressedLengths[i][0]
                off = data.offsets[i][0]
                blob = CompressionHelper.decompress_lz4(cb[off:off + cl], dl)
            except Exception as exc:  # noqa: BLE001
                entry["subprograms"].append({"platform": plat, "error": str(exc)})
                continue
            subs = parse_subprograms(blob, data.object_reader.version)
            for sub in subs:
                sub["platform"] = PLATFORM_NAMES.get(plat, plat)
                if sub.get("code_text"):
                    safe = re.sub(r'[^0-9A-Za-z_\-]+', '_', name or "shader")
                    fname = "{}_{}_p{}_s{}.glsl".format(
                        obj.path_id, safe, plat, sub["index"])
                    with open(os.path.join(out_dir, fname), "w", encoding="utf-8",
                              newline="\n") as fh:
                        fh.write("// {} platform={} program_type={} keywords={}\n\n{}".format(
                            name, sub["platform"],
                            PROGRAM_TYPE_NAMES.get(sub["program_type"], sub["program_type"]),
                            json.dumps(sub.get("keywords", [])),
                            sub["code_text"]))
                    sub["glsl_file"] = fname
                sub.pop("code_text", None)
                entry["subprograms"].append(sub)
        summary.append(entry)

    with open(os.path.join(out_dir, "_programs_summary.json"), "w", encoding="utf-8") as fh:
        json.dump(summary, fh, indent=2, ensure_ascii=False)
    print("dumped", len(summary), "shaders")
    for e in summary:
        print(e["path_id"], e["name"], e.get("platforms"),
              [(s.get("program_type"), s.get("code_size")) for s in e.get("subprograms", [])])
    return 0


if __name__ == "__main__":
    sys.exit(main())
