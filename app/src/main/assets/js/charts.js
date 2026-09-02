/* =========================================================
 * charts.js — 零依赖轻量图表（Canvas 绘制，适配高清屏）
 * 提供：柱状图、折线图、环形图。配色走小清新薄荷绿系。
 * ========================================================= */
(function (global) {
  'use strict';

  const PALETTE = ['#5ec9a0', '#7fd1c4', '#9ad0f0', '#f6b9a8', '#f7d08a', '#c3b1e1', '#a8d5ba'];

  function setup(canvas) {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const w = rect.width || canvas.clientWidth || 300;
    const h = rect.height || canvas.clientHeight || 160;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    return { ctx, w, h };
  }

  function barChart(canvas, opts) {
    const { ctx, w, h } = setup(canvas);
    const { labels = [], values = [], color = PALETTE[0], unit = '', axisStep = 1, pickFormatter = null } = opts;
    if (!values.length) return;

    // 高亮色：在基础色基础上加深，用于被选中的柱子轻微突出
    const HL = shade(color, -0.16);

    // 顶部预留信息条高度，点击后在此显示具体消耗量（不遮挡任何柱子）
    const padL = 30, padR = 12, padT = 40, padB = 24;
    const cw = w - padL - padR, ch = h - padT - padB;
    const max = Math.max(...values, 1);
    const n = values.length;
    const bw = Math.min(34, cw / n * 0.6);
    const gap = cw / n;

    // 记录柱子几何，便于点击命中检测
    const bars = values.map((v, i) => {
      const x = padL + gap * i + (gap - bw) / 2;
      const bh = Math.max(2, ch * v / max);
      return { x, y: padT + ch - bh, w: bw, h: bh, v };
    });

    const st = canvas._bstate || (canvas._bstate = { pop: 0, raf: 0 });
    st.bars = bars;

    function draw(picked, pop) {
      ctx.clearRect(0, 0, w, h);

      // 网格 + Y 轴刻度（每次重设字体/对齐，避免被选中柱子的状态污染）
      ctx.save();
      ctx.strokeStyle = '#eef3f1';
      ctx.fillStyle = '#9fb3ad';
      ctx.font = '10px system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      const ticks = 3;
      for (let i = 0; i <= ticks; i++) {
        const y = padT + ch - (ch * i / ticks);
        ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(w - padR, y); ctx.stroke();
        const v = Math.round(max * i / ticks);
        ctx.fillText(v, padL - 4, y);
      }
      ctx.restore();

      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      bars.forEach((b, i) => {
        const isPicked = (i === picked);
        const lift = isPicked ? 6 * pop : 0; // 选中时轻轻抬起
        const x = b.x, bw_ = b.w, bh = b.h, y = b.y - lift;
        // 每根柱子单独 save/restore，确保选中柱的阴影/高亮不会影响其它柱与日期标签
        ctx.save();
        if (isPicked) { ctx.shadowColor = 'rgba(31,42,39,0.22)'; ctx.shadowBlur = 12; ctx.shadowOffsetY = 4; }
        ctx.fillStyle = isPicked ? HL : color;
        roundRect(ctx, x, y, bw_, bh, Math.min(6, bw_ / 2));
        ctx.fill();
        ctx.restore();

        // 底部日期标签（始终用常规细体 + 顶部基线，避免被污染成加黑/抬高）
        // axisStep > 1 时按步长间隔绘制（如每月只在 1/6/11... 显示日期），其余保留以备点击显示完整日期
        ctx.save();
        ctx.fillStyle = '#7a8c87';
        ctx.font = '10px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        if ((i % axisStep) === 0) ctx.fillText(labels[i] || '', x + bw_ / 2, padT + ch + 6);
        ctx.restore();
      });
      ctx.restore();

      // 选中信息条：画在画布顶部固定区（绝不遮挡柱子），显示「日期 · XX.XX 千卡」
      // 使用 pickFormatter 回调可在不同视图（周/月/年）自定义文本
      if (picked >= 0 && picked < bars.length && pop > 0.5) {
        const b = bars[picked];
        const label = labels[picked] || '';
        const txt = pickFormatter
          ? pickFormatter(picked, label, b.v)
          : ((label ? label + '  ' : '') + b.v.toFixed(2) + ' 千卡');
        ctx.save();
        ctx.font = '600 13px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const tw = ctx.measureText(txt).width + 20;
        const bx = Math.max(4, Math.min(w - tw - 4, w / 2 - tw / 2));
        roundRect(ctx, bx, 6, tw, 22, 11);
        ctx.fillStyle = HL; ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.fillText(txt, w / 2, 17);
        ctx.restore();
      }
    }

    function frame() {
      const cur = (canvas._picked != null && canvas._picked >= 0) ? 1 : 0;
      const idx = canvas._picked != null ? canvas._picked : -1;
      st.pop += (cur - st.pop) * 0.3;
      if (Math.abs(cur - st.pop) < 0.01) st.pop = cur;
      draw(idx, st.pop);
      const animating = st.pop > 0.001 && st.pop < 0.999;
      st.raf = animating ? requestAnimationFrame(frame) : 0;
    }

    if (canvas._picked == null) canvas._picked = -1;
    if (!st.raf) st.raf = requestAnimationFrame(frame);

    if (!canvas._barBound) {
      canvas._barBound = true;
      canvas.addEventListener('click', (ev) => {
        const rect = canvas.getBoundingClientRect();
        const x = ev.clientX - rect.left, y = ev.clientY - rect.top;
        let hit = -1;
        for (let i = 0; i < bars.length; i++) {
          const b = bars[i];
          // 命中区域：柱子矩形 + 顶部轻微抬升范围
          if (x >= b.x && x <= b.x + b.w && y >= b.y - 8 && y <= b.y - 8 + b.h + 8) { hit = i; break; }
        }
        canvas._picked = (hit >= 0 && canvas._picked === hit) ? -1 : hit;
        if (!st.raf) st.raf = requestAnimationFrame(frame);
        if (opts.onPick) opts.onPick(canvas._picked === -1 ? -1 : canvas._picked);
      });
    }
  }

  // 颜色加深/变浅（用于高亮）：amt 为负数表示加深
  function shade(hex, amt) {
    const m = hex.replace('#', '');
    const num = parseInt(m.length === 3 ? m.split('').map(c => c + c).join('') : m, 16);
    let r = (num >> 16) & 255, g = (num >> 8) & 255, b = num & 255;
    r = Math.max(0, Math.min(255, Math.round(r * (1 + amt))));
    g = Math.max(0, Math.min(255, Math.round(g * (1 + amt))));
    b = Math.max(0, Math.min(255, Math.round(b * (1 + amt))));
    return `rgb(${r},${g},${b})`;
  }

  function lineChart(canvas, opts) {
    const { ctx, w, h } = setup(canvas);
    const { labels = [], values = [], color = PALETTE[2], unit = '' } = opts;
    if (!values.length) return;
    const padL = 30, padR = 12, padT = 14, padB = 24;
    const cw = w - padL - padR, ch = h - padT - padB;
    const max = Math.max(...values, 1);
    const n = values.length;
    const stepX = n > 1 ? cw / (n - 1) : 0;

    ctx.strokeStyle = '#eef3f1';
    ctx.fillStyle = '#9fb3ad';
    ctx.font = '10px system-ui, sans-serif';
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    const ticks = 3;
    for (let i = 0; i <= ticks; i++) {
      const y = padT + ch - (ch * i / ticks);
      ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(w - padR, y); ctx.stroke();
      ctx.fillText(Math.round(max * i / ticks), padL - 4, y);
    }

    const pts = values.map((v, i) => [padL + stepX * i, padT + ch - ch * v / max]);

    // 渐变填充
    const grad = ctx.createLinearGradient(0, padT, 0, padT + ch);
    grad.addColorStop(0, hexA(color, 0.25));
    grad.addColorStop(1, hexA(color, 0));
    ctx.beginPath();
    ctx.moveTo(pts[0][0], padT + ch);
    pts.forEach(p => ctx.lineTo(p[0], p[1]));
    ctx.lineTo(pts[pts.length - 1][0], padT + ch);
    ctx.closePath();
    ctx.fillStyle = grad; ctx.fill();

    ctx.beginPath();
    pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]));
    ctx.strokeStyle = color; ctx.lineWidth = 2.4; ctx.lineJoin = 'round'; ctx.stroke();

    ctx.fillStyle = color;
    pts.forEach(p => { ctx.beginPath(); ctx.arc(p[0], p[1], 3, 0, Math.PI * 2); ctx.fill(); });

    ctx.fillStyle = '#7a8c87';
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    labels.forEach((lb, i) => {
      if (n > 8 && i % 2) return;
      ctx.fillText(lb, pts[i][0], padT + ch + 6);
    });
  }

  function donutChart(canvas, opts) {
    const { ctx, w, h } = setup(canvas);
    const { segments = [], onPick } = opts;
    const total = segments.reduce((s, x) => s + x.value, 0);
    if (!total) return;

    // 顶部预留标注区（正上方居中显示选中色块的数据标注，无引导线），环形图整体下移
    const padT = 30;
    const cx = w / 2, cy = padT + (h - padT) / 2, R = Math.min(w, h - padT) / 2 - 12, r = R * 0.6;
    const EXPLODE = 7; // 选中扇区向外轻微突出（像素），让点击更有反馈

    // 构建扇区几何（含从起点 -90° 起算的累积角度，便于点击命中检测）
    let cum = 0;
    const segs = segments.map((s, i) => {
      const ang = s.value / total * Math.PI * 2;
      const seg = {
        cumStart: cum, cumEnd: cum + ang,
        start: -Math.PI / 2 + cum, end: -Math.PI / 2 + cum + ang,
        color: s.color || PALETTE[i % PALETTE.length],
        label: s.label || ('动作' + (i + 1)),
        value: s.value
      };
      cum += ang;
      return seg;
    });

    const st = canvas._dstate || (canvas._dstate = { pop: 0, raf: 0 });
    const pickedNow = () => (canvas._picked != null && canvas._picked < segs.length) ? canvas._picked : -1;

    function drawSeg(s, off, isPicked) {
      const mid = (s.start + s.end) / 2;
      const ox = Math.cos(mid) * off, oy = Math.sin(mid) * off;
      ctx.save();
      if (isPicked) { ctx.shadowColor = 'rgba(31,42,39,0.22)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 3; }
      ctx.beginPath();
      ctx.moveTo(cx + ox, cy + oy);
      ctx.arc(cx + ox, cy + oy, R, s.start, s.end);
      ctx.closePath();
      ctx.fillStyle = s.color;
      ctx.fill();
      ctx.restore();
      return { ox, oy, mid };
    }

    function draw(picked, pop) {
      ctx.clearRect(0, 0, w, h);
      // 先画未选中扇区（底层）
      segs.forEach((s, i) => { if (i !== picked) drawSeg(s, 0, false); });
      // 再画选中扇区（向外突出 + 柔和阴影，置于最上层，丝滑自然）
      let pos = null;
      if (picked >= 0 && segs[picked]) pos = drawSeg(segs[picked], EXPLODE * pop, true);
      // 内圈挖空
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff'; ctx.fill();
      // 中心总量
      ctx.fillStyle = '#2f3e3a';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = '600 15px system-ui, sans-serif';
      ctx.fillText(total.toFixed(2), cx, cy - 6);
      ctx.fillStyle = '#9fb3ad';
      ctx.font = '10px system-ui, sans-serif';
      ctx.fillText('千卡', cx, cy + 9);
      // 选中色块的数据标注：统一显示在环形图【正上方居中】，去掉引导线，圆角胶囊保证完整不被遮挡
      if (picked >= 0 && segs[picked]) {
        const s = segs[picked];
        const text = `${s.label} ${(s.value / total * 100).toFixed(1)}%`;
        ctx.font = '600 12.5px system-ui, sans-serif';
        ctx.textBaseline = 'middle';
        const tw = ctx.measureText(text).width;
        // 标注框布局：左侧色点 + 文字，整体带足 padding，确保文本永不超出框
        const dot = 4;                 // 色点半径
        const dotGap = 8;              // 色点到文字的间距
        const sidePad = 11;            // 框两侧内边距
        const boxW = sidePad * 2 + dot * 2 + dotGap + tw;
        const bh = 24;
        const bx = Math.max(4, Math.min(w - boxW - 4, cx - boxW / 2));
        const by = 3; // 紧贴顶部，正上方居中
        // 圆角胶囊底（色块描边 + 白底，清晰且不遮挡环形图）
        roundRect(ctx, bx, by, boxW, bh, bh / 2);
        ctx.fillStyle = 'rgba(255,255,255,0.96)'; ctx.fill();
        ctx.strokeStyle = s.color; ctx.lineWidth = 1.4; ctx.stroke();
        // 左侧色点
        ctx.fillStyle = s.color;
        ctx.beginPath(); ctx.arc(bx + sidePad + dot, by + bh / 2, dot, 0, Math.PI * 2); ctx.fill();
        // 文本（从色点右侧开始，框宽已为其预留完整空间，绝不超出）
        ctx.fillStyle = '#2f3e3a';
        ctx.textAlign = 'left';
        ctx.fillText(text, bx + sidePad + dot * 2 + dotGap, by + bh / 2 + 0.5);
      }
    }

    // 平滑过渡：选中时突出、取消时收回
    function frame() {
      const target = pickedNow();
      const tp = target >= 0 ? 1 : 0;
      st.pop += (tp - st.pop) * 0.28;
      if (Math.abs(tp - st.pop) < 0.01) st.pop = tp;
      draw(target, st.pop);
      const animating = (st.pop > 0.001 && st.pop < 0.999) ||
                        (target >= 0 && st.pop < 1) || (target < 0 && st.pop > 0);
      st.raf = animating ? requestAnimationFrame(frame) : 0;
    }

    if (canvas._picked == null) canvas._picked = -1;
    if (!st.raf) st.raf = requestAnimationFrame(frame);

    // 点击扇区切换选中；点击内圈/外圈空白取消选中（带平滑突出动画）
    if (!canvas._donutBound) {
      canvas._donutBound = true;
      canvas.addEventListener('click', (ev) => {
        const rect = canvas.getBoundingClientRect();
        const x = ev.clientX - rect.left, y = ev.clientY - rect.top;
        const dx = x - cx, dy = y - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < r || dist > R) { canvas._picked = -1; }
        else {
          let a = Math.atan2(dy, dx);
          let rel = (a + Math.PI / 2) % (Math.PI * 2);
          if (rel < 0) rel += Math.PI * 2; // 从起点 -90° 起算的累积角度
          const idx = segs.findIndex(s => rel >= s.cumStart && rel < s.cumEnd);
          if (idx >= 0) canvas._picked = (canvas._picked === idx) ? -1 : idx;
        }
        if (!st.raf) st.raf = requestAnimationFrame(frame);
        if (onPick) onPick(canvas._picked === -1 ? -1 : canvas._picked);
      });
    }
  }

  // ---- 工具 ----
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function hexA(hex, a) {
    const m = hex.replace('#', '');
    const n = parseInt(m.length === 3 ? m.split('').map(c => c + c).join('') : m, 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }

  global.FitCharts = { barChart, lineChart, donutChart, PALETTE };
})(window);
