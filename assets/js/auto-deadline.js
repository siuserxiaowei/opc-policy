// auto-deadline.js — 自动让任何带 data-deadline="YYYY-MM-DD" 的元素在过期后退出"催促模式"
// 使用方式：
//   <span data-deadline="2026-05-20" data-deadline-expired-text="5 月窗口已结束"
//         data-deadline-active-text="距 5/20 截止 {days} 天">
//     距 5/20 截止 {days} 天
//   </span>
//
//   过期时元素会获得 .is-expired class（前端可统一去红、灰化），并把文案替换成 expired-text。
//   未过期时把 {days}/{hours} 占位符替换成实时数值。
//   父级容器若加 data-deadline-hide-when-expired 则整个父节点过期后被设为 display:none。
(function () {
  if (typeof document === 'undefined') return;
  // 注入一次性默认样式（页面没自定义 .is-expired 时也有像样的视觉降级）
  if (!document.getElementById('opc-deadline-style')) {
    var st = document.createElement('style');
    st.id = 'opc-deadline-style';
    st.textContent =
      '.is-expired{opacity:.55;text-decoration:line-through;color:#64748B!important;background:transparent!important;border-color:#CBD5E1!important}' +
      '.is-expired::before{content:"已结束 · ";font-weight:600;text-decoration:none;display:inline}';
    (document.head || document.documentElement).appendChild(st);
  }
  function parseDate(s) {
    // 接受 YYYY-MM-DD 或带时区的 ISO，按东八区当日 23:59:59 收尾
    if (!s) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(s + 'T23:59:59+08:00');
    var d = new Date(s);
    return isNaN(d) ? null : d;
  }
  function fillTokens(tpl, days, hours) {
    return tpl
      .replace(/\{days\}/g, Math.max(0, days))
      .replace(/\{hours\}/g, Math.max(0, hours));
  }
  function tick() {
    var now = Date.now();
    document.querySelectorAll('[data-deadline]').forEach(function (el) {
      var d = parseDate(el.getAttribute('data-deadline'));
      if (!d) return;
      var diff = d.getTime() - now;
      var expired = diff <= 0;
      var days = Math.floor(diff / 86400000);
      var hours = Math.floor((diff % 86400000) / 3600000);
      el.classList.toggle('is-expired', expired);
      el.classList.toggle('is-active', !expired);
      var activeTpl = el.getAttribute('data-deadline-active-text');
      var expiredTpl = el.getAttribute('data-deadline-expired-text');
      if (expired && expiredTpl) el.textContent = expiredTpl;
      else if (!expired && activeTpl) el.textContent = fillTokens(activeTpl, days, hours);
      // 父级可选：过期则隐藏
      var hideHost = el.closest('[data-deadline-hide-when-expired]');
      if (hideHost && expired) hideHost.style.display = 'none';
    });
  }
  // 暴露给页面手动触发（比如倒计时）
  window.OPCDeadline = { tick: tick };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', tick);
  } else {
    tick();
  }
  // 每 60s 复检一次：跨过 0 点会自动过期
  setInterval(tick, 60000);
})();
