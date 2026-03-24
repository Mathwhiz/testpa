/* ═══════════════════════════════════════════════════════
   ui-utils.js  v2 —  Modales · Pickers · Logo · Loading
   Congregación Sur · Territory App
   ═══════════════════════════════════════════════════════ */

/* ─────────────────────────────────────────
   CSS GLOBAL
───────────────────────────────────────── */
(function injectCSS() {
  const style = document.createElement('style');
  style.textContent = `
/* ── Modal base ── */
.ui-overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.72);
  display: flex; align-items: center; justify-content: center;
  z-index: 9000; padding: 1rem;
  animation: uiFadeIn 0.15s ease;
}
@keyframes uiFadeIn { from { opacity:0 } to { opacity:1 } }

.ui-modal {
  background: #252525;
  border: 1px solid #3a3a3a;
  border-radius: 20px;
  padding: 1.75rem 1.5rem 1.5rem;
  width: 100%; max-width: 340px;
  box-shadow: 0 24px 64px rgba(0,0,0,0.6);
  animation: uiSlideUp 0.18s ease;
}
@keyframes uiSlideUp { from { transform:translateY(12px); opacity:0 } to { transform:translateY(0); opacity:1 } }

.ui-modal-icon {
  width: 48px; height: 48px; border-radius: 14px;
  display: flex; align-items: center; justify-content: center;
  margin: 0 auto 14px; font-size: 22px;
}
.ui-modal-icon.warn   { background: rgba(239,159,39,0.15); }
.ui-modal-icon.danger { background: rgba(240,149,149,0.15); }
.ui-modal-icon.info   { background: rgba(29,158,117,0.15); }
.ui-modal-icon.purple { background: rgba(127,119,221,0.15); }

.ui-modal-title {
  font-size: 17px; font-weight: 600; color: #eee;
  text-align: center; margin-bottom: 8px;
}
.ui-modal-msg {
  font-size: 14px; color: #aaa; text-align: center;
  line-height: 1.5; margin-bottom: 20px;
}
.ui-modal-btns { display: flex; gap: 8px; }
.ui-modal-btns button {
  flex: 1; padding: 11px;
  font-size: 14px; font-weight: 500;
  border-radius: 12px; border: none; cursor: pointer;
  transition: filter 0.1s, transform 0.1s;
}
.ui-modal-btns button:active { transform: scale(0.97); }
.ui-btn-cancel  { background: #333; color: #aaa; border: 0.5px solid #444 !important; }
.ui-btn-cancel:hover { filter: brightness(1.15); }
.ui-btn-confirm-warn   { background: #EF9F27; color: #fff; }
.ui-btn-confirm-danger { background: #A32D2D; color: #F09595; }
.ui-btn-confirm-info   { background: #1D9E75; color: #fff; }
.ui-btn-confirm-purple { background: #7F77DD; color: #fff; }
.ui-btn-confirm-warn:hover,
.ui-btn-confirm-danger:hover,
.ui-btn-confirm-info:hover,
.ui-btn-confirm-purple:hover { filter: brightness(1.1); }
.ui-btn-ok { background: #333; color: #eee; border: 0.5px solid #555 !important; }
.ui-btn-ok:hover { filter: brightness(1.15); }

/* ═══════════════════════════════════════════
   BOTTOM SHEET base (date, time, conductor, territorio)
═══════════════════════════════════════════ */
.bs-overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.72);
  display: flex; align-items: flex-end; justify-content: center;
  z-index: 9100;
  animation: uiFadeIn 0.15s ease;
}
@media (min-height: 600px) {
  .bs-overlay { align-items: center; padding: 1rem; }
}
.bs-card {
  background: #252525;
  border: 1px solid #3a3a3a;
  border-radius: 24px 24px 0 0;
  width: 100%; max-width: 380px;
  box-shadow: 0 -16px 48px rgba(0,0,0,0.5);
  animation: bsSlideUp 0.22s cubic-bezier(.22,.68,0,1.2);
  user-select: none; overflow: hidden;
}
@media (min-height: 600px) {
  .bs-card { border-radius: 24px; box-shadow: 0 24px 64px rgba(0,0,0,0.6); }
}
@keyframes bsSlideUp { from { transform:translateY(40px); opacity:0 } to { transform:translateY(0); opacity:1 } }

.bs-handle {
  width: 36px; height: 4px; border-radius: 2px;
  background: #444; margin: 12px auto 0;
}
.bs-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 16px 10px;
}
.bs-title { font-size: 15px; font-weight: 600; color: #eee; }
.bs-close-btn {
  width: 30px; height: 30px; border-radius: 8px;
  border: 0.5px solid #444; background: #1e1e1e; color: #888;
  cursor: pointer; display: flex; align-items: center; justify-content: center;
  font-size: 16px; transition: background 0.1s;
}
.bs-close-btn:hover { background: #2e2e2e; color: #eee; }

.bs-footer {
  display: flex; gap: 8px; padding: 12px 16px 16px;
}
.bs-footer button {
  flex: 1; padding: 11px; font-size: 14px; font-weight: 500;
  border-radius: 12px; border: none; cursor: pointer; transition: filter 0.1s;
}
.bs-btn-cancel { background: #333; color: #aaa; border: 0.5px solid #444 !important; }
.bs-btn-cancel:hover { filter: brightness(1.15); }
.bs-btn-ok { background: #185FA5; color: #fff; }
.bs-btn-ok:hover { filter: brightness(1.1); }

/* ═══════════════════════════════════════════
   DATE PICKER
═══════════════════════════════════════════ */
.dp-nav-btn {
  width: 34px; height: 34px; border-radius: 10px;
  border: 0.5px solid #444; background: #1e1e1e; color: #aaa;
  cursor: pointer; display: flex; align-items: center; justify-content: center;
  font-size: 16px; transition: background 0.1s, color 0.1s;
}
.dp-nav-btn:hover { background: #2e2e2e; color: #eee; }
.dp-month-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 16px 10px;
}
.dp-month-title { font-size: 14px; font-weight: 600; color: #eee; }
.dp-weekdays {
  display: grid; grid-template-columns: repeat(7,1fr);
  text-align: center; padding: 0 10px; margin-bottom: 4px;
}
.dp-wd { font-size: 11px; font-weight: 600; color: #555; padding: 4px 0; }
.dp-days {
  display: grid; grid-template-columns: repeat(7,1fr);
  gap: 2px; padding: 0 10px;
}
.dp-day {
  aspect-ratio: 1; display: flex; align-items: center; justify-content: center;
  font-size: 13px; font-weight: 500; color: #ccc;
  border-radius: 10px; cursor: pointer;
  transition: background 0.1s; border: none; background: transparent;
}
.dp-day:hover:not(.dp-day-other):not(.dp-day-disabled) { background: #333; color: #eee; }
.dp-day-other    { color: #3a3a3a; cursor: default; }
.dp-day-disabled { color: #333; cursor: not-allowed; }
.dp-day-today    { color: #97C459; font-weight: 700; }
.dp-day-selected { background: #185FA5 !important; color: #fff !important; font-weight: 700; }

/* ═══════════════════════════════════════════
   TIME PICKER
═══════════════════════════════════════════ */
.tp-display {
  display: flex; align-items: center; justify-content: center;
  gap: 4px; padding: 4px 16px 16px;
}
.tp-display-num {
  font-size: 52px; font-weight: 300; color: #eee;
  min-width: 80px; text-align: center; line-height: 1;
  background: #1e1e1e; border-radius: 14px; padding: 8px 12px;
  cursor: pointer; transition: background 0.1s;
}
.tp-display-num.active { background: #185FA5; color: #fff; }
.tp-display-num:hover:not(.active) { background: #2a2a2a; }
.tp-display-sep { font-size: 44px; font-weight: 300; color: #555; line-height: 1; }
.tp-numpad {
  display: grid; grid-template-columns: repeat(3,1fr); gap: 8px;
  padding: 0 16px 4px;
}
.tp-num-btn {
  padding: 14px; font-size: 20px; font-weight: 400; color: #eee;
  background: #1e1e1e; border: none; border-radius: 12px; cursor: pointer;
  transition: background 0.1s, transform 0.08s;
}
.tp-num-btn:hover { background: #2e2e2e; }
.tp-num-btn:active { transform: scale(0.93); background: #333; }
.tp-num-btn.tp-del { color: #F09595; background: #2e1a1a; }
.tp-num-btn.tp-del:hover { background: #3a2020; }
.tp-num-btn.tp-empty { background: transparent; cursor: default; }

/* ═══════════════════════════════════════════
   CONDUCTOR PICKER
═══════════════════════════════════════════ */
.cp-search-wrap {
  padding: 0 14px 8px;
  position: relative;
}
.cp-search-input {
  width: 100%; padding: 9px 12px 9px 36px;
  background: #1e1e1e; border: 0.5px solid #444; border-radius: 10px;
  color: #eee; font-size: 14px; outline: none;
  transition: border-color 0.15s;
  box-sizing: border-box;
}
.cp-search-input:focus { border-color: #666; }
.cp-search-icon {
  position: absolute; left: 26px; top: 50%; transform: translateY(-50%);
  color: #555; pointer-events: none;
  display: flex; align-items: center; justify-content: center;
  width: 16px; height: 16px;
}
.cp-list {
  max-height: 280px; overflow-y: auto;
  padding: 0 6px 10px;
}
.cp-list::-webkit-scrollbar { width: 3px; }
.cp-list::-webkit-scrollbar-track { background: transparent; }
.cp-list::-webkit-scrollbar-thumb { background: #3a3a3a; border-radius: 2px; }
.cp-item {
  display: flex; align-items: center; gap: 10px;
  padding: 9px 10px; border-radius: 10px; cursor: pointer;
  transition: background 0.1s; border: none; background: transparent;
  width: 100%; text-align: left;
}
.cp-item:hover { background: #2a2a2a; }
.cp-item.selected { background: rgba(24,95,165,0.18); }
.cp-item-avatar {
  width: 32px; height: 32px; border-radius: 50%; flex-shrink: 0;
  background: #2e2e2e; border: 1px solid #3a3a3a;
  display: flex; align-items: center; justify-content: center;
  font-size: 12px; font-weight: 700; color: #888;
  text-transform: uppercase;
}
.cp-item.selected .cp-item-avatar {
  background: rgba(24,95,165,0.25); border-color: #185FA5; color: #85B7EB;
}
.cp-item-name { font-size: 14px; font-weight: 500; color: #ddd; flex: 1; }
.cp-item.selected .cp-item-name { color: #eee; }
.cp-item-check {
  color: #185FA5; flex-shrink: 0;
  opacity: 0; transition: opacity 0.1s;
  display: flex; align-items: center;
}
.cp-item.selected .cp-item-check { opacity: 1; }
.cp-empty { text-align: center; padding: 28px 16px; color: #555; font-size: 13px; }
.cp-divider {
  height: 0.5px; background: #2e2e2e;
  margin: 2px 10px 6px;
}
.cp-sin-asignar {
  display: flex; align-items: center; gap: 10px;
  padding: 9px 10px; border-radius: 10px; cursor: pointer;
  border: none; background: transparent; width: 100%; text-align: left;
  transition: background 0.1s;
}
.cp-sin-asignar:hover { background: #2a2a2a; }
.cp-sin-asignar-icon {
  width: 32px; height: 32px; border-radius: 50%; flex-shrink: 0;
  background: #252525; border: 1px solid #333;
  display: flex; align-items: center; justify-content: center;
}
.cp-sin-asignar-txt { font-size: 13px; color: #666; }

/* ═══════════════════════════════════════════
   TERRITORIO PICKER
═══════════════════════════════════════════ */
.tp-search-wrap {
  padding: 0 14px 8px;
  position: relative;
}
.tp-search-input {
  width: 100%; padding: 9px 12px 9px 36px;
  background: #1e1e1e; border: 0.5px solid #444; border-radius: 10px;
  color: #eee; font-size: 14px; outline: none;
  transition: border-color 0.15s;
  box-sizing: border-box;
}
.tp-search-input:focus { border-color: #666; }
.tp-search-icon {
  position: absolute; left: 28px; top: 50%; transform: translateY(-50%);
  color: #555; pointer-events: none;
  display: flex; align-items: center; justify-content: center;
  width: 16px; height: 16px;
}
.tp-list {
  max-height: 320px; overflow-y: auto;
  padding: 0 6px 10px;
}
.tp-list::-webkit-scrollbar { width: 3px; }
.tp-list::-webkit-scrollbar-track { background: transparent; }
.tp-list::-webkit-scrollbar-thumb { background: #3a3a3a; border-radius: 2px; }
.tp-section-title {
  font-size: 11px; font-weight: 700; color: #555;
  text-transform: uppercase; letter-spacing: 0.05em;
  padding: 10px 10px 6px; margin-top: 4px;
}
.tp-item {
  display: flex; align-items: center; gap: 10px;
  padding: 9px 10px; border-radius: 10px; cursor: pointer;
  transition: background 0.1s; border: none; background: transparent;
  width: 100%; text-align: left;
}
.tp-item:hover { background: #2a2a2a; }
.tp-item-num {
  width: 36px; height: 36px; border-radius: 8px; flex-shrink: 0;
  background: #2e2e2e; border: 1px solid #3a3a3a;
  display: flex; align-items: center; justify-content: center;
  font-size: 13px; font-weight: 700; color: #aaa;
}
.tp-item-info { flex: 1; }
.tp-item-label { font-size: 13px; font-weight: 500; color: #ddd; }
.tp-item-days { font-size: 11px; color: #666; }
.tp-empty { text-align: center; padding: 28px 16px; color: #555; font-size: 13px; }
.tp-divider {
  height: 0.5px; background: #2e2e2e;
  margin: 2px 10px 6px;
}
.tp-expand-btn {
  display: flex; align-items: center; justify-content: space-between;
  width: 100%; padding: 10px 10px; margin: 4px 0;
  background: transparent; border: 0.5px solid #333; border-radius: 10px;
  color: #666; font-size: 13px; cursor: pointer;
  transition: background 0.1s, color 0.1s;
}
.tp-expand-btn:hover { background: #2a2a2a; color: #aaa; }
.tp-expand-btn.expanded { color: #aaa; border-color: #444; }

/* ── Fake input (reemplaza select/date/time nativos) ── */
.ui-fake-input {
  width: 100%; font-size: 13px; padding: 6px 8px;
  border: 0.5px solid #555; border-radius: 8px;
  background: #1e1e1e; color: #eee;
  cursor: pointer; text-align: left;
  display: flex; align-items: center; gap: 6px;
  transition: border-color 0.15s;
  box-sizing: border-box;
}
.ui-fake-input:hover { border-color: #777; }
.ui-fake-input.empty { color: #555; }
.ui-fake-input-icon { font-size: 14px; flex-shrink: 0; opacity: 0.6; }

/* ═══════════════════════════════════════════
   LOADING OVERLAY
═══════════════════════════════════════════ */
.ui-loading-overlay {
  position: fixed; inset: 0;
  background: rgba(10,10,10,0.82);
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  z-index: 9500;
  backdrop-filter: blur(4px);
  animation: uiFadeIn 0.2s ease;
  gap: 18px;
}
.ui-loading-overlay.hiding {
  animation: uiFadeOut 0.25s ease forwards;
}
@keyframes uiFadeOut { from { opacity:1 } to { opacity:0 } }

.ui-loading-spinner {
  width: 52px; height: 52px;
  position: relative;
}
.ui-loading-spinner::before,
.ui-loading-spinner::after {
  content: ''; position: absolute; border-radius: 50%;
}
.ui-loading-spinner::before {
  inset: 0;
  border: 3px solid #2a2a2a;
}
.ui-loading-spinner::after {
  inset: 0;
  border: 3px solid transparent;
  border-top-color: #7F77DD;
  border-right-color: #5B8DDE;
  animation: uiSpin 0.7s linear infinite;
}
@keyframes uiSpin { to { transform: rotate(360deg); } }

.ui-loading-text {
  font-size: 14px; color: #888;
  font-family: system-ui, sans-serif;
  letter-spacing: 0.02em;
}

/* ═══════════════════════════════════════════
   LOGO SVG (hexágono violeta estilo jw.org)
═══════════════════════════════════════════ */
.cs-logo-svg {
  display: block;
}

/* ═══════════════════════════════════════════
   PANTALLA INICIAL (index.html)
═══════════════════════════════════════════ */
.cs-home-body {
  background: #1a1c1f;
  background-image:
    radial-gradient(ellipse at 60% 20%, rgba(46,134,193,0.06) 0%, transparent 60%),
    radial-gradient(ellipse at 20% 80%, rgba(79,195,195,0.04) 0%, transparent 50%),
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)' opacity='0.035'/%3E%3C/svg%3E");
}

.cs-nav-card {
  width: 100%;
  background: #232628;
  border: 1px solid #2e3033;
  border-radius: 18px;
  padding: 1.1rem 1.25rem;
  cursor: pointer;
  text-align: left;
  display: flex;
  align-items: center;
  gap: 14px;
  transition: border-color 0.18s, background 0.18s, transform 0.1s, box-shadow 0.18s;
  text-decoration: none;
  color: inherit;
  box-shadow: 0 2px 12px rgba(0,0,0,0.25);
}
.cs-nav-card:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 24px rgba(0,0,0,0.35);
}
.cs-nav-card:active { transform: scale(0.98); box-shadow: none; }

.cs-nav-icon {
  width: 46px; height: 46px; border-radius: 13px;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.cs-nav-icon-terr  { background: #1a3a1a; }
.cs-nav-icon-asign { background: #1a2340; }

.cs-nav-card-terr:hover  { border-color: #3a6b3a; background: #242826; }
.cs-nav-card-asign:hover { border-color: #2e4070; background: #23252e; }

.cs-nav-title { font-size: 17px; font-weight: 600; color: #e8e8e8; margin-bottom: 2px; }
.cs-nav-sub   { font-size: 13px; color: #666; }

.cs-logo-title {
  font-size: 34px; font-weight: 700;
  color: #f0f0f0; letter-spacing: -0.5px;
}
.cs-logo-sub { font-size: 14px; color: #555; }
.cs-footer   { font-size: 12px; color: #3a3a3a; margin-top: 4px; }
.cs-back-btn { display:block; width:100%; max-width:320px; padding:11px; text-align:center; font-size:13px; color:#666; text-decoration:none; border:1px solid #333; border-radius:14px; transition:color 0.15s, border-color 0.15s, background 0.15s; margin-top:4px; }
.cs-back-btn:hover { color:#eee; border-color:#666; background:#252525; }

/* ═══════════════════════════════════════════
   TOAST
═══════════════════════════════════════════ */
.ui-toast-container {
  position: fixed; bottom: 24px; left: 50%;
  transform: translateX(-50%);
  z-index: 9800; display: flex; flex-direction: column;
  align-items: center; gap: 8px; pointer-events: none;
}
.ui-toast {
  background: #2a2a2a; border: 1px solid #3a3a3a;
  border-radius: 30px; padding: 10px 20px;
  font-size: 13px; font-weight: 500; color: #eee;
  box-shadow: 0 8px 32px rgba(0,0,0,0.5);
  animation: toastIn 0.2s cubic-bezier(.22,.68,0,1.2);
  white-space: nowrap;
}
.ui-toast.success { border-color: #1D9E75; color: #5DCAA5; }
.ui-toast.error   { border-color: #A32D2D; color: #F09595; }
.ui-toast.hiding  { animation: toastOut 0.2s ease forwards; }
@keyframes toastIn  { from { transform:translateY(16px); opacity:0 } to { transform:translateY(0); opacity:1 } }
@keyframes toastOut { from { opacity:1 } to { opacity:0; transform:translateY(8px) } }
`;
  document.head.appendChild(style);
})();

