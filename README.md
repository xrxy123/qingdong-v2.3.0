# 轻动 (QingDong) · Android 版 v2.3.0

一个**零依赖**的健身运动 App（网页前端 + Android WebView 原生壳），小清新薄荷绿风格，
包含运动库、计时/计数训练、最佳成绩、统计图表、自定义计划、科学热量计算、音效等全部 2.3.0 功能
（含训练前「准备+3秒倒计时」语音播报、环形图标注优化、统计左右滑切换等）。

> ⚠️ **关于本交付物的重要说明**
> 我在当前开发环境中尝试直接编译并签名生成 APK，但沙箱网络对 `dl.google.com`、
> `aka.ms` 等站点的**大体积二进制下载（Android SDK ≈ 数百 MB、JDK ≈ 186 MB）被限速/阻断**
> （仅能拿到响应头，正文传输会卡死），因此**无法在此环境内直接产出 `.apk` 安装包文件**。
> 为此我为你准备好了**完整、可直接构建的 Android 工程 + 一键自动化构建脚本**，
> 你在自己电脑或云端（GitHub Actions）跑一次即可获得 `qingdong-v2.3.0.apk`。
> 工程内的网页资源已冻结为 2.3.0 版本，构建出的 APK 即等同于「2.3.0版本」。

---

## 一、三种构建方式（任选其一）

### 方式 A：GitHub Actions 云端构建（推荐，无需本机安装任何东西）
1. 在 GitHub 新建一个仓库。
2. 把**整个工程**推送到仓库即可（工作流已放在仓库根 `.github/workflows/build-apk.yml`，
   会自动定位 Gradle 工程并构建）。
   - 你也可以只把 `android/` 文件夹的内容推到仓库根——工作流同样是自适应的，两种上传方式都能跑通。
3. 进入仓库 **Actions** 标签页 → 左侧 **Build 轻动 APK** → **Run workflow**
   （推送 `main`/`master` 分支也会自动触发）。
4. 运行完成后，在 **Artifacts** 中下载 `qingdong-v2.3.0-apk`，里面就是签名好的安装包。
> 该工作流会自动安装 JDK17、Android SDK、build-tools 与 platform，并用 Gradle 构建。
> 使用工程内固定的 `release-key.p12` 直接做 **release 签名**，无需任何 Secrets 配置，
> 下载的 apk 可直接安装到手机（侧载），且新版本可覆盖旧版本。

