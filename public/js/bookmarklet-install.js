/**
 * 拖拽安装书签浮窗按钮（bookmarklet-install-button 技能实现）
 *
 * 原理：链接元素的 href 会被浏览器在拖拽到书签栏时保存为书签地址。
 * 书签目标（按优先级）：
 *   1. opts.url                          显式指定的完整 URL
 *   2. #bm-code 文本内容                  javascript: 代码（无协议头则自动补）或完整 URL
 *   3. location.origin + '/'             默认：本站首页（拖入即得到应用首页快捷书签）
 *
 * 用法（顺序不能颠倒）：
 *   <script id="bm-code" type="text/plain">(function(){...})();</script>  <!-- 可选 -->
 *   <script>window.BM_INSTALLER_OPTS = { top: 64 }</script>              <!-- 可选 -->
 *   <script src="/js/bookmarklet-install.js"></script>
 *
 * API：
 *   BookmarkletInstaller.mount(opts) 重新挂载/覆盖配置（幂等）
 *   BookmarkletInstaller.reset()     清除「已安装隐藏」状态并重新渲染
 *
 * 默认行为：
 * - 悬浮按钮固定右上角（可配置 position: top-right | top-left | top-center）
 * - 主色探测：CSS 变量 → meta[name=theme-color] → 兜底 #004baa
 * - 按住拖拽时按钮上方出现「向上拖👆」气泡并跟随光标
 * - 按下瞬间链接文本与 title 设为应用名（书签名 = 应用名），不显式加 draggable
 * - dragend 判定发生明显位移即视为安装成功，本次页面内永久隐藏（刷新恢复）
 * - 点击（未拖拽）复制书签地址，兼容移动端无法拖拽
 */
