/* =========================================================
 * store.js — 本地数据层（localStorage）
 * 负责：运动记录、最佳成绩、健身计划、个人资料、目标、提醒
 * ========================================================= */
(function (global) {
  'use strict';

  const KEY = 'fitapp.v1';

  const defaultState = {
    records: [],     // {id, exId, mode, value, calories, durationSec, date(ISO), ts}
    plans: [],       // {id, name, emoji, exIds:[], createdAt}
    profile: {
      name: '健身达人', weight: 60, height: 170, goalDailyMin: 20,
      avatar: '',    // 头像 dataURL（可空，使用占位 🌿）
      birthday: '',  // 出生日期 yyyy-mm-dd（可空，用于计算年龄与BMI健康建议）
      gender: ''     // 性别：'' / 'male' / 'female'（可空，用于 BMI 性别化建议体重）
    },
    goals: {},       // exId -> {type:'count'|'time', target:Number}
    reminders: [],   // {id, time:'HH:MM', days:[0..6], label, on}
    settings: { reduceMotion: false, sound: true },
    clicks: {}       // exId -> 点击/查看次数（用于动作库排序）
  };

  let state = load();

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return structuredClone(defaultState);
      const parsed = JSON.parse(raw);
      const merged = Object.assign(structuredClone(defaultState), parsed);
      // 兼容旧数据：保证 profile 字段完整
      merged.profile.avatar = merged.profile.avatar || '';
      merged.profile.birthday = merged.profile.birthday || '';
      merged.profile.gender = merged.profile.gender || '';
      return merged;
    } catch (e) {
      return structuredClone(defaultState);
    }
  }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
  }

  // ---- 记录 ----
  function addRecord(rec) {
    rec.id = 'r' + Date.now() + Math.floor(Math.random() * 1000);
    rec.ts = Date.now();
    rec.date = rec.date || new Date().toISOString();
    state.records.push(rec);
    save();
    return rec;
  }

  function getRecords() { return state.records; }

  // 动作点击次数（查看动作详情时累加，用于动作库动态排序）
  function bumpClick(exId) {
    state.clicks[exId] = (state.clicks[exId] || 0) + 1;
    save();
  }
  function getClick(exId) { return state.clicks[exId] || 0; }

  function deleteRecord(id) {
    state.records = state.records.filter(r => r.id !== id);
    save();
  }

  // 某动作最佳成绩：计时取最长秒数，计数取最大个数
  function getBest(exId) {
    const list = state.records.filter(r => r.exId === exId);
    if (!list.length) return null;
    const maxVal = Math.max(...list.map(r => r.value));
    return { value: maxVal, record: list.find(r => r.value === maxVal) };
  }

  // ---- 计划 ----
  function addPlan(plan) {
    plan.id = 'p' + Date.now();
    plan.createdAt = Date.now();
    plan.exIds = plan.exIds || [];
    state.plans.push(plan);
    save();
    return plan;
  }
  function updatePlan(id, patch) {
    const p = state.plans.find(x => x.id === id);
    if (p) Object.assign(p, patch);
    save();
    return p;
  }
  function deletePlan(id) {
    state.plans = state.plans.filter(p => p.id !== id);
    save();
  }
  function getPlans() { return state.plans; }

  // ---- 资料 / 目标 / 提醒 ----
  function updateProfile(patch) {
    Object.assign(state.profile, patch);
    save();
  }
  function setGoal(exId, goal) {
    state.goals[exId] = goal;
    save();
  }
  function getGoal(exId) { return state.goals[exId]; }

  function addReminder(r) {
    r.id = 'rem' + Date.now();
    state.reminders.push(r);
    save();
    return r;
  }
  function updateReminder(id, patch) {
    const r = state.reminders.find(x => x.id === id);
    if (r) Object.assign(r, patch);
    save();
  }
  function deleteReminder(id) {
    state.reminders = state.reminders.filter(r => r.id !== id);
    save();
  }
  function getReminders() { return state.reminders; }

  function updateSettings(patch) {
    Object.assign(state.settings, patch);
    save();
  }

  function resetAll() {
    state = structuredClone(defaultState);
    save();
  }

  // ---- 数据导入 / 导出（用于换机、重装前备份，防止数据丢失） ----
  function exportData() {
    return JSON.stringify({
      app: 'qingdong-fit',
      version: 1,
      exportedAt: new Date().toISOString(),
      state: state
    }, null, 2);
  }

  // 从本程序导出的备份文件恢复全部数据；会覆盖当前数据，调用方需先二次确认
  function importData(jsonStr) {
    if (typeof jsonStr !== 'string' || !jsonStr.trim()) throw new Error('文件为空');
    let parsed;
    try { parsed = JSON.parse(jsonStr); } catch (e) { throw new Error('文件不是合法的 JSON'); }
    // 兼容「带包装」与「裸 state」两种格式
    const incoming = (parsed && parsed.state) ? parsed.state : parsed;
    if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) throw new Error('文件格式不正确');

    const def = structuredClone(defaultState);
    const merged = Object.assign(def, incoming);
    merged.profile = Object.assign(structuredClone(defaultState.profile), incoming.profile || {});
    merged.settings = Object.assign(structuredClone(defaultState.settings), incoming.settings || {});
    merged.records = Array.isArray(incoming.records) ? incoming.records : [];
    merged.plans = Array.isArray(incoming.plans) ? incoming.plans : [];
    merged.reminders = Array.isArray(incoming.reminders) ? incoming.reminders : [];
    merged.goals = (incoming.goals && typeof incoming.goals === 'object') ? incoming.goals : {};
    merged.clicks = (incoming.clicks && typeof incoming.clicks === 'object') ? incoming.clicks : {};
    state = merged;
    save();
    return true;
  }

  // ---- 统计工具 ----
  // 返回某天的本地日期字符串 YYYY-MM-DD
  function dayKey(d) {
    const x = new Date(d);
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
  }

  function recordsOfDay(key) {
    return state.records.filter(r => dayKey(r.date) === key);
  }

  // 聚合一段记录
  function aggregate(list) {
    let count = 0, durationSec = 0, calories = 0;
    list.forEach(r => {
      if (r.mode === 'count') count += r.value;
      else durationSec += r.value;
      calories += r.calories || 0;
    });
    return { count, durationSec, calories, sessions: list.length };
  }

  global.FitStore = {
    addRecord, getRecords, deleteRecord, getBest,
    bumpClick, getClick,
    addPlan, updatePlan, deletePlan, getPlans,
    updateProfile, setGoal, getGoal,
    addReminder, updateReminder, deleteReminder, getReminders,
    updateSettings, resetAll, exportData, importData,
    dayKey, recordsOfDay, aggregate, get state() { return state; }
  };
})(window);
