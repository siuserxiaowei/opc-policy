/**
 * opcgate.com 政策时间调度辅助
 *
 * 统一输入：policy.application.schedule 对象（见 scripts/migrate_schedule.py 的 schema）
 * 统一输出：
 *   nextDeadline(schedule) -> ISO 日期字符串（YYYY-MM-DD）或 null
 *   displayLabel(schedule) -> 人类可读标签
 *   daysUntil(iso)         -> 剩余整天数（<0 表示已过）
 *
 * 设计：
 *   - 所有函数可传 schedule 对象；如果传的是旧字符串也能用（向后兼容）。
 *   - 时区统一用东八区 UTC+8（gov.cn 公文时区）。
 */
(function () {
  'use strict';

  function parseISO(s) {
    if (!s) return null;
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s));
    if (!m) return null;
    return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], 15, 59, 59));
    // 23:59:59 UTC+8 = 15:59:59 UTC
  }

  function nowInCST() {
    return new Date();
  }

  function nextRecurringWindow(schedule, base) {
    const months = (schedule.months && schedule.months.length) ? schedule.months : [1,2,3,4,5,6,7,8,9,10,11,12];
    const dayStart = schedule.day_start || 1;
    const dayEnd = schedule.day_end || 20;
    const cstNow = new Date(base.getTime() + 8 * 3600 * 1000);
    let year = cstNow.getUTCFullYear();
    for (let iter = 0; iter < 24; iter++) {
      for (const m of months) {
        const winEndISO = new Date(Date.UTC(year, m - 1, dayEnd, 15, 59, 59));
        if (winEndISO.getTime() >= base.getTime()) {
          return {
            start: `${year}-${String(m).padStart(2,'0')}-${String(dayStart).padStart(2,'0')}`,
            end:   `${year}-${String(m).padStart(2,'0')}-${String(dayEnd).padStart(2,'0')}`,
          };
        }
      }
      year += 1;
    }
    return null;
  }

  function nextDeadline(input) {
    if (!input) return null;
    if (typeof input === 'string') {
      const d = parseISO(input);
      return d ? input.slice(0, 10) : null;
    }
    const s = input;
    const now = nowInCST();
    if (s.type === 'deadline' && s.deadline) {
      return s.deadline;
    }
    if (s.type === 'window' && s.end) {
      return s.end;
    }
    if (s.type === 'recurring') {
      if (s.next_end && parseISO(s.next_end) >= now) return s.next_end;
      const win = nextRecurringWindow(s, now);
      return win ? win.end : null;
    }
    return null;
  }

  function nextStart(input) {
    if (!input || typeof input === 'string') return null;
    const s = input;
    if (s.type === 'window' && s.start) return s.start;
    if (s.type === 'recurring') {
      if (s.next_start) return s.next_start;
      const win = nextRecurringWindow(s, nowInCST());
      return win ? win.start : null;
    }
    return null;
  }

  function displayLabel(input) {
    if (!input) return '';
    if (typeof input === 'string') return `截止 ${input}`;
    const s = input;
    if (s.display) return s.display;
    if (s.type === 'deadline') return `截止 ${s.deadline}`;
    if (s.type === 'window') return `${s.start} 至 ${s.end}`;
    if (s.type === 'recurring') {
      const mm = (s.months || []).join('/');
      return `每年${mm ? mm + '月' : ''}${s.day_start || ''}-${s.day_end || ''}日`;
    }
    return '';
  }

  function daysUntil(iso) {
    const d = parseISO(iso);
    if (!d) return null;
    const diff = d.getTime() - Date.now();
    return Math.ceil(diff / (24 * 3600 * 1000));
  }

  function countdown(input) {
    const end = nextDeadline(input);
    if (!end) return null;
    const d = daysUntil(end);
    if (d === null) return null;
    const start = nextStart(input);
    return {
      endDate: end,
      startDate: start,
      daysLeft: d,
      expired: d < 0,
      urgent: d >= 0 && d <= 7,
      soon: d > 7 && d <= 30,
      label: displayLabel(input),
    };
  }

  const api = { nextDeadline, nextStart, displayLabel, daysUntil, countdown };
  if (typeof window !== 'undefined') window.Schedule = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
