'use strict';

// ══════════════════════════════════════════════════════════════════
//  CONFIG  —  Replace these values before deploying
// ══════════════════════════════════════════════════════════════════
const ONESIGNAL_APP_ID      = 'f9a948e0-79d4-46d7-9fae-6edb3f2b361d';
const CLOUDFLARE_WORKER_URL = 'https://rickroll-scheduler.vlantoy.workers.dev';

// ── DEV MODE ─────────────────────────────────────────────────────
const DEV_MODE = true;
// ══════════════════════════════════════════════════════════════════

const GAME_DURATION  = 10;
const PRIZE_DELAY_MS = DEV_MODE ? 3 * 1000 : 6 * 60 * 60 * 1000;    // 3s (dev) hoặc 6h (prod)

// ── State ─────────────────────────────────────────────────────────
let currentState      = 'intro';
let clickCount        = 0;
let timeLeft          = GAME_DURATION;
let timerInterval     = null;
let countdownInterval = null;

// ── OneSignal init ────────────────────────────────────────────────
window.OneSignalDeferred = window.OneSignalDeferred || [];
OneSignalDeferred.push(async function (OneSignal) {
  await OneSignal.init({
    appId: ONESIGNAL_APP_ID,
    serviceWorkerPath: 'OneSignalSDKWorker.js',
    notifyButton: { enable: false },
    allowLocalhostAsSecureOrigin: true,
  });
});

// ── Screen helper ─────────────────────────────────────────────────
// Xóa localStorage nếu có ?reset trong URL
if (location.search.includes('reset')) { localStorage.clear(); location.replace(location.pathname); }

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

// ── Game ──────────────────────────────────────────────────────────
function startGame() {
  currentState = 'game';
  clickCount   = 0;
  timeLeft     = GAME_DURATION;
  showScreen('screen-game');
  renderGame();

  timerInterval = setInterval(() => {
    timeLeft -= 1;
    renderGame();
    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      timerInterval = null;
      endGame();
    }
  }, 1000);
}

function renderGame() {
  document.getElementById('time-left').textContent   = timeLeft;
  document.getElementById('click-count').textContent = clickCount;
  const pct = ((GAME_DURATION - timeLeft) / GAME_DURATION) * 100;
  document.getElementById('timer-bar').style.width   = pct + '%';
}

function handleGameTap() {
  if (currentState !== 'game') return;
  clickCount += 1;
  renderGame();

  const btn = document.getElementById('game-btn');
  btn.classList.add('clicked');
  // Remove via requestAnimationFrame for snappiest feel
  requestAnimationFrame(() => requestAnimationFrame(() => btn.classList.remove('clicked')));
}

function endGame() {
  currentState = 'result';
  localStorage.setItem('lastScore', String(clickCount));

  const tiers = [
    [0,   30,  '🐢 Chậm như rùa, nhưng vẫn ổn!'],
    [30,  60,  '👍 Không tệ chút nào'],
    [60,  90,  '⚡ Phản xạ siêu nhanh!'],
    [90,  130, '🔥 Bạn là siêu nhân!'],
    [130, Infinity, '💀 Ngón tay bất tử???'],
  ];
  const [,, rating] = tiers.find(([lo, hi]) => clickCount >= lo && clickCount < hi);

  document.getElementById('final-score').textContent = clickCount;
  document.getElementById('rating').textContent       = rating;
  showScreen('screen-result');
}