/* ─────────────────────────────────────────
   LOGO SVG — Hexágono azul-teal
───────────────────────────────────────── */
window.CS_LOGO_SVG = `<svg class="cs-logo-svg" width="80" height="80" viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="csLogoGrad" x1="8" y1="4" x2="64" y2="68" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#9B8FFF"/>
      <stop offset="50%" stop-color="#7061E0"/>
      <stop offset="100%" stop-color="#4A3FB5"/>
    </linearGradient>
    <linearGradient id="csIconGrad" x1="18" y1="18" x2="54" y2="54" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#C4BEFF"/>
      <stop offset="100%" stop-color="#9B8FFF"/>
    </linearGradient>
    <filter id="csShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="4" stdDeviation="7" flood-color="#4A3FB5" flood-opacity="0.5"/>
    </filter>
  </defs>
  <path d="M36 4 L64 20 L64 52 L36 68 L8 52 L8 20 Z"
    fill="url(#csLogoGrad)" filter="url(#csShadow)"/>
  <path d="M36 9 L60 23 L60 49 L36 63 L12 49 L12 23 Z"
    fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="1"/>
  <circle cx="28" cy="27" r="6" fill="url(#csIconGrad)"/>
  <path d="M16 48 C16 40 22 36 28 36 C31 36 33.5 37.2 35.5 39" stroke="url(#csIconGrad)" stroke-width="2.8" stroke-linecap="round" fill="none"/>
  <circle cx="40" cy="25" r="7" fill="url(#csIconGrad)"/>
  <path d="M26 50 C27 41.5 33 37 40 37 C47 37 53 41.5 54 50" stroke="url(#csIconGrad)" stroke-width="3.2" stroke-linecap="round" fill="none"/>
</svg>`;

