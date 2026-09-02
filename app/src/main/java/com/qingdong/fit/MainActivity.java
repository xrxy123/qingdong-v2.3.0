package com.qingdong.fit;

import android.Manifest;
import android.app.Activity;
import android.app.DownloadManager;
import android.content.Context;
import android.content.res.AssetFileDescriptor;
import android.media.AudioAttributes;
import android.media.SoundPool;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.os.Vibrator;
import android.provider.CalendarContract;
import android.provider.Settings;
import android.view.View;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import java.io.File;
import java.io.FileOutputStream;
import java.util.Calendar;
import java.util.HashMap;
import java.util.Locale;

public class MainActivity extends Activity {
    private WebView webView;
    // 文件选择回传通道（<input type="file"> 在 WebView 中需原生桥接才能弹出系统选择器）
    private ValueCallback<Uri[]> filePathCallback;
    private static final int REQ_FILE = 9001;

    // 内嵌语音包：用 SoundPool 播放 assets/tts/*.mp3，彻底摆脱对设备系统 TTS 引擎的依赖（解决手机端倒计时无声）
    private SoundPool soundPool;
    private final java.util.HashMap<String, Integer> soundIds = new java.util.HashMap<>();
    private int lastStreamId = 0;
    private boolean soundReady = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // 刘海屏 / 挖孔屏 / 水滴屏 / 全面屏 适配：内容延伸到系统栏之下，
        // 由网页的 safe-area-inset 安全区自行避让。API 28+ 支持 cutout 短边模式。
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            getWindow().getAttributes().layoutInDisplayCutoutMode =
                    WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
        }
        // 透明系统栏，避免默认黑/绿边遮挡网页顶部（网页已做安全区内边距）
        getWindow().setStatusBarColor(0x00000000);
        getWindow().setNavigationBarColor(0x00000000);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
            getWindow().getDecorView().setSystemUiVisibility(
                    View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                            | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                            | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);
        }

        webView = new WebView(this);
        WebSettings s = webView.getSettings();

        // 启用 JS / 本地存储（localStorage）/ 数据库，保证健身数据持久化
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        try {
            s.setDatabasePath(getApplicationContext().getDir("database", MODE_PRIVATE).getPath());
        } catch (Throwable ignored) { }

        // 适配移动端 viewport（与网页 <meta viewport> 配合）
        s.setUseWideViewPort(true);
        s.setLoadWithOverviewMode(true);
        s.setAllowFileAccess(true);
        s.setAllowFileAccessFromFileURLs(true);
        s.setBuiltInZoomControls(false);
        s.setDisplayZoomControls(false);
        // 混合内容允许（网页为 file://，但版本升级等需加载 https 外链）
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            s.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        }

        // 链接 / 外链处理：应用内 http(s) 交给系统浏览器打开；file:// 资源正常加载
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                if (url == null) return false;
                // 仅本应用自身的资源（asset/file）在 WebView 内加载；其余外链走系统浏览器
                if (url.startsWith("file://") || url.startsWith("about:")) return false;
                try {
                    Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                    startActivity(i);
                } catch (Throwable e) {
                    Toast.makeText(MainActivity.this, "无法打开链接：" + url, Toast.LENGTH_SHORT).show();
                }
                return true; // 已处理，WebView 不再加载
            }
        });

        // WebChromeClient：支持 <input type="file"> 调起系统相册/文件选择器，并暴露原生桥接
        webView.setWebChromeClient(new WebChromeClient() {
            // 安卓 5.0+ 文件选择
            @Override
            public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> filePathCallback,
                                             FileChooserParams fileChooserParams) {
                MainActivity.this.filePathCallback = filePathCallback;
                Intent intent = fileChooserParams.createIntent();
                // 限定为图片选择（相册），更贴合「上传图标/头像」场景；若失败再回退通用选择器
                try {
                    startActivityForResult(intent, REQ_FILE);
                } catch (Throwable e) {
                    try {
                        Intent pick = new Intent(Intent.ACTION_GET_CONTENT);
                        pick.setType("*/*");
                        pick.addCategory(Intent.CATEGORY_OPENABLE);
                        startActivityForResult(pick, REQ_FILE);
                    } catch (Throwable e2) {
                        Toast.makeText(MainActivity.this, "无法打开文件选择器", Toast.LENGTH_SHORT).show();
                        if (filePathCallback != null) { filePathCallback.onReceiveValue(null); filePathCallback = null; }
                    }
                }
                return true;
            }

            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                // 自动授予网页可能请求的权限（如麦克风等），避免卡死
                runOnUiThread(() -> {
                    try { request.grant(request.getResources()); } catch (Throwable ignored) { }
                });
            }
        });

        // 原生桥接：网页通过 window.AndroidBridge.* 调用安卓能力
        webView.addJavascriptInterface(new AndroidBridge(), "AndroidBridge");

        // 提前初始化系统 TTS 引擎（作为内嵌语音的回退）
        TTSManager.init(this);
        // 初始化内嵌语音包（SoundPool 播放 assets/tts/*.mp3）：倒计时优先用内嵌音频，保证手机端一定有声音
        initSoundPool();

        webView.loadUrl("file:///android_asset/index.html");
        setContentView(webView);
    }

    // 文件选择结果回传网页
    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == REQ_FILE) {
            if (filePathCallback == null) return;
            Uri[] results = null;
            if (resultCode == Activity.RESULT_OK && data != null) {
                Uri uri = data.getData();
                if (uri != null) results = new Uri[]{uri};
            }
            filePathCallback.onReceiveValue(results);
            filePathCallback = null;
        }
    }

    // ===== 内嵌语音包（SoundPool）=====
    /** 预加载 assets/tts 下的倒计时语音到 SoundPool，避免依赖系统 TTS 引擎（彻底解决手机端无声）。 */
    private void initSoundPool() {
        try {
            AudioAttributes aa = new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ASSISTANCE_ACCESSIBILITY)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                    .build();
            soundPool = new SoundPool.Builder()
                    .setMaxStreams(4)
                    .setAudioAttributes(aa)
                    .build();
            soundPool.setOnLoadCompleteListener((pool, sampleId, status) -> {
                if (status == 0) soundReady = true;
            });
            loadSound("ready", "tts/ready.mp3");   // 运动请准备
            loadSound("n3", "tts/n3.mp3");         // 3
            loadSound("n2", "tts/n2.mp3");         // 2
            loadSound("n1", "tts/n1.mp3");         // 1
            loadSound("go", "tts/go.mp3");         // 开始
        } catch (Throwable e) {
            soundPool = null; // 极端情况下回退到系统 TTS
        }
    }

    private void loadSound(String key, String assetPath) {
        if (soundPool == null) return;
        try {
            AssetFileDescriptor afd = getAssets().openFd(assetPath);
            int id = soundPool.load(afd, 1);
            if (id != 0) soundIds.put(key, id);
            afd.close();
        } catch (Throwable ignored) {
            // 资源缺失时静默忽略，调用方会回退到系统 TTS
        }
    }

    // ===== 原生桥接对象 =====
    public class AndroidBridge {
        // 是否有原生 TTS（供网页探测，优先用原生播报保证安卓有声音）
        @JavascriptInterface
        public boolean hasTTS() { return true; }

        // 语音播报：使用安卓 TextToSpeech 引擎（中文），解决 WebView 无 speechSynthesis 的问题
        @JavascriptInterface
        public void speak(final String text) {
            if (text == null || text.isEmpty()) return;
            runOnUiThread(() -> TTSManager.speak(MainActivity.this, text));
        }

        // 播放内嵌语音包：name = 资源键(ready/n3/n2/n1/go)，phrase = 原始中文短语（用于回退）。
        // 设备无需安装任何系统 TTS 语言包即可播放倒计时语音。
        @JavascriptInterface
        public void playAsset(final String name, final String phrase) {
            runOnUiThread(() -> {
                if (soundPool != null && soundReady) {
                    Integer id = soundIds.get(name);
                    if (id != null) {
                        lastStreamId = soundPool.play(id, 1.0f, 1.0f, 1, 0, 1.0f);
                        return;
                    }
                }
                // 内嵌音频不可用：回退系统 TTS
                TTSManager.speak(MainActivity.this, (phrase != null && !phrase.isEmpty()) ? phrase : name);
            });
        }

        // 停止当前正在播放的内嵌语音（用于倒计时中途取消）
        @JavascriptInterface
        public void stopSound() {
            runOnUiThread(() -> {
                if (soundPool != null && lastStreamId != 0) {
                    soundPool.stop(lastStreamId);
                    lastStreamId = 0;
                }
            });
        }

        // 打开外部链接（系统浏览器），用于版本升级等
        @JavascriptInterface
        public void openExternal(final String url) {
            if (url == null || url.isEmpty()) return;
            runOnUiThread(() -> {
                try {
                    Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                    startActivity(i);
                } catch (Throwable e) {
                    Toast.makeText(MainActivity.this, "无法打开链接", Toast.LENGTH_SHORT).show();
                }
            });
        }

        // 保存文件到 Download 目录并通知系统（用于数据导出），dataUrl 形如 "data:application/json;base64,...."
        @JavascriptInterface
        public void saveFile(final String fileName, final String dataUrl) {
            runOnUiThread(() -> saveBase64File(fileName, dataUrl));
        }

        // 联动系统日历：直接调起日历应用的「新建日程」界面，预填标题与时间，保存即加入系统提醒。
        // 使用 CalendarContract.ACTION_INSERT（无需文件、无需 WRITE_CALENDAR 权限，兼容性最好）。
        @JavascriptInterface
        public void addEvent(final String title, final String timeHHMM, final String byday) {
            runOnUiThread(() -> {
                try {
                    Calendar begin = nextOccurrence(timeHHMM, byday);
                    Calendar end = (Calendar) begin.clone();
                    end.add(Calendar.MINUTE, 60); // 默认时长 1 小时
                    Intent i = new Intent(Intent.ACTION_INSERT)
                            .setData(CalendarContract.Events.CONTENT_URI)
                            .putExtra(CalendarContract.Events.TITLE, title == null ? "轻动 · 运动提醒" : title)
                            .putExtra(CalendarContract.Events.DESCRIPTION, "来自「轻动」App 的运动提醒，到点动一动~")
                            .putExtra(CalendarContract.EXTRA_EVENT_BEGIN_TIME, begin.getTimeInMillis())
                            .putExtra(CalendarContract.EXTRA_EVENT_END_TIME, end.getTimeInMillis())
                            .putExtra(CalendarContract.Events.HAS_ALARM, 1)          // 带提醒
                            .putExtra(CalendarContract.Reminders.MINUTES, 0);        // 准时提醒
                    startActivity(Intent.createChooser(i, "添加到日程"));
                } catch (Throwable e) {
                    Toast.makeText(MainActivity.this, "无法打开日历：" + e.getMessage(), Toast.LENGTH_SHORT).show();
                }
            });
        }

        // 振动反馈（按键触感）。网页端 navigator.vibrate 在部分 WebView 受限，故提供原生通道。
        @JavascriptInterface
        public void vibrate(final long ms) {
            try {
                Vibrator v = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
                if (v != null) {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        v.vibrate(android.os.VibrationEffect.createOneShot(ms, android.os.VibrationEffect.DEFAULT_AMPLITUDE));
                    } else {
                        v.vibrate(ms);
                    }
                }
            } catch (Throwable ignored) { }
        }
    }

    // 计算下一次提醒时间：今天/明天的 HH:MM；若给定星期集合（MO,WE,FR...），则顺延到最近的匹配日。
    private Calendar nextOccurrence(String timeHHMM, String byday) {
        int hh = 19, mm = 0;
        if (timeHHMM != null && timeHHMM.contains(":")) {
            try { hh = Integer.parseInt(timeHHMM.split(":")[0]); mm = Integer.parseInt(timeHHMM.split(":")[1]); } catch (Throwable ignored) { }
        }
        Calendar cal = Calendar.getInstance();
        cal.set(Calendar.HOUR_OF_DAY, hh);
        cal.set(Calendar.MINUTE, mm);
        cal.set(Calendar.SECOND, 0);
        cal.set(Calendar.MILLISECOND, 0);
        if (cal.getTimeInMillis() < System.currentTimeMillis()) {
            cal.add(Calendar.DAY_OF_MONTH, 1);
        }
        if (byday != null && !byday.isEmpty()) {
            // BYDAY -> Calendar 星期（SUNDAY=1..SATURDAY=7）
            HashMap<String, Integer> map = new HashMap<>();
            map.put("SU", Calendar.SUNDAY); map.put("MO", Calendar.MONDAY); map.put("TU", Calendar.TUESDAY);
            map.put("WE", Calendar.WEDNESDAY); map.put("TH", Calendar.THURSDAY); map.put("FR", Calendar.FRIDAY);
            map.put("SA", Calendar.SATURDAY);
            java.util.HashSet<Integer> allowed = new java.util.HashSet<>();
            for (String token : byday.split(",")) {
                Integer d = map.get(token.trim().toUpperCase(Locale.US));
                if (d != null) allowed.add(d);
            }
            if (!allowed.isEmpty()) {
                int guard = 0;
                while (!allowed.contains(cal.get(Calendar.DAY_OF_WEEK)) && guard < 8) {
                    cal.add(Calendar.DAY_OF_MONTH, 1);
                    guard++;
                }
            }
        }
        return cal;
    }

    // 将 dataUrl(base64) 写入 Download 目录，并用 DownloadManager 通知系统媒体库
    private void saveBase64File(String fileName, String dataUrl) {
        try {
            if (dataUrl == null || !dataUrl.contains(",")) throw new Exception("数据为空");
            String base64 = dataUrl.substring(dataUrl.indexOf(",") + 1);
            byte[] bytes = android.util.Base64.decode(base64, android.util.Base64.DEFAULT);

            // 优先用 DownloadManager，让文件出现在「下载」且通知栏提示
            File downloads = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
            if (!downloads.exists()) downloads.mkdirs();
            File out = new File(downloads, fileName);
            FileOutputStream fos = new FileOutputStream(out);
            fos.write(bytes);
            fos.close();

            DownloadManager dm = (DownloadManager) getSystemService(DOWNLOAD_SERVICE);
            if (dm != null) {
                dm.addCompletedDownload(out.getName(), "轻动数据备份", true,
                        guessMime(fileName), out.getAbsolutePath(), bytes.length, true);
            }
            Toast.makeText(this, "已导出到：Download/" + fileName, Toast.LENGTH_LONG).show();
        } catch (Throwable e) {
            Toast.makeText(this, "导出失败：" + e.getMessage(), Toast.LENGTH_SHORT).show();
        }
    }

    private static String guessMime(String name) {
        if (name != null && name.toLowerCase(Locale.US).endsWith(".json")) return "application/json";
        if (name != null && name.toLowerCase(Locale.US).endsWith(".ics")) return "text/calendar";
        return "application/octet-stream";
    }

    @Override
    public void onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onPause() {
        super.onPause();
        webView.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        webView.onResume();
    }

    @Override
    protected void onDestroy() {
        TTSManager.shutdown();
        if (soundPool != null) {
            try { soundPool.release(); } catch (Throwable ignored) { }
            soundPool = null;
        }
        if (webView != null) {
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }
}
