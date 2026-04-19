'use strict';

// ══════════════════════════════════════════════════════════════════
//  CONFIG  —  Replace these values before deploying
// ══════════════════════════════════════════════════════════════════
const ONESIGNAL_APP_ID      = 'f9a948e0-79d4-46d7-9fae-6edb3f2b361d';
const CLOUDFLARE_WORKER_URL = 'https://rickroll-scheduler.vlantoy.workers.dev';

// ── DEV MODE ─────────────────────────────────────────────────────
const DEV_MODE = false;
// ══════════════════════════════════════════════════════════════════

const GAME_DURATION  = 10;
const PRIZE_DELAY_MS = DEV_MODE ? 5 * 1000 : 6 * 60 * 60 * 1000;    // 5s (dev) hoặc 6h (prod)

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
  const allowBtn = document.getElementById('btn-allow');
  const errorEl  = document.getElementById('error-msg');

  const setStatus = (msg) => { allowBtn.textContent = msg; };
  allowBtn.disabled = true;
  errorEl.classList.add('hidden');

  try {
    // Step 1: Check support
    setStatus('⏳ [1/4] Kiểm tra trình duyệt...');
    if (!('Notification' in window)) throw new Error('Trình duyệt này không hỗ trợ thông báo.');
    if (!('serviceWorker' in navigator)) throw new Error('Service Worker không được hỗ trợ. Hãy dùng Chrome.');

    // Step 2: Opt in qua OneSignal (tự xử lý cả permission + push subscription)
    setStatus('⏳ [2/4] Đăng ký thông báo...');
    await callOneSignal((OS) => OS.User.PushSubscription.optIn());

    // Step 3: Poll chờ subscription ID (optIn async, mất vài giây)
    setStatus('⏳ [3/4] Lấy subscription ID...');
    let playerId = null;
    for (let i = 0; i < 20; i++) {
      playerId = await callOneSignal((OS) => OS.User.PushSubscription.id);
      if (playerId) break;
      await new Promise(r => setTimeout(r, 1000));
    }
    if (!playerId) throw new Error('Không lấy được subscription ID sau 20s. Thử reset permission trong Chrome Settings rồi thử lại.');

    // Step 4: Schedule qua Cloudflare Worker (proxy tránh CORS block của OneSignal)
    setStatus('⏳ [4/4] Lên lịch thông báo...');
    const sendAt = Date.now() + PRIZE_DELAY_MS;

    let workerRes;
    try {
      workerRes = await fetch(`${CLOUDFLARE_WORKER_URL}/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId, sendAt }),
      });
    } catch (fetchErr) {
      throw new Error(`Không kết nối được Worker: ${fetchErr.message}`);
    }
    if (!workerRes.ok) {
      const txt = await workerRes.text().catch(() => '');
      throw new Error(`Worker lỗi ${workerRes.status}: ${txt}`);
    }

    localStorage.setItem('prizeAt', String(sendAt));
    showSuccessScreen(sendAt);

  } catch (err) {
    console.error('[Permission]', err);
    errorEl.textContent = '⚠️ ' + err.message;
    errorEl.classList.remove('hidden');
    allowBtn.disabled    = false;
    allowBtn.textContent = 'Thử Lại 🔔';
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

// ── Countdown ─────────────────────────────────────────────────────
function showSuccessScreen(sendAt) {
  currentState = 'success';
  showScreen('screen-success');
  if (countdownInterval) clearInterval(countdownInterval);
  tickCountdown(sendAt);
  countdownInterval = setInterval(() => tickCountdown(sendAt), 1000);
}

function tickCountdown(sendAt) {
  const rem = sendAt - Date.now();
  const el  = document.getElementById('countdown');
  const msg = document.getElementById('success-msg');

  if (rem <= 0) {
    el.textContent  = '00:00:00';
    msg.textContent = '🎁 Phần thưởng đã được gửi! Kiểm tra thông báo nhé.';
    clearInterval(countdownInterval);
    return;
  }

  const h = Math.floor(rem / 3_600_000).toString().padStart(2, '0');
  const m = Math.floor((rem % 3_600_000) / 60_000).toString().padStart(2, '0');
  const s = Math.floor((rem % 60_000)    / 1_000).toString().padStart(2, '0');
  el.textContent = `${h}:${m}:${s}`;
}

// ── Share ─────────────────────────────────────────────────────────
function shareChallenge() {
  const score = localStorage.getItem('lastScore') ?? '??';
  const text  = `Tao vừa click được ${score} lần trong 10 giây! 😤 Thử xem mày có hơn không?`;
  if (navigator.share) {
    navigator.share({ title: 'Thử Thách Phản Xạ', text, url: location.href }).catch(() => {});
  } else {
    navigator.clipboard.writeText(location.href)
      .then(() => alert('Đã copy link!'))
      .catch(() => alert(location.href));
  }
}

// ── Show iOS tip if needed ────────────────────────────────────────
function maybeShowIosTip() {
  const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isStandalone = window.navigator.standalone === true;
  if (isIos && !isStandalone) {
    document.getElementById('ios-tip').style.display = '';
  }
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

  // Restore state if user already registered (page refresh / revisit)
  const savedPrizeAt = localStorage.getItem('prizeAt');
  if (savedPrizeAt && Date.now() < parseInt(savedPrizeAt, 10)) {
    showSuccessScreen(parseInt(savedPrizeAt, 10));
    return;
  }

  // Intro
  document.getElementById('btn-start').addEventListener('click', startGame);

  // Game button — handle both touch (mobile) and click (desktop)
  const gameBtn = document.getElementById('game-btn');
  gameBtn.addEventListener('click', handleGameTap);
  gameBtn.addEventListener('touchstart', (e) => {
    e.preventDefault(); // kill 300ms delay & prevent ghost click
    handleGameTap();
  }, { passive: false });

  // Result
  document.getElementById('btn-get-prize').addEventListener('click', () => {
    maybeShowIosTip();
    currentState = 'notify';
    showScreen('screen-notify');
  });
  document.getElementById('btn-retry').addEventListener('click', () => {
    localStorage.removeItem('prizeAt');
    startGame();
  });

  // Notification permission
  document.getElementById('btn-allow').addEventListener('click', requestNotificationPermission);
  document.getElementById('btn-skip').addEventListener('click', () => showScreen('screen-intro'));

  // Success
  document.getElementById('btn-share').addEventListener('click', shareChallenge);
});
