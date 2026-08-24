import zipfile, os
p = r"C:/Users/Bc/Downloads/10234.penguin.cytoidlevel"
print('exists:', os.path.exists(p), 'size:', os.path.getsize(p))
with zipfile.ZipFile(p) as z:
    for i in z.infolist():
        print(i.file_size, i.filename)
