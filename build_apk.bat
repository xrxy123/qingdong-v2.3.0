@echo off
setlocal EnableDelayedExpansion
REM ============================================================
REM  轻动 (QingDong) v2.3.0 - 本地 APK 构建脚本（无需 Android Studio / Gradle）
REM  前置条件：
REM    1) 已安装 JDK 17，并设置环境变量 JAVA_HOME 指向它
REM    2) 已安装 Android SDK，并设置环境变量 ANDROID_HOME 指向它
REM    3) 已通过 sdkmanager 安装：build-tools;34.0.0 与 platforms;android-34
REM    4) 系统已安装 Python（用于注入资源）
REM  用法：直接双击或命令行运行 build_apk.bat
REM  产物：当前目录下的 qingdong-v2.3.0.apk
REM ============================================================

if "%JAVA_HOME%"=="" ( echo [错误] 请先设置 JAVA_HOME 指向 JDK 17 & exit /b 1 )
if "%ANDROID_HOME%"=="" ( echo [错误] 请先设置 ANDROID_HOME 指向 Android SDK & exit /b 1 )

REM 选取最新的 build-tools 目录
set BT=%ANDROID_HOME%\build-tools
set BUILD_TOOLS=
for /f "delims=" %%d in ('dir /b /ad /o-n "%BT%"') do ( set "BUILD_TOOLS=%BT%\%%d" & goto :found_bt )
:found_bt
if "%BUILD_TOOLS%"=="" ( echo [错误] 未找到 build-tools & exit /b 1 )
echo [使用] build-tools: %BUILD_TOOLS%

set PLATFORM=%ANDROID_HOME%\platforms\android-34
if not exist "%PLATFORM%" ( echo [错误] 缺少 platforms;android-34，请先运行：sdkmanager "platforms;android-34" & exit /b 1 )
set ANDROID_JAR=%PLATFORM%\android.jar

set "ROOT=%~dp0"
set "SRC=%ROOT%app\src\main"
set "OUT=%ROOT%build"
if exist "%OUT%" rd /s /q "%OUT%"
mkdir "%OUT%"

echo [1/6] 编译 MainActivity.java ...
"%JAVA_HOME%\bin\javac" -d "%OUT%" -cp "%ANDROID_JAR%" "%SRC%\java\com\qingdong\fit\MainActivity.java"
if errorlevel 1 exit /b 1

echo [2/6] 转 DEX (classes.dex) ...
java -jar "%BUILD_TOOLS%\lib\d8.jar" --release --output "%OUT%\classes.dex" "%OUT%\com\qingdong\fit\MainActivity.class"
if errorlevel 1 exit /b 1

echo [3/6] aapt2 编译资源 ...
"%BUILD_TOOLS%\aapt2.exe" compile --dir "%SRC%\res" -o "%OUT%\res.zip"
if errorlevel 1 exit /b 1

echo [4/6] aapt2 链接生成未签名 APK ...
"%BUILD_TOOLS%\aapt2.exe" link -o "%OUT%\app-unsigned.apk" -I "%ANDROID_JAR%" --manifest "%SRC%\AndroidManifest.xml" -R "%OUT%\res.zip"
if errorlevel 1 exit /b 1

echo [5/6] 注入 classes.dex 与 assets(网页) ...
python "%ROOT%inject_assets.py" "%OUT%\app-unsigned.apk" "%OUT%\app-unaligned.apk" "%OUT%\classes.dex" "%SRC%\assets"
if errorlevel 1 exit /b 1

echo [6/6] zipalign 对齐 + apksigner 签名 ...
set "KEYSTORE=%ROOT%release-key.p12"
if not exist "%KEYSTORE%" (
  echo [错误] 找不到统一签名密钥 release-key.p12（应与 build_apk.bat 同目录）& exit /b 1
)
"%BUILD_TOOLS%\zipalign.exe" -p 4 "%OUT%\app-unaligned.apk" "%OUT%\app-aligned.apk"
call "%BUILD_TOOLS%\apksigner.bat" sign --ks "%KEYSTORE%" --ks-key-alias qingdong --ks-pass pass:qingdong123 --key-pass pass:qingdong123 --ks-type PKCS12 --out "%ROOT%qingdong-v2.3.0.apk" "%OUT%\app-aligned.apk"
if errorlevel 1 exit /b 1

echo.
echo ==================== 构建完成 ====================
echo APK 产物: %ROOT%qingdong-v2.3.0.apk
echo 安装到手机:  adb install "%ROOT%qingdong-v2.3.0.apk"
endlocal
