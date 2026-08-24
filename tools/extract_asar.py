import json, os, struct

def extract(asar_path, out_dir):
    with open(asar_path, 'rb') as f:
        data = f.read()
    header_size = struct.unpack('<I', data[4:8])[0]
    # The JSON header starts at the first occurrence of '{"files":'
    idx = data.find(b'{"files":')
    if idx < 0:
        raise RuntimeError('asar header not found')
    # Find the matching end brace (string-aware) since following bytes are binary.
    depth = 0
    end = idx
    in_str = False
    escape = False
    for i in range(idx, len(data)):
        c = data[i]
        if in_str:
            if escape:
                escape = False
            elif c == 0x5c:  # backslash
                escape = True
            elif c == 0x22:  # quote
                in_str = False
            continue
        if c == 0x22:
            in_str = True
        elif c == 0x7b:
            depth += 1
        elif c == 0x7d:
            depth -= 1
            if depth == 0:
                end = i + 1
                break
    header = json.loads(data[idx:end].decode('utf-8'))
    base = 8 + header_size

    def walk(node, path, offset):
        if 'files' not in node:
            return
        for name, child in node['files'].items():
            cur = os.path.join(path, name)
            if 'files' in child:
                walk(child, cur, offset)
            else:
                size = child['size']
                start = offset + int(child['offset'])
                full = os.path.join(out_dir, cur)
                os.makedirs(os.path.dirname(full), exist_ok=True)
                with open(full, 'wb') as out:
                    out.write(data[start:start + size])

    walk(header, '', base)
    print('extracted to', out_dir)

if __name__ == '__main__':
    extract(r"D:\sd\Cytoid flies\cylheim_4.0.3\resources\app.asar", r"V:\cytoid storyboarder\reference\cylheim")