/* Helper para insertar el logo donde haya .cs-logo-placeholder */
window.insertLogos = function() {
  document.querySelectorAll('.cs-logo-placeholder').forEach(el => {
    el.innerHTML = CS_LOGO_SVG;
  });
};
document.addEventListener('DOMContentLoaded', insertLogos);

/* ─────────────────────────────────────────
   LOADING OVERLAY
───────────────────────────────────────── */
let _loadingEl = null;

window.uiLoading = {
  show(text = 'Cargando...') {
    if (_loadingEl) return;
    _loadingEl = document.createElement('div');
    _loadingEl.className = 'ui-loading-overlay';
    _loadingEl.innerHTML = `
      <div class="ui-loading-spinner"></div>
      <div class="ui-loading-text" id="ui-loading-text">${text}</div>`;
    document.body.appendChild(_loadingEl);
  },
  setText(text) {
    const el = document.getElementById('ui-loading-text');
    if (el) el.textContent = text;
  },
  hide() {
    if (!_loadingEl) return;
    _loadingEl.classList.add('hiding');
    setTimeout(() => {
      if (_loadingEl) { _loadingEl.remove(); _loadingEl = null; }
    }, 260);
  }
};

/* ─────────────────────────────────────────
   TOAST
───────────────────────────────────────── */
(function() {
  let container;
  function getContainer() {
    if (!container) {
      container = document.createElement('div');
      container.className = 'ui-toast-container';
      document.body.appendChild(container);
    }
    return container;
  }
  window.uiToast = function(msg, type = '', duration = 2500) {
    const c = getContainer();
    const t = document.createElement('div');
    t.className = 'ui-toast' + (type ? ' ' + type : '');
    t.textContent = msg;
    c.appendChild(t);
    setTimeout(() => {
      t.classList.add('hiding');
      setTimeout(() => t.remove(), 220);
    }, duration);
  };
})();

