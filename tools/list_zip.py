import zipfile
p = r"D:\sd\Cytoid flies\player\示例关卡.cytoidlevel"
with zipfile.ZipFile(p) as z:
    for i in z.infolist():
        print(i.filename, i.file_size)
