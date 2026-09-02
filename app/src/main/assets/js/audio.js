/* =========================================================
 * audio.js — 轻量音效引擎（Web Audio，零依赖、可离线）
 * tick(): 每步/每秒提示音；finish(): 完成提示音（区别于 tick）
 * scroll(): 滚轮滑动轻提示（短促、节流友好）
 * 受 设置-音效提醒 开关控制
 * ========================================================= */
(function (global) {
  'use strict';
  let ctx = null;

  function getCtx() {
    if (ctx) return ctx;
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); }
    catch (e) { ctx = null; }
    return ctx;
  }
  function ensure() {
    const c = getCtx();
    if (c && c.state === 'suspended') c.resume();
    return c;
  }
  function enabled() {
    const st = global.FitStore && global.FitStore.state.settings;
    return st ? st.sound !== false : true;
  }
  function beep(freq, dur, type, vol) {
    if (!enabled()) return;
    const c = getCtx(); if (!c) return;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type || 'sine';
    o.frequency.value = freq;
    const t = c.currentTime;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol || 0.16, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(c.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  }
  // 每步/每秒提醒
  function tick() { beep(1000, 0.05, 'square', 0.10); }
  // 完成提示（上行三音，区别于 tick）
  function finish() {
    const notes = [523.25, 659.25, 783.99];
    notes.forEach((f, i) => setTimeout(() => beep(f, 0.18, 'triangle', 0.2), i * 130));
  }
  // 滚轮滑动轻提示：短促三角波、较低音量，避免污染听感
  function scroll() { beep(880, 0.03, 'triangle', 0.05); }

  // 语音播报（Web Speech API，中文优先）。受音效开关控制；不支持时静默降级。
  let voicesReady = false;
  function ensureVoices() {
    if (voicesReady || !('speechSynthesis' in window)) return;
    // 部分浏览器需等 voiceschanged 才能拿到语音列表
    const load = () => { voicesReady = true; };
    if (window.speechSynthesis.getVoices().length) load();
    else window.speechSynthesis.onvoiceschanged = load;
  }
  function pickZhVoice() {
    const vs = window.speechSynthesis.getVoices ? window.speechSynthesis.getVoices() : [];
    return vs.find(v => /zh|cmn|Chinese/i.test(v.lang + v.name))
      || vs.find(v => /zh|cmn|Chinese/i.test(v.lang))
      || vs[0] || null;
  }
  function speak(text) {
    if (!enabled()) return;
    if (!text) return;
    // 优先使用安卓原生 TTS（通过 JS 桥接 AndroidBridge），解决 WebView 无 speechSynthesis 的问题
    if (window.AndroidBridge && typeof window.AndroidBridge.speak === 'function') {
      try { window.AndroidBridge.speak(text); return; } catch (e) { /* 回退到 Web Speech */ }
    }
    // 回退：Web Speech API（部分浏览器支持）；不支持则静默降级
    if (!('speechSynthesis' in window)) return;
    try {
      ensureVoices();
      window.speechSynthesis.cancel(); // 打断上一条，避免排队堆积
      const u = new SpeechSynthesisUtterance(text);
      const v = pickZhVoice();
      if (v) { u.voice = v; u.lang = v.lang || 'zh-CN'; }
      else u.lang = 'zh-CN';
      u.rate = 1.02; u.pitch = 1.0; u.volume = 1.0;
      window.speechSynthesis.speak(u);
    } catch (e) { /* 忽略：语音失败不影响训练 */ }
  }

  global.FitAudio = { ensure, tick, finish, scroll, speak };
})(window);
