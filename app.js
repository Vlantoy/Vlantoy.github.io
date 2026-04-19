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

function openGiftBox(prizeAt, skipAnim) {
  const box  = document.getElementById('giftbox');
  const hint = document.getElementById('gift-hint');
  if (box.classList.contains('opened') || box.classList.contains('is-opening')) return;
  if (hint) hint.style.opacity = '0';

  if (skipAnim) {
    box.classList.add('opened');
    if (countdownInterval) clearInterval(countdownInterval);
    tickCountdown(prizeAt);
    countdownInterval = setInterval(() => tickCountdown(prizeAt), 1000);
    return;
  }

  // ——— Chương trình animation ~3.5 giây ———
  box.classList.add('is-opening');
  if (navigator.vibrate) navigator.vibrate([20, 40, 20, 40, 80]);

  // Phase 1 (0ms): Rung lắc
  box.classList.add('shaking');

  // Phase 2 (450ms): Nắp bắt vào không trung
  setTimeout(() => {
    box.classList.remove('shaking');
    box.classList.add('lid-flying');
    spawnLightBeam(box);
    if (navigator.vibrate) navigator.vibrate([100]);
  }, 450);

  // Phase 3 (680ms): Shockwave + flash + bão sparkle 1
  setTimeout(() => {
    spawnShockwave(box);
    spawnScreenFlash();
    spawnSparkles(box, 30);
  }, 680);

  // Phase 4 (950ms): Thân hộp nảy + sparkle 2
  setTimeout(() => {
    box.classList.add('body-bouncing');
    spawnSparkles(box, 18);
    if (navigator.vibrate) navigator.vibrate([60]);
  }, 950);

  // Phase 5 (1100ms): Mưa giấy vụn
  setTimeout(() => spawnConfetti(50), 1100);

  // Phase 6 (1550ms): Sparkle 3
  setTimeout(() => spawnSparkles(box, 14), 1550);

  // Phase 7 (2300ms): Sparkle 4 nhỏ
  setTimeout(() => spawnSparkles(box, 8), 2300);

  // Final (3300ms): Hiện countdown
  setTimeout(() => {
    box.classList.remove('is-opening', 'lid-flying', 'body-bouncing');
    box.classList.add('opened');
    if (countdownInterval) clearInterval(countdownInterval);
    tickCountdown(prizeAt);
    countdownInterval = setInterval(() => tickCountdown(prizeAt), 1000);
  }, 3300);
}

function spawnSparkles(el, count) {
  count = count || 22;
  const rect   = el.getBoundingClientRect();
  const cx     = rect.left + rect.width  / 2;
  const cy     = rect.top  + rect.height / 2;
  const colors = ['#f09433','#dc2743','#bc1888','#ffd700','#ffffff','#ff6b9d','#a855f7'];
  for (let i = 0; i < count; i++) {
    const s     = document.createElement('div');
    s.className = 'sparkle';
    const angle = (i / count) * 2 * Math.PI + Math.random() * 0.6;
    const dist  = 60 + Math.random() * 160;
    const size  = 5 + Math.random() * 11;
    const dur   = (0.6 + Math.random() * 0.6).toFixed(2);
    s.style.cssText = 'left:' + (cx-size/2).toFixed(1) + 'px;top:' + (cy-size/2).toFixed(1) + 'px;width:' + size.toFixed(1) + 'px;height:' + size.toFixed(1) + 'px;background:' + colors[i%colors.length] + ';--tx:' + (Math.cos(angle)*dist).toFixed(1) + 'px;--ty:' + (Math.sin(angle)*dist).toFixed(1) + 'px;--dur:' + dur + 's;animation-delay:' + (Math.random()*0.1).toFixed(2) + 's';
    document.body.appendChild(s);
    setTimeout(() => s.remove(), (+dur + 0.3) * 1000);
  }
}

function spawnLightBeam(el) {
  const rect = el.getBoundingClientRect();
  const cx   = rect.left + rect.width / 2;
  const by   = rect.top + rect.height * 0.25;
  const beam = document.createElement('div');
  beam.className = 'light-beam';
  beam.style.cssText = 'left:' + cx + 'px;bottom:' + (window.innerHeight - by) + 'px;';
  document.body.appendChild(beam);
  setTimeout(() => beam.remove(), 1500);
}

function spawnShockwave(el) {
  const rect = el.getBoundingClientRect();
  const cx   = rect.left + rect.width  / 2;
  const cy   = rect.top  + rect.height / 2;
  [0, 220].forEach((delay, idx) => {
    setTimeout(() => {
      const w = document.createElement('div');
      w.className = 'shockwave';
      const sz = 80;
      w.style.cssText = 'left:' + cx + 'px;top:' + cy + 'px;width:' + sz + 'px;height:' + sz + 'px;' +
        'margin-left:-' + (sz/2) + 'px;margin-top:-' + (sz/2) + 'px;' +
        (idx === 1 ? 'border-color:rgba(188,24,136,0.8);animation-duration:1s;' : '');
      document.body.appendChild(w);
      setTimeout(() => w.remove(), idx === 1 ? 1100 : 950);
    }, delay);
  });
}

function spawnScreenFlash() {
  const f = document.createElement('div');
  f.className = 'screen-flash';
  document.body.appendChild(f);
  setTimeout(() => f.remove(), 750);
}

function spawnConfetti(count) {
  const colors = ['#f09433','#dc2743','#bc1888','#ffd700','#fff','#ff6b9d','#a855f7','#06b6d4','#22c55e'];
  for (let i = 0; i < count; i++) {
    const c    = document.createElement('div');
    c.className = 'confetti-piece';
    const size  = 5 + Math.random() * 9;
    const isRect = Math.random() > 0.45;
    const dur   = (2.8 + Math.random() * 2.2).toFixed(2);
    const delay = (Math.random() * 1.8).toFixed(2);
    const dx    = ((Math.random() - 0.5) * 120).toFixed(1);
    const rot   = Math.floor(Math.random() * 720 - 360) + 'deg';
    c.style.cssText = 'left:' + (Math.random() * 100).toFixed(1) + '%;' +
      'width:' + size.toFixed(1) + 'px;height:' + (isRect ? (size*0.45).toFixed(1) : size.toFixed(1)) + 'px;' +
      'background:' + colors[Math.floor(Math.random()*colors.length)] + ';' +
      'border-radius:' + (isRect ? '2px' : '50%') + ';' +
      '--dx:' + dx + 'px;--rot:' + rot + ';' +
      'animation-duration:' + dur + 's;animation-delay:' + delay + 's;';
    document.body.appendChild(c);
    setTimeout(() => c.remove(), (+dur + +delay + 0.5) * 1000);
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
  if (saved) { requestAnimationFrame(() => openGiftBox(parseInt(saved, 10), true)); return; }
  document.getElementById('giftbox').addEventListener('click', () => {
    if (document.getElementById('giftbox').classList.contains('opened')) return;
    const prizeAt = Date.now() + PRIZE_DELAY_MS;
    localStorage.setItem('prizeAt', String(prizeAt));
    openGiftBox(prizeAt);
  });
});