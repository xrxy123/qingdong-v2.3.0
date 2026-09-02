import sys, zipfile, os

# 把 classes.dex 与 assets（网页文件）注入到 aapt2 链接生成的未签名 APK 中。
# 用法: python inject_assets.py <apk_in> <apk_out> <classes.dex> <assets_dir>
def main():
    apk_in, apk_out, dex, assets_dir = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
    with zipfile.ZipFile(apk_in, 'r') as zin, \
         zipfile.ZipFile(apk_out, 'w', zipfile.ZIP_DEFLATED) as zout:
        for item in zin.infolist():
            if item.filename == 'classes.dex':
                continue  # 稍后重新写入
            zout.writestr(item, zin.read(item.filename))
        with open(dex, 'rb') as f:
            zout.writestr('classes.dex', f.read())
        for root, _, files in os.walk(assets_dir):
            for fn in files:
                full = os.path.join(root, fn)
                rel = os.path.relpath(full, assets_dir).replace(os.sep, '/')
                with open(full, 'rb') as f:
                    zout.writestr('assets/' + rel, f.read())
    print('已注入 classes.dex 与 assets ->', apk_out)

if __name__ == '__main__':
    main()