/* ─────────────────────────────────────────
   MODAL CONFIRM
───────────────────────────────────────── */
window.uiConfirm = function({ title = '¿Estás seguro?', msg = '', confirmText = 'Confirmar', cancelText = 'Cancelar', type = 'warn' } = {}) {
  return new Promise(resolve => {
    const icons = { warn: '⚠️', danger: '🗑️', info: 'ℹ️' };
    const overlay = document.createElement('div');
    overlay.className = 'ui-overlay';
    overlay.innerHTML = `
      <div class="ui-modal">
        <div class="ui-modal-icon ${type}"><span>${icons[type] || '⚠️'}</span></div>
        <div class="ui-modal-title">${title}</div>
        ${msg ? `<div class="ui-modal-msg">${msg}</div>` : ''}
        <div class="ui-modal-btns">
          <button class="ui-btn-cancel">${cancelText}</button>
          <button class="ui-btn-confirm-${type}">${confirmText}</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    const [btnCancel, btnConfirm] = overlay.querySelectorAll('button');
    const close = val => { overlay.remove(); resolve(val); };
    btnCancel.onclick  = () => close(false);
    btnConfirm.onclick = () => close(true);
    overlay.addEventListener('click', e => { if (e.target === overlay) close(false); });
  });
};

/* ─────────────────────────────────────────
   MODAL ALERT
───────────────────────────────────────── */
window.uiAlert = function(msg, title = 'Atención') {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.className = 'ui-overlay';
    overlay.innerHTML = `
      <div class="ui-modal">
        <div class="ui-modal-icon info"><span>ℹ️</span></div>
        <div class="ui-modal-title">${title}</div>
        <div class="ui-modal-msg">${msg}</div>
        <div class="ui-modal-btns">
          <button class="ui-btn-ok" style="flex:1;">Entendido</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    const btn = overlay.querySelector('button');
    const close = () => { overlay.remove(); resolve(); };
    btn.onclick = close;
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  });
};

