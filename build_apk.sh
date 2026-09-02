#!/usr/bin/env bash
# 轻动 (QingDong) v2.3.0 - 本地 APK 构建脚本（macOS / Linux，无需 Android Studio / Gradle）
# 前置：JDK17 (JAVA_HOME)、Android SDK (ANDROID_HOME，含 build-tools;34.0.0 与 platforms;android-34)、python3
set -e

: "${JAVA_HOME:?请先设置 JAVA_HOME 指向 JDK 17}"
: "${ANDROID_HOME:?请先设置 ANDROID_HOME 指向 Android SDK}"

BUILD_TOOLS=$(ls -d "$ANDROID_HOME"/build-tools/*/ | sort -r | head -1)
PLATFORM="$ANDROID_HOME/platforms/android-34"
[ -d "$PLATFORM" ] || { echo "缺少 platforms;android-34，请先: sdkmanager \"platforms;android-34\""; exit 1; }
ANDROID_JAR="$PLATFORM/android.jar"

ROOT="$(cd "$(dirname "$0")" && pwd)"
SRC="$ROOT/app/src/main"
OUT="$ROOT/build"
rm -rf "$OUT"; mkdir -p "$OUT"

echo "[1/6] 编译 MainActivity.java ..."
"$JAVA_HOME/bin/javac" -d "$OUT" -cp "$ANDROID_JAR" "$SRC/java/com/qingdong/fit/MainActivity.java"

echo "[2/6] 转 DEX (classes.dex) ..."
java -jar "$BUILD_TOOLS/lib/d8.jar" --release --output "$OUT/classes.dex" "$OUT/com/qingdong/fit/MainActivity.class"

echo "[3/6] aapt2 编译资源 ..."
"$BUILD_TOOLS/aapt2" compile --dir "$SRC/res" -o "$OUT/res.zip"

echo "[4/6] aapt2 链接生成未签名 APK ..."
"$BUILD_TOOLS/aapt2" link -o "$OUT/app-unsigned.apk" -I "$ANDROID_JAR" --manifest "$SRC/AndroidManifest.xml" -R "$OUT/res.zip"

echo "[5/6] 注入 classes.dex 与 assets(网页) ..."
python3 "$ROOT/inject_assets.py" "$OUT/app-unsigned.apk" "$OUT/app-unaligned.apk" "$OUT/classes.dex" "$SRC/assets"

echo "[6/6] zipalign 对齐 + apksigner 签名 ..."
KEYSTORE="$ROOT/release-key.p12"
if [ ! -f "$KEYSTORE" ]; then
  echo "[错误] 找不到统一签名密钥 release-key.p12（应与 build_apk.sh 同目录）"
  exit 1
fi
"$BUILD_TOOLS/zipalign" -p 4 "$OUT/app-unaligned.apk" "$OUT/app-aligned.apk"
"$BUILD_TOOLS/apksigner" sign --ks "$KEYSTORE" --ks-key-alias qingdong --ks-pass pass:qingdong123 --key-pass pass:qingdong123 --ks-type PKCS12 --out "$ROOT/qingdong-v2.3.0.apk" "$OUT/app-aligned.apk"

echo
echo "==================== 构建完成 ===================="
echo "APK 产物: $ROOT/qingdong-v2.3.0.apk"
echo "安装到手机: adb install \"$ROOT/qingdong-v2.3.0.apk\""
