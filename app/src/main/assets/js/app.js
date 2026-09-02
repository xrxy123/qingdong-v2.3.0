/* =========================================================
 * app.js — 轻动健身 主逻辑
 * 视图：运动 / 计划 / 统计 / 我的
 * 功能：动作库+图示、计时/计数训练+最佳成绩、日程统计图表、
 *       自定义计划、目标/提醒等必备能力
 * ========================================================= */
(function () {
  'use strict';

  const { exercises, categories } = window.FitData;
  const S = window.FitStore;
  const C = window.FitCharts;
  const exMap = Object.fromEntries(exercises.map(e => [e.id, e]));

  // ---------- 工具 ----------
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function fmtSec(sec) {
    sec = Math.round(sec);
    const m = Math.floor(sec / 60), s = sec % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }
  function fmtDur(sec) {
    sec = Math.round(sec);
    if (sec < 60) return sec + '秒';
    const m = Math.floor(sec / 60), s = sec % 60;
    return s ? `${m}分${s}秒` : `${m}分钟`;
  }
  function fmtCal(c) { return Math.round(c); }
  function todayKey() { return S.dayKey(new Date()); }
  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 1900);
  }

  // 触感反馈：优先原生 Vibrator（安卓 WebView 的 navigator.vibrate 常被限制），回退 Web Vibration API
  function haptic(ms) {
    const m = ms || 10;
    try {
      if (window.AndroidBridge && typeof window.AndroidBridge.vibrate === 'function') {
        window.AndroidBridge.vibrate(m); return;
      }
    } catch (e) { /* 回退 */ }
    try { if (navigator.vibrate) navigator.vibrate(m); } catch (e) { }
  }

  // ---------- 导航 ----------
  let currentView = 'home';
  let homeCat = '全部';

  function switchView(v) {
    currentView = v;
    $$('.view').forEach(x => x.classList.remove('is-active'));
    $('#view-' + v).classList.add('is-active');
    $$('.tab').forEach(t => t.classList.toggle('is-active', t.dataset.view === v));
    renderHeader();
    ({ home: renderHome, plans: renderPlans, stats: renderStats, profile: renderProfile })[v]();
    $('#view-' + v).scrollTop = 0;
  }

  function renderHeader() {
    const h = $('#appHeader');
    const map = {
      home: { t: '轻动', s: '今天也要好好动一动~' },
      plans: { t: '我的计划', s: '点开计划，一键开练' },
      stats: { t: '运动统计', s: '看见坚持的力量' },
      profile: { t: '我的', s: '资料 · 目标 · 提醒' }
    };
    const m = map[currentView];
    h.innerHTML = `<div class="header-row">
      <div><h1>${m.t}</h1><div class="sub">${m.s}</div></div>
      <div class="header-emoji">${headerEmoji()}</div></div>`;
  }

  // 右上角标志：运动页显示用户头像（无头像回退草叶），其余视图用图标
  function headerEmoji() {
    if (currentView === 'home') {
      const av = S.state.profile.avatar;
      if (av) return `<img class="header-avatar" src="${av}" alt="头像">`;
      return '🌿';
    }
    if (currentView === 'profile') {
      // 今日状态表情显示在「我的」标题最右上方
      return `<span class="header-mood" role="img" aria-label="今日状态" title="${esc(todayMoodTip())}">${todayMoodEmoji()}</span>`;
    }
    return { plans: '📋', stats: '📊' }[currentView] || '🌿';
  }

  // 今日状态表情：未开始=🤔、已开始但 ≤30 千卡=😐、>30 千卡=😄
  function todayMoodEmoji() {
    const tk = S.dayKey(new Date());
    const recs = S.getRecords().filter(r => S.dayKey(r.date) === tk);
    const cal = recs.reduce((s, r) => s + (r.calories || 0), 0);
    if (cal > 30) return '😄';
    if (recs.length > 0) return '😐';
    return '🤔';
  }
  function todayMoodTip() {
    const tk = S.dayKey(new Date());
    const recs = S.getRecords().filter(r => S.dayKey(r.date) === tk);
    const cal = recs.reduce((s, r) => s + (r.calories || 0), 0);
    if (cal > 30) return `今日已消耗 ${cal.toFixed(2)} 千卡，状态超棒！`;
    if (recs.length > 0) return `今日已消耗 ${cal.toFixed(2)} 千卡，再加把劲吧`;
    return '今日还没开始运动，去练一组吧';
  }

  // ---------- 首页 ----------
  function renderHome() {
    const view = $('#view-home');
    const today = todayKey();
    const agg = S.aggregate(S.recordsOfDay(today));
    const hero = `<div class="hero">
      <div class="ring"></div><div class="ring2"></div>
      <h2>嗨，${esc(S.state.profile.name)} 👋</h2>
      <p>今日已消耗 <b>${fmtCal(agg.calories)}</b> 千卡</p>
      <div class="hero-stats">
        <div>今日时长<b>${fmtDur(agg.durationSec)}</b></div>
        <div>今日次数<b>${agg.count}</b></div>
        <div>打卡<b>${agg.sessions}次</b></div>
      </div>
    </div>`;

    const chips = categories.map(c =>
      `<button class="chip ${c === homeCat ? 'is-active' : ''}" data-cat="${c}">${c}</button>`).join('');

    const list = (homeCat === '全部' ? exercises : exercises.filter(e => e.category === homeCat))
      .slice().sort((a, b) => S.getClick(b.id) - S.getClick(a.id)); // 按点击次数降序，同分保持原序
    const grid = `<div class="ex-grid">${list.map(e => `
      <div class="ex-card" data-ex="${e.id}">
        <div class="ex-icon">${e.icon}</div>
        <div class="ex-name">${e.name}</div>
        <div class="ex-mode ${e.mode === 'timer' ? 'mode-timer' : 'mode-count'}">
          <span class="dot"></span>${e.mode === 'timer' ? '计时' : '计数'}
        </div>
      </div>`).join('')}</div>`;

    view.innerHTML = `${hero}
      <div class="section-title">动作库 <span class="more">${list.length} 个动作</span></div>
      <div class="chip-row">${chips}</div>
      ${grid}`;

    $$('.chip', view).forEach(b => b.onclick = () => { homeCat = b.dataset.cat; renderHome(); });
    $$('.ex-card', view).forEach(c => c.onclick = () => openExerciseDetail(c.dataset.ex));
  }

  // ---------- 动作详情 ----------
  function openExerciseDetail(exId) {
    const e = exMap[exId];
    S.bumpClick(exId); // 记录动作点击次数，用于动作库动态排序
    const best = S.getBest(exId);
    const goal = S.getGoal(exId);
    let goalHtml = '';
    if (goal) {
      const cur = best ? best.value : 0;
      const pct = Math.min(100, Math.round(cur / goal.target * 100));
      const unit = goal.type === 'time' ? '秒' : '次';
      goalHtml = `<div class="card mt16">
        <div class="flex between"><span class="muted">目标进度</span><span class="muted">${cur}/${goal.target}${unit}</span></div>
        <div style="height:10px;background:var(--mint-50);border-radius:999px;margin-top:8px;overflow:hidden">
          <div style="height:100%;width:${pct}%;background:var(--mint-500);border-radius:999px"></div></div>
      </div>`;
    }
    const bestHtml = best
      ? `<div class="best-badge">🏆 最佳：${e.mode === 'timer' ? fmtDur(best.value) : best.value + ' 次'}</div>`
      : `<div class="best-badge" style="background:var(--mint-50);color:var(--mint-700)">暂无记录，去创造第一个吧</div>`;

    const sciNote = e.mode === 'timer'
      ? `约 <b>${e.met.toFixed(1)}</b> 千卡/分钟（按60kg估算）· 强度 ${e.met} MET`
      : `每个约 <b>${e.secPerRep}</b> 秒 · 约 <b>${(e.met * e.secPerRep / 60).toFixed(2)}</b> 千卡/次（按60kg估算）`;

    openModal(`
      <div class="center">
        <div class="big-illu" style="width:120px;height:120px;margin-top:0">${e.icon}</div>
        <div class="session-ex-name">${e.name}</div>
        <div class="session-ex-cat">${e.category} · ${e.mode === 'timer' ? '计时挑战' : '计数挑战'}</div>
        ${bestHtml}
        <div class="sci-note">🔬 ${sciNote}</div>
      </div>
      <div class="card mt16">
        <div class="muted mb8">锻炼部位</div>
        <div>${e.muscles.map(m => `<span class="chip" style="margin:0 6px 6px 0">${m}</span>`).join('')}</div>
        <div class="muted mb8 mt16">动作要领</div>
        <ul style="padding-left:18px">${e.steps.map(s => `<li style="margin:4px 0;font-size:13.5px">${s}</li>`).join('')}</ul>
      </div>
      ${goalHtml}
      <div class="session-actions">
        <button class="btn ghost" id="setGoalBtn">设置目标</button>
        <button class="btn" id="startExBtn">开始训练</button>
      </div>
    `);
    $('#startExBtn').onclick = () => { closeModal(); openSession([{ exId, target: 0, type: e.mode === 'timer' ? 'time' : 'count' }], null); };
    $('#setGoalBtn').onclick = () => openGoalModal(exId);
  }

  function openGoalModal(exId) {
    const e = exMap[exId];
    const g = S.getGoal(exId);
    const isTimer = e.mode === 'timer';
    const type = isTimer ? 'time' : 'count';
    const unit = isTimer ? '秒' : '次';
    const defVal = isTimer ? 60 : 30;
    const typeLabel = isTimer ? '时长目标' : '次数目标';
    openModal(`
      <h3>设置「${e.name}」目标</h3>
      <div class="field">
        <label>目标类型</label>
        <div class="goal-type-tag">${typeLabel}</div>
      </div>
      <div class="field">
        <label>目标数值（${unit}）</label>
        <input id="goalVal" type="number" min="1" value="${g && g.type === type ? g.target : defVal}" />
      </div>
      <p class="muted" style="font-size:12px;margin:-4px 0 8px">保存后，点「开始训练」会自动以该目标为默认值；训练中仍可拖动时间轴自由调整。</p>
      <div class="session-actions">
        <button class="btn ghost" id="goalCancel">取消</button>
        <button class="btn" id="goalSave">保存目标</button>
      </div>
    `);
    $('#goalCancel').onclick = closeModal;
    $('#goalSave').onclick = () => {
      const v = Math.max(1, parseInt($('#goalVal').value) || 1);
      S.setGoal(exId, { type, target: v });
      toast('目标已保存'); closeModal();
    };
  }

  // ---------- 训练会话 ----------
  let session = null;

  // 依据已设目标，初始化本次训练的滑块默认值（计划步骤目标优先，其次个人目标）
  function initTarget(e, step) {
    if (step && step.target > 0) return Math.max(0, step.target | 0);
    const g = S.getGoal(e.id);
    if (g && ((e.mode === 'timer' && g.type === 'time') || (e.mode === 'count' && g.type === 'count'))) {
      return Math.max(0, g.target | 0);
    }
    return 0;
  }

  function openSession(steps, planName) {
    session = { queue: steps, idx: 0, planName, restUntil: 0 };
    renderSession();
  }

  function renderSession() {
    if (session._timer) { clearInterval(session._timer); session._timer = null; }
    session._finished = false; // 重置「已完成」标记，确保下一项能正常完成
    session._started = false;  // 重置「已开始」标记，确保下次进入需重新倒计时
    const root = $('#sessionRoot');
    const step = session.queue[session.idx];
    const exId = step.exId;
    const e = exMap[exId];
    const best = S.getBest(exId);
    const total = session.queue.length;
    const progress = total > 1 ? `第 ${session.idx + 1}/${total} 项` : '';
    const title = session.planName || e.name;

    const bestHtml = best
      ? `<div class="best-badge">🏆 最佳 ${e.mode === 'timer' ? fmtDur(best.value) : best.value + ' 次'}</div>`
      : '';

    let bodyUi;
    if (e.mode === 'timer') {
      const init = initTarget(e, step);
      bodyUi = `
        <div class="target-set">
          <div class="flex between"><span class="muted">设定时长目标（拖动）</span><b id="tgtVal">${init > 0 ? init + ' 秒' : '不限定'}</b></div>
          <input type="range" id="tgtRange" min="0" max="600" step="1" value="${init}">
          <div class="muted" style="font-size:11px">0 = 自由计时，达到目标自动结束</div>
        </div>
        <div class="timer-display" id="tm">0:00</div>
        <div class="sub-display" id="tmTarget">${init > 0 ? '目标 ' + fmtSec(init) : ''}</div>
        <div class="session-actions">
          <button class="btn ghost" id="resetBtn">重置</button>
          <button class="btn" id="toggleBtn">开始</button>
          <button class="btn coral" id="finishBtn">完成</button>
        </div>`;
    } else {
      const init = initTarget(e, step);
      bodyUi = `
        <div class="target-set">
          <div class="flex between"><span class="muted">设定次数目标（拖动）</span><b id="tgtVal">${init > 0 ? init + ' 次' : '自由计数'}</b></div>
          <input type="range" id="tgtRange" min="0" max="200" step="1" value="${init}">
          <div class="muted" style="font-size:11px">0 = 自由计数（点「完成」结束）；设目标后点「开始」按科学节奏自动计数至目标</div>
        </div>
        <div class="count-display" id="cnt">0</div>
        <div class="sub-display">已完成次数 / <span id="cntTarget">${init > 0 ? init + ' 次' : ''}</span></div>
        <div class="auto-note" id="autoNote">${init > 0 ? '已设目标 · 点「开始」自动计数' : '点「开始」自动计数'}</div>
        <div class="prog"><div class="prog-fill" id="progFill" style="width:0%"></div></div>
        <div class="session-actions">
          <button class="btn ghost" id="resetBtn">重置</button>
          <button class="btn" id="toggleBtn">开始</button>
          <button class="btn coral" id="finishBtn">完成</button>
        </div>`;
    }

    root.innerHTML = `<div class="session">
      <div class="session-head">
        <span class="x" id="closeSession">✕</span>
        <span class="t">${esc(title)}</span>
        <span class="progress">${progress}</span>
      </div>
      <div class="session-body">
        <div class="big-illu">${e.icon}</div>
        <div class="session-ex-name">${e.name}</div>
        <div class="session-ex-cat">${e.category} · ${e.mode === 'timer' ? '计时模式' : '计数模式'}</div>
        ${bestHtml}
        ${bodyUi}
      </div>
    </div>`;
    root.classList.add('is-open');

    $('#closeSession').onclick = () => closeSession();
    if (e.mode === 'timer') bindTimer(e);
    else bindCounter(e);
  }

  // 训练前准备与倒计时：弹出覆盖层 →「运动请准备」语音 → 3/2/1/开始 数字语音 → 回调 onStart 真正开始训练
  // 注意：本函数由用户点击动作界面的「开始」按钮触发（而非「开始训练」入口），结束才正式开训
  function runReadyCountdown(e, onStart) {
    const root = $('#sessionRoot');
    if (!root) return;
    // 防止重复叠加（idx 切换时 renderSession 会重跑）
    const existing = root.querySelector('.ready-mask');
    if (existing) existing.remove();

    const mask = document.createElement('div');
    mask.className = 'ready-mask';
    mask.innerHTML = `
      <div class="ready-card">
        <div class="ready-illu">${e.icon}</div>
        <div class="ready-name">${esc(e.name)}</div>
        <div class="ready-stage" id="readyStage">
          <div class="ready-title" id="readyTitle">运动请准备</div>
        </div>
        <div class="ready-hint">准备好姿势，马上开始</div>
      </div>`;
    root.appendChild(mask);
    // 触发进入动画
    requestAnimationFrame(() => mask.classList.add('show'));

    window.FitAudio.ensure();
    window.FitAudio.speak('运动请准备');

    const stage = mask.querySelector('#readyStage');

    // 序列：准备停留 → 3 → 2 → 1 → 开始
    const seq = [
      { txt: '3', speak: '3', hold: 1000 },
      { txt: '2', speak: '2', hold: 1000 },
      { txt: '1', speak: '1', hold: 1000 },
      { txt: '开始', speak: '开始', hold: 600 }
    ];
    let i = 0;
    let timer = null;
    let cancelled = false;

    function showNum(item) {
      // 重建数字节点以重放缩放动画
      const cls = item.txt === '开始' ? 'ready-num is-go' : 'ready-num';
      stage.innerHTML = `<div class="${cls}">${esc(item.txt)}</div>`;
      haptic(item.txt === '开始' ? 22 : 12); // 每个数字一下轻触感，「开始」稍重
      window.FitAudio.speak(item.speak);
      timer = setTimeout(() => {
        i++;
        if (i < seq.length) showNum(seq[i]);
        else finishCountdown();
      }, item.hold);
    }

    function finishCountdown() {
      if (cancelled) return;
      mask.classList.remove('show');
      mask.classList.add('hide');
      setTimeout(() => {
        if (cancelled) return;
        mask.remove();
        // 真正开始训练（由调用方传入的 onStart，避免递归触发 toggle）
        if (typeof onStart === 'function') onStart();
      }, 320);
    }

    // 准备停留 1.2s 后开始数字倒计时
    timer = setTimeout(() => showNum(seq[0]), 1200);

    // 用户中途点 X 关闭时，撤掉倒计时避免自动开训
    const onClose = () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      window.FitAudio.speak && window.speechSynthesis && window.speechSynthesis.cancel();
      mask.remove();
    };
    const closeBtn = $('#closeSession');
    if (closeBtn) closeBtn.addEventListener('click', onClose, { once: true });
  }

  function closeSession() {
    if (session && session._timer) clearInterval(session._timer);
    $('#sessionRoot').innerHTML = '';
    session = null;
  }

  function bindTimer(e) {
    const weight = S.state.profile.weight;
    let running = false, elapsed = 0, startTs = 0, lastTick = 0;
    const tm = $('#tm'), toggle = $('#toggleBtn'), finish = $('#finishBtn'), reset = $('#resetBtn'), tgt = $('#tmTarget');
    const range = $('#tgtRange');
    session.target = parseInt(range.value) || 0;
    range.addEventListener('input', () => {
      if (running) return;
      session.target = parseInt(range.value) || 0;
      const v = session.target;
      $('#tgtVal').textContent = v > 0 ? v + ' 秒' : '不限定';
      tgt.textContent = v > 0 ? '目标 ' + fmtSec(v) : '';
    });
    session._get = () => ({ mode: 'timer', value: Math.round(elapsed), durationSec: Math.round(elapsed), calories: window.FitData.calcCalories(e, Math.round(elapsed), weight) });
    session._timer = setInterval(() => {
      if (running) {
        elapsed = (performance.now() - startTs) / 1000;
        tm.textContent = fmtSec(elapsed);
        const sec = Math.floor(elapsed);
        if (sec !== lastTick) { lastTick = sec; if (sec > 0) window.FitAudio.tick(); }
        if (session.target > 0 && elapsed >= session.target) {
          running = false; toggle.textContent = '开始';
          finishExercise(e);
        }
      }
    }, 100);
    // 真正开始/继续训练（倒计时结束或暂停后再次点击都会走到这里）
    function beginRun() {
      running = true;
      startTs = performance.now() - elapsed * 1000; if (range) range.disabled = true;
      toggle.textContent = '暂停'; lastTick = Math.floor(elapsed);
    }
    toggle.onclick = () => {
      haptic(14);
      window.FitAudio.ensure();
      if (!running && !session._started) {
        // 首次点击「开始」：先弹准备 + 倒计时，结束才真正开训
        session._started = true;
        runReadyCountdown(e, beginRun);
      } else {
        running = !running;
        if (running) beginRun();
        else toggle.textContent = '继续';
      }
    };
    reset.onclick = () => { haptic(10); running = false; session._started = false; elapsed = 0; tm.textContent = '0:00'; toggle.textContent = '开始'; if (range) range.disabled = false; };
    finish.onclick = () => finishExercise(e);
  }

  function bindCounter(e) {
    const weight = S.state.profile.weight;
    const cnt = $('#cnt'), tgtSpan = $('#cntTarget'), autoNote = $('#autoNote'), progFill = $('#progFill');
    const toggle = $('#toggleBtn'), finish = $('#finishBtn'), reset = $('#resetBtn');
    const range = $('#tgtRange');
    let count = 0, running = false, elapsed = 0, last = performance.now();
    const getTarget = () => parseInt(range.value) || 0;
    session.target = getTarget();

    function updateProg() {
      const t = session.target;
      const pct = t > 0 ? Math.min(100, Math.round(count / t * 100)) : 0;
      if (progFill) progFill.style.width = pct + '%';
    }
    function refreshNote() {
      const t = session.target;
      if (autoNote) autoNote.textContent = t > 0 ? `已设目标(${t}次) · 点「开始」自动计数` : '点「开始」自动计数';
    }
    if (reset) reset.onclick = () => {
      running = false; count = 0; cnt.textContent = '0';
      if (toggle) toggle.textContent = '开始';
      elapsed = 0; last = performance.now();
      if (range) range.disabled = false;
      session._started = false; // 重置后仍需重新倒计时，下次点「开始」再触发准备+倒计时
      updateProg();
      if (autoNote) autoNote.textContent = '点「开始」自动计数';
    };
    range.addEventListener('input', () => {
      if (running) return;
      session.target = getTarget();
      const v = session.target;
      $('#tgtVal').textContent = v > 0 ? v + ' 次' : '自由计数';
      if (tgtSpan) tgtSpan.textContent = v > 0 ? v + ' 次' : '';
      refreshNote(); updateProg();
    });

    session._get = () => ({ mode: 'count', value: count, durationSec: Math.round(count * e.secPerRep), calories: window.FitData.calcCalories(e, count, weight) });

    session._timer = setInterval(() => {
      if (!running) { last = performance.now(); return; }
      const now = performance.now();
      elapsed += (now - last) / 1000; last = now;
      // 按平均每次用时自动累计次数（科学节奏）
      const due = Math.floor(elapsed / e.secPerRep);
      while (count < due) {
        count++; cnt.textContent = count; window.FitAudio.tick(); updateProg();
        if (session.target > 0 && count >= session.target) { autoFinish(); return; }
      }
    }, 100);

    function autoFinish() { running = false; if (toggle) toggle.textContent = '开始'; session._started = false; finishExercise(e); }

    // 真正开始/继续训练（倒计时结束或暂停后再次点击都会走到这里）
    function beginRun() {
      running = true;
      if (range) range.disabled = true; last = performance.now();
      if (toggle) toggle.textContent = '暂停';
    }
    toggle.onclick = () => {
      haptic(14);
      window.FitAudio.ensure();
      if (!running && !session._started) {
        // 首次点击「开始」：先弹准备 + 倒计时，结束才真正开训
        session._started = true;
        runReadyCountdown(e, beginRun);
      } else {
        running = !running;
        if (running) beginRun();
        else if (toggle) toggle.textContent = '继续';
      }
    };
    finish.onclick = () => finishExercise(e);
  }

  function finishExercise(e) {
    if (session._finished) return;
    if (session._timer) { clearInterval(session._timer); session._timer = null; }
    const data = session._get();
    if (data.value <= 0) { toast('还没有成绩哦'); return; }
    session._finished = true;
    window.FitAudio.finish();
    const before = S.getBest(e.id);
    const rec = S.addRecord({
      exId: e.id, mode: e.mode, value: data.value,
      calories: data.calories, durationSec: data.durationSec
    });
    const isNew = !before || data.value > before.value;
    showResult(e, data, isNew, rec);
  }

  function showResult(e, data, isNew, rec) {
    const unit = e.mode === 'timer' ? '秒' : '次';
    const valTxt = e.mode === 'timer' ? fmtDur(data.value) : data.value;
    const hasNext = session.idx < session.queue.length - 1;
    // 来自计划且为末项 → 弹出表扬总结界面
    if (!hasNext && session.planName) { showPlanComplete(); return; }
    $('#sessionRoot').querySelector('.session-body').innerHTML = `
      <div class="result-card">
        ${isNew ? '<div class="newbest">🎉 新纪录！</div>' : ''}
        <div class="session-ex-name">${e.name} 完成</div>
        <div class="result-val">${valTxt}</div>
        <div class="result-unit">${e.mode === 'timer' ? '坚持时长' : '完成次数'}</div>
        <div class="result-stats">
          <div><b>${fmtCal(data.calories)}</b><span>千卡</span></div>
          <div><b>${fmtDur(data.durationSec)}</b><span>时长</span></div>
          <div><b>${S.getRecords().length}</b><span>总打卡</span></div>
        </div>
        ${hasNext
          ? `<div class="session-actions"><button class="btn ghost" id="endBtn">结束</button><button class="btn" id="nextBtn">下一项 →</button></div>`
          : `<div class="session-actions"><button class="btn block" id="endBtn">完成</button></div>`}
      </div>`;
    const next = $('#nextBtn'); if (next) next.onclick = () => { session.idx++; renderSession(); };
    $('#endBtn').onclick = () => { closeSession(); switchView(currentView); };
  }

  // 完成整个计划的表扬总结界面
  function showPlanComplete() {
    // 汇总本次计划所有动作的成绩
    const rows = session.queue.map(s => {
      const e = exMap[s.exId]; if (!e) return null;
      const recs = S.getRecords().filter(r => r.exId === s.exId);
      // 取该动作最近一条记录作为本次成绩
      const rec = recs[recs.length - 1];
      const val = rec ? (e.mode === 'timer' ? fmtDur(rec.value) : rec.value + ' 次') : '—';
      const cal = rec ? Math.round(rec.calories) : 0;
      return { name: e.name, icon: e.icon, val, cal };
    }).filter(Boolean);
    const totalCal = rows.reduce((s, r) => s + r.cal, 0);
    const totalDur = session.queue.reduce((s, st) => {
      const e = exMap[st.exId]; if (!e) return s;
      const recs = S.getRecords().filter(r => r.exId === st.exId);
      const rec = recs[recs.length - 1];
      return s + (rec ? rec.durationSec : 0);
    }, 0);

    const listHtml = rows.map((r, i) => `
      <div class="pc-row">
        <div class="pc-ic">${r.icon}</div>
        <div class="pc-name">${esc(r.name)}</div>
        <div class="pc-val">${r.val}</div>
        <div class="pc-cal">${r.cal} 千卡</div>
      </div>`).join('');

    $('#sessionRoot').querySelector('.session-body').innerHTML = `
      <div class="plan-complete">
        <div class="pc-badge">🏆</div>
        <div class="pc-title">太棒了！计划完成</div>
        <div class="pc-sub">「${esc(session.planName)}」全部 ${rows.length} 个动作已打卡</div>
        <div class="pc-stats">
          <div><b>${rows.length}</b><span>完成动作</span></div>
          <div><b>${fmtDur(totalDur)}</b><span>总时长</span></div>
          <div><b>${fmtCal(totalCal)}</b><span>千卡</span></div>
        </div>
        <div class="pc-list">${listHtml}</div>
        <div class="pc-praise">🎉 坚持就是胜利，今天也是更好的自己！明天继续加油~</div>
        <div class="session-actions">
          <button class="btn block lg" id="pcDone">完成</button>
        </div>
      </div>`;
    $('#pcDone').onclick = () => { closeSession(); switchView(currentView); };
  }

  // ---------- 计划 ----------
  // 计划步骤列表（兼容旧版 exIds 数据：自动迁移为 steps）
  function planSteps(p) {
    if (p.steps && p.steps.length) return p.steps;
    return (p.exIds || []).map(id => ({
      exId: id, target: 0,
      type: (exMap[id] && exMap[id].mode === 'timer') ? 'time' : 'count'
    }));
  }

  // 计划卡片右滑显示删除按钮（向左拖出删除区，松手吸附开/合）
  function bindSwipeDelete(wrap, card) {
    const DEL_W = 84;          // 删除区宽度
    let startX = 0, startY = 0, open = false, dragging = false, x0 = 0, offset = 0, lockY = false;
    function setOffset(v) {
      offset = Math.max(-DEL_W, Math.min(0, v));
      card.style.transform = `translateX(${offset}px)`;
    }
    function open_() { open = true; wrap.classList.add('is-open'); setOffset(-DEL_W); }
    function close_() { open = false; wrap.classList.remove('is-open'); setOffset(0); }

    card.addEventListener('touchstart', (e) => {
      dragging = true; lockY = false;
      startX = e.touches[0].clientX; startY = e.touches[0].clientY;
      x0 = offset; card.style.transition = 'none';
    }, { passive: true });
    card.addEventListener('touchmove', (e) => {
      if (!dragging) return;
      const dx = e.touches[0].clientX - startX;
      const dy = e.touches[0].clientY - startY;
      if (!lockY && Math.abs(dy) > Math.abs(dx)) { lockY = true; dragging = false; return; } // 纵向滚动，放弃
      if (Math.abs(dx) > 6) lockY = true;
      setOffset(x0 + dx);
    }, { passive: true });
    card.addEventListener('touchend', () => {
      if (!dragging) return;
      dragging = false; card.style.transition = '';
      if (offset < -DEL_W / 2) open_(); else close_();
    });

    // 桌面预览：鼠标拖动
    card.addEventListener('mousedown', (e) => {
      dragging = true; startX = e.clientX; startY = e.clientY; x0 = offset; card.style.transition = 'none';
      const move = (ev) => {
        if (!dragging) return;
        const dx = ev.clientX - startX;
        setOffset(x0 + dx);
      };
      const up = () => {
        dragging = false; card.style.transition = '';
        document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up);
        if (offset < -DEL_W / 2) open_(); else close_();
      };
      document.addEventListener('mousemove', move); document.addEventListener('mouseup', up);
    });
  }

  function renderPlans() {
    const view = $('#view-plans');
    const plans = S.getPlans();
    let listHtml;
    if (!plans.length) {
      listHtml = `<div class="empty"><div class="big">📋</div><p>还没有健身计划</p><p>创建一个计划，把动作组合在一起吧</p></div>`;
    } else {
      listHtml = plans.map(p => {
        const steps = planSteps(p);
        const exs = steps.map(s => exMap[s.exId]).filter(Boolean);
        const detail = exs.slice(0, 3).map(x => x.name).join('、') + (exs.length > 3 ? '…' : '');
        const emojiHtml = (p.emoji && p.emoji.indexOf('data:image') === 0)
          ? `<img src="${p.emoji}" alt="${esc(p.name)}" />`
          : (p.emoji || '💪');
        return `<div class="plan-card-wrap" data-plan="${p.id}">
          <div class="plan-del"><button class="plan-del-btn">删除</button></div>
          <div class="plan-card">
            <div class="plan-emoji">${emojiHtml}</div>
            <div class="plan-info">
              <h3>${esc(p.name)}</h3>
              <p>${steps.length} 个动作 · ${detail || '自定义'}</p>
            </div>
            <span class="plan-go">开始 ›</span>
          </div>
        </div>`;
      }).join('');
    }
    view.innerHTML = `
      <div class="section-title">我的健身计划</div>
      ${listHtml}
      <button class="btn block lg mt16" id="addPlanBtn">＋ 新建计划</button>`;
    $$('.plan-card-wrap', view).forEach(wrap => {
      const p = S.getPlans().find(x => x.id === wrap.dataset.plan);
      const card = wrap.querySelector('.plan-card');
      // 点击卡片（未滑开时）开始训练
      card.onclick = () => {
        if (wrap.classList.contains('is-open')) return; // 滑开状态不触发开始
        haptic(12); openSession(planSteps(p), p.name);
      };
      // 删除按钮
      wrap.querySelector('.plan-del-btn').onclick = () => {
        openConfirm('删除计划', `确定删除「${p.name}」吗？该计划下的动作编排将一并移除。`, () => {
          S.deletePlan(p.id); toast('已删除'); renderPlans();
        });
      };
      // 右滑手势显示删除
      bindSwipeDelete(wrap, card);
    });
    $('#addPlanBtn').onclick = openPlanEditor;
  }

  function openPlanEditor(editId) {
    const plan = editId ? S.getPlans().find(p => p.id === editId) : null;
    let steps = plan ? planSteps(plan).map(s => ({ ...s })) : [];
    const emojis = ['💪', '🔥', '🌿', '⚡', '🏃', '🧘', '💦', '🍃'];
    let emoji = plan ? plan.emoji : emojis[0];

    openModal(`
      <h3>${plan ? '编辑计划' : '新建健身计划'}</h3>
      <div id="peMain">
        <div class="field">
          <label>计划名称</label>
          <input id="planName" placeholder="如：每日核心训练" value="${plan ? esc(plan.name) : ''}" />
        </div>
        <div class="field">
          <label>选择图标</label>
          <div class="pick-grid" id="emojiPick">
            ${emojis.map((em) => `<button data-em="${em}" class="${plan && plan.emoji === em ? 'is-active' : ''}">${em}</button>`).join('')}
            <button class="emoji-upload" id="emojiUploadBtn" title="从本地上传图片"><span class="emoji-plus">＋</span></button>
          </div>
          <input id="emojiFile" type="file" accept="image/*" hidden />
          <p class="muted" style="font-size:11.5px;margin-top:8px">点击 ＋ 可从本地上传照片作为计划图标（自动压缩到 256px）</p>
        </div>
        <div class="field">
          <label id="flowLabel">训练流程图（${steps.length} 步）</label>
          <div id="flowList" class="flow-list"></div>
          <button class="btn ghost block mt8" id="addStepBtn">＋ 添加动作</button>
          <p class="muted" style="font-size:11.5px;margin:8px 0 0">每个动作可单独设定目标；同一动作可重复添加，按先后顺序自动执行。</p>
        </div>
        <div class="session-actions">
          ${plan ? '<button class="btn ghost" id="delPlan">删除</button>' : ''}
          <button class="btn ghost" id="planCancel">取消</button>
          <button class="btn" id="planSave">${plan ? '保存' : '创建'}</button>
        </div>
      </div>
      <div id="pePicker" style="display:none">
        <div class="flex between" style="margin-bottom:10px">
          <h3 style="margin:0">选择动作</h3>
          <button class="btn ghost btn-sm" id="pickerBack">返回</button>
        </div>
        <div class="pick-ex" id="exPickPicker">
          ${exercises.map(e => `<button data-ex="${e.id}">
            <span class="pe-ic">${e.icon}</span>${e.name}<small class="pe-mode">${e.mode === 'timer' ? '计时' : '计数'}</small></button>`).join('')}
        </div>
      </div>
      <div id="peTarget" style="display:none">
        <div class="flex between" style="margin-bottom:10px">
          <h3 style="margin:0" id="tgTitle">设定目标</h3>
          <button class="btn ghost btn-sm" id="targetBack">返回</button>
        </div>
        <div class="target-set" id="tgBox"></div>
        <div class="session-actions">
          <button class="btn ghost" id="tgCancel">取消</button>
          <button class="btn" id="tgConfirm">确定</button>
        </div>
      </div>
    `);

    const main = $('#peMain'), picker = $('#pePicker'), target = $('#peTarget');
    const uploadBtn = $('#emojiUploadBtn');
    const show = (el) => { [main, picker, target].forEach(p => p.style.display = (p === el ? 'block' : 'none')); };

    // 编辑已有计划：若图标为上传图片，则把「＋」按钮变成图片预览并选中
    function showUploadPreview(src) {
      uploadBtn.classList.add('is-active', 'is-uploaded');
      uploadBtn.innerHTML = `<img src="${src}" alt="自定义图标" />`;
    }
    if (plan && plan.emoji && plan.emoji.indexOf('data:image') === 0) {
      showUploadPreview(plan.emoji);
    }

    $$('#emojiPick button').forEach(b => b.onclick = () => {
      if (b.id === 'emojiUploadBtn') return; // 上传按钮单独处理
      $$('#emojiPick button').forEach(x => x.classList.remove('is-active'));
      b.classList.add('is-active'); emoji = b.dataset.em;
    });

    // 自定义图标上传：点击 ＋ 选择本地图片，压缩为 dataURL 作为计划图标
    const emojiFile = $('#emojiFile');
    uploadBtn.onclick = () => emojiFile.click();
    emojiFile.onchange = (ev) => {
      const f = ev.target.files && ev.target.files[0];
      if (!f) return;
      if (f.size > 4 * 1024 * 1024) { toast('图片过大，请选择 ≤ 4MB'); emojiFile.value = ''; return; }
      const img = new Image();
      const reader = new FileReader();
      reader.onload = () => {
        img.onload = () => {
          const MAX = 256;
          let { width: w, height: h } = img;
          if (w > h && w > MAX) { h = Math.round(h * MAX / w); w = MAX; }
          else if (h > MAX) { w = Math.round(w * MAX / h); h = MAX; }
          const cv = document.createElement('canvas');
          cv.width = w; cv.height = h;
          cv.getContext('2d').drawImage(img, 0, 0, w, h);
          const dataUrl = cv.toDataURL('image/jpeg', 0.85);
          emoji = dataUrl; // 存为自定义图标 dataURL
          $$('#emojiPick button').forEach(x => x.classList.remove('is-active'));
          // 直接显示该图片、设为选中态，且不再显示 ＋ 号（改为图片预览）
          showUploadPreview(dataUrl);
          toast('已选用上传图片作为图标');
        };
        img.onerror = () => toast('图片读取失败');
        img.src = reader.result;
      };
      reader.readAsDataURL(f);
    };

    function renderFlow() {
      const fl = $('#flowList');
      if (!steps.length) {
        fl.innerHTML = '';
      } else {
        fl.innerHTML = steps.map((s, i) => {
          const e = exMap[s.exId]; if (!e) return '';
          const tgtTxt = s.target > 0
            ? (s.type === 'time' ? `目标 ${fmtSec(s.target)}` : `目标 ${s.target} 次`)
            : '自由训练';
          return `<div class="flow-step">
            <div class="fs-idx">${i + 1}</div>
            <div class="fs-ic">${e.icon}</div>
            <div class="fs-info"><b>${e.name}</b><span>${tgtTxt}</span></div>
            <div class="fs-ops">
              <button class="fs-btn" data-up="${i}" ${i === 0 ? 'disabled' : ''} aria-label="上移">↑</button>
              <button class="fs-btn" data-down="${i}" ${i === steps.length - 1 ? 'disabled' : ''} aria-label="下移">↓</button>
              <button class="fs-btn fs-del" data-del="${i}" aria-label="删除">✕</button>
            </div>
          </div>`;
        }).join('');
      }
      const lbl = $('#flowLabel');
      if (lbl) lbl.textContent = `训练流程图（${steps.length} 步）`;
    }

    function renderPickerSel() {
      $$('#exPickPicker button').forEach(b => {
        const n = steps.filter(s => s.exId === b.dataset.ex).length;
        b.classList.toggle('in-flow', n > 0);
        let tag = b.querySelector('.pe-count');
        if (n > 0) { if (!tag) { tag = document.createElement('small'); tag.className = 'pe-count'; b.appendChild(tag); } tag.textContent = '×' + n; }
        else if (tag) tag.remove();
      });
    }

    function openPicker() { renderPickerSel(); show(picker); }
    function openTarget(exId) {
      const e = exMap[exId];
      const isTimer = e.mode === 'timer';
      const type = isTimer ? 'time' : 'count';
      const unit = isTimer ? '秒' : '次';
      const max = isTimer ? 600 : 200;
      const def = isTimer ? 60 : 20;
      $('#tgTitle').textContent = `「${e.name}」目标（${isTimer ? '计时' : '计数'}）`;
      $('#tgBox').innerHTML = `
        <div class="flex between"><span class="muted">${isTimer ? '时长目标（拖动）' : '次数目标（拖动）'}</span><b id="tgVal">${def} ${unit}</b></div>
        <input type="range" id="tgRange" min="0" max="${max}" step="1" value="${def}">
        <div class="muted" style="font-size:11px">0 = 自由${isTimer ? '计时' : '计数'}（不设目标）</div>`;
      const range = $('#tgRange');
      range.addEventListener('input', () => {
        const v = parseInt(range.value) || 0;
        $('#tgVal').textContent = v > 0 ? v + ' ' + unit : '自由';
      });
      show(target);
      $('#tgCancel').onclick = () => show(picker);
      $('#targetBack').onclick = () => show(picker);
      $('#tgConfirm').onclick = () => {
        const v = parseInt(range.value) || 0;
        steps.push({ exId, target: v, type });
        show(main); renderFlow();
      };
    }

    $('#addStepBtn').onclick = openPicker;
    $$('#exPickPicker button').forEach(b => b.onclick = () => openTarget(b.dataset.ex));
    $('#pickerBack').onclick = () => show(main);

    $('#flowList').addEventListener('click', (ev) => {
      const t = ev.target;
      if (t.dataset.up != null) {
        const i = +t.dataset.up; if (i > 0) { [steps[i - 1], steps[i]] = [steps[i], steps[i - 1]]; renderFlow(); }
      } else if (t.dataset.down != null) {
        const i = +t.dataset.down; if (i < steps.length - 1) { [steps[i + 1], steps[i]] = [steps[i], steps[i + 1]]; renderFlow(); }
      } else if (t.dataset.del != null) {
        steps.splice(+t.dataset.del, 1); renderFlow();
      }
    });

    $('#planCancel').onclick = closeModal;
    if (plan) $('#delPlan').onclick = () => { S.deletePlan(plan.id); toast('已删除'); closeModal(); renderPlans(); };
    $('#planSave').onclick = () => {
      const name = $('#planName').value.trim() || '我的计划';
      if (!steps.length) { toast('请至少添加 1 个动作'); return; }
      const payload = { name, emoji, steps: steps.map(s => ({ ...s })) };
      if (plan) { S.updatePlan(plan.id, payload); toast('已保存'); }
      else { S.addPlan(payload); toast('计划已创建'); }
      closeModal(); renderPlans();
    };

    renderFlow();
  }

  // ---------- 统计 ----------
  let statTab = 'day';
  let selDay = todayKey();
  let calY = new Date().getFullYear(), calM = new Date().getMonth();        // 日 tab：日历显示月份
  let wkStart = mondayOf(new Date());                                        // 周 tab：所选周（周一）
  let myYear = new Date().getFullYear(), myMonth = new Date().getMonth();   // 月 tab
  let yrYear = new Date().getFullYear();                                     // 年 tab

  // ---- 时间选择辅助 ----
  function mondayOf(d) {
    const x = new Date(d); x.setHours(0, 0, 0, 0);
    const day = (x.getDay() + 6) % 7; // 周一为 0
    x.setDate(x.getDate() - day);
    return x;
  }
  function isoWeek(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = (d.getUTCDay() + 6) % 7;
    d.setUTCDate(d.getUTCDate() - dayNum + 3); // 取所在周周四
    const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
    const week = 1 + Math.round((d - firstThursday) / (7 * 24 * 3600 * 1000));
    return { year: d.getUTCFullYear(), week };
  }
  // 时间段导航条（日/周/月/年）
  function periodNav(key) {
    let label = '';
    if (key === 'day') label = `${calY}年${calM + 1}月`;
    else if (key === 'week') { const w = isoWeek(wkStart); label = `${w.year}年第${w.week}周`; }
    else if (key === 'month') label = `${myYear}年${myMonth + 1}月`;
    else label = `${yrYear}年`;
    return `<div class="period-nav">
      <button class="pn-btn" data-pn="prev">‹</button>
      <div class="pn-label">${label}</div>
      <button class="pn-btn" data-pn="next">›</button>
    </div>`;
  }

  function rangeOf(tab) {
    if (tab === 'day') {
      const list = S.recordsOfDay(selDay);
      const d = new Date(selDay + 'T00:00:00');
      const label = selDay === todayKey() ? '今天' : `${d.getMonth() + 1}月${d.getDate()}日`;
      return { list, label, key: 'day' };
    }
    if (tab === 'week') {
      const mon = new Date(wkStart); mon.setHours(0, 0, 0, 0);
      const sun = new Date(mon); sun.setDate(mon.getDate() + 6); sun.setHours(23, 59, 59);
      const list = S.getRecords().filter(r => { const t = new Date(r.date); return t >= mon && t <= sun; });
      const w = isoWeek(mon);
      return { list, label: `${w.year}年第${w.week}周`, key: 'week' };
    }
    if (tab === 'month') {
      const list = S.getRecords().filter(r => { const t = new Date(r.date); return t.getFullYear() === myYear && t.getMonth() === myMonth; });
      return { list, label: `${myYear}年${myMonth + 1}月`, key: 'month' };
    }
    const list = S.getRecords().filter(r => new Date(r.date).getFullYear() === yrYear);
    return { list, label: `${yrYear}年`, key: 'year' };
  }

  function renderStats() {
    const view = $('#view-stats');
    const r = rangeOf(statTab);
    const agg = S.aggregate(r.list);
    const total = S.aggregate(S.getRecords());

    const seg = `<div class="seg">
      ${['day', 'week', 'month', 'year'].map(t => `<button data-tab="${t}" class="${statTab === t ? 'is-active' : ''}">${{ day: '日', week: '周', month: '月', year: '年' }[t]}</button>`).join('')}
    </div>`;

    const boxes = `<div class="stat-grid">
      <div class="stat-box"><div class="k">${r.label}时长</div><div class="v">${fmtDur(agg.durationSec)}</div></div>
      <div class="stat-box"><div class="k">${r.label}次数</div><div class="v">${agg.count}<small> 次</small></div></div>
      <div class="stat-box"><div class="k">${r.label}千卡</div><div class="v">${fmtCal(agg.calories)}</div></div>
      <div class="stat-box"><div class="k">累计千卡</div><div class="v">${fmtCal(total.calories)}</div></div>
    </div>`;

    let chartHtml = '';
    if (statTab === 'day') {
      chartHtml = renderDayView(r);
    } else {
      chartHtml = renderRangeChart(r);
    }

    view.innerHTML = `
      <div class="muted" style="margin-top:8px">${r.label} · 实时统计</div>
      ${seg}
      ${boxes}
      ${chartHtml}
      <div class="section-title">全部打卡记录</div>
      ${renderRecordsList(r.list.slice().reverse())}`;

    $$('.seg button', view).forEach(b => b.onclick = () => { haptic(10); statTab = b.dataset.tab; renderStats(); });
    $$('.rdel', view).forEach(b => b.onclick = () => { S.deleteRecord(b.dataset.del); toast('已删除'); renderStats(); });
    bindStatCharts(view, r);
    // 统计页左右滑动切换 tab（与点击文字切换等价，阈值：水平 > 60px 且 |dx| > |dy|*1.5）
    bindStatSwipe(view);
  }

  // 统计页：左右滑切换日/周/月/年（循环切换）。同时支持触摸与鼠标拖拽，适配安卓 WebView。
  function bindStatSwipe(view) {
    // 关键：view(#view-stats) 是常驻容器，每次 renderStats 只替换 innerHTML，事件不会自动移除。
    // 若每次都 addEventListener 会导致监听器累积 → 一次滑动触发多次跳变（日→年）。
    // 用标记保证只绑定一次（handler 读取的是模块级 statTab，无需重复绑定）。
    if (view._statSwipeBound) return;
    view._statSwipeBound = true;

    const tabs = ['day', 'week', 'month', 'year'];
    let sx = 0, sy = 0, tracking = false, axisLock = 0; // 0未定 1横 2纵

    function getX(e) { return (e.touches && e.touches[0] && e.touches[0].clientX) || (e.changedTouches && e.changedTouches[0] && e.changedTouches[0].clientX) || (e.clientX != null ? e.clientX : 0); }
    function getY(e) { return (e.touches && e.touches[0] && e.touches[0].clientY) || (e.changedTouches && e.changedTouches[0] && e.changedTouches[0].clientY) || (e.clientY != null ? e.clientY : 0); }

    function onStart(e) {
      tracking = true; axisLock = 0;
      sx = getX(e); sy = getY(e);
    }
    function onMove(e) {
      if (!tracking) return;
      const cx = getX(e), cy = getY(e);
      const dx = Math.abs(cx - sx), dy = Math.abs(cy - sy);
      if (axisLock === 0 && (dx > 6 || dy > 6)) {
        axisLock = dx > dy ? 1 : 2;
      }
      // 横向滑动时阻止页面纵向滚动干扰手势（passive:false 已允许 preventDefault）
      if (axisLock === 1 && e.cancelable) e.preventDefault();
    }
    function onEnd(e) {
      if (!tracking) return;
      tracking = false;
      const dx = getX(e) - sx, dy = getY(e) - sy;
      if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.4) return;
      const idx = tabs.indexOf(statTab);
      if (dx < 0 && idx < tabs.length - 1) { statTab = tabs[idx + 1]; haptic(10); renderStats(); }   // 左滑：next
      else if (dx > 0 && idx > 0) { statTab = tabs[idx - 1]; haptic(10); renderStats(); }            // 右滑：prev
    }

    // 触摸事件（安卓 WebView 主力）：用 passive:false 以便横向滑动时 preventDefault
    view.addEventListener('touchstart', onStart, { passive: true });
    view.addEventListener('touchmove', onMove, { passive: false });
    view.addEventListener('touchend', onEnd, { passive: true });
    view.addEventListener('touchcancel', onEnd, { passive: true });
    // 鼠标拖拽（桌面预览回退）
    view.addEventListener('mousedown', onStart);
    view.addEventListener('mousemove', onMove);
    view.addEventListener('mouseup', onEnd);
    view.addEventListener('mouseleave', onEnd);
  }

  function renderDayView(r) {
    const cal = buildCalendar();
    const dayTxt = selDay === todayKey() ? '今天' : selDay;
    // 当日按动作分布环形
    const segs = buildSegs(r.list);
    const donut = segs.length
      ? `<div class="chart-card"><h4>${dayTxt}热量来源</h4><canvas id="donut"></canvas><div class="muted donut-tip">点击图中色块查看动作占比</div></div>`
      : `<div class="empty"><div class="big">🍃</div><p>${dayTxt}还没有运动记录</p><p>去「运动」页开始第一项吧</p></div>`;
    return `
      ${periodNav('day')}
      <div class="chart-card"><h4>打卡日历</h4>${cal}
        <div class="legend"><span><i style="background:var(--mint-200)"></i>有记录</span><span><i style="background:var(--mint-300)"></i>较多</span><span><i style="background:var(--mint-500)"></i>丰富</span></div>
      </div>
      ${donut}`;
  }

  function buildCalendar() {
    const y = calY, m = calM;
    const first = new Date(y, m, 1).getDay();
    const days = new Date(y, m + 1, 0).getDate();
    const wd = ['一', '二', '三', '四', '五', '六', '日'];
    let cells = wd.map(d => `<div class="wd">${d}</div>`).join('');
    for (let i = 0; i < (first + 6) % 7; i++) cells += `<div></div>`;
    const dayCal = {};
    S.getRecords().forEach(rec => { const k = S.dayKey(rec.date); dayCal[k] = (dayCal[k] || 0) + rec.calories; });
    const tk = todayKey();
    for (let d = 1; d <= days; d++) {
      const k = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const cal = dayCal[k] || 0;
      let cls = 'day'; if (cal) { cls += ' has'; if (cal > 200) cls += ' lv3'; else if (cal > 80) cls += ' lv2'; }
      if (k === tk) cls += ' today';
      if (k === selDay) cls += ' sel';
      cells += `<div class="${cls}" data-day="${k}">${d}</div>`;
    }
    return `<div class="cal">${cells}</div>`;
  }

  // 动作热量分段（取前 6，按热量降序；图例与环形图共用，保证一致）
  function buildSegs(list) {
    const byEx = {};
    list.forEach(rec => { byEx[rec.exId] = (byEx[rec.exId] || 0) + (rec.calories || 0); });
    return Object.entries(byEx).sort((a, b) => b[1] - a[1]).slice(0, 6)
      .map(([id, v], i) => ({ label: exMap[id] ? exMap[id].name : id, value: v, color: C.PALETTE[i % C.PALETTE.length] }));
  }

  // 区间柱状图序列（日/周/月/年 通用）
  // labels 始终保留「点击弹出的完整日期信息」，由 barChart 的 axisStep 控制 X 轴下方的稀疏绘制
  function rangeSeries(r) {
    const labels = [], values = [];
    if (r.key === 'week') {
      // 周：星期一到星期日（点击弹出的 tooltip 直接显示如「星期五 4.00千卡」）
      const names = ['星期一', '星期二', '星期三', '星期四', '星期五', '星期六', '星期日'];
      const mon = new Date(wkStart); mon.setHours(0, 0, 0, 0);
      for (let i = 0; i < 7; i++) {
        const d = new Date(mon); d.setDate(mon.getDate() + i);
        const k = S.dayKey(d);
        labels.push(names[i]); values.push(Math.round(S.aggregate(S.recordsOfDay(k)).calories));
      }
    } else if (r.key === 'month') {
      // 月：1..days（如「21日」），但 X 轴下每 5 个间隔显示 1 个避免拥挤
      const days = new Date(myYear, myMonth + 1, 0).getDate();
      for (let d = 1; d <= days; d++) {
        const k = `${myYear}-${String(myMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        labels.push(d + '日');
        values.push(Math.round(S.aggregate(S.recordsOfDay(k)).calories));
      }
    } else { // year
      for (let mo = 0; mo < 12; mo++) {
        const list = S.getRecords().filter(rc => { const t = new Date(rc.date); return t.getFullYear() === yrYear && t.getMonth() === mo; });
        labels.push((mo + 1) + '月'); values.push(Math.round(S.aggregate(list).calories));
      }
    }
    return { labels, values };
  }

  function renderRangeChart(r) {
    if (!r.list.length) {
      return `${periodNav(r.key)}<div class="empty"><div class="big">📊</div><p>${r.label}还没有运动记录</p><p>去「运动」页开始第一项训练吧</p></div>`;
    }
    const segs = buildSegs(r.list);
    const barTitle = { week: '每日消耗(千卡)', month: '每日消耗趋势(千卡)', year: '每月消耗(千卡)' }[r.key];
    return `
      ${periodNav(r.key)}
      <div class="chart-card"><h4>${barTitle}</h4><canvas id="bar"></canvas></div>
      ${segs.length ? `<div class="chart-card"><h4>${r.label}动作热量分布</h4><canvas id="donut"></canvas><div class="muted donut-tip">点击图中色块查看动作占比</div></div>` : ''}`;
  }

  function bindStatCharts(view, r) {
    const bar = $('#bar', view);
    if (bar) {
      const { labels, values } = rangeSeries(r);
      // 月视图柱子多（28~31 根），X 轴按 5 间隔显示（如 1/6/11/16/21/26/31）避免拥挤
      // labels 已自带完整日期（如 "21日"），点击任何柱子都能精准显示完整日期
      const axisStep = (r.key === 'month') ? 5 : 1;
      // pickFormatter: tooltip「标签 + 4.00 千卡」。所有视图统一格式，由 labels 决定文案
      const pickFormatter = (i, label, v) => `${label} ${v.toFixed(2)} 千卡`;
      C.barChart(bar, { labels, values, color: C.PALETTE[0], axisStep, pickFormatter });
    }
    const donut = $('#donut', view);
    if (donut) {
      const segs = buildSegs(r.list);
      C.donutChart(donut, { segments: segs });
    }
    // 时间段导航（日/周/月/年）
    $$('.pn-btn', view).forEach(b => b.onclick = () => {
      const dir = b.dataset.pn === 'prev' ? -1 : 1;
      if (statTab === 'day') {
        calM += dir; if (calM < 0) { calM = 11; calY--; } else if (calM > 11) { calM = 0; calY++; }
      } else if (statTab === 'week') {
        wkStart = new Date(wkStart); wkStart.setDate(wkStart.getDate() + dir * 7);
      } else if (statTab === 'month') {
        myMonth += dir; if (myMonth < 0) { myMonth = 11; myYear--; } else if (myMonth > 11) { myMonth = 0; myYear++; }
      } else {
        yrYear += dir;
      }
      renderStats();
    });
    // 日历点击
    $$('.cal .day[data-day]', view).forEach(d => d.onclick = () => {
      selDay = d.dataset.day;
      const sd = new Date(selDay + 'T00:00:00');
      calY = sd.getFullYear(); calM = sd.getMonth();
      renderStats();
      const list = S.recordsOfDay(selDay);
      toast(`${selDay} · ${list.length} 次打卡`);
    });
  }

  function renderRecordsList(list) {
    if (!list.length) return `<div class="empty"><div class="big">📭</div><p>暂无记录</p></div>`;
    return `<div class="rec-list">${list.map(rec => {
      const e = exMap[rec.exId]; if (!e) return '';
      const val = rec.mode === 'timer' ? fmtDur(rec.value) : rec.value + ' 次';
      return `<div class="rec-item">
        <div class="ri">${e.icon}</div>
        <div class="rm"><h4>${e.name}</h4><p>${S.dayKey(rec.date)} ${new Date(rec.date).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })} · ${fmtCal(rec.calories)}千卡</p></div>
        <div class="rv">${val}</div>
        <button class="rdel" data-del="${rec.id}">🗑</button>
      </div>`;
    }).join('')}</div>`;
  }

  // ---------- 我的 ----------
  function renderProfile() {
    const view = $('#view-profile');
    const p = S.state.profile;
    const all = S.aggregate(S.getRecords());
    const days = new Set(S.getRecords().map(r => S.dayKey(r.date))).size;
    const reminders = S.getReminders();

    const rmHtml = reminders.length
      ? reminders.map(r => `<div class="setting-row">
          <span class="si">⏰</span>
          <div class="sl">${esc(r.label || '运动提醒')}<div class="sv">${r.time} · 每${r.days.map(d => ['一', '二', '三', '四', '五', '六', '日'][d]).join('')}</div></div>
          <button class="icon-btn" data-cal="${r.id}" title="导出到手机日历（系统闹钟提醒）">📅</button>
          <div class="switch ${r.on ? 'on' : ''}" data-rm="${r.id}"></div>
        </div>`).join('')
      : `<div class="setting-row"><span class="si">⏰</span><div class="sl">还没有提醒<div class="sv">添加定时运动提醒</div></div></div>`;

    // 头像：上传后用 <img>，否则显示占位 🌿
    const avatarHtml = p.avatar
      ? `<img src="${p.avatar}" alt="头像">`
      : `<span class="avatar-emoji">🌿</span>`;
    // 副标题动态拼接：身高 · 体重 · 年龄（任缺任省）
    const age = window.FitData.ageFromBirthday(p.birthday);
    const subParts = [];
    if (p.height) subParts.push(p.height + 'cm');
    if (p.weight) subParts.push(p.weight + 'kg');
    if (p.gender === 'male') subParts.push('男');
    else if (p.gender === 'female') subParts.push('女');
    if (age != null) subParts.push(age + '岁');
    const subtitle = subParts.join(' · ') || '点编辑资料完善信息';

    view.innerHTML = `
      <div class="card">
        <div class="profile-top">
          <div class="avatar" id="viewAvatar">${avatarHtml}</div>
          <div class="profile-info">
            <h3>${esc(p.name)}</h3>
            <p>${esc(subtitle)}</p>
          </div>
        </div>
        <div class="stat-grid mt16 stat-grid-3">
          <div class="stat-box"><div class="k">累计打卡</div><div class="v">${all.sessions}<small> 次</small></div></div>
          <div class="stat-box"><div class="k">坚持天数</div><div class="v">${days}<small> 天</small></div></div>
          <div class="stat-box"><div class="k">总千卡</div><div class="v">${fmtCal(all.calories)}</div></div>
        </div>
      </div>

      ${renderBMICard(p)}

      <div class="section-title">设置</div>
      <div class  ="card">
        <div class="setting-row" id="editProfile"><span class="si">✏️</span><div class="sl">个人资料</div><span class="sv">›</span></div>
        <div class="setting-row" id="editSound"><span class="si">🔊</span><div class="sl">音效提醒<div class="sv">计时/计数与完成提示音</div></div><div class="switch ${S.state.settings.sound !== false ? 'on' : ''}" id="soundSw"></div></div>
        <div class="setting-row" id="addReminder"><span class="si">⏰</span><div class="sl">运动提醒<div class="sv">${reminders.length} 个</div></div><span class="sv">›</span></div>
        <div class="setting-row" id="dataIO"><span class="si">💾</span><div class="sl">数据导入导出<div class="sv">备份 / 恢复运动数据</div></div><span class="sv">›</span></div>
        <div class="setting-row" id="versionUp"><span class="si">🚀</span><div class="sl">版本升级<div class="sv">点击前往最新版本</div></div><span class="sv">›</span></div>
      </div>

      <div class="section-title">我的提醒</div>
      <div class="card">${rmHtml}</div>

      <button class="btn ghost block mt16" id="resetBtn2">清空所有数据</button>
      <p class="muted center mt16">轻动 · 让运动更简单 🌿<br>数据保存在本机，可放心使用</p>
    `;

    $('#editProfile').onclick = openProfileEditor;
    $('#addReminder').onclick = openReminderEditor;
    $('#dataIO').onclick = openDataIO;
    // 版本升级：先弹确认框「是否跳转到外部网页」，确认后再调起系统浏览器
    const versionBtn = $('#versionUp', view);
    if (versionBtn) versionBtn.onclick = () => {
      const url = 'https://pan.quark.cn/s/ae4ebde6b4e6';
      openConfirm('是否跳转到外部网页', '即将离开「轻动」前往夸克网盘下载最新版本安装包，是否继续？', () => {
        haptic(12);
        // 安卓优先用原生桥接调起系统浏览器（WebView 内加载外部 https 会被拦/无网络）
        if (window.AndroidBridge && typeof window.AndroidBridge.openExternal === 'function') {
          try { window.AndroidBridge.openExternal(url); return; } catch (e) { /* 回退 */ }
        }
        const win = window.open(url, '_blank');
        if (!win) window.location.href = url;
      });
    };
    $('#soundSw').onclick = () => {
      haptic(8);
      const cur = S.state.settings.sound !== false;
      const next = !cur;
      S.updateSettings({ sound: next });
      $('#soundSw').classList.toggle('on', next);
      if (next) { window.FitAudio.ensure(); window.FitAudio.tick(); }
    };
    $$('.switch[data-rm]', view).forEach(s => s.onclick = () => {
      haptic(8);
      const r = S.getReminders().find(x => x.id === s.dataset.rm);
      S.updateReminder(r.id, { on: !r.on }); renderProfile();
    });
    $$('.icon-btn[data-cal]', view).forEach(b => b.onclick = () => {
      const r = S.getReminders().find(x => x.id === b.dataset.cal);
      if (r) exportReminderICS(r);
    });
    const fillBtn = $('#bmiFillBtn', view); if (fillBtn) fillBtn.onclick = openProfileEditor;
    $('#resetBtn2').onclick = () => {
      openConfirm('清空所有数据', '确定要清空所有运动记录、计划和提醒吗？此操作不可恢复。', () => {
        S.resetAll();
        toast('已清空');
        switchView('home');
      }, '确认清空');
    };
  }

  /**
   * BMI 健康指标卡（中国《成人体重判定》WS/T 428-2013）
   *   分档：<18.5 偏低 / 18.5~24 标准 / 24~28 偏高 / >=28 过高
   *   身高/体重 缺失时显示引导补齐按钮
   */
  function renderBMICard(p) {
    const F = window.FitData;
    const v = F.calcBMI(p.weight, p.height);
    const band = v != null ? F.bmiBand(v) : null;
    const ready = p.weight > 0 && p.height > 0;

    if (!ready) {
      return `<div class="section-title">BMI 健康指标</div>
      <div class="card bmi-empty">
        <div class="bmi-row">
          <div class="bmi-num"><span class="muted">--</span><small class="muted">BMI</small></div>
          <div class="bmi-rate"><span class="muted">未填写</span><small class="muted">评级</small></div>
        </div>
        <div class="bmi-hint">补齐身高 / 体重后自动测算 BMI，并据此提供健康建议。</div>
      </div>`;
    }

    // 轴域 0~40，分段：18.5 / 24 / 28
    const AX_MAX = 40;
    const cuts = [18.5, 24, 28].map(x => Math.min(100, (x / AX_MAX) * 100));
    // 指针位置（夹紧）
    const pct = Math.max(0, Math.min(100, (v / AX_MAX) * 100));
    const age = F.ageFromBirthday(p.birthday);
    // 年龄相关提示（未成年人/老年人分档参考不同标准）
    let ageNote = '';
    if (age != null) {
      if (age < 18) ageNote = '未成年人 BMI 分档应参考年龄-性别标准（WS/T 456-2014），以下按成人标准供参考。';
      else if (age > 65) ageNote = '老年人健康 BMI 可略高于成人标准，具体请遵医嘱。';
    }
    // 建议体重（性别差异化）
    const rw = F.recommendedWeight(p.height, p.gender, age);
    let deltaNote = '';
    if (rw) {
      if (p.weight < rw.min) {
        const d = Math.round((rw.min - p.weight) * 10) / 10;
        deltaNote = `当前偏轻，建议增至 ${rw.min}~${rw.max} kg（距下限约还差 ${d} kg）。`;
      } else if (p.weight > rw.max) {
        const d = Math.round((p.weight - rw.max) * 10) / 10;
        deltaNote = `当前偏重，建议减至 ${rw.min}~${rw.max} kg（超出上限约 ${d} kg）。`;
      } else {
        deltaNote = '当前体重处于健康区间，继续保持 👍';
      }
    }
    const tipCls = 'bmi-tip-' + (band.key === 'low' ? 'blue'
      : band.key === 'normal' ? 'mint'
      : band.key === 'over'   ? 'amber' : 'orange');

    // 建议体重分析块（仅保留"建议体重 + 区间"一行；理想体重 / 标准说明 / 对比文字已隐藏）
    const recHtml = rw ? `
      <div class="bmi-rec">
        <div class="bmi-rec-row"><span>建议体重</span><b>${rw.min} ~ ${rw.max}<i>kg</i></b></div>
      </div>` : '';

    return `
      <div class="section-title">BMI 健康指标</div>
      <div class="card bmi-card">
        <div class="bmi-row">
          <div class="bmi-num">${v.toFixed(1)}<small>BMI</small></div>
          <div class="bmi-rate" style="color:${band.color}">${band.label}<small>评级</small></div>
        </div>
        <div class="bmi-axis">
          <div class="bmi-bar">
            <div class="bmi-seg" style="width:${cuts[0]}%;background:#3FB6EF"></div>
            <div class="bmi-seg" style="width:${cuts[1] - cuts[0]}%;background:#3CC9A7"></div>
            <div class="bmi-seg" style="width:${cuts[2] - cuts[1]}%;background:#F2B53A"></div>
            <div class="bmi-seg" style="width:${100 - cuts[2]}%;background:#F47A4E"></div>
          </div>
          <div class="bmi-pointer" style="left:${pct}%">
            <svg width="14" height="8" viewBox="0 0 14 8" aria-hidden="true"><path d="M7 8 L0 0 L14 0 Z" fill="#1f2a27"/></svg>
          </div>
          <div class="bmi-ticks">
            <span style="left:${cuts[0]}%">18.5</span>
            <span style="left:${cuts[1]}%">24.0</span>
            <span style="left:${cuts[2]}%">28.0</span>
          </div>
        </div>
        <div class="bmi-legend">
          <span><i style="background:#3FB6EF"></i>偏低</span>
          <span><i style="background:#3CC9A7"></i>标准</span>
          <span><i style="background:#F2B53A"></i>偏高</span>
          <span><i style="background:#F47A4E"></i>过高</span>
        </div>
        ${recHtml}
        <div class="bmi-tip ${tipCls}">
          <span class="bmi-tip-text">${band.advice}</span>
          ${ageNote ? `<span class="bmi-tip-age">${ageNote}</span>` : ''}
        </div>
      </div>
    `;
  }

  function openProfileEditor() {
    const p = S.state.profile;
    const avatarNow = p.avatar
      ? `<img src="${p.avatar}" alt="头像预览">`
      : `<span class="avatar-emoji">🌿</span>`;

    openModal(`
      <h3>个人资料</h3>
      <div class="field profile-avatar-field">
        <label>头像</label>
        <div class="profile-avatar" id="paPreview" role="button" tabindex="0" title="点击头像从本地上传">${avatarNow}</div>
        <input id="paFile" type="file" accept="image/*" hidden />
        <p class="muted" style="font-size:11.5px;margin-top:8px">点击头像即可从本地上传（jpg / png / webp，自动压缩保存）</p>
      </div>
      <div class="field"><label>昵称</label><input id="pName" value="${esc(p.name)}" /></div>
      <div class="field"><label>性别</label>
        <div class="gender-pick" id="genderPick">
          <button type="button" data-g="male" class="${p.gender === 'male' ? 'is-active' : ''}">男</button>
          <button type="button" data-g="female" class="${p.gender === 'female' ? 'is-active' : ''}">女</button>
        </div>
      </div>
      <div class="field"><label>出生日期</label><input id="pBirthday" type="text" readonly value="${p.birthday || ''}" placeholder="点此选择" /></div>
      <div class="field"><label>身高 (cm)</label><input id="pHeight" type="text" readonly value="${p.height || ''}" placeholder="点此选择" /></div>
      <div class="field"><label>体重 (kg)</label><input id="pWeight" type="text" readonly value="${p.weight || ''}" placeholder="点此选择" /></div>
      <div class="session-actions"><button class="btn ghost" id="pc">取消</button><button class="btn" id="ps">保存</button></div>
    `);

    // 头像：点击头像即触发本地上传（已移除「本地上传 / 移除」按钮）
    let pickedAvatar = p.avatar || '';
    const preview = $('#paPreview');
    const file = $('#paFile');
    const openPicker = () => file.click();
    preview.onclick = openPicker;
    preview.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPicker(); } };
    file.onchange = (ev) => {
      const f = ev.target.files && ev.target.files[0];
      if (!f) return;
      // 超过 1.5MB 提醒；超过 4MB 直接拒绝
      if (f.size > 4 * 1024 * 1024) { toast('图片过大，请选择 ≤ 4MB'); file.value = ''; return; }
      // 用 canvas 等比缩放到 ≤ 256px → JPEG 0.85 压缩 → 远小于 1.5MB
      const img = new Image();
      const reader = new FileReader();
      reader.onload = () => {
        img.onload = () => {
          const MAX = 256;
          let { width: w, height: h } = img;
          if (w > h && w > MAX) { h = Math.round(h * MAX / w); w = MAX; }
          else if (h > MAX) { w = Math.round(w * MAX / h); h = MAX; }
          const cv = document.createElement('canvas');
          cv.width = w; cv.height = h;
          cv.getContext('2d').drawImage(img, 0, 0, w, h);
          const dataUrl = cv.toDataURL('image/jpeg', 0.85);
          pickedAvatar = dataUrl;
          preview.innerHTML = `<img src="${dataUrl}" alt="头像预览">`;
        };
        img.onerror = () => toast('图片读取失败');
        img.src = reader.result;
      };
      reader.readAsDataURL(f);
    };

    $('#pc').onclick = closeModal;
    // 性别选择
    $$('#genderPick button').forEach(b => b.onclick = () => {
      $$('#genderPick button').forEach(x => x.classList.remove('is-active'));
      b.classList.add('is-active');
    });

    // 出生日期滚轮：年 / 月 / 日 三列
    // - 滚轮每一项只显示纯数字（无「年」「月」「日」字样）
    // - 「年」「月」「日」三字由 cfg.unitLabels 钉在选中区中央列间隙
    const now = new Date();
    const pad2 = (n) => String(n).padStart(2, '0');
    function openBirthdayWheel() {
      const cur = ($('#pBirthday').value || '').split('-').map(Number);
      const year = cur[0] || (now.getFullYear() - 20);
      const month = cur[1] || 1;
      const day = cur[2] || 1;
      const thisYear = now.getFullYear();
      // 仅数字，无单位
      const yearVals = [];
      for (let y = thisYear; y >= 1930; y--) yearVals.push({ v: y, label: String(y) });
      const monthVals = [];
      for (let m = 1; m <= 12; m++) monthVals.push({ v: m, label: String(m).padStart(2, '0') });
      function dayValsOf(y, m) {
        const n = new Date(y, m, 0).getDate();
        const arr = [];
        for (let d = 1; d <= n; d++) arr.push({ v: d, label: String(d).padStart(2, '0') });
        return arr;
      }
      openWheelPicker({
        title: '出生日期',
        unitLabels: ['年', '月', '日'],
        columns: [
          { values: yearVals, default: year },
          { values: monthVals, default: month },
          { values: dayValsOf(year, month), default: day }
        ],
        onConfirm: (out) => {
          let [yy, mm, dd] = out;
          const maxD = new Date(yy, mm, 0).getDate();
          if (dd > maxD) dd = maxD;
          if (yy > thisYear) yy = thisYear;
          // 不超今天
          const dt = new Date(yy, mm - 1, dd);
          const today0 = new Date(thisYear, now.getMonth(), now.getDate());
          if (dt > today0) { yy = thisYear; mm = now.getMonth() + 1; dd = now.getDate(); }
          $('#pBirthday').value = `${yy}-${pad2(mm)}-${pad2(dd)}`;
        }
      });
    }
    $('#pBirthday').onclick = openBirthdayWheel;

    // 身高滚轮：整数位 + 小数位 双列（中间小数点），精确到 0.1cm
    function openHeightWheel() {
      const cur = parseFloat($('#pHeight').value) || 170.0;
      const intVals = [], decVals = [];
      for (let h = 120; h <= 220; h++) intVals.push({ v: h, label: h + '' });
      // 第二列只显示数字本身（如 5），小数点单独由选中区中央的 .wp-sel-dot 居中显示
      for (let d = 0; d <= 9; d++) decVals.push({ v: d, label: '' + d });
      const curInt = Math.floor(cur), curDec = Math.round((cur - curInt) * 10);
      openWheelPicker({
        title: '身高 (cm)',
        dotCols: [0, 1], // 第 0、1 列之间显示居中的小数点
        columns: [
          { values: intVals, default: Math.max(120, Math.min(220, curInt)) },
          { values: decVals, default: Math.max(0, Math.min(9, curDec)) }
        ],
        onConfirm: (out) => { $('#pHeight').value = (out[0] + out[1] / 10).toFixed(1); }
      });
    }
    $('#pHeight').onclick = openHeightWheel;

    // 体重滚轮：整数位 + 小数位 双列（中间小数点），精确到 0.1kg
    function openWeightWheel() {
      const cur = parseFloat($('#pWeight').value) || 60.0;
      const intVals = [], decVals = [];
      for (let w = 30; w <= 150; w++) intVals.push({ v: w, label: w + '' });
      // 第二列只显示数字本身（如 5），小数点单独由选中区中央的 .wp-sel-dot 居中显示
      for (let d = 0; d <= 9; d++) decVals.push({ v: d, label: '' + d });
      const curInt = Math.floor(cur), curDec = Math.round((cur - curInt) * 10);
      openWheelPicker({
        title: '体重 (kg)',
        dotCols: [0, 1],
        columns: [
          { values: intVals, default: Math.max(30, Math.min(150, curInt)) },
          { values: decVals, default: Math.max(0, Math.min(9, curDec)) }
        ],
        onConfirm: (out) => { $('#pWeight').value = (out[0] + out[1] / 10).toFixed(1); }
      });
    }
    $('#pWeight').onclick = openWeightWheel;

    $('#ps').onclick = () => {
      const name = $('#pName').value.trim() || '健身达人';
      const height = Math.max(50, Math.min(250, parseInt($('#pHeight').value) || 170));
      const weight = Math.max(20, Math.min(200, parseInt($('#pWeight').value) || 60));
      const birthday = ($('#pBirthday').value || '').trim();
      const gActive = $('#genderPick .is-active');
      const gender = gActive ? gActive.dataset.g : '';
      S.updateProfile({ name, height, weight, birthday, gender, avatar: pickedAvatar });
      toast('已保存'); closeModal(); renderProfile();
    };
  }

  function openGoalMinEditor() {
    const p = S.state.profile;
    openModal(`
      <h3>每日运动目标</h3>
      <div class="field"><label>目标时长 (分钟)</label><input id="gm" type="number" min="1" value="${p.goalDailyMin}" /></div>
      <div class="session-actions"><button class="btn ghost" id="gc">取消</button><button class="btn" id="gs">保存</button></div>
    `);
    $('#gc').onclick = closeModal;
    $('#gs').onclick = () => { S.updateProfile({ goalDailyMin: Math.max(1, parseInt($('#gm').value) || 20) }); toast('已保存'); closeModal(); renderProfile(); };
  }

  function openReminderEditor() {
    const days = [0, 1, 2, 3, 4, 5, 6]; const pick = new Set([1, 3, 5]);
    openModal(`
      <h3>新建运动提醒</h3>
      <div class="field"><label>提醒时间</label><input id="rTime" type="text" readonly value="19:00" placeholder="点此选择" /></div>
      <div class="field"><label>重复</label><div class="day-pick" id="rDays">
        ${['一', '二', '三', '四', '五', '六', '日'].map((d, i) => `<button data-d="${i}" class="${pick.has(i) ? 'on' : ''}">${d}</button>`).join('')}
      </div></div>
      <div class="field"><label>备注</label><input id="rLabel" placeholder="如：晚间核心训练" /></div>
      <p class="muted" style="font-size:11.5px;line-height:1.6;margin:2px 0 12px">应用打开时到点会弹出醒目提醒；若想<b>关闭网页也能用手机系统闹钟提醒</b>，添加后点提醒右侧的 📅 导出到手机日历即可。</p>
      <div class="session-actions"><button class="btn ghost" id="rc">取消</button><button class="btn" id="rs">添加</button></div>
    `);
    // 提醒时间滚轮：时 / 分 两列（列内纯数字，「时」「分」由 unitLabels 钉在选中区中央）
    function openTimeWheel() {
      const t = ($('#rTime').value || '19:00').split(':').map(Number);
      const h = t[0] || 19, m = t[1] || 0;
      const hourVals = []; for (let i = 0; i < 24; i++) hourVals.push({ v: i, label: String(i).padStart(2, '0') });
      const minVals = []; for (let i = 0; i < 60; i++) minVals.push({ v: i, label: String(i).padStart(2, '0') });
      openWheelPicker({
        title: '提醒时间',
        unitLabels: ['时', '分'],
        columns: [
          { values: hourVals, default: h },
          { values: minVals, default: m }
        ],
        onConfirm: (out) => { $('#rTime').value = `${String(out[0]).padStart(2, '0')}:${String(out[1]).padStart(2, '0')}`; }
      });
    }
    $('#rTime').onclick = openTimeWheel;
    $$('#rDays button').forEach(b => b.onclick = () => {
      const d = +b.dataset.d;
      if (pick.has(d)) { pick.delete(d); b.classList.remove('on'); } else { pick.add(d); b.classList.add('on'); }
    });
    $('#rc').onclick = closeModal;
    $('#rs').onclick = () => {
      const time = $('#rTime').value || '19:00';
      if (!pick.size) { toast('请选择至少一天'); return; }
      S.addReminder({ time, days: [...pick].sort(), label: $('#rLabel').value.trim(), on: true });
      toast('提醒已添加'); closeModal(); renderProfile();
    };
  }

  // ---------- Modal ----------
  function openModal(html) {
    $('#modalRoot').innerHTML = `<div class="modal-mask" id="mask"><div class="modal">${html}</div></div>`;
    $('#mask').onclick = (e) => { if (e.target.id === 'mask') closeModal(); };
  }
  function closeModal() { $('#modalRoot').innerHTML = ''; }

  /**
   * 通用滚轮选择器（移动端 iOS 风格）
   * @param {Object} cfg
   *   title     弹窗标题
   *   columns   列定义数组，每列 { values:[{v,label}], default:v }
   *   dotCols   (可选, 双列小数滚轮) 不绘制 wp-unit，由 .wp-sel-dot 居中显示小数点
   *   unitLabels (可选, 多列单位) 在选中行中央按列间隙定位绘制单位，如
   *               出生日期 cols=3, unitLabels=['年','月','日'] → 第 1 / 3、第 2 / 3 处；
   *               提醒时间 cols=2, unitLabels=['时','分']         → 第 1 / 2 处。
   *               互斥与 dotCols：两者不会同时存在。
   *   onConfirm(values) 确认回调，values 为各列选中值数组
   * 交互：触摸拖动 / 鼠标滚轮 / 点击选中区，松手吸附到最近项
   */
  function openWheelPicker(cfg) {
    const cols = cfg.columns;
    const id = 'wp_' + Math.random().toString(36).slice(2, 8);
    const COL_H = 36;                 // 每项高度
    const VISIBLE = 5;                // 可见行数（奇数，中间为选中行）
    const PAD = (VISIBLE - 1) / 2;    // 上下留白行数
    const boxH = COL_H * VISIBLE;

    const colHtml = cols.map((c, ci) => {
      const items = c.values.map(it => `<div class="wp-item" data-v="${esc(it.v)}">${esc(it.label)}</div>`).join('');
      // 当前实现：双列小数滚轮（dotCols 模式）不显示 wp-unit；多列单位走 cfg.unitLabels 统一在 wp-sel 内定位
      return `<div class="wp-col" data-ci="${ci}" style="height:${boxH}px">
        <div class="wp-items" style="padding:${PAD * COL_H}px 0">${items}</div>
      </div>`;
    }).join('');

    // 单位文字 span（钉在选中行中央列间隙）：
    //   - 多列单位场景：N = cols.length，单位个数 N-1，位于 (i+1)/N
    //   - 双列小数场景：由 .wp-sel-dot 单独绘制小数点
    let unitHtml = '';
    if (cfg.unitLabels && cfg.unitLabels.length && !cfg.dotCols) {
      const N = cols.length;
      unitHtml = cfg.unitLabels.map((u, i) => {
        // 第 i 个单位位于第 i 列与第 i+1 列之间（中心 = (i+1) / N）
        const left = ((i + 1) / N) * 100;
        return `<span class="wp-sel-unit" style="left:${left}%">${esc(u)}</span>`;
      }).join('');
    }

    // 关键点：滚轮选择器使用【独立覆盖层】，不替换 #modalRoot 里原有的弹窗
    // （原弹窗含 #pHeight/#pWeight 等输入框，若被替换则在确认回调里取不到，导致保存失败）。
    if (!$('#wpLayer')) {
      const layer = document.createElement('div');
      layer.id = 'wpLayer';
      layer.className = 'wp-layer';
      document.body.appendChild(layer);
    }
    const layer = $('#wpLayer');
    layer.innerHTML = `
      <div class="wp-sheet">
        <div class="wp-head"><h3>${esc(cfg.title || '请选择')}</h3></div>
      <div class="wp-wrap" style="height:${boxH}px">
        <div class="wp-cols" id="${id}">${colHtml}</div>
        <div class="wp-mask"></div>
        <div class="wp-sel" style="height:${COL_H}px;top:${PAD * COL_H}px">
          ${cfg.dotCols ? `<span class="wp-sel-dot">.</span>` : ''}
          ${unitHtml}
        </div>
      </div>
        <div class="session-actions" style="margin-top:16px">
          <button class="btn ghost" id="wpCancel">取消</button>
          <button class="btn" id="wpOk">确定</button>
        </div>
      </div>`;
    layer.classList.add('show');
    // 点击滚轮层背景（非 sheet 区域）关闭滚轮，等同于取消；不影响原弹窗
    layer.onclick = (e) => { if (e.target === layer) closeWheel(); };

    const root = $('#' + id);
    const colEls = $$('.wp-col', root);
    const state = colEls.map((el, ci) => {
      const itemsEl = $('.wp-items', el);
      const vals = cols[ci].values;
      let def = cols[ci].default;
      let idx = Math.max(0, vals.findIndex(it => String(it.v) === String(def)));
      return { el, itemsEl, vals, idx, dragging: false, startY: 0, startOffset: 0, offset: 0, lastY: 0, lastT: 0, vel: 0, raf: 0 };
    });

    function clampOffset(s) {
      const min = -(s.vals.length - 1) * COL_H;
      if (s.offset > 0) s.offset = 0;
      if (s.offset < min) s.offset = min;
    }
    function apply(s) {
      s.itemsEl.style.transform = `translateY(${s.offset}px)`;
    }
    function setIndex(s, i, animate) {
      s.idx = Math.max(0, Math.min(s.vals.length - 1, i));
      const target = -s.idx * COL_H;
      if (animate) {
        cancelAnimationFrame(s.raf);
        const step = () => {
          s.offset += (target - s.offset) * 0.25;
          if (Math.abs(target - s.offset) < 0.5) { s.offset = target; apply(s); }
          else { apply(s); s.raf = requestAnimationFrame(step); }
        };
        step();
      } else { s.offset = target; apply(s); }
    }
    state.forEach(s => { setIndex(s, s.idx, false); });

    function nearest(s) {
      return Math.round(-s.offset / COL_H);
    }
    function endDrag(s) {
      s.dragging = false;
      // 惯性：根据末速度追加位移
      let v = s.vel;
      const momentum = () => {
        if (Math.abs(v) < 0.4) {
          setIndex(s, nearest(s), true);
          return;
        }
        s.offset += v;
        v *= 0.86;
        const min = -(s.vals.length - 1) * COL_H;
        if (s.offset > 0) { s.offset = 0; v = 0; }
        if (s.offset < min) { s.offset = min; v = 0; }
        apply(s);
        requestAnimationFrame(momentum);
      };
      momentum();
    }

    state.forEach(s => {
      const el = s.el;
      // 滑动音效节流（100ms 一次），避免连续滑动刷出爆音；同时跟随 on/off
      let lastScrollAt = 0;
      const canPlayScroll = () => {
        const now = performance.now();
        if (now - lastScrollAt < 100) return false;
        lastScrollAt = now; return true;
      };
      const playScrollIfAllowed = () => { if (canPlayScroll()) window.FitAudio.scroll(); };
      // 触摸
      el.addEventListener('touchstart', (e) => {
        s.dragging = true; cancelAnimationFrame(s.raf);
        s.startY = e.touches[0].clientY; s.startOffset = s.offset;
        s.lastY = s.startY; s.lastT = performance.now(); s.vel = 0;
        lastScrollAt = 0; window.FitAudio.ensure(); window.FitAudio.scroll();
      }, { passive: true });
      el.addEventListener('touchmove', (e) => {
        if (!s.dragging) return;
        const y = e.touches[0].clientY;
        s.offset = s.startOffset + (y - s.startY);
        clampOffset(s); apply(s);
        const now = performance.now(), dt = now - s.lastT || 16;
        s.vel = (y - s.lastY) / dt * 16; s.lastY = y; s.lastT = now;
        playScrollIfAllowed();
      }, { passive: true });
      el.addEventListener('touchend', () => endDrag(s));
      // 鼠标（桌面预览）
      el.addEventListener('mousedown', (e) => {
        s.dragging = true; cancelAnimationFrame(s.raf);
        s.startY = e.clientY; s.startOffset = s.offset; s.lastY = s.startY; s.lastT = performance.now(); s.vel = 0;
        lastScrollAt = 0; window.FitAudio.ensure(); window.FitAudio.scroll();
        const move = (ev) => {
          if (!s.dragging) return;
          const y = ev.clientY;
          s.offset = s.startOffset + (y - s.startY);
          clampOffset(s); apply(s);
          const now = performance.now(), dt = now - s.lastT || 16;
          s.vel = (y - s.lastY) / dt * 16; s.lastY = y; s.lastT = now;
          playScrollIfAllowed();
        };
        const up = () => { s.dragging = false; document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up); endDrag(s); };
        document.addEventListener('mousemove', move);
        document.addEventListener('mouseup', up);
      });
      // 滚轮
      el.addEventListener('wheel', (e) => {
        e.preventDefault(); cancelAnimationFrame(s.raf);
        window.FitAudio.ensure();
        s.offset -= Math.sign(e.deltaY) * COL_H; clampOffset(s); apply(s);
        playScrollIfAllowed();
      }, { passive: false });
      // 点击选中区：点击某项使其居中
      el.addEventListener('click', (e) => {
        if (s.dragging) return;
        const item = e.target.closest('.wp-item');
        if (!item) return;
        const i = [...s.itemsEl.children].indexOf(item);
        if (i >= 0) {
          window.FitAudio.ensure(); window.FitAudio.scroll();
          setIndex(s, i, true);
        }
      });
    });

    function closeWheel() {
      layer.classList.remove('show');
      layer.innerHTML = '';
    }
    $('#wpCancel').onclick = closeWheel;
    $('#wpOk').onclick = () => {
      const out = state.map(s => s.vals[s.idx].v);
      if (cfg.onConfirm) cfg.onConfirm(out); // 先回填原弹窗字段，再关闭滚轮层（原弹窗保留）
      closeWheel();
    };
  }

  // 通用二次确认弹窗：点击「确认」才执行 onYes
  function openConfirm(title, msg, onYes, confirmText) {
    const yes = confirmText || '确认';
    openModal(`
      <h3>${esc(title)}</h3>
      <p class="muted" style="font-size:13.5px;line-height:1.65;margin:12px 0 20px">${esc(msg)}</p>
      <div class="session-actions">
        <button class="btn ghost" id="cfNo">取消</button>
        <button class="btn coral" id="cfYes">${esc(yes)}</button>
      </div>`);
    $('#cfNo').onclick = () => { haptic(8); closeModal(); };
    $('#cfYes').onclick = () => { haptic(12); closeModal(); if (onYes) onYes(); };
  }

  // 数据导入 / 导出：换机或重装前备份，防止运动数据丢失
  function openDataIO() {
    openModal(`
      <h3>数据导入导出</h3>
      <p class="muted" style="font-size:12.5px;line-height:1.65;margin:8px 0 18px">
        导出会把全部运动记录、计划、提醒、资料等保存到本机文件；换手机或重装 APP 前先导出，再导入即可无损迁移。
      </p>
      <div class="io-actions">
        <button class="btn block" id="doExport">⬇️ 导出数据到本地</button>
        <button class="btn ghost block" id="doImport">⬆️ 从备份文件导入</button>
      </div>
      <input type="file" id="ioFile" accept="application/json,.json" hidden />
      <p class="muted center mt8" style="font-size:11px">导入会用备份文件覆盖当前全部数据，请先确认已导出备份。</p>
    `);
    $('#doExport').onclick = () => {
      haptic(12);
      const json = S.exportData();
      const ts = new Date(), pad = (n) => String(n).padStart(2, '0');
      const name = `轻动数据备份_${ts.getFullYear()}${pad(ts.getMonth() + 1)}${pad(ts.getDate())}_${pad(ts.getHours())}${pad(ts.getMinutes())}.json`;
      // 安卓 WebView 不支持 a.download 下载，优先通过原生桥接写入 Download 目录
      if (window.AndroidBridge && typeof window.AndroidBridge.saveFile === 'function') {
        const b64 = 'data:application/json;base64,' + btoa(unescape(encodeURIComponent(json)));
        try { window.AndroidBridge.saveFile(name, b64); closeModal(); return; }
        catch (e) { /* 回退浏览器下载 */ }
      }
      // 回退：浏览器下载
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.download = name;
      a.href = url; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast('数据已导出到本机');
      closeModal();
    };
    $('#doImport').onclick = () => { haptic(12); $('#ioFile').click(); };
    $('#ioFile').onchange = (ev) => {
      const file = ev.target.files && ev.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const text = String(reader.result || '');
        openConfirm('导入数据', '导入将用该备份文件覆盖当前全部运动数据，确定继续吗？', () => {
          try {
            S.importData(text);
            toast('数据已导入');
            renderProfile(); renderPlans();
          } catch (e) {
            toast('导入失败：' + (e && e.message ? e.message : '文件格式不正确'));
          }
        });
      };
      reader.onerror = () => toast('读取文件失败');
      reader.readAsText(file);
    };
  }

  // ---------- 提醒检查（应用打开时） ----------
  function checkReminders() {
    const now = new Date();
    const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const wd = (now.getDay() + 6) % 7;
    const key = S.dayKey(now) + ' ' + hhmm;
    S.getReminders().forEach(r => {
      if (!r.on || r.time !== hhmm || !r.days.includes(wd)) { r._firedKey = ''; return; }
      if (r._firedKey === key) return;          // 本时刻已提醒过（修复只触发一次 bug，次日可重新触发）
      r._firedKey = key;
      ringAlarm(r);
    });
  }

  // 提醒触发：系统通知（若已授权）+ 应用内醒目弹窗，无论是否授权都能看到
  function ringAlarm(r) {
    const title = '⏰ 运动提醒';
    const body = r.label || '该运动啦~';
    if ('Notification' in window && Notification.permission === 'granted') {
      try { new Notification(title, { body }); } catch (e) {}
    }
    showAlarm(title, body);
    window.FitAudio.ensure();
    for (let i = 0; i < 2; i++) setTimeout(() => window.FitAudio.tick(), i * 350);
  }

  // 应用内醒目提醒弹窗
  function showAlarm(title, body) {
    openModal(`
      <div class="alarm-card">
        <div class="alarm-bell">⏰</div>
        <h3 style="margin:6px 0 8px">${esc(title)}</h3>
        <p class="alarm-body">${esc(body)}</p>
        <p class="muted" style="font-size:12px">来自「轻动」 · 到点该动一动啦</p>
        <button class="btn block lg" id="alarmOk">知道了，去运动</button>
      </div>`);
    $('#alarmOk').onclick = closeModal;
  }

  // 生成日历事件（.ics，含每周重复 RRULE 与 VALARM），导入手机日历即可用系统闹钟提醒
  function buildICS(r) {
    const pad = (n) => String(n).padStart(2, '0');
    const [hh, mm] = (r.time || '19:00').split(':');
    const byday = (r.days && r.days.length ? r.days : [1, 3, 5])
      .map(d => ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'][d]).join(',');
    const now = new Date();
    const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}T${pad(now.getHours())}${pad(now.getMinutes())}00`;
    const start = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}T${pad(+hh)}${pad(+mm)}00`;
    const summary = r.label || '轻动 · 运动提醒';
    return [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//QingDong//Fit//CN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      'UID:qingdong-' + (r.id || 'rem') + '@fit',
      'DTSTAMP:' + stamp,
      'DTSTART:' + start,
      'RRULE:FREQ=WEEKLY;BYDAY=' + byday,
      'SUMMARY:' + summary,
      'DESCRIPTION:来自「轻动」App 的运动提醒，到点动一动~',
      'BEGIN:VALARM', 'TRIGGER:-PT0M', 'ACTION:DISPLAY', 'DESCRIPTION:' + summary, 'END:VALARM',
      'END:VEVENT', 'END:VCALENDAR'
    ].join('\r\n');
  }

  function exportReminderICS(r) {
    const ics = buildICS(r);
    const safeName = (r.label || '运动').replace(/[^\w一-龥]/g, '');
    const name = `轻动提醒_${safeName}_${r.time}.ics`;
    const title = r.label || '轻动 · 运动提醒';
    // 重复星期（与 buildICS 同口径）：r.days 为 0-6 索引，映射到 MO..SU
    const byday = (r.days && r.days.length ? r.days : [1, 3, 5])
      .map(d => ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'][d]).join(',');
    // 安卓优先用原生桥接联动系统日历（CalendarContract.ACTION_INSERT），保存即加入系统提醒
    if (window.AndroidBridge && typeof window.AndroidBridge.addEvent === 'function') {
      try { window.AndroidBridge.addEvent(title, r.time || '19:00', byday); toast('已调起日历，保存后由系统按时提醒'); return; }
      catch (e) { /* 回退浏览器下载 */ }
    }
    // 回退：浏览器下载 .ics
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('日历文件已导出，导入手机日历即可用系统闹钟提醒');
  }

  // ---------- 启动 ----------
  function init() {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
    // 开屏页：薄荷绿主题 2 秒淡出，与主程序过渡自然
    // （splash 的 CSS 动画 splashOut 设定了 2s 离场，结束时彻底隐藏）
    document.body.classList.add('is-splash');
    setTimeout(() => { document.body.classList.remove('is-splash'); }, 2100);
    switchView('home');
    checkReminders();
    setInterval(checkReminders, 30000);
    $$('.tab').forEach(t => t.onclick = () => { haptic(10); switchView(t.dataset.view); });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
