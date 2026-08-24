import zipfile, tempfile, os, json
p = r"C:/Users/Bc/Downloads/10234.penguin.cytoidlevel"
tmp = tempfile.mkdtemp(prefix='penguin_')
with zipfile.ZipFile(p) as z:
    z.extractall(tmp)
print('TMP:', tmp)
print('--- level.json ---')
print(open(os.path.join(tmp,'level.json'), encoding='utf-8').read())
print('--- chart.base.txt head ---')
print('\n'.join(open(os.path.join(tmp,'chart.base.txt'), encoding='utf-8').read().splitlines()[:40]))
print('--- storyboard_base.json ---')
print(open(os.path.join(tmp,'storyboard_base.json'), encoding='utf-8').read())
print('--- storyboard_hard.json ---')
print(open(os.path.join(tmp,'storyboard_hard.json'), encoding='utf-8').read())
open(os.path.join(r'V:\cytoid storyboarder\tools','penguin_tmp_path.txt'),'w').write(tmp)