(function () {
  'use strict';
  if (window.BookmarkletInstaller && window.BookmarkletInstaller.__ready) return;

  var DEFAULTS = {
    source: 'bm-code',
    url: null,
    label: '按住，拖进书签栏',
    hint: '向上拖👆',
    position: 'top-right',
    top: 16,
    right: 16,
    left: 16,
    appName: null,
    primary: null
  };

  var opts = {};
  var btn = null;
  var bubble = null;
  var hidden = false;
  var p0 = null;
  var p1 = null;

  function merge(t) {
    for (var k in t) if (Object.prototype.hasOwnProperty.call(t, k)) opts[k] = t[k];
  }

  function readCode() {
    var el = document.getElementById(opts.source);
    return el ? el.textContent.trim() : '';
  }

  function getHref() {
    if (opts.url) return opts.url;
    var raw = readCode();
    if (!raw) return location.origin + '/';
    if (/^javascript:/i.test(raw)) return raw;
    if (raw.indexOf('http://') === 0 || raw.indexOf('https://') === 0) return raw;
    return 'javascript:' + raw;
  }

  function detectAppName() {
    if (opts.appName) return opts.appName;
    var m = document.querySelector(
      'meta[name="application-name"], meta[name="apple-mobile-web-app-title"]'
    );
    if (m && m.getAttribute('content')) return m.getAttribute('content').trim();
    if (window.APP_NAME) return String(window.APP_NAME);
    var t = (document.title || '').split(/[-|·(（]/)[0].trim();
    return t || '书签';
  }

  function hslToRgb(h, s, l) {
    s /= 100;
    l /= 100;
    var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    var q2 = 2 * l - q;
    function f(t) {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return q2 + (q - q2) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return q2 + (q - q2) * (2 / 3 - t) * 6;
      return q2;
    }
    return {
      r: Math.round(f(h / 360 + 1 / 3) * 255),
      g: Math.round(f(h / 360) * 255),
      b: Math.round(f(h / 360 - 1 / 3) * 255)
    };
  }

  function parseColor(str) {
    if (!str) return null;
    var m;
    str = String(str).trim();
    if ((m = str.match(/^#([0-9a-f]{3})$/i))) {
      return {
        r: parseInt(m[1][0] + m[1][0], 16),
        g: parseInt(m[1][1] + m[1][1], 16),
        b: parseInt(m[1][2] + m[1][2], 16)
      };
    }
    if ((m = str.match(/^#([0-9a-f]{6})$/i))) {
      return {
        r: parseInt(m[1].slice(0, 2), 16),
        g: parseInt(m[1].slice(2, 4), 16),
        b: parseInt(m[1].slice(4, 6), 16)
      };
    }
    if ((m = str.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i))) {
      return { r: +m[1], g: +m[2], b: +m[3] };
    }
    if ((m = str.match(/^hsla?\(\s*([\d.]+)[\s,]+([\d.]+)%[\s,]+([\d.]+)%/i))) {
      return hslToRgb(+m[1], +m[2], +m[3]);
    }
    if ((m = str.match(/^([\d.]+)\s+([\d.]+)%\s+([\d.]+)%$/))) {
      return hslToRgb(+m[1], +m[2], +m[3]);
    }
    return null;
  }

  function detectPrimary() {
    if (opts.primary) {
      var c0 = parseColor(opts.primary);
      if (c0) return c0;
    }
    var vars = [
      '--primary-color',
      '--color-primary',
      '--primary',
      '--brand-color',
      '--theme-color',
      '--main-color',
      '--el-color-primary',
      '--ant-primary-color'
    ];
    var cs = getComputedStyle(document.documentElement);
    for (var i = 0; i < vars.length; i++) {
      var c = parseColor(cs.getPropertyValue(vars[i]));
      if (c) return c;
    }
    var metas = document.querySelectorAll('meta[name="theme-color"]');
    for (var j = 0; j < metas.length; j++) {
      var c2 = parseColor(metas[j].getAttribute('content'));
      if (c2) return c2;
    }
    return parseColor('#004baa');
  }

  function contrastColor(color) {
    function f(v) {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    }
    var lum = 0.2126 * f(color.r) + 0.7152 * f(color.g) + 0.0722 * f(color.b);
    return lum > 0.45 ? '#111827' : '#ffffff';
  }

  function setBubble(x, y) {
    if (!bubble) return;
    var r = bubble.getBoundingClientRect();
    var left = Math.max(8, Math.min(x - r.width / 2, window.innerWidth - r.width - 8));
    var top = y - r.height - 12;
    if (top < 8) top = y + 20;
    bubble.style.left = left + 'px';
    bubble.style.top = top + 'px';
  }

  function showBubbleAtButton() {
    if (!btn || !bubble) return;
    var r = btn.getBoundingClientRect();
    setBubble(r.left + r.width / 2, r.top);
  }

  function copyCode() {
    if (!btn) return;
    var full = getHref();
    function done() {
      if (!btn) return;
      var old = btn.textContent;
      btn.textContent = '已复制，建书签时粘贴到网址栏';
      setTimeout(function () {
        if (btn && btn.textContent === '已复制，建书签时粘贴到网址栏') {
          btn.textContent = old;
        }
      }, 1800);
    }
    function legacy() {
      var ta = document.createElement('textarea');
      ta.value = full;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
      } catch (e) {
        /* ignore */
      }
      ta.remove();
      done();
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(full).then(done, legacy);
    } else {
      legacy();
    }
  }

  function render() {
    if (btn) {
      btn.remove();
      btn = null;
    }
    if (bubble) {
      bubble.remove();
      bubble = null;
    }
    if (hidden) return;
    var href = getHref();
    if (!href) return;

    var color = detectPrimary();
    var pos = opts.position || 'top-right';
    var appName = detectAppName();

    btn = document.createElement('a');
    btn.id = 'bookmarklet-install-btn';
    btn.href = href;
    btn.textContent = opts.label;
    btn.title = opts.label;

    var s = btn.style;
    s.position = 'fixed';
    s.zIndex = '9999';
    s.top = (opts.top == null ? 16 : opts.top) + 'px';
    if (pos === 'top-center') {
      s.left = '50%';
      s.transform = 'translateX(-50%)';
    } else if (pos === 'top-left') {
      s.left = (opts.left == null ? 16 : opts.left) + 'px';
    } else {
      s.right = (opts.right == null ? 16 : opts.right) + 'px';
    }
    s.display = 'inline-flex';
    s.alignItems = 'center';
    s.gap = '6px';
    s.padding = '8px 14px';
    s.borderRadius = '9999px';
    s.background = 'rgb(' + color.r + ',' + color.g + ',' + color.b + ')';
    s.color = contrastColor(color);
    s.fontSize = '13px';
    s.fontWeight = '600';
    s.fontFamily = 'system-ui,-apple-system,"Segoe UI",sans-serif';
    s.textDecoration = 'none';
    s.whiteSpace = 'nowrap';
    s.boxShadow = '0 4px 14px rgba(0,0,0,.18)';
    s.cursor = 'grab';
    s.userSelect = 'none';
    s.webkitUserSelect = 'none';
    s.touchAction = 'manipulation';

    p0 = null;
    p1 = null;

    btn.addEventListener('mousedown', function (e) {
      p0 = { x: e.clientX, y: e.clientY };
      p1 = null;
      btn.textContent = appName;
      btn.title = appName;
    });

    btn.addEventListener('dragstart', function () {
      btn.textContent = appName;
      btn.title = appName;
      if (!bubble) {
        bubble = document.createElement('div');
        bubble.id = 'bookmarklet-install-bubble';
        bubble.textContent = opts.hint;
        var bs = bubble.style;
        bs.position = 'fixed';
        bs.zIndex = '10000';
        bs.background = '#111827';
        bs.color = '#fff';
        bs.fontSize = '12px';
        bs.padding = '6px 10px';
        bs.borderRadius = '8px';
        bs.pointerEvents = 'none';
        bs.whiteSpace = 'nowrap';
        bs.boxShadow = '0 4px 10px rgba(0,0,0,.25)';
        (document.body || document.documentElement).appendChild(bubble);
      }
      showBubbleAtButton();
    });

    btn.addEventListener('drag', function (e) {
      p1 = { x: e.clientX, y: e.clientY };
      setBubble(e.clientX, e.clientY);
    });

    btn.addEventListener('dragend', function () {
      if (bubble) {
        bubble.remove();
        bubble = null;
      }
      btn.textContent = opts.label;
      btn.title = opts.label;
      var moved =
        p0 && p1 && Math.abs(p1.x - p0.x) + Math.abs(p1.y - p0.y) > 10;
      if (moved) {
        hidden = true;
        btn.style.display = 'none';
      }
    });

    btn.addEventListener('click', function (e) {
      e.preventDefault();
      btn.textContent = opts.label;
      btn.title = opts.label;
      copyCode();
    });

    (document.body || document.documentElement).appendChild(btn);
  }

  function mount(o) {
    if (o) merge(o);
    render();
    return window.BookmarkletInstaller;
  }

  function reset() {
    hidden = false;
    render();
  }

  function boot() {
    merge(DEFAULTS);
    merge(window.BM_INSTALLER_OPTS || {});
    render();
  }

  window.BookmarkletInstaller = { mount: mount, reset: reset, __ready: true };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
