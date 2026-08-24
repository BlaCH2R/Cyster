# Minimal SM4/SM5 pixel-shader token decoder for Unity-extracted DXBC blobs.
# Usage: python dxbc_decode.py <blob.bin> [stream_start_offset]
import os, sys, struct

OPS = {
    0: "add", 1: "and", 2: "break", 3: "breakc", 4: "call", 5: "callc",
    6: "case", 7: "continue", 8: "continuec", 9: "cut", 10: "default",
    11: "discard", 12: "div", 13: "dp2", 14: "dp3", 15: "dp4", 16: "else",
    17: "emit", 18: "emitthencut", 19: "endif", 20: "endloop", 21: "endswitch",
    22: "eq", 23: "exp", 24: "fceil", 25: "ffloor", 26: "fma", 27: "fne",
    28: "frc", 29: "gather4", 30: "ge", 31: "iadd", 32: "ieq", 33: "ige",
    34: "igt", 35: "imad", 36: "imax", 37: "imin", 38: "imul", 39: "ine",
    40: "ineg", 41: "ishl", 42: "ishr", 43: "itof", 44: "lt", 45: "mad",
    46: "max", 47: "min", 48: "mov", 49: "movc", 50: "mul", 51: "ne",
    52: "nop", 53: "not", 54: "or", 55: "rcp", 56: "rep", 57: "resinfo",
    58: "ret", 59: "retc", 60: "round_ne", 61: "round_ni", 62: "round_pi",
    63: "rsq", 64: "sample", 65: "sample_c", 66: "sample_c_lz", 67: "sample_d",
    68: "sample_l", 69: "sample_lz", 70: "sample_b", 71: "sample_c_gradient",
    72: "sin", 73: "sqrt", 74: "srs", 75: "tofloat", 76: "trunc", 77: "uadd",
    78: "udiv", 79: "uge", 80: "ult", 81: "umad", 82: "umax", 83: "umin",
    84: "umul", 85: "une", 86: "ushr", 87: "xor", 88: "dcl_resource",
    89: "dcl_constantbuffer", 90: "dcl_sampler", 91: "dcl_index_range",
    92: "dcl_indexable_temp", 93: "dcl_global_flags", 94: "dcl_input",
    95: "dcl_input_sgv", 96: "dcl_input_siv", 97: "dcl_input_ps",
    98: "dcl_input_ps_sgv", 99: "dcl_input_ps_siv", 100: "dcl_output",
    101: "dcl_output_sgv", 102: "dcl_output_siv", 103: "dcl_temps",
    104: "dcl_indexable_temp", 105: "dcl_index_range", 106: "dcl_constantbuffer",
    107: "dcl_sampler", 108: "dcl_global_flags", 109: "dcl_input",
    110: "dcl_input_sgv", 111: "dcl_input_siv", 112: "dcl_input_ps",
    113: "dcl_input_ps_sgv", 114: "dcl_input_ps_siv", 115: "dcl_output",
    116: "dcl_output_sgv", 117: "dcl_output_siv", 118: "dcl_temps",
    119: "dcl_indexable_temp", 120: "dcl_index_range",
    121: "dcl_uav_typed", 122: "dcl_uav_raw", 123: "dcl_uav_structured",
    124: "dcl_tgsm_raw", 125: "dcl_tgsm_structured", 126: "dcl_resource_raw",
    127: "dcl_resource_structured", 128: "dcl_thread_group",
    129: "dcl_thread_group_shared", 130: "dcl_thread_group_shared_structured",
    131: "dcl_resource_structured", 132: "dcl_input_thread",
    133: "dcl_input_thread_group", 134: "dcl_input_thread_id_in_group",
    135: "dcl_input_thread_id_in_group_flattened", 136: "dcl_input_gs_instance_id",
    137: "dcl_output_control_point_id", 138: "dcl_input_control_point",
    139: "dcl_output_control_point", 140: "dcl_input_patch_constant",
    141: "dcl_input_domain_point", 142: "dcl_output_depth",
    143: "dcl_output_depth_greater_equal", 144: "dcl_output_depth_less_equal",
    145: "dcl_gs_output_primitive_topology", 146: "dcl_max_output_vertex_count",
    147: "dcl_input_primitive", 148: "dcl_output_topology",
    149: "dcl_tessellator_domain", 150: "dcl_tessellator_partitioning",
    151: "dcl_tessellator_output_primitive", 152: "dcl_num_threads",
    153: "dcl_stream", 154: "dcl_function_body", 155: "dcl_function_table",
    156: "dcl_interface", 157: "dcl_thread_group", 158: "dcl_input_primitive_id",
    159: "dcl_input_primitive", 160: "dcl_immediate_constant_buffer",
    161: "dcl_constant_buffer", 162: "dcl_resource", 163: "dcl_sampler",
    164: "dcl_input", 165: "dcl_output", 166: "dcl_temps", 167: "dcl_indexable_temp",
    168: "dcl_input_sgv", 169: "dcl_input_siv", 170: "dcl_input_ps",
    171: "dcl_output_sgv", 172: "dcl_output_siv", 173: "dcl_global_flags",
}