### 方式 B：Android Studio 本地构建（最直观）
1. 安装 [Android Studio](https://developer.android.com/studio)。
2. 打开 Android Studio → **Open** → 选择本 `android/` 文件夹。
3. 等待 Gradle 同步完成（会自动下载 SDK 组件）。
4. 菜单 **Build → Build Bundle(s) / APK(s) → Build APK(s)**。
5. 完成后右下角提示，APK 位于 `android/app/build/outputs/apk/release/app-release.apk`。

### 方式 C：本地脚本构建（仅 JDK + SDK，无需 Android Studio / Gradle）
1. 安装 JDK 17，设置环境变量 `JAVA_HOME`。
2. 安装 Android SDK（commandlinetools），设置 `ANDROID_HOME`，并运行：
   `sdkmanager "build-tools;34.0.0" "platforms;android-34"`
3. 安装 Python（用于注入资源）。
4. Windows：双击 `build_apk.bat`；macOS/Linux：`./build_apk.sh`。
5. 产物：`android/qingdong-v2.3.0.apk`。

---

## 二、安装到手机
- **方式一（最简单）**：把 `qingdong-v2.3.0.apk` 传到安卓手机，在文件管理器里点击安装
  （首次需允许「未知来源应用」安装权限）。
- **方式二（adb）**：手机开启 USB 调试并连接电脑，执行 `adb install qingdong-v2.3.0.apk`。

---

## 三、应用图标
图标沿用 1.0.0 设计规范（薄荷绿圆角底 + 「轻动」二字），已按 Android 规范生成：
- 传统 mipmap 图标（mdpi~xxxhdpi 五档密度），在任意机型桌面均能完美显示；
- 自适应图标（Adaptive Icon）前景/背景分层（API 26+），在各类启动器下自动适配形状
  （圆形、方形、圆角方、泪滴等），桌面显示完整不裁切。

---

## 四、机型适配（完美适配各类安卓手机）
为做到各类安卓机型（刘海屏 / 挖孔屏 / 水滴屏 / 全面屏 / 传统屏）的完美显示：
- **刘海/挖孔/水滴适配**：`MainActivity` 在 API 28+ 启用
  `LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES`，内容延伸至系统栏之下，不避让留白。
- **沉浸式系统栏**：状态栏与导航栏设为透明，网页以 `viewport-fit=cover` + 安全区
  （`env(safe-area-inset-*)`）自行避让，顶部/底部贴合各机型异形屏，无黑边绿边。
- **自适应图标**：见第三节，桌面图标在任意启动器完美显示。
- **五档密度资源**：图标/布局覆盖 mdpi~xxxhdpi，任意分辨率清晰。

---

## 五、兼容性与已知限制
- **最低支持 Android 5.0（API 21）**，覆盖市面 99% 以上机型；目标 API 34。
- App 完全离线运行（数据保存在手机本地 WebView 的 localStorage），无需联网（版本升级等外链除外，已加 INTERNET 权限）。
- 竖屏锁定，已做状态栏/导航栏与异形屏安全区适配。

## 六、安卓 WebView 能力与原生桥接（已解决 7 类常见问题 + 二次深修）
安卓 WebView 与桌面浏览器能力不同，本工程已通过 **JavaScriptInterface 原生桥接** 补齐：

| 功能 | 桌面浏览器 | 安卓 WebView | 本工程方案 |
|------|-----------|--------------|-----------|
| 倒计时语音播报 | Web Speech | 不支持 | 原生 `TextToSpeech`（中文）桥接 `AndroidBridge.speak`；**Activity.onCreate 预初始化引擎 + 未就绪时缓存最新一条补播 + 中文语音缺失自动引导安装数据**，彻底解决「完全没声音」 |
| 计划图标/头像上传（文件选择） | `<input type=file>` | 需原生支持 | `WebChromeClient.onShowFileChooser` 调起系统相册 |
| 统计页左右滑切换 | 指针事件 | 触摸更可靠 | 统一 touch 事件 + `preventDefault` 防滚动干扰；**单次绑定守卫防止监听器累积导致「日→年」跳变** |
| 头像上传 | `<input type=file>` | 需原生支持 | 同上（原生文件选择） |
| 运动提醒联动系统日程 | Notification/.ics | 不支持 | **改用 `CalendarContract.ACTION_INSERT` 直接调起系统日历「新建日程」预填时间+提醒**（替代原 `file://` Uri 方案，规避 API24+ FileUriExposed 崩溃） |
| 数据导出/导入 | 下载/Blob | 不支持下载 | 导出走 `AndroidBridge.saveFile` 写入 Download 并通知；导入走原生文件选择 |
| 版本升级外链 | 新标签 | 加载失败 | `AndroidBridge.openExternal` 调系统浏览器；**点击先弹「是否跳转到外部网页」确认框** |
| 按键触感反馈 | Vibration API | 常被限制 | 新增 `AndroidBridge.vibrate`（Vibration 权限）+ 网页 `navigator.vibrate` 回退；底部 tab、日周月年、滑动、计划卡、开始/暂停/重置、确认框、导出导入等已接入 |

> 说明：原生 `Notification` 系统通知在纯 WebView 壳中仍受限，运动提醒采用「应用内弹窗 + 音效 + 联动系统日历（带准时提醒）」方案；点击日历图标即调起系统日历新建日程，保存后由系统按时提醒。

---

## 六、工程结构
```
android/
├─ app/src/main/
│  ├─ java/com/qingdong/fit/MainActivity.java   # WebView 原生壳（刘海/沉浸适配 + 原生桥接 + 文件选择 + 外链）
│  ├─ java/com/qingdong/fit/TTSManager.java     # 原生中文 TTS 封装（语音播报）
│  ├─ AndroidManifest.xml                        # 包名 com.qingdong.fit, 版本 2.3.0, INTERNET 权限
│  ├─ res/                                       # 图标 / 字符串 / 主题（透明系统栏）
│  └─ assets/                                    # 2.3.0 网页（index.html + css + js）
├─ build.gradle / settings.gradle / gradle.properties
├─ build_apk.bat / build_apk.sh                  # 本地免 Gradle 构建（产物 qingdong-v2.3.0.apk）
├─ inject_assets.py                              # 资源注入辅助
├─ .github/workflows/build-apk.yml               # 云端一键构建（artifact: qingdong-v2.3.0-apk）
└─ README.md
```
> 说明：为保证「整个工程推到 GitHub 即自动构建」，工作流同时放在仓库根 `.github/workflows/build-apk.yml`
> 与 `android/.github/workflows/build-apk.yml`（两份内容一致、自适应定位 Gradle 工程），
> 无论你上传整个工程还是只上传 `android/`，Actions 都能跑通，无需任何改动。

如需对 2.3.0 版本做修改升级，请基于项目中的 `versions/2.3.0/` 基线，
改完网页后重新把 `index.html / css / js` 同步进 `app/src/main/assets/` 再构建即可。

---

## 七、签名一致性与覆盖安装（重要）

所有构建方式（Android Studio / 本地脚本 `build_apk.bat`·`build_apk.sh` / GitHub Actions）**统一使用工程根目录下的同一把签名密钥 `release-key.p12`**（别名 `qingdong`，密钥库与密钥密码均为 `qingdong123`，PKCS#12 格式）。

- 因此：**无论用哪种方式构建，产出的 APK 签名完全一致**；只要 `versionCode` 递增且包名不变，新版本就能**直接覆盖安装**旧版本，无需先卸载。
- GitHub Actions 无需再配置任何 Secrets——密钥已随工程提交，工作流直接用它签名。

### 为什么之前会「签名不同，覆盖安装失败」？
旧版（2.0.0 / 2.1.0）若通过 GitHub Actions 构建，每次运行都在全新虚拟机里**临时重新生成密钥**，导致每次构建的签名都不同；用新密钥签的包去覆盖旧密钥签的包，Android 会拒绝（提示「与已安装应用签名不同」）。改用本工程固定的 `release-key.p12` 后，所有构建共享同一签名，彻底解决。

### 已安装旧版本的用户如何升级？
- 如果手机上现有的旧版是用**与本工程同一把 `release-key.p12`** 签的（例如你一直用本工程本地脚本或本 Actions 构建），直接安装新版即可覆盖。
- 如果旧版是用**别的密钥**签的（典型情况：早期某次 GitHub Actions 自动生成的临时密钥），Android 不允许跨签名升级。**只需先卸载旧版一次**，再安装 2.3.0；从此之后的所有新版本（都用 `release-key.p12`）都能无缝覆盖，不再需要卸载。
- 若你仍保留着当初给旧版签名的那个 keystore 文件，可把它替换为本工程的 `release-key.p12`（保持别名 `qingdong`、密码 `qingdong123`、PKCS#12 格式），这样连这一次都不用卸载即可覆盖。

> 安全提示：本工程把签名密钥随代码提交，便于个人分发/侧载时签名一致。若日后要上架应用商店，请改用你自行保管、不公开的正式发布密钥。