/* ─────────────────────────────────────────
   DATE PICKER
───────────────────────────────────────── */
window.uiDatePicker = function({ value = '', min = null, label = 'Elegir fecha' } = {}) {
  return new Promise(resolve => {
    const today = new Date(); today.setHours(0,0,0,0);
    let viewYear, viewMonth, selDate;
    if (value) {
      const d = new Date(value + 'T00:00:00');
      viewYear = d.getFullYear(); viewMonth = d.getMonth(); selDate = new Date(d);
    } else {
      viewYear = today.getFullYear(); viewMonth = today.getMonth(); selDate = null;
    }
    const overlay = document.createElement('div');
    overlay.className = 'bs-overlay';
    document.body.appendChild(overlay);
    const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    const DS = ['Lu','Ma','Mi','Ju','Vi','Sá','Do'];
    function pad(n) { return String(n).padStart(2,'0'); }
    function toISO(d) { return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }
    function minDate() { return min ? new Date(min + 'T00:00:00') : null; }
    function render() {
      const firstDay = new Date(viewYear, viewMonth, 1);
      const lastDay  = new Date(viewYear, viewMonth + 1, 0);
      let startDow = firstDay.getDay() - 1; if (startDow < 0) startDow = 6;
      const cells = [];
      for (let i = startDow - 1; i >= 0; i--) cells.push({ d: new Date(viewYear, viewMonth, -i), other: true });
      for (let i = 1; i <= lastDay.getDate(); i++) cells.push({ d: new Date(viewYear, viewMonth, i), other: false });
      while (cells.length % 7 !== 0) cells.push({ d: new Date(viewYear, viewMonth + 1, cells.length - lastDay.getDate() - startDow + 1), other: true });
      const mn = minDate();
      const daysHTML = cells.map(({ d, other }) => {
        const isToday   = !other && d.toDateString() === today.toDateString();
        const isSel     = selDate && !other && d.toDateString() === selDate.toDateString();
        const isDisabled = mn && d < mn;
        let cls = 'dp-day';
        if (other) cls += ' dp-day-other';
        else if (isDisabled) cls += ' dp-day-disabled';
        else if (isToday) cls += ' dp-day-today';
        if (isSel) cls += ' dp-day-selected';
        return `<button class="${cls}" data-date="${toISO(d)}" ${isDisabled||other?'disabled':''}>${d.getDate()}</button>`;
      }).join('');
      overlay.innerHTML = `
        <div class="bs-card">
          <div class="bs-handle"></div>
          <div class="bs-header">
            <div class="bs-title">${label}</div>
            <button class="bs-close-btn">✕</button>
          </div>
          <div class="dp-month-header">
            <button class="dp-nav-btn" id="dp-prev">‹</button>
            <div class="dp-month-title">${MESES[viewMonth]} ${viewYear}</div>
            <button class="dp-nav-btn" id="dp-next">›</button>
          </div>
          <div class="dp-weekdays">${DS.map(d=>`<div class="dp-wd">${d}</div>`).join('')}</div>
          <div class="dp-days">${daysHTML}</div>
          <div class="bs-footer">
            <button class="bs-btn-cancel">Cancelar</button>
            <button class="bs-btn-ok" ${!selDate?'disabled style="opacity:.4;cursor:not-allowed"':''}>Listo</button>
          </div>
        </div>`;
      overlay.querySelector('#dp-prev').onclick = () => { viewMonth--; if (viewMonth<0){viewMonth=11;viewYear--;} render(); };
      overlay.querySelector('#dp-next').onclick = () => { viewMonth++; if (viewMonth>11){viewMonth=0;viewYear++;} render(); };
      overlay.querySelectorAll('.dp-day:not([disabled])').forEach(btn => {
        btn.onclick = () => { selDate = new Date(btn.dataset.date + 'T00:00:00'); render(); };
      });
      overlay.querySelector('.bs-close-btn').onclick = () => { overlay.remove(); resolve(null); };
      overlay.querySelector('.bs-btn-cancel').onclick = () => { overlay.remove(); resolve(null); };
      overlay.querySelector('.bs-btn-ok').onclick = () => {
        if (!selDate) return;
        overlay.remove(); resolve(toISO(selDate));
      };
      overlay.addEventListener('click', e => { if (e.target === overlay) { overlay.remove(); resolve(null); } });
    }
    render();
  });
};

/* ─────────────────────────────────────────
   TIME PICKER
───────────────────────────────────────── */
window.uiTimePicker = function({ value = '', label = 'Elegir hora' } = {}) {
  return new Promise(resolve => {
    let hh = '', mm = '', editing = 'h', buffer = '';
    if (value && value.includes(':')) [hh, mm] = value.split(':');
    const overlay = document.createElement('div');
    overlay.className = 'bs-overlay';
    document.body.appendChild(overlay);
    function dispH() { return hh !== '' ? String(hh).padStart(2,'0') : '--'; }
    function dispM() { return mm !== '' ? String(mm).padStart(2,'0') : '--'; }
    function validate() {
      let h = parseInt(hh), m = parseInt(mm);
      if (isNaN(h)||h<0||h>23) hh='';
      if (isNaN(m)||m<0||m>59) mm='';
    }
    function render() {
      const ok = hh !== '' && mm !== '';
      overlay.innerHTML = `
        <div class="bs-card">
          <div class="bs-handle"></div>
          <div class="bs-header">
            <div class="bs-title">${label}</div>
            <button class="bs-close-btn">✕</button>
          </div>
          <div class="tp-display">
            <div class="tp-display-num ${editing==='h'?'active':''}" id="tp-h">${dispH()}</div>
            <div class="tp-display-sep">:</div>
            <div class="tp-display-num ${editing==='m'?'active':''}" id="tp-m">${dispM()}</div>
          </div>
          <div class="tp-numpad">
            ${[1,2,3,4,5,6,7,8,9,'',0,'del'].map(n => {
              if (n==='') return `<button class="tp-num-btn tp-empty"></button>`;
              if (n==='del') return `<button class="tp-num-btn tp-del" data-del>⌫</button>`;
              return `<button class="tp-num-btn" data-n="${n}">${n}</button>`;
            }).join('')}
          </div>
          <div class="bs-footer">
            <button class="bs-btn-cancel">Cancelar</button>
            <button class="bs-btn-ok" ${!ok?'disabled style="opacity:.4;cursor:not-allowed"':''}>Listo</button>
          </div>
        </div>`;
      overlay.querySelector('#tp-h').onclick = () => { editing='h'; buffer=''; render(); };
      overlay.querySelector('#tp-m').onclick = () => { editing='m'; buffer=''; render(); };
      overlay.querySelectorAll('[data-n]').forEach(btn => {
        btn.onclick = () => {
          const digit = btn.dataset.n;
          if (editing==='h') {
            if (buffer==='') { if(parseInt(digit)<=2){buffer=digit;hh=digit;}else{hh=digit;buffer='';editing='m';} }
            else { const c=buffer+digit; if(parseInt(c)<=23){hh=c;buffer='';editing='m';}else{hh=digit;buffer='';if(parseInt(digit)>2)editing='m';} }
          } else {
            if (buffer==='') { if(parseInt(digit)<=5){buffer=digit;mm=digit;}else{mm=digit;buffer='';} }
            else { const c=buffer+digit; if(parseInt(c)<=59){mm=c;buffer='';}else{mm=digit;buffer='';} }
          }
          render();
        };
      });
      overlay.querySelector('[data-del]').onclick = () => { buffer=''; if(editing==='h')hh='';else mm=''; render(); };
      overlay.querySelector('.bs-close-btn').onclick = () => { overlay.remove(); resolve(null); };
      overlay.querySelector('.bs-btn-cancel').onclick = () => { overlay.remove(); resolve(null); };
      overlay.querySelector('.bs-btn-ok').onclick = () => {
        if (!ok) return;
        validate();
        if (hh===''||mm==='') { render(); return; }
        overlay.remove();
        resolve(`${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}`);
      };
      overlay.addEventListener('click', e => { if (e.target===overlay){overlay.remove();resolve(null);} });
    }
    render();
  });
};