REG_TYPES = {
    0: "r", 1: "v", 2: "o", 3: "x", 4: "l", 5: "d", 6: "s", 7: "t",
    8: "cb", 9: "icb", 10: "lbl", 11: "primid", 12: "odepth", 13: "null",
    14: "ra", 15: "ocov", 16: "stream", 17: "fb", 18: "ft", 19: "iif",
    20: "fi", 21: "fo", 22: "ocpid", 23: "iforkid", 24: "ijoinid",
    25: "icp", 26: "ocp", 27: "ipc", 28: "idpt", 29: "this", 30: "undef",
    31: "icov", 32: "tid", 33: "tgid", 34: "tidig", 35: "tidigf", 36: "giid",
    37: "odepthge", 38: "odepthle",
}

def operand(tok):
    typ = tok & 0x7F
    num = (tok >> 11) & 0x7
    swz = (tok >> 16) & 0xFF
    sel = (tok >> 24) & 0x3
    name = REG_TYPES.get(typ, "?%d" % typ)
    sw = ""
    if swz != 0xE4 and (typ in (0, 1, 2, 3, 4, 5, 7, 8)):
        c = "xyzw"
        parts = [(swz >> (2 * i)) & 3 for i in range(4)]
        sw = "." + "".join(c[p] for p in parts[:num] if num)
    return name, num, sw, sel

def decode(data, start, limit=None):
    lines = []
    pos = start
    total = limit or len(data)
    while pos + 4 <= total:
        tok = struct.unpack_from("<I", data, pos)[0]
        op = tok & 0x7FF
        length = (tok >> 16) & 0xFF
        sat = (tok >> 11) & 1
        pred = (tok >> 12) & 1
        opname = OPS.get(op, "op_%d" % op)
        nxt = pos + 4
        # gather raw operand dwords for the instruction
        raw = []
        for i in range(length):
            if nxt + 4 <= total:
                raw.append(struct.unpack_from("<I", data, nxt)[0])
                nxt += 4
        # interpret common operand patterns
        desc = ""
        if opname in ("dcl_constantbuffer",) and len(raw) >= 3:
            desc = "cb%s[%d]" % (raw[1], raw[2])
        elif opname == "dcl_sampler" and len(raw) >= 1:
            desc = "s%s" % ((raw[0] >> 11) & 7)
        elif opname == "dcl_temps" and len(raw) >= 1:
            desc = "r%s" % raw[0]
        elif opname in ("dcl_input", "dcl_input_ps", "dcl_output", "dcl_input_siv", "dcl_output_siv", "dcl_input_sgv", "dcl_output_sgv", "dcl_input_ps_siv", "dcl_input_ps_sgv") and len(raw) >= 1:
            rn, num, sw, sel = operand(raw[0])
            desc = "%s%s%s" % (rn, num, sw)
            if len(raw) >= 2:
                desc += " sv=0x%08x" % raw[1]
        elif opname in ("dcl_resource",) and len(raw) >= 2:
            rn, num, sw, sel = operand(raw[0])
            desc = "%s%s dim=0x%08x" % (rn, num, raw[1])
        elif opname in ("mov", "add", "mul", "mad", "max", "min", "dp2", "dp3", "dp4", "rcp", "rsq", "sqrt", "exp", "frc", "sin", "sincos", "div", "eq", "ne", "lt", "ge", "fma", "itof", "tofloat", "trunc", "round_ne") and len(raw) >= 2:
            rn0, n0, sw0, s0 = operand(raw[0])
            rn1, n1, sw1, s1 = operand(raw[1])
            desc = "%s%s%s, %s%s%s" % (rn0, n0, sw0, rn1, n1, sw1)
            if len(raw) >= 3:
                rn2, n2, sw2, s2 = operand(raw[2])
                desc += ", %s%s%s" % (rn2, n2, sw2)
        elif opname in ("sample",) and len(raw) >= 3:
            rn0, n0, sw0, s0 = operand(raw[0])
            rn1, n1, sw1, s1 = operand(raw[1])
            rn2, n2, sw2, s2 = operand(raw[2])
            desc = "%s%s%s, %s%s%s, %s%s%s" % (rn0, n0, sw0, rn1, n1, sw1, rn2, n2, sw2)
        elif opname == "ret":
            desc = ""
        elif opname == "discard":
            pass
        elif len(raw):
            rns = []
            for r in raw[:4]:
                rn, num, sw, sel = operand(r)
                rns.append("%s%s%s" % (rn, num, sw))
            desc = ", ".join(rns)
        lines.append("%6d: %-24s%s%s" % (pos, opname, " sat" if sat else "", (" pred" if pred else "")) + ((" " + desc) if desc else ""))
        if opname == "ret" and length == 0:
            break
        pos = nxt
    return lines

def main():
    path = sys.argv[1]
    with open(path, "rb") as f:
        blob = f.read()
    idx = blob.find(b"DXBC")
    data = blob[idx:]
    start = int(sys.argv[2]) if len(sys.argv) > 2 else None
    starts = [start] if start is not None else [280, 284, 288, 292, 296, 300, 304, 308, 312, 316, 320]
    for s in starts:
        try:
            lines = decode(data, s)
            # coherence: count unknown ops
            unknown = [ln for ln in lines if "op_" in ln]
            print("==== stream start", s, "instructions", len(lines), "unknown", len(unknown))
            for ln in lines[:120]:
                print(ln)
            if len(unknown) == 0:
                break
        except Exception as e:
            print("start", s, "ERR", e)

if __name__ == "__main__":
    main()
