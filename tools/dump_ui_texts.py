# -*- coding: utf-8 -*-
"""收集软件内描述性文本与提示信息，导出两列 Excel 供审查修改。
第一列：目前的描述；第二列：审查修改意见（留空）。
"""
import re
import sys
from openpyxl import Workbook

ROOT = r'V:\cytoid storyboarder\app'
FILES = [
    ROOT + r'\src\renderer\app.js',
    ROOT + r'\src\renderer\schema.js',
    ROOT + r'\src\renderer\note_selector_tool.js',
    ROOT + r'\src\renderer\note_selector.html',
    ROOT + r'\src\renderer\index.html',
    ROOT + r'\main.js',
]
OUT = r'V:\cytoid storyboarder\描述性文本与提示信息审查.xlsx'

def clean(s):
    s = re.sub(r'<[^>]+>', '', s)
    # 把 ${xxx} 模板占位符显示为 {xxx}，便于审查
    s = re.sub(r'\$\{([^}]+)\}', r'{\1}', s)
    s = re.sub(r'\s+', ' ', s)
    return s.strip()

def is_ui(s):
    if len(s) < 2:
        return False
    # 只保留中文或常见 UI 词汇，排除纯代码/纯英文变量
    if re.search(r'[\u4e00-\u9fff]', s):
        return True
    return bool(re.match(r'^[A-Za-z][A-Za-z0-9 .\-+×/()（）…:：\u4e00-\u9fff]{2,}$', s)) and not s.startswith(('id', 'type', 'path', 'time', 'note', 'obj'))

strings = []
def add(s):
    c = clean(s)
    if c and is_ui(c) and c not in strings:
        strings.append(c)

for fp in FILES:
    try:
        src = open(fp, 'r', encoding='utf-8').read()
    except Exception as e:
        print('skip', fp, e)
        continue
    # toast('...') / toast(`...`)
    for m in re.finditer(r"toast\(\s*(['\"`])(.*?)\1", src, re.S):
        add(m.group(2))
    # label: '...'（右键菜单 / 下拉选项 / 弹窗按钮）
    for m in re.finditer(r"label:\s*(['\"])(.*?)\1", src, re.S):
        add(m.group(2))
    # title: '...'（弹窗标题）
    for m in re.finditer(r"title:\s*(['\"])(.*?)\1", src, re.S):
        add(m.group(2))
    # placeholder="..."
    for m in re.finditer(r'placeholder="([^"]+)"', src):
        add(m.group(1))
    # title="..."
    for m in re.finditer(r'title="([^"]+)"', src):
        add(m.group(1))
    # help-text">...</div>（含多行）
    for m in re.finditer(r'help-text">(.*?)</div>', src, re.S):
        add(m.group(1))
    # field('标签', ...)
    for m in re.finditer(r"field\(\s*(['\"])(.*?)\1", src):
        add(m.group(2))
    # confirmDialog('标题', '正文', ...) / openModal('标题', ...)
    for m in re.finditer(r"(?:confirmDialog|openModal)\(\s*(['\"])(.*?)\1,\s*(['\"])(.*?)\3", src, re.S):
        add(m.group(2))
        add(m.group(4))
    # textContent = '...'
    for m in re.finditer(r"textContent\s*=\s*(['\"])(.*?)\1", src, re.S):
        add(m.group(2))
    # index.html 菜单/欢迎文案：标签文本
    for m in re.finditer(r'>([^<>{}]{2,80})<', src):
        add(m.group(1))
    # 提示/说明类变量赋值字符串（nsStatus 等拼接前的字面量）
    for m in re.finditer(r"=\s*(['\"])(.*?)\1\s*\+", src):
        add(m.group(2))

# 补充：main.js 对话框标题与按钮
for fp in [ROOT + r'\main.js']:
    src = open(fp, 'r', encoding='utf-8').read()
    for m in re.finditer(r"title:\s*(['\"])(.*?)\1", src):
        add(m.group(2))
    for m in re.finditer(r"name:\s*(['\"])(.*?)\1", src):
        add(m.group(2))

wb = Workbook()
ws = wb.active
ws.title = '文本与提示'
ws.append(['目前的描述', '审查修改意见'])
for s in strings:
    ws.append([s, None])
ws.column_dimensions['A'].width = 70
ws.column_dimensions['B'].width = 50
wb.save(OUT)
print('total:', len(strings))
print('saved:', OUT)