/* ─────────────────────────────────────────
   CONDUCTOR PICKER
   uiConductorPicker({ conductores, value, label })
   Returns Promise<string|null>
───────────────────────────────────────── */
window.uiConductorPicker = function({ conductores = [], value = '', label = 'Elegir conductor' } = {}) {
  return new Promise(resolve => {
    let sel = value;
    let query = '';
    const overlay = document.createElement('div');
    overlay.className = 'bs-overlay';
    document.body.appendChild(overlay);

    function filtered() {
      if (!query) return conductores;
      const q = query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
      return conductores.filter(c => c.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').includes(q));
    }

    function render() {
      const lista = filtered();
      overlay.innerHTML = `
        <div class="bs-card">
          <div class="bs-handle"></div>
          <div class="bs-header">
            <div class="bs-title">${label}</div>
            <button class="bs-close-btn">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
              </svg>
            </button>
          </div>
          <div class="cp-search-wrap">
            <span class="cp-search-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <circle cx="11" cy="11" r="8" stroke="currentColor" stroke-width="2"/>
                <path d="m21 21-4.35-4.35" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </span>
            <input class="cp-search-input" type="text" placeholder="Buscar..." value="${query}" autocomplete="off">
          </div>
          <div class="cp-list">
            <button class="cp-sin-asignar" data-clear>
              <span class="cp-sin-asignar-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="8" r="4" stroke="#555" stroke-width="1.8"/>
                  <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="#555" stroke-width="1.8" stroke-linecap="round"/>
                </svg>
              </span>
              <span class="cp-sin-asignar-txt">Sin asignar</span>
            </button>
            <div class="cp-divider"></div>
            ${lista.length === 0
              ? `<div class="cp-empty">Sin resultados</div>`
              : lista.map(c => {
                  const initials = c.split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase();
                  return `<button class="cp-item ${c===sel?'selected':''}" data-name="${c.replace(/"/g,'&quot;')}">
                    <span class="cp-item-avatar">${initials}</span>
                    <span class="cp-item-name">${c}</span>
                    <span class="cp-item-check">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                        <path d="M5 13l4 4L19 7" stroke="#185FA5" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                      </svg>
                    </span>
                  </button>`;
                }).join('')
            }
          </div>
        </div>`;

      // Búsqueda
      const searchInput = overlay.querySelector('.cp-search-input');
      searchInput.addEventListener('input', e => { query = e.target.value; render(); });
      // Foco automático (pequeño delay para que el DOM esté listo)
      setTimeout(() => searchInput.focus(), 80);

      // Sin asignar
      overlay.querySelector('[data-clear]').onclick = () => { overlay.remove(); resolve(''); };

      // Items
      overlay.querySelectorAll('.cp-item').forEach(btn => {
        btn.onclick = () => {
          sel = btn.dataset.name;
          overlay.remove();
          resolve(sel);
        };
      });

      overlay.querySelector('.bs-close-btn').onclick = () => { overlay.remove(); resolve(null); };
      overlay.addEventListener('click', e => { if (e.target===overlay){overlay.remove();resolve(null);} });
    }
    render();
  });
};

