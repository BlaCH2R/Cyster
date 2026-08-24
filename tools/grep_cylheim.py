import re, sys, os

def grep(path, patterns, width=260, limit=40):
    with open(path, 'r', encoding='utf-8', errors='replace') as f:
        text = f.read()
    print('### FILE:', os.path.basename(path), 'len', len(text))
    count = 0
    for pat in patterns:
        hits = list(re.finditer(pat, text, re.I))
        if not hits:
            print('---', pat, ': 0 hits')
            continue
        print('---', pat, ':', len(hits), 'hits')
        for m in hits[:limit]:
            s = max(0, m.start() - width)
            e = min(len(text), m.end() + width)
            frag = text[s:e]
            frag = re.sub(r'\s+', ' ', frag)
            print('   ...' + frag[:520] + '...')
            count += 1
            if count >= limit * 2:
                return

if __name__ == '__main__':
    which = sys.argv[1] if len(sys.argv) > 1 else 'renderer'
    base = r"V:\cytoid storyboarder\reference\cylheim\.vite"
    if which == 'renderer':
        grep(os.path.join(base, 'renderer', 'main_window', 'assets', 'index-C4trsuFx.js'),
             [r'欢迎|欢迎界面', r'新建项目|新建关卡|创建项目|createProject', r'打开项目|openProject|openLevel',
              r'cytoidlevel|\.ctdsber', r'选择音乐|音乐文件|背景图片|storyboard', r'recent|最近'])
    else:
        grep(os.path.join(base, 'build', 'main-qRA-FMi6.js'),
             [r'cytoidlevel', r'project', r'welcome', r'dialog', r'ipcMain'])
