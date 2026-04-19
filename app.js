'use strict';

window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); });

const RICKROLL_URL   = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
const DEV_MODE       = false;
const PRIZE_DELAY_MS = DEV_MODE ? 10 * 1000 : 6 * 60 * 60 * 1000;

if (location.search.includes('reset')) { localStorage.clear(); location.replace(location.pathname); }

let countdownInterval = null;

function isInAppBrowser() {
  const ua = navigator.userAgent || '';
  return /FBAN|FBAV|Instagram|Messenger|Twitter|Line\/|TikTok|Snapchat|LinkedIn|Pinterest|WeChat|MicroMessenger/.test(ua)
    || (typeof window.webkit !== 'undefined' && /iphone|ipad/i.test(ua) && !/safari/i.test(ua));
}

function showInAppBrowserWall(url) {
  document.body.innerHTML = '<div style="min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:32px 24px;background:#0a0a0a;color:#fff;text-align:center;font-family:-apple-system,sans-serif"><div style="font-size:3rem;margin-bottom:16px">&#128274;</div><h2 style="font-size:1.4rem;font-weight:800;margin-bottom:10px">Mo bang Chrome de xem qua</h2><p style="color:#888;line-height:1.7;margin-bottom:24px">Copy link roi dan vao <strong style="color:#fff">Chrome</strong></p><div style="background:#1a1a1a;border-radius:14px;padding:16px;width:100%;max-width:340px"><div style="background:#252525;border-radius:8px;padding:10px 12px;font-size:0.78rem;color:#e1306c;word-break:break-all;margin-bottom:10px">' + url + '</div><button onclick="navigator.clipboard.writeText(this.dataset.url).then(()=>this.textContent=String.fromCodePoint(9989)+\' Copy!\').catch(()=>{})" data-url="' + url + '" style="width:100%;padding:12px;background:linear-gradient(135deg,#f09433,#dc2743,#bc1888);border:none;border-radius:50px;color:#fff;font-weight:700;font-size:1rem;cursor:pointer">Copy Link</button></div></div>';
}

function openGiftBox(prizeAt) {
  const box  = document.getElementById('giftbox');
  const hint = document.getElementById('gift-hint');
  if (box.classList.contains('opened')) return;
  if (navigator.vibrate) navigator.vibrate([40, 20, 80]);
  spawnSparkles(box);
  box.classList.add('opened');
  if (hint) hint.style.opacity = '0';
  if (countdownInterval) clearInterval(countdownInterval);
  tickCountdown(prizeAt);
  countdownInterval = setInterval(() => tickCountdown(prizeAt), 1000);
}

function spawnSparkles(el) {
  const rect   = el.getBoundingClientRect();
  const cx     = rect.left + rect.width  / 2;
  const cy     = rect.top  + rect.height / 2;
  const colors = ['#f09433','#dc2743','#bc1888','#ffd700','#ffffff','#ff6b9d','#a855f7'];
  for (let i = 0; i < 22; i++) {
    const s     = document.createElement('div');
    s.className = 'sparkle';
    const angle = (i / 22) * 2 * Math.PI + Math.random() * 0.5;
    const dist  = 70 + Math.random() * 140;
    const size  = 6 + Math.random() * 10;
    const dur   = (0.65 + Math.random() * 0.5).toFixed(2);
    s.style.cssText = 'left:' + (cx-size/2).toFixed(1) + 'px;top:' + (cy-size/2).toFixed(1) + 'px;width:' + size.toFixed(1) + 'px;height:' + size.toFixed(1) + 'px;background:' + colors[i%colors.length] + ';--tx:' + (Math.cos(angle)*dist).toFixed(1) + 'px;--ty:' + (Math.sin(angle)*dist).toFixed(1) + 'px;--dur:' + dur + 's;animation-delay:' + (Math.random()*0.12).toFixed(2) + 's';
    document.body.appendChild(s);
    setTimeout(() => s.remove(), (+dur + 0.2) * 1000);
  }
}

function tickCountdown(prizeAt) {
  const rem = prizeAt - Date.now();
  const el  = document.getElementById('countdown');
  const msg = document.getElementById('inner-msg');
  const btn = document.getElementById('btn-prize');
  if (rem <= 0) {
    el.textContent = '';
    if (msg) msg.textContent = '';
    if (btn) btn.classList.remove('hidden');
    clearInterval(countdownInterval);
    return;
  }
  const h = Math.floor(rem / 3600000).toString().padStart(2, '0');
  const m = Math.floor((rem % 3600000) / 60000).toString().padStart(2, '0');
  const s = Math.floor((rem % 60000)   / 1000).toString().padStart(2, '0');
  el.textContent = h + ':' + m + ':' + s;
  if (msg && !msg.textContent) msg.textContent = 'Quà sẽ xuất hiện tại đây ⬇️';
}

document.addEventListener('DOMContentLoaded', () => {
  if (isInAppBrowser()) { showInAppBrowserWall(location.href); return; }
  const prizeBtn = document.getElementById('btn-prize');
  prizeBtn.addEventListener('click', () => { location.href = RICKROLL_URL; });
  const saved = localStorage.getItem('prizeAt');
  if (saved) { requestAnimationFrame(() => openGiftBox(parseInt(saved, 10))); return; }
  document.getElementById('giftbox').addEventListener('click', () => {
    if (document.getElementById('giftbox').classList.contains('opened')) return;
    const prizeAt = Date.now() + PRIZE_DELAY_MS;
    localStorage.setItem('prizeAt', String(prizeAt));
    openGiftBox(prizeAt);
  });
});