/* ─────────────────────────────────────────
   TERRITORIO PICKER
   uiTerritorioPicker({ territoriosData, allData, grupo, configData, label, color })
   Returns Promise<string|null>
───────────────────────────────────────── */
window.uiTerritorioPicker = function({
  territoriosData = {},
  allData = {},
  grupo = null,
  configData = {},
  label = 'Elegir territorio',
  color = '#97C459'
} = {}) {
  return new Promise(resolve => {
    let query = '';
    let gruposExpanded = false;
    const overlay = document.createElement('div');
    overlay.className = 'bs-overlay';
    document.body.appendChild(overlay);

    function daysSince(ds) {
      if (!ds) return 9999;
      return Math.floor((new Date() - new Date(ds + 'T00:00:00')) / 86400000);
    }

    function daysColor(dias) {
      if (!dias || dias >= 9999) return '#555';
      if (dias <= 30)  return '#4CAF50';
      if (dias <= 45)  return '#8BC34A';
      if (dias <= 60)  return '#FFC107';
      if (dias <= 90)  return '#FF9800';
      if (dias <= 120) return '#FF5722';
      return '#F44336';
    }

    function buildLista() {
      const enProgreso = [];
      const resto = [];

      Object.keys(territoriosData).forEach(n => {
        if ((configData[n] || 'normal') === 'no_predica') return;
        const t = territoriosData[n];
        const lastDate = t.lastFin || t.lastIni;
        const dias = daysSince(lastDate);
        if (t.enProgreso) {
          enProgreso.push({ n, dias, lastDate });
        } else {
          resto.push({ n, dias, lastDate });
        }
      });

      enProgreso.sort((a,b) => b.dias - a.dias);
      resto.sort((a,b) => b.dias - a.dias);

      const deGrupos = [];
      if (grupo === 'C' && allData) {
        [1,2,3,4].forEach(g => {
          const data = allData[g];
          if (!data) return;
          Object.keys(data).forEach(n => {
            const t = data[n];
            const lastDate = t.lastFin || t.lastIni;
            const dias = daysSince(lastDate);
            deGrupos.push({ n, dias, lastDate, grupo: g, enProgreso: t.enProgreso });
          });
        });
        deGrupos.sort((a,b) => b.dias - a.dias);
      }

      return { enProgreso, resto, deGrupos };
    }

    function filtered(lista) {
      if (!query) return lista;
      return lista.filter(t => t.n.toString().includes(query.trim()));
    }

    function itemHTML(t, subOverride) {
      const col = daysColor(t.dias);
      const diasLabel = t.dias >= 9999 ? 'sin registros' : `${t.dias}d · ${t.lastDate ? t.lastDate.split('-').slice(1).reverse().join('/') : '—'}`;
      const sub = subOverride !== undefined ? subOverride
        : (t.enProgreso ? '<span style="color:#5DCAA5;">⟳ En progreso</span>' : diasLabel);
      return `<button class="tp-item" data-terr="${t.n}">
        <span class="tp-item-num" style="color:${col};border-color:${col}33;">${t.n}</span>
        <span class="tp-item-info">
          <span class="tp-item-label">Territorio ${t.n}</span>
          <span class="tp-item-days">${sub}</span>
        </span>
      </button>`;
    }

    function render() {
      const { enProgreso, resto, deGrupos } = buildLista();
      const hayQuery = query.trim() !== '';
      const fProgreso = filtered(enProgreso);
      const fResto    = filtered(resto);
      const fGrupos   = filtered(deGrupos);

      let html = `
        <div class="bs-card">
          <div class="bs-handle"></div>
          <div class="bs-header">
            <div class="bs-title">${label}</div>
            <button class="bs-close-btn">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
              </svg>
            </button>
          </div>
          <div class="tp-search-wrap">
            <span class="tp-search-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <circle cx="11" cy="11" r="8" stroke="currentColor" stroke-width="2"/>
                <path d="m21 21-4.35-4.35" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </span>
            <input class="tp-search-input" type="text" placeholder="Buscar por número..." value="${query}" autocomplete="off" inputmode="numeric">
          </div>
          <div class="tp-list">`;

      // ── En progreso ──
      if (fProgreso.length > 0) {
        html += `<div class="tp-section-title">⟳ En progreso</div>`;
        fProgreso.forEach(t => { html += itemHTML(t); });
        html += `<div class="tp-divider"></div>`;
      }

      // ── Propios ──
      if (!hayQuery && grupo === 'C') html += `<div class="tp-section-title">Congregación</div>`;
      if (fResto.length === 0 && fProgreso.length === 0 && !hayQuery) {
        html += `<div class="tp-empty">Sin territorios disponibles</div>`;
      } else {
        fResto.forEach(t => { html += itemHTML(t); });
      }

      // ── Territorios de grupos (solo Congregación) ──
      if (grupo === 'C') {
        if (hayQuery) {
          if (fGrupos.length > 0) {
            html += `<div class="tp-divider"></div>`;
            html += `<div class="tp-section-title">Grupos 1–4</div>`;
            fGrupos.forEach(t => {
              const diasLabel = t.dias >= 9999 ? 'sin reg.' : `${t.dias}d`;
              const sub = `Grupo ${t.grupo} · ${t.enProgreso ? '<span style="color:#5DCAA5;">en progreso</span>' : diasLabel}`;
              html += itemHTML(t, sub);
            });
          } else if (fResto.length === 0 && fProgreso.length === 0) {
            html += `<div class="tp-empty">Sin resultados para "${query}"</div>`;
          }
        } else {
          html += `<div class="tp-divider"></div>`;
          if (!gruposExpanded) {
            html += `<button class="tp-expand-btn" id="tp-expand-grupos">
              <span>Ver territorios de grupos</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>`;
          } else {
            html += `<button class="tp-expand-btn expanded" id="tp-expand-grupos">
              <span>Ocultar territorios de grupos</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M18 15l-6-6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>`;
            [1,2,3,4].forEach(g => {
              const lista = deGrupos.filter(t => t.grupo === g);
              if (lista.length === 0) return;
              html += `<div class="tp-section-title" style="color:#555;">Grupo ${g}</div>`;
              lista.forEach(t => {
                const diasLabel = t.dias >= 9999 ? 'sin reg.' : `${t.dias}d · ${t.lastDate ? t.lastDate.split('-').slice(1).reverse().join('/') : '—'}`;
                const sub = t.enProgreso ? '<span style="color:#5DCAA5;">⟳ En progreso</span>' : diasLabel;
                html += itemHTML(t, sub);
              });
            });
          }
        }
      }

      if (hayQuery && fProgreso.length === 0 && fResto.length === 0 && (grupo !== 'C' || fGrupos.length === 0)) {
        html += `<div class="tp-empty">Sin resultados para "${query}"</div>`;
      }

      html += `</div></div>`;
      overlay.innerHTML = html;

      const searchInput = overlay.querySelector('.tp-search-input');
      searchInput.addEventListener('input', e => { query = e.target.value; render(); });
      setTimeout(() => searchInput.focus(), 80);

      const expandBtn = overlay.querySelector('#tp-expand-grupos');
      if (expandBtn) expandBtn.onclick = () => { gruposExpanded = !gruposExpanded; render(); };

      overlay.querySelectorAll('.tp-item').forEach(btn => {
        btn.onclick = () => { overlay.remove(); resolve(btn.dataset.terr); };
      });

      overlay.querySelector('.bs-close-btn').onclick = () => { overlay.remove(); resolve(null); };
      overlay.addEventListener('click', e => { if (e.target === overlay) { overlay.remove(); resolve(null); } });
    }
    render();
  });
};