// ── Notification flow ─────────────────────────────────────────────
async function requestNotificationPermission() {
  const box      = document.getElementById('giftbox');
  const statusEl = document.getElementById('gift-status');
  const deniedEl = document.getElementById('gift-denied');
  const errorEl  = document.getElementById('error-msg');

  box.classList.add('is-loading');
  deniedEl.classList.add('hidden');
  errorEl.classList.add('hidden');
  statusEl.textContent = '⏳ Đang đăng ký thông báo...';
  statusEl.classList.remove('hidden');

  try {
    if (!('Notification' in window) || !('serviceWorker' in navigator))
      throw new Error('Hãy dùng Chrome để nhận thông báo.');

    if (Notification.permission === 'denied') {
      box.classList.remove('is-loading');
      statusEl.classList.add('hidden');
      deniedEl.classList.remove('hidden');
      return;
    }

    await callOneSignal((OS) => OS.User.PushSubscription.optIn());

    statusEl.textContent = '⏳ Đang xác nhận...';
    let playerId = null;
    for (let i = 0; i < 20; i++) {
      playerId = await callOneSignal((OS) => OS.User.PushSubscription.id);
      if (playerId) break;
      await new Promise(r => setTimeout(r, 1000));
    }
    if (!playerId) throw new Error('Không lấy được ID. Thử lại!');

    statusEl.textContent = '⏳ Đang lên lịch...';
    const sendAt = Date.now() + PRIZE_DELAY_MS;

    let workerRes;
    try {
      workerRes = await fetch(`${CLOUDFLARE_WORKER_URL}/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId, sendAt }),
      });
    } catch (fetchErr) {
      throw new Error(`Không kết nối được: ${fetchErr.message}`);
    }
    if (!workerRes.ok) {
      const txt = await workerRes.text().catch(() => '');
      throw new Error(`Lỗi ${workerRes.status}: ${txt}`);
    }

    localStorage.setItem('prizeAt', String(sendAt));
    statusEl.classList.add('hidden');
    document.getElementById('gift-hint').style.opacity = '0';
    openGiftBox(sendAt);

  } catch (err) {
    console.error('[Permission]', err);
    box.classList.remove('is-loading');
    statusEl.classList.add('hidden');
    if (typeof Notification !== 'undefined' && Notification.permission === 'denied') {
      deniedEl.classList.remove('hidden');
    } else {
      errorEl.textContent = '⚠️ ' + err.message;
      errorEl.classList.remove('hidden');
    }
  }
}

/** Safely queues a callback into OneSignalDeferred and returns a Promise. */
function callOneSignal(fn) {
  return new Promise((resolve, reject) => {
    OneSignalDeferred.push(async (OS) => {
      try { resolve(await fn(OS)); }
      catch (e) { reject(e); }
    });
  });
}

// ── Gift box open + sparkles ──────────────────────────────────────
function openGiftBox(sendAt) {
  const box = document.getElementById('giftbox');
  if (box.classList.contains('opened')) return;
  if (navigator.vibrate) navigator.vibrate([40, 20, 80]);
  spawnSparkles(box);
  box.classList.remove('is-loading');
  box.classList.add('opened');
  if (countdownInterval) clearInterval(countdownInterval);
  tickCountdown(sendAt);
  countdownInterval = setInterval(() => tickCountdown(sendAt), 1000);
}

function spawnSparkles(el) {
  const rect = el.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top  + rect.height / 2;
  const colors = ['#f09433','#dc2743','#bc1888','#ffd700','#ffffff','#ff6b9d','#a855f7'];
  for (let i = 0; i < 20; i++) {
    const s = document.createElement('div');
    s.className = 'sparkle';
    const angle = (i / 20) * 2 * Math.PI + Math.random() * 0.5;
    const dist  = 70 + Math.random() * 140;
    const size  = 6 + Math.random() * 10;
    const dur   = (0.65 + Math.random() * 0.5).toFixed(2);
    s.style.cssText = `left:${(cx-size/2).toFixed(1)}px;top:${(cy-size/2).toFixed(1)}px;width:${size.toFixed(1)}px;height:${size.toFixed(1)}px;background:${colors[i%colors.length]};--tx:${(Math.cos(angle)*dist).toFixed(1)}px;--ty:${(Math.sin(angle)*dist).toFixed(1)}px;--dur:${dur}s;animation-delay:${(Math.random()*0.12).toFixed(2)}s`;
    document.body.appendChild(s);
    setTimeout(() => s.remove(), (+dur + 0.2) * 1000);
  }
}

function tickCountdown(sendAt) {
  const rem = sendAt - Date.now();
  const el  = document.getElementById('countdown');
  const msg = document.getElementById('success-msg');

  if (rem <= 0) {
    el.textContent = '🎉';
    if (msg) msg.textContent = 'Kiểm tra thông báo!';
    clearInterval(countdownInterval);
    return;
  }

  const h = Math.floor(rem / 3_600_000).toString().padStart(2, '0');
  const m = Math.floor((rem % 3_600_000) / 60_000).toString().padStart(2, '0');
  const s = Math.floor((rem % 60_000)    / 1_000).toString().padStart(2, '0');
  el.textContent = `${h}:${m}:${s}`;
  if (msg && !msg.textContent) msg.textContent = 'Giữ thông báo bật nhé 😄';
}


// ── In-app browser detection ────────────────────────────────────
function isInAppBrowser() {
  const ua = navigator.userAgent || '';
  return /FBAN|FBAV|Instagram|Messenger|Twitter|Line\/|TikTok|Snapchat|LinkedIn|Pinterest|WeChat|MicroMessenger/.test(ua)
    || (typeof window.webkit !== 'undefined' && /iphone|ipad/i.test(ua) && !/safari/i.test(ua));
}

function showInAppBrowserWall(currentUrl) {
  document.body.innerHTML = `
    <div style="
      min-height:100vh; display:flex; flex-direction:column;
      align-items:center; justify-content:center; padding:32px 24px;
      background:#0a0a0a; color:#fff; text-align:center; font-family:-apple-system,sans-serif;
    ">
      <div style="font-size:3.5rem;margin-bottom:16px">🔒</div>
      <h2 style="font-size:1.5rem;font-weight:800;margin-bottom:12px">Cần mở bằng trình duyệt thật</h2>
      <p style="color:#888;line-height:1.7;margin-bottom:28px">
        Trang này không hoạt động trong trình duyệt của Messenger / Instagram.<br>
        Vui lòng mở bằng <strong style="color:#fff">Safari</strong> hoặc <strong style="color:#fff">Chrome</strong>.
      </p>
      <div style="background:#1a1a1a;border-radius:16px;padding:20px;width:100%;max-width:340px;margin-bottom:24px">
        <p style="font-size:0.85rem;color:#aaa;margin-bottom:12px">📋 Copy link rồi dán vào Safari/Chrome:</p>
        <div style="
          background:#252525;border-radius:10px;padding:12px 14px;
          font-size:0.8rem;color:#e1306c;word-break:break-all;margin-bottom:12px
        ">${currentUrl}</div>
        <button onclick="navigator.clipboard.writeText('${currentUrl}').then(()=>this.textContent='✅ Đã copy!').catch(()=>{})" style="
          width:100%;padding:13px;background:linear-gradient(135deg,#f09433,#dc2743,#bc1888);
          border:none;border-radius:50px;color:#fff;font-weight:700;font-size:1rem;cursor:pointer
        ">Copy Link 📋</button>
      </div>
      <p style="font-size:0.8rem;color:#555">
        iOS: Safari → dán link vào thanh địa chỉ<br>
        Android: Chrome → dán link vào thanh địa chỉ
      </p>
    </div>
  `;
}

// ── Bootstrap ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Block in-app browsers immediately
  if (isInAppBrowser()) {
    showInAppBrowserWall(location.href);
    return;
  }

  // Nếu notification bị tắt thì xóa prizeAt — bắt đăng ký lại
  if (typeof Notification !== 'undefined' && Notification.permission === 'denied') {
    localStorage.removeItem('prizeAt');
  }

  // Restore: đã đăng ký → thẳng vào màn hộp quà đã mở
  const savedPrizeAt = localStorage.getItem('prizeAt');
  if (savedPrizeAt && Date.now() < parseInt(savedPrizeAt, 10)) {
    showScreen('screen-gift');
    requestAnimationFrame(() => openGiftBox(parseInt(savedPrizeAt, 10)));
    return;
  }

  // Intro
  document.getElementById('btn-start').addEventListener('click', startGame);

  // Game button
  const gameBtn = document.getElementById('game-btn');
  gameBtn.addEventListener('click', handleGameTap);
  gameBtn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    handleGameTap();
  }, { passive: false });

  // Result → gift screen
  document.getElementById('btn-get-prize').addEventListener('click', () => {
    currentState = 'gift';
    showScreen('screen-gift');
    if (typeof Notification !== 'undefined' && Notification.permission === 'denied') {
      document.getElementById('gift-denied').classList.remove('hidden');
      document.getElementById('gift-hint').style.opacity = '0';
    }
  });
  document.getElementById('btn-retry').addEventListener('click', () => {
    localStorage.removeItem('prizeAt');
    startGame();
  });

  // Gift box click → trigger notification subscription
  const giftbox = document.getElementById('giftbox');
  giftbox.addEventListener('click', () => {
    if (giftbox.classList.contains('opened') || giftbox.classList.contains('is-loading')) return;
    requestNotificationPermission();
  });

  // Retry after manually enabling notifications
  document.getElementById('btn-retry-notif').addEventListener('click', () => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'denied') {
      document.getElementById('gift-denied').classList.remove('hidden');
      return;
    }
    document.getElementById('gift-denied').classList.add('hidden');
    requestNotificationPermission();
  });
});
