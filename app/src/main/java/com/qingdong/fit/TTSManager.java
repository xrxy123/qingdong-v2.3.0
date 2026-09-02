package com.qingdong.fit;

import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;

import java.util.HashMap;
import java.util.Locale;

/**
 * 轻量 TTS 封装：安卓系统自带语音引擎，解决 WebView 无 speechSynthesis 导致倒计时无声音的问题。
 * - 在 Activity.onCreate 预初始化，避免首次播报时引擎尚未就绪而丢失语音；
 * - 未就绪时缓存「最新一条」文本，初始化完成后立即播报；
 * - 优先选中文语音；若中文语音包缺失，尝试引导安装 TTS 语言数据；
 * - 每次播报打断上一条（QUEUE_FLUSH），贴合倒计时 3/2/1/开始 的节奏。
 */
public class TTSManager {
    private static TextToSpeech tts;
    private static boolean ready = false;
    private static Context appCtx;
    private static String pending = null;
    private static final Object lock = new Object();

    /** 在 Activity 创建时调用，提前初始化引擎。 */
    public static synchronized void init(Context ctx) {
        appCtx = ctx.getApplicationContext();
        if (tts != null) return;
        try {
            tts = new TextToSpeech(appCtx, status -> {
                if (status == TextToSpeech.SUCCESS) {
                    applyChinese();
                    tts.setSpeechRate(1.0f);
                    tts.setPitch(1.0f);
                    tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
                        @Override public void onStart(String s) { }
                        @Override public void onDone(String s) { }
                        @Override public void onError(String s) { }
                    });
                    synchronized (lock) {
                        ready = true;
                        if (pending != null) {
                            String p = pending; pending = null;
                            speakNow(p);
                        }
                    }
                } else {
                    // 引擎初始化失败（多为缺少语言数据）：引导用户安装 TTS 数据
                    try {
                        Intent install = new Intent(TextToSpeech.Engine.ACTION_INSTALL_TTS_DATA);
                        install.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                        appCtx.startActivity(install);
                    } catch (Throwable ignored) { }
                }
            });
        } catch (Throwable e) {
            tts = null;
        }
    }

    /** 选择中文语音：简体优先，回退繁体/通用中文；都缺失则保留引擎默认语言。 */
    private static void applyChinese() {
        if (tts == null) return;
        int r = tts.setLanguage(Locale.SIMPLIFIED_CHINESE);
        if (r == TextToSpeech.LANG_MISSING_DATA || r == TextToSpeech.LANG_NOT_SUPPORTED) {
            r = tts.setLanguage(Locale.CHINESE);
        }
        if (r == TextToSpeech.LANG_MISSING_DATA || r == TextToSpeech.LANG_NOT_SUPPORTED) {
            r = tts.setLanguage(Locale.TRADITIONAL_CHINESE);
        }
        // 若仍不支持，尝试从已安装语音列表中挑一个含 zh 的
        if (r == TextToSpeech.LANG_MISSING_DATA || r == TextToSpeech.LANG_NOT_SUPPORTED) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                try {
                    Object voicesObj = tts.getClass().getMethod("getVoices").invoke(tts);
                    if (voicesObj instanceof java.util.Set) {
                        java.util.Set<?> voices = (java.util.Set<?>) voicesObj;
                        for (Object v : voices) {
                            if (v == null) continue;
                            try {
                                String name = (String) v.getClass().getMethod("getName").invoke(v);
                                String lang = null;
                                Object locale = v.getClass().getMethod("getLocale").invoke(v);
                                if (locale != null) {
                                    lang = (String) locale.getClass().getMethod("getLanguage").invoke(locale);
                                }
                                if ("zh".equals(lang)
                                        || (name != null && (name.toLowerCase(Locale.US).contains("chinese")
                                        || name.toLowerCase(Locale.US).contains("zh")))) {
                                    tts.getClass().getMethod("setVoice", v.getClass()).invoke(tts, v);
                                    return;
                                }
                            } catch (Throwable ignored2) { }
                        }
                    }
                } catch (Throwable ignored) { }
            }
            // 中文语音包确实缺失：引导用户安装一次 TTS 语言数据
            promptInstallData();
        }
    }

    private static boolean installPrompted = false;
    private static void promptInstallData() {
        if (installPrompted || appCtx == null) return;
        installPrompted = true;
        try {
            Intent install = new Intent(TextToSpeech.Engine.ACTION_INSTALL_TTS_DATA);
            install.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            appCtx.startActivity(install);
        } catch (Throwable ignored) { }
    }

    /** 播报：未就绪时缓存最新一条，初始化完成后自动补播。 */
    public static void speak(Context ctx, String text) {
        if (text == null || text.isEmpty()) return;
        if (tts == null) init(ctx);
        synchronized (lock) {
            if (ready && tts != null) {
                speakNow(text);
            } else {
                pending = text; // 记住最新一条
            }
        }
    }

    private static void speakNow(String text) {
        try { tts.stop(); } catch (Throwable ignored) { }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            HashMap<String, String> params = new HashMap<>();
            params.put(TextToSpeech.Engine.KEY_PARAM_UTTERANCE_ID, "qd_" + System.currentTimeMillis());
            tts.speak(text, TextToSpeech.QUEUE_FLUSH, params);
        } else {
            HashMap<String, String> params = new HashMap<>();
            params.put(TextToSpeech.Engine.KEY_PARAM_UTTERANCE_ID, "qd");
            tts.speak(text, TextToSpeech.QUEUE_FLUSH, params);
        }
    }

    public static synchronized void shutdown() {
        if (tts != null) {
            try { tts.stop(); tts.shutdown(); } catch (Throwable ignored) { }
            tts = null; ready = false; pending = null;
        }
    }
}