/* ─────────────────────────────────────────
   HELPER: upgrade inputs date/time/select en DOM
───────────────────────────────────────── */
window.upgradeInputs = function(container) {
  container = container || document;

  // ── DATE inputs ──
  container.querySelectorAll('input[type="date"]').forEach(input => {
    if (input.dataset.upgraded) return;
    input.dataset.upgraded = 'true';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ui-fake-input' + (input.value ? '' : ' empty');
    function updateBtn() {
      const v = input.value;
      if (v) {
        const d = new Date(v + 'T00:00:00');
        const days = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'][d.getDay()];
        const fmtd = `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getFullYear()).slice(-2)}`;
        btn.innerHTML = `<span class="ui-fake-input-icon">📅</span><span style="color:#eee;">${days} ${fmtd}</span>`;
        btn.classList.remove('empty');
      } else {
        btn.innerHTML = `<span class="ui-fake-input-icon">📅</span><span>Elegir fecha</span>`;
        btn.classList.add('empty');
      }
    }
    updateBtn();
    btn.onclick = async () => {
      const result = await uiDatePicker({ value: input.value, min: input.min || null });
      if (result !== null) { input.value = result; input.dispatchEvent(new Event('change',{bubbles:true})); updateBtn(); }
    };
    input.addEventListener('change', updateBtn);
    input.style.display = 'none';
    input.insertAdjacentElement('afterend', btn);
  });

  // ── TIME inputs ──
  container.querySelectorAll('input[type="time"]').forEach(input => {
    if (input.dataset.upgraded) return;
    input.dataset.upgraded = 'true';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ui-fake-input' + (input.value ? '' : ' empty');
    function updateBtn() {
      const v = input.value;
      if (v) {
        btn.innerHTML = `<span class="ui-fake-input-icon">🕐</span><span style="color:#eee;">${v}</span>`;
        btn.classList.remove('empty');
      } else {
        btn.innerHTML = `<span class="ui-fake-input-icon">🕐</span><span>Elegir hora</span>`;
        btn.classList.add('empty');
      }
    }
    updateBtn();
    btn.onclick = async () => {
      const result = await uiTimePicker({ value: input.value });
      if (result !== null) { input.value = result; input.dispatchEvent(new Event('change',{bubbles:true})); updateBtn(); }
    };
    input.addEventListener('change', updateBtn);
    input.style.display = 'none';
    input.insertAdjacentElement('afterend', btn);
  });

  // ── SELECT de conductor (los que tienen id que empieza con sal-cond- o reg-cond-) ──
  container.querySelectorAll('select[id^="sal-cond-"], select[id^="reg-cond-"], select[id^="edit-cond"]').forEach(select => {
    if (select.dataset.upgraded) return;
    // Solo si es un <select> (no el input de texto del modal de historial)
    if (select.tagName !== 'SELECT') return;
    select.dataset.upgraded = 'true';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ui-fake-input' + (select.value ? '' : ' empty');

    function updateBtn() {
      const v = select.value;
      if (v) {
        btn.innerHTML = `<span class="ui-fake-input-icon">👤</span><span style="color:#eee;">${v}</span>`;
        btn.classList.remove('empty');
      } else {
        btn.innerHTML = `<span class="ui-fake-input-icon">👤</span><span>Elegir conductor</span>`;
        btn.classList.add('empty');
      }
    }
    updateBtn();

    btn.onclick = async () => {
      // Obtener opciones del select (excluye la primera vacía)
      const conductores = [...select.options]
        .filter(o => o.value)
        .map(o => o.value);
      const result = await uiConductorPicker({
        conductores,
        value: select.value,
        label: 'Elegir conductor'
      });
      if (result !== null) {
        select.value = result;
        select.dispatchEvent(new Event('change', { bubbles: true }));
        updateBtn();
      }
    };

    select.style.display = 'none';
    select.insertAdjacentElement('afterend', btn);
  });
};

/* ─────────────────────────────────────────
   AUTO-UPGRADE al cargar
───────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => upgradeInputs(document));

const _uiObserver = new MutationObserver(mutations => {
  mutations.forEach(m => {
    m.addedNodes.forEach(node => {
      if (node.nodeType !== 1) return;
      upgradeInputs(node);
    });
  });
});
_uiObserver.observe(document.body, { childList: true, subtree: true });

/* ─────────────────────────────────────────
   AUTO-APPLY cs-home-body + cs-module-cover
───────────────────────────────────────── */
(function() {
  function applyBg() {
    document.body.classList.add('cs-home-body');
  }
  if (document.body) applyBg();
  else document.addEventListener('DOMContentLoaded', applyBg);
})();

/* ─────────────────────────────────────────
   CSS MÓDULOS (covers de territorios/asignaciones)
───────────────────────────────────────── */
(function injectModuleCSS() {
  const style = document.createElement('style');
  style.textContent = `
.cs-module-cover {
  min-height: calc(100vh - 2rem);
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  gap: 10px; padding: 2rem 1rem;
  max-width: 340px; margin: 0 auto;
}
.cs-module-icon-wrap {
  width: 80px; height: 80px; border-radius: 24px;
  display: flex; align-items: center; justify-content: center;
  margin-bottom: 4px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.4);
}
.cs-module-title {
  font-size: 48px; font-weight: 700; color: #efefef;
  letter-spacing: -0.5px; line-height: 1; text-align: center;
}
.cs-module-sub  { font-size: 15px; font-weight: 500; text-align: center; margin-bottom: 2px; }
.cs-module-label { font-size: 13px; color: #666; text-align: center; }
.cs-module-card {
  width: 100%; background: #232628;
  border: 1px solid #2e3033; border-radius: 18px;
  padding: 1rem 1.25rem; cursor: pointer; text-align: left;
  display: flex; align-items: center; gap: 14px;
  transition: border-color 0.18s, background 0.18s, transform 0.1s, box-shadow 0.18s;
  text-decoration: none; color: inherit;
  box-shadow: 0 2px 12px rgba(0,0,0,0.25); outline: none;
}
.cs-module-card:hover {
  border-color: var(--card-hover-border, #3a3a3a);
  background: var(--card-hover-bg, #272a2d);
  transform: translateY(-1px);
  box-shadow: 0 6px 24px rgba(0,0,0,0.35);
}
.cs-module-card:active { transform: scale(0.98); box-shadow: none; }
.cs-module-card-icon {
  width: 44px; height: 44px; border-radius: 13px;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.cs-module-card-title { font-size: 16px; font-weight: 600; color: #e8e8e8; margin-bottom: 2px; }
.cs-module-card-sub   { font-size: 13px; color: #666; }
`;
  document.head.appendChild(style);
})();